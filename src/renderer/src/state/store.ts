import { create } from 'zustand'
import type { SavedRoom } from './settings'

export type Peer = { id: string; nick: string; hue: number; muted: boolean; deafened: boolean; sharing: boolean }
export type MyShare = { stream: MediaStream; name: string; audio: boolean }

export type ChatImage = { url: string; name: string; w: number; h: number }
export type ChatMessage = {
  id: string
  kind: 'user' | 'system'
  from: string
  nick: string
  hue: number
  text: string
  image?: ChatImage
  ts: number
  mine: boolean
}

export const ME = 'me'

type State = {
  current: SavedRoom | null
  peers: Record<string, Peer>
  messages: ChatMessage[]
  /** Quem está falando agora (id do peer ou ME) */
  speaking: Record<string, boolean>
  muted: boolean
  deafened: boolean
  micError: string | null
  settingsOpen: boolean
  addRoomOpen: boolean
  viewer: ChatImage | null
  sharePickerOpen: boolean
  inviteOpen: boolean
  /** Minha transmissão ativa */
  myShare: MyShare | null
  /** Transmissões que pedi para assistir (id do peer → stream, ou null enquanto conecta) */
  watching: Record<string, MediaStream | null>
  /** Volume do áudio de cada transmissão (0–100) */
  screenVolumes: Record<string, number>
  /** Transmissão em destaque (id do peer ou ME) */
  focused: string | null

  setCurrent: (room: SavedRoom | null) => void
  upsertPeer: (peer: Peer) => void
  removePeer: (id: string) => void
  addMessage: (msg: ChatMessage) => void
  setSpeaking: (id: string, on: boolean) => void
  patch: (p: Partial<State>) => void
}

export const useStore = create<State>((set) => ({
  current: null,
  peers: {},
  messages: [],
  speaking: {},
  muted: false,
  deafened: false,
  micError: null,
  settingsOpen: false,
  addRoomOpen: false,
  viewer: null,
  sharePickerOpen: false,
  inviteOpen: false,
  myShare: null,
  watching: {},
  screenVolumes: {},
  focused: null,

  // Trocar de sala zera peers e chat (o chat vive só durante a sessão)
  setCurrent: (current) =>
    set((s) => {
      for (const m of s.messages) if (m.image) URL.revokeObjectURL(m.image.url)
      return { current, peers: {}, messages: [], speaking: {}, watching: {}, focused: null }
    }),
  upsertPeer: (peer) => set((s) => ({ peers: { ...s.peers, [peer.id]: peer } })),
  removePeer: (id) =>
    set((s) => {
      const { [id]: _, ...peers } = s.peers
      const { [id]: __, ...speaking } = s.speaking
      const { [id]: ___, ...watching } = s.watching
      return { peers, speaking, watching, focused: s.focused === id ? null : s.focused }
    }),
  addMessage: (msg) =>
    set((s) => {
      const messages = [...s.messages, msg]
      // Mantém as últimas 500 mensagens e libera a memória das imagens descartadas
      while (messages.length > 500) {
        const old = messages.shift()
        if (old?.image) URL.revokeObjectURL(old.image.url)
      }
      return { messages }
    }),
  setSpeaking: (id, on) => set((s) => (!!s.speaking[id] === on ? s : { speaking: { ...s.speaking, [id]: on } })),
  patch: (p) => set(p)
}))
