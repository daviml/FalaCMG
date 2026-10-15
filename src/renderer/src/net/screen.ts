import { platform } from '../platform'
import type { Room } from 'trystero/nostr'
import { SHARE_PRESETS, type SharePresetId } from '../state/settings'
import { ME, useStore } from '../state/store'

/*
 * Transmissão sob demanda (estilo Discord): quem transmite só envia vídeo para quem clicou em "Assistir".
 * Em malha P2P isso é o que mais economiza upload: cada espectador custa um envio separado.
 */

type Watch = { on: boolean }

let room: Room | null = null
let sendWatch: ((data: Watch, opts: { target: string }) => Promise<void>) | null = null
const watchers = new Set<string>()
let presetId: SharePresetId = '720p30'

export function attachRoom(r: Room): void {
  room = r
  watchers.clear()
  const watch = r.makeAction<Watch>('watch', {
    onMessage: (data, { peerId }) => (data.on ? addWatcher(peerId) : removeWatcher(peerId))
  })
  sendWatch = watch.send
}

export function detachRoom(): void {
  stopShare()
  room = null
  sendWatch = null
  watchers.clear()
}

export function handlePeerLeave(peerId: string): void {
  watchers.delete(peerId)
}

// ---------- Quem transmite ----------

/** source = fonte escolhida no nosso seletor (Windows); null = seletor do próprio navegador (web). */
export async function startShare(source: { id: string; name: string } | null, audio: boolean, preset: SharePresetId): Promise<void> {
  stopShare()
  presetId = preset
  const p = SHARE_PRESETS[preset]
  if (source) platform.screen.select(source.id, audio)
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: { ideal: p.fps, max: p.fps }, height: { max: p.height } },
    // restrictOwnAudio: o áudio do sistema vai sem as vozes que o próprio FalaCMG está tocando (sem eco para os amigos)
    audio: audio
      ? ({ restrictOwnAudio: true, echoCancellation: false, noiseSuppression: false, autoGainControl: false } as MediaTrackConstraints)
      : false,
    // Opções do Chrome/Edge: oferecer o som do sistema e não listar a própria aba do FalaCMG
    ...(platform.isWeb ? { systemAudio: audio ? 'include' : 'exclude', selfBrowserSurface: 'exclude', surfaceSwitching: 'include' } : {})
  } as DisplayMediaStreamOptions)

  const video = stream.getVideoTracks()[0]
  const name = source?.name ?? (video.label || 'Tela')
  video.contentHint = p.hint
  await video.applyConstraints({ frameRate: { max: p.fps }, height: { max: p.height } }).catch(() => {})
  for (const t of stream.getAudioTracks()) t.contentHint = 'music'
  // Janela fechada / monitor desconectado encerra a transmissão
  video.addEventListener('ended', () => {
    if (useStore.getState().myShare?.stream === stream) stopShare()
  })

  useStore.getState().patch({ myShare: { stream, name, audio: stream.getAudioTracks().length > 0 }, focused: ME })
}

export function stopShare(): void {
  const { myShare, focused, patch } = useStore.getState()
  if (!myShare) return
  for (const id of watchers) room?.removeStream(myShare.stream, { target: id })
  watchers.clear()
  myShare.stream.getTracks().forEach((t) => t.stop())
  patch({ myShare: null, focused: focused === ME ? null : focused })
}

function addWatcher(peerId: string): void {
  const share = useStore.getState().myShare
  if (!room || !share || watchers.has(peerId)) return
  watchers.add(peerId)
  const pending = room.addStream(share.stream, { target: peerId, metadata: { kind: 'screen' } })
  Promise.all(pending).then(() => tuneSender(peerId, share.stream)).catch((e) => console.warn('[screen] addStream', e))
}

function removeWatcher(peerId: string): void {
  const share = useStore.getState().myShare
  if (!watchers.delete(peerId) || !share) return
  room?.removeStream(share.stream, { target: peerId })
}

/** Limita bitrate/fps por espectador conforme a qualidade escolhida. */
async function tuneSender(peerId: string, stream: MediaStream): Promise<void> {
  const p = SHARE_PRESETS[presetId]
  const pending = new Set(stream.getTracks())
  // Os parâmetros só existem depois que a renegociação termina; tenta por até ~15 s
  for (let i = 0; i < 50 && pending.size && watchers.has(peerId); i++) {
    const pc = room?.getPeers()[peerId]
    for (const sender of pc?.getSenders() ?? []) {
      if (!sender.track || !pending.has(sender.track)) continue
      const params = sender.getParameters()
      if (!params.encodings?.length || !params.codecs?.length) continue
      if (sender.track.kind === 'video') {
        params.encodings[0].maxBitrate = p.bitrate
        params.encodings[0].maxFramerate = p.fps
        // Texto: segura a resolução; jogos: equilibra resolução e fluidez quando a banda aperta
        ;(params as RTCRtpSendParameters & { degradationPreference?: string }).degradationPreference =
          p.hint === 'detail' ? 'maintain-resolution' : 'balanced'
      } else {
        params.encodings[0].maxBitrate = 128_000
      }
      try {
        await sender.setParameters(params)
        pending.delete(sender.track)
      } catch (e) {
        console.warn('[screen] setParameters', (e as Error).message)
      }
    }
    if (pending.size) await new Promise((r) => setTimeout(r, 300))
  }
}

// ---------- Quem assiste ----------

export function watch(peerId: string): void {
  const st = useStore.getState()
  if (peerId in st.watching) return
  st.patch({ watching: { ...st.watching, [peerId]: null }, focused: peerId })
  sendWatch?.({ on: true }, { target: peerId })
}

export function unwatch(peerId: string, notify = true): void {
  const st = useStore.getState()
  if (!(peerId in st.watching)) return
  const { [peerId]: _, ...watching } = st.watching
  st.patch({ watching, focused: st.focused === peerId ? null : st.focused })
  if (notify) sendWatch?.({ on: false }, { target: peerId })
}

export function onRemoteScreen(peerId: string, stream: MediaStream): void {
  const st = useStore.getState()
  // Chegou vídeo sem eu ter pedido (ex.: pedido antigo): recusa
  if (!(peerId in st.watching)) {
    sendWatch?.({ on: false }, { target: peerId })
    return
  }
  st.patch({ watching: { ...st.watching, [peerId]: stream } })
}

// Quem parou de transmitir sai da lista de assistidos
useStore.subscribe((s, prev) => {
  if (s.peers === prev.peers) return
  for (const id of Object.keys(s.watching)) if (!s.peers[id]?.sharing) unwatch(id, false)
})

