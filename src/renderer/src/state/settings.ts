import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PttBinding } from '../../../preload'

export type SavedRoom = { name: string; password: string }
export type NoiseMode = 'off' | 'standard' | 'rnnoise'
export type VoiceMode = 'vad' | 'ptt'

export type SharePresetId = '480p30' | '720p30' | '1080p30' | '1080p60' | 'text'
export type SharePreset = { label: string; desc: string; height: number; fps: number; bitrate: number; hint: 'motion' | 'detail' }
export const SHARE_PRESETS: Record<SharePresetId, SharePreset> = {
  '480p30': { label: '480p 30fps', desc: 'Economia (~0,7 Mbps por espectador)', height: 480, fps: 30, bitrate: 700_000, hint: 'motion' },
  '720p30': { label: '720p 30fps', desc: 'Equilibrado (~1,5 Mbps)', height: 720, fps: 30, bitrate: 1_500_000, hint: 'motion' },
  '1080p30': { label: '1080p 30fps', desc: 'Alta qualidade (~2,5 Mbps)', height: 1080, fps: 30, bitrate: 2_500_000, hint: 'motion' },
  '1080p60': { label: '1080p 60fps', desc: 'Jogos fluidos (~4,5 Mbps)', height: 1080, fps: 60, bitrate: 4_500_000, hint: 'motion' },
  text: { label: 'Texto nítido', desc: '1080p 15fps, prioriza nitidez (código, documentos)', height: 1080, fps: 15, bitrate: 1_200_000, hint: 'detail' }
}

export type Settings = {
  nick: string
  /** Matiz (0–359) da cor do avatar */
  hue: number
  rooms: SavedRoom[]
  inputDeviceId: string
  outputDeviceId: string
  /** 0–200 (%) */
  inputVolume: number
  outputVolume: number
  voiceMode: VoiceMode
  /** Sensibilidade da detecção de voz, em dBFS (-100 a 0) */
  vadThreshold: number
  pttBinding: PttBinding | null
  pttReleaseMs: number
  noise: NoiseMode
  echoCancellation: boolean
  autoGainControl: boolean
  /** Volume por amigo (0–200 %), pelo apelido: o id do peer muda a cada sessão */
  peerVolumes: Record<string, number>
  sounds: boolean
  turnUrl: string
  turnUser: string
  turnPass: string
  sharePreset: SharePresetId
  shareAudio: boolean
}

type Actions = {
  set: (patch: Partial<Settings>) => void
  saveRoom: (room: SavedRoom) => void
  removeRoom: (name: string) => void
  setPeerVolume: (nick: string, volume: number) => void
}

// Migra o apelido da primeira versão e apaga o resto que ela gravava solto (inclusive as salas)
const legacyNick = (() => {
  try {
    const v = localStorage.getItem('nick')
    localStorage.removeItem('nick')
    localStorage.removeItem('rooms')
    return v ? String(JSON.parse(v)) : ''
  } catch {
    return ''
  }
})()

/*
 * Só preferências ficam salvas (apelido, áudio, atalho). Salas, senhas, chat e imagens são temporários:
 * vivem na memória e somem ao fechar o app.
 */
export const useSettings = create<Settings & Actions>()(
  persist(
    (set, get) => ({
      nick: legacyNick,
      hue: Math.floor(Math.random() * 360),
      rooms: [],
      inputDeviceId: 'default',
      outputDeviceId: 'default',
      inputVolume: 100,
      outputVolume: 100,
      voiceMode: 'vad',
      vadThreshold: -50,
      pttBinding: null,
      pttReleaseMs: 200,
      noise: 'rnnoise',
      echoCancellation: true,
      autoGainControl: true,
      peerVolumes: {},
      sounds: true,
      turnUrl: '',
      turnUser: '',
      turnPass: '',
      sharePreset: '720p30',
      shareAudio: true,

      set: (patch) => set(patch),
      saveRoom: (room) => set({ rooms: [room, ...get().rooms.filter((r) => r.name !== room.name)] }),
      removeRoom: (name) => set({ rooms: get().rooms.filter((r) => r.name !== name) }),
      setPeerVolume: (nick, volume) => set({ peerVolumes: { ...get().peerVolumes, [nick]: volume } })
    }),
    {
      name: 'falacmg-settings',
      partialize: ({ rooms: _, ...prefs }) => prefs,
      // Ignora salas que versões anteriores tenham gravado
      merge: (saved, current) => ({ ...current, ...(saved as Partial<Settings>), rooms: [] })
    }
  )
)
