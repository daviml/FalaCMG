import { platform } from '../platform'
import { joinRoom, selfId, type Room } from 'trystero/nostr'
import { useSettings, type SavedRoom } from '../state/settings'
import { useStore, type ChatImage, type ChatMessage } from '../state/store'
import { acquireMic, attachPeer, detachAll, detachPeer, outgoingStream, releaseMic, applyPeerVolume } from './audio'
import { sounds } from './sounds'
import { attachRoom, detachRoom, handlePeerLeave, onRemoteScreen } from './screen'
import { FalaPeerConnection } from './rtc'

// Prefixo que isola as salas do FalaCMG de outros apps que usam os mesmos relays
const APP_ID = 'falacmg-v1'
const MAX_IMAGE_BYTES = 8 * 1024 ** 2
const MAX_IMAGE_SIDE = 1920
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

type Presence = { nick: string; hue: number; muted: boolean; deafened: boolean; sharing: boolean }
type Chat = { text: string }
type ImageMeta = { mime: string; name: string; w: number; h: number }

let room: Room | null = null
let micHeld = false
let sendPresence: ((data: Presence, opts?: { target?: string }) => Promise<void>) | null = null
let sendChat: ((data: Chat) => Promise<void>) | null = null
let sendImage: ((data: ArrayBuffer, opts: { metadata: ImageMeta }) => Promise<void>) | null = null

const myPresence = (): Presence => {
  const { nick, hue } = useSettings.getState()
  const { muted, deafened, myShare } = useStore.getState()
  return { nick, hue, muted, deafened, sharing: !!myShare }
}

const clampHue = (h: unknown) => (typeof h === 'number' && Number.isFinite(h) ? Math.abs(Math.round(h)) % 360 : 0)

function pushMessage(msg: Omit<ChatMessage, 'id' | 'ts'>): void {
  useStore.getState().addMessage({ id: crypto.randomUUID(), ts: Date.now(), ...msg })
  if (!msg.mine && msg.kind === 'user') {
    if (!document.hasFocus()) {
      sounds.message()
      platform.flash()
    }
  }
}

function systemMessage(text: string): void {
  pushMessage({ kind: 'system', from: '', nick: '', hue: 0, text, mine: false })
}

function peerInfo(peerId: string) {
  const p = useStore.getState().peers[peerId]
  return { nick: p?.nick ?? '???', hue: p?.hue ?? 0 }
}

export function connect(target: SavedRoom): void {
  disconnect(false)
  const st = useStore.getState()
  st.setCurrent(target)
  if (!micHeld) {
    micHeld = true
    acquireMic()
  }

  const { turnUrl, turnUser, turnPass } = useSettings.getState()
  room = joinRoom(
    {
      appId: APP_ID,
      password: target.password || undefined,
      maxReceiveBytes: MAX_IMAGE_BYTES + 1024 ** 2,
      rtcPolyfill: FalaPeerConnection,
      turnConfig: turnUrl.trim() ? [{ urls: turnUrl.trim(), username: turnUser, credential: turnPass }] : undefined
    },
    target.name,
    { onJoinError: (e) => console.warn('[falacmg] falha ao conectar com peer', e) }
  )

  const presence = room.makeAction<Presence>('presence', {
    onMessage: (data, { peerId }) => {
      const s = useStore.getState()
      // Peer recém-conectado fica como "…" até mandar a primeira presença
      const isNew = (s.peers[peerId]?.nick ?? '…') === '…'
      const nick = String(data.nick ?? '').slice(0, 32) || '???'
      const wasSharing = !!s.peers[peerId]?.sharing
      const sharing = !!data.sharing
      s.upsertPeer({ id: peerId, nick, hue: clampHue(data.hue), muted: !!data.muted, deafened: !!data.deafened, sharing })
      if (isNew) systemMessage(`${nick} entrou na sala`)
      if (sharing && !wasSharing) systemMessage(`${nick} começou a transmitir a tela`)
      applyPeerVolume(peerId)
    }
  })
  const chat = room.makeAction<Chat>('chat', {
    onMessage: (data, { peerId }) => {
      const text = String(data.text ?? '').slice(0, 4000)
      if (text) pushMessage({ kind: 'user', from: peerId, ...peerInfo(peerId), text, mine: false })
    }
  })
  const image = room.makeAction<ArrayBuffer>('image', {
    onMessage: (data, { peerId, metadata }) => {
      const meta = (metadata ?? {}) as Partial<ImageMeta>
      const mime = String(meta.mime)
      if (!IMAGE_TYPES.includes(mime)) return
      const bytes = data instanceof ArrayBuffer ? data : (data as ArrayBufferView)
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }))
      const img: ChatImage = { url, name: String(meta.name ?? 'imagem').slice(0, 100), w: Number(meta.w) || 0, h: Number(meta.h) || 0 }
      pushMessage({ kind: 'user', from: peerId, ...peerInfo(peerId), text: '', image: img, mine: false })
    }
  })
  sendPresence = presence.send
  sendChat = chat.send
  sendImage = image.send as typeof sendImage
  attachRoom(room)

  room.onPeerJoin = (peerId) => {
    useStore.getState().upsertPeer({ id: peerId, nick: '…', hue: 0, muted: false, deafened: false, sharing: false })
    presence.send(myPresence(), { target: peerId })
    room?.addStream(outgoingStream(), { target: peerId, metadata: { kind: 'mic' } })
    sounds.join()
  }
  room.onPeerLeave = (peerId) => {
    const { nick } = peerInfo(peerId)
    detachPeer(peerId)
    handlePeerLeave(peerId)
    useStore.getState().removePeer(peerId)
    systemMessage(`${nick} saiu da sala`)
    sounds.leave()
  }
  room.onPeerStream = (stream, peerId, metadata) => {
    const kind = (metadata as { kind?: string } | undefined)?.kind
    if (kind === 'screen') onRemoteScreen(peerId, stream)
    else if (kind === 'mic' || stream.getVideoTracks().length === 0) attachPeer(peerId, stream)
  }

  sounds.selfJoin()
}

export function disconnect(full = true): void {
  detachRoom()
  if (room) {
    room.leave()
    sounds.leave()
  }
  room = null
  sendPresence = sendChat = sendImage = null
  detachAll()
  if (full) {
    if (micHeld) releaseMic()
    micHeld = false
    useStore.getState().setCurrent(null)
  }
}

export function sendMessage(text: string): void {
  const t = text.trim().slice(0, 4000)
  if (!t || !sendChat) return
  sendChat({ text: t })
  const { nick, hue } = useSettings.getState()
  pushMessage({ kind: 'user', from: selfId, nick, hue, text: t, mine: true })
}

/** Reduz imagens grandes (máx. 1920px, WebP) para economizar banda; GIF vai como está. */
async function prepareImage(file: Blob): Promise<{ blob: Blob; w: number; h: number }> {
  const bmp = await createImageBitmap(file)
  const { width, height } = bmp
  if (file.type === 'image/gif') {
    bmp.close()
    return { blob: file, w: width, h: height }
  }
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(width, height))
  const w = Math.round(width * scale)
  const h = Math.round(height * scale)
  const canvas = new OffscreenCanvas(w, h)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const webp = await canvas.convertToBlob({ type: 'image/webp', quality: 0.85 })
  return webp.size < file.size || scale < 1 ? { blob: webp, w, h } : { blob: file, w, h }
}

export async function sendImageFile(file: Blob, name = 'imagem'): Promise<void> {
  if (!sendImage) return
  if (!IMAGE_TYPES.includes(file.type)) return alert('Formato não suportado. Use PNG, JPG, GIF ou WebP.')
  let prepared
  try {
    prepared = await prepareImage(file)
  } catch {
    return alert('Não foi possível ler essa imagem.')
  }
  const { blob, w, h } = prepared
  if (blob.size > MAX_IMAGE_BYTES) return alert('Imagem muito grande (máx. 8 MB).')

  const data = await blob.arrayBuffer()
  const { nick, hue } = useSettings.getState()
  const url = URL.createObjectURL(blob)
  pushMessage({ kind: 'user', from: selfId, nick, hue, text: '', image: { url, name, w, h }, mine: true })
  sendImage(data, { metadata: { mime: blob.type, name: name.slice(0, 100), w, h } })
}

export function toggleMute(): void {
  const s = useStore.getState()
  // Desmutar enquanto ensurdecido também tira o ensurdecer (como no Discord)
  if (s.deafened) s.patch({ deafened: false, muted: false })
  else s.patch({ muted: !s.muted })
  useStore.getState().muted ? sounds.mute() : sounds.unmute()
  broadcastPresence()
}

export function toggleDeafen(): void {
  const s = useStore.getState()
  s.patch({ deafened: !s.deafened })
  useStore.getState().deafened ? sounds.mute() : sounds.unmute()
  broadcastPresence()
}

export function broadcastPresence(): void {
  sendPresence?.(myPresence())
}

// Mudou apelido/cor nas configurações → avisa a sala
useSettings.subscribe((s, prev) => {
  if (s.nick !== prev.nick || s.hue !== prev.hue) broadcastPresence()
})
// Começou/parou de transmitir → avisa a sala
useStore.subscribe((s, prev) => {
  if (!!s.myShare !== !!prev.myShare) broadcastPresence()
})
