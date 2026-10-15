import { platform } from '../platform'
import { RnnoiseWorkletNode, loadRnnoise } from '@sapphi-red/web-noise-suppressor'
import rnnoiseWorkletUrl from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url'
import rnnoiseWasmUrl from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url'
import rnnoiseSimdUrl from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url'
import { useSettings, type Settings } from '../state/settings'
import { ME, useStore } from '../state/store'

/*
 * Cadeia de entrada:  mic → [RNNoise] → ganho de entrada → analisador (medidor/VAD) → destino (track enviada)
 * A track enviada é sempre a mesma; trocar dispositivo/ruído só reconstrói o começo da cadeia.
 * O "portão" (PTT / detecção de voz / mudo) liga e desliga track.enabled: desligada, o WebRTC
 * manda só silêncio, quase sem banda.
 *
 * Saída: cada amigo → ganho individual → ganho mestre (volume de saída / ensurdecer) → dispositivo escolhido.
 */

const TICK_MS = 30
const VAD_HOLD_MS = 300
const REMOTE_SPEAK_DB = -55
const REMOTE_HOLD_MS = 250

let ctx: AudioContext | null = null
let master: GainNode
let fx: GainNode
let dest: MediaStreamAudioDestinationNode
let inputGain: GainNode
let inputAnalyser: AnalyserNode

let micStream: MediaStream | null = null
let micSource: MediaStreamAudioSourceNode | null = null
let rnnoise: RnnoiseWorkletNode | null = null
let rnnoiseWasm: Promise<ArrayBuffer> | null = null
let micUsers = 0
let micBuild: Promise<void> = Promise.resolve()
let monitoring = false

let level = -100
let vadOpenUntil = 0
let pttDown = false
let pttReleaseTimer: ReturnType<typeof setTimeout> | null = null
let transmitting = false

type RemotePeer = {
  el: HTMLAudioElement
  source: MediaStreamAudioSourceNode
  gain: GainNode
  analyser: AnalyserNode
  speakUntil: number
}
const remotes = new Map<string, RemotePeer>()
const buf = new Float32Array(1024)

const settings = () => useSettings.getState()

function dbOf(analyser: AnalyserNode): number {
  analyser.getFloatTimeDomainData(buf)
  let sum = 0
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
  const rms = Math.sqrt(sum / buf.length)
  return rms > 0 ? Math.max(-100, 20 * Math.log10(rms)) : -100
}

function getCtx(): AudioContext {
  if (!ctx) {
    // RNNoise exige 48 kHz
    ctx = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' })
    master = ctx.createGain()
    master.connect(ctx.destination)
    fx = ctx.createGain()
    fx.gain.value = 0.25
    fx.connect(ctx.destination)
    dest = ctx.createMediaStreamDestination()
    inputGain = ctx.createGain()
    inputGain.gain.value = settings().inputVolume / 100
    inputAnalyser = ctx.createAnalyser()
    inputAnalyser.fftSize = 1024
    inputGain.connect(inputAnalyser)
    inputGain.connect(dest)
    dest.stream.getAudioTracks()[0].enabled = false
    applyOutput()
    applyOutputDevice()
    setInterval(tick, TICK_MS)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

/** Stream de voz enviada aos amigos (mesma instância durante toda a vida do app) */
export function outgoingStream(): MediaStream {
  getCtx()
  return dest.stream
}

/** Nó para tocar efeitos sonoros (não é afetado por "ensurdecer", igual ao Discord) */
export function fxOutput(): { ctx: AudioContext; out: AudioNode } {
  const c = getCtx()
  return { ctx: c, out: fx }
}

async function buildMic(): Promise<void> {
  const c = getCtx()
  teardownMic()
  const s = settings()
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: s.inputDeviceId === 'default' ? undefined : { exact: s.inputDeviceId },
        channelCount: 1,
        sampleRate: 48000,
        echoCancellation: s.echoCancellation,
        autoGainControl: s.autoGainControl,
        noiseSuppression: s.noise === 'standard'
      }
    })
  } catch (e) {
    console.error('[audio] microfone', e)
    useStore.getState().patch({ micError: 'Não foi possível acessar o microfone. Verifique o dispositivo nas configurações.' })
    return
  }
  useStore.getState().patch({ micError: null })
  micSource = c.createMediaStreamSource(micStream)

  if (s.noise === 'rnnoise') {
    try {
      rnnoiseWasm ??= loadRnnoise({ url: rnnoiseWasmUrl, simdUrl: rnnoiseSimdUrl })
      const [wasmBinary] = await Promise.all([rnnoiseWasm, c.audioWorklet.addModule(rnnoiseWorkletUrl)])
      rnnoise = new RnnoiseWorkletNode(c, { maxChannels: 1, wasmBinary })
      micSource.connect(rnnoise).connect(inputGain)
      return
    } catch (e) {
      console.error('[audio] RNNoise falhou, usando sem supressão', e)
      rnnoise = null
    }
  }
  micSource.connect(inputGain)
}

function teardownMic(): void {
  micSource?.disconnect()
  rnnoise?.disconnect()
  rnnoise?.destroy()
  micStream?.getTracks().forEach((t) => t.stop())
  micSource = null
  rnnoise = null
  micStream = null
}

/** Liga o microfone (contagem de usos: sala e tela de configurações) */
export function acquireMic(): Promise<void> {
  if (micUsers++ === 0) micBuild = micBuild.then(buildMic)
  return micBuild
}

export function releaseMic(): void {
  micUsers = Math.max(0, micUsers - 1)
  if (micUsers === 0) {
    micBuild = micBuild.then(teardownMic)
    setMonitor(false)
  }
}

function rebuildMic(): void {
  if (micUsers > 0) micBuild = micBuild.then(buildMic)
}

/** "Teste de microfone": escutar a própria voz processada */
export function setMonitor(on: boolean): void {
  if (!ctx || on === monitoring) return
  monitoring = on
  if (on) inputGain.connect(master)
  else inputGain.disconnect(master)
}

export const getLevel = () => level
export const isTransmitting = () => transmitting

export function setPttDown(down: boolean): void {
  if (pttReleaseTimer) clearTimeout(pttReleaseTimer)
  pttReleaseTimer = null
  if (down) pttDown = true
  // Atraso ao soltar evita cortar o fim da palavra
  else pttReleaseTimer = setTimeout(() => (pttDown = false), settings().pttReleaseMs)
}

function tick(): void {
  const now = performance.now()
  const s = settings()
  const st = useStore.getState()

  level = micStream ? dbOf(inputAnalyser) : -100
  if (level > s.vadThreshold) vadOpenUntil = now + VAD_HOLD_MS

  const open = s.voiceMode === 'ptt' ? pttDown : now < vadOpenUntil
  const tx = !!micStream && !!st.current && !st.muted && !st.deafened && open
  if (tx !== transmitting) {
    transmitting = tx
    dest.stream.getAudioTracks()[0].enabled = tx
  }
  st.setSpeaking(ME, tx && level > Math.min(s.vadThreshold, -60))

  for (const [id, r] of remotes) {
    if (dbOf(r.analyser) > REMOTE_SPEAK_DB) r.speakUntil = now + REMOTE_HOLD_MS
    st.setSpeaking(id, now < r.speakUntil)
  }
}

// ---------- Amigos ----------

export function attachPeer(peerId: string, stream: MediaStream): void {
  const c = getCtx()
  detachPeer(peerId)
  // Bug do Chromium: stream WebRTC remota só toca no WebAudio se estiver presa a um <audio>
  const el = new Audio()
  el.srcObject = stream
  el.muted = true
  el.play().catch(() => {})
  const source = c.createMediaStreamSource(stream)
  const gain = c.createGain()
  const analyser = c.createAnalyser()
  analyser.fftSize = 1024
  source.connect(gain).connect(master)
  source.connect(analyser)
  remotes.set(peerId, { el, source, gain, analyser, speakUntil: 0 })
  applyPeerVolume(peerId)
}

export function detachPeer(peerId: string): void {
  const r = remotes.get(peerId)
  if (!r) return
  r.source.disconnect()
  r.gain.disconnect()
  r.el.srcObject = null
  remotes.delete(peerId)
}

export function detachAll(): void {
  for (const id of [...remotes.keys()]) detachPeer(id)
}

export function applyPeerVolume(peerId: string): void {
  const r = remotes.get(peerId)
  const nick = useStore.getState().peers[peerId]?.nick
  if (!r) return
  const vol = nick ? (settings().peerVolumes[nick] ?? 100) : 100
  r.gain.gain.value = vol / 100
}

function applyOutput(): void {
  if (!ctx) return
  const { deafened } = useStore.getState()
  master.gain.value = deafened ? 0 : settings().outputVolume / 100
}

function applyOutputDevice(): void {
  if (!ctx) return
  const id = settings().outputDeviceId
  const c = ctx as AudioContext & { setSinkId?: (id: string) => Promise<void> }
  c.setSinkId?.(id === 'default' ? '' : id).catch((e) => console.error('[audio] saída', e))
}

// Reage às configurações
useSettings.subscribe((s: Settings, prev: Settings) => {
  if (!ctx) return
  inputGain.gain.value = s.inputVolume / 100
  if (s.outputVolume !== prev.outputVolume) applyOutput()
  if (s.outputDeviceId !== prev.outputDeviceId) applyOutputDevice()
  if (s.peerVolumes !== prev.peerVolumes) for (const id of remotes.keys()) applyPeerVolume(id)
  if (
    s.inputDeviceId !== prev.inputDeviceId ||
    s.noise !== prev.noise ||
    s.echoCancellation !== prev.echoCancellation ||
    s.autoGainControl !== prev.autoGainControl
  )
    rebuildMic()
})
useStore.subscribe((s, prev) => {
  if (s.deafened !== prev.deafened) applyOutput()
})

// PTT global vindo do processo principal
platform.ptt.onState(setPttDown)
const syncPttBinding = () => platform.ptt.set(settings().voiceMode === 'ptt' ? settings().pttBinding : null)
syncPttBinding()
useSettings.subscribe((s, prev) => {
  if (s.voiceMode !== prev.voiceMode || s.pttBinding !== prev.pttBinding) syncPttBinding()
})

export async function listDevices(): Promise<{ inputs: MediaDeviceInfo[]; outputs: MediaDeviceInfo[] }> {
  const all = await navigator.mediaDevices.enumerateDevices()
  return {
    inputs: all.filter((d) => d.kind === 'audioinput'),
    outputs: all.filter((d) => d.kind === 'audiooutput')
  }
}
