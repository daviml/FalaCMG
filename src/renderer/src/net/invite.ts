import { platform, PUBLIC_URL } from '../platform'
import type { SavedRoom } from '../state/settings'
import { useSettings } from '../state/settings'
import { useStore } from '../state/store'
import { connect } from './room'

/*
 * Convite = nome + senha da sala codificados em base64url.
 * Formato principal: https://<site>/convite/#<código> (abre uma página que oferece navegador ou app do Windows).
 * Sem site configurado, o app do Windows usa falacmg://entrar/<código>.
 * Quem tem o convite entra na sala (é como passar a senha), então mande só para quem você quer.
 */

const toB64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64Url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

export function inviteCode(room: SavedRoom): string {
  return toB64Url(new TextEncoder().encode(JSON.stringify({ n: room.name, p: room.password })))
}

export function makeInvite(room: SavedRoom): string {
  const site = PUBLIC_URL || (platform.isWeb ? location.origin : '')
  return site ? `${site}/convite/#${inviteCode(room)}` : `falacmg://entrar/${inviteCode(room)}`
}

/** Aceita o link (https ou falacmg://), o link com texto em volta (mensagem colada) ou só o código. */
export function parseInvite(text: string): SavedRoom | null {
  const match = text.match(/(?:falacmg:\/\/entrar\/|\/convite\/?#|(?:^|#)entrar\/)([A-Za-z0-9_-]+)/i)
  const code = match ? match[1] : text.trim()
  if (!/^[A-Za-z0-9_-]{8,}$/.test(code)) return null
  try {
    const data = JSON.parse(new TextDecoder().decode(fromB64Url(code)))
    const name = String(data.n ?? '').trim().slice(0, 64)
    if (!name) return null
    return { name, password: String(data.p ?? '') }
  } catch {
    return null
  }
}

let pending: SavedRoom | null = null

/** Entra na sala do convite (se ainda não tem apelido, espera a tela de boas-vindas). */
export function acceptInvite(text: string): boolean {
  const room = parseInvite(text)
  if (!room) return false
  if (!useSettings.getState().nick) {
    pending = room
    return true
  }
  if (useStore.getState().current?.name !== room.name) {
    useSettings.getState().saveRoom(room)
    connect(room)
  }
  useStore.getState().patch({ addRoomOpen: false })
  return true
}

// Convite que abriu o app + convites recebidos com o app aberto
platform.invite.take().then((url) => url && acceptInvite(url))
platform.invite.onInvite((url) => acceptInvite(url))

// Depois de escolher o apelido, entra na sala do convite pendente
useSettings.subscribe((s, prev) => {
  if (pending && s.nick && !prev.nick) {
    const room = pending
    pending = null
    s.saveRoom(room)
    connect(room)
  }
})

export function inviteMessage(room: SavedRoom): string {
  return `Bora conversar no FalaCMG! Sala "${room.name}".\nÉ só abrir o link:\n${makeInvite(room)}`
}
