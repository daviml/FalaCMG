import type { FalaApi, PttBinding, ScreenSource } from '../../preload'

/*
 * O mesmo app roda no Electron (Windows) e no navegador (versão web).
 * No Electron, window.falacmg vem do preload; no navegador, este arquivo fornece equivalentes:
 *  - PTT: só com a aba em foco (o navegador não vê teclas de outros programas)
 *  - tela: o seletor é o do próprio navegador
 *  - convite: chega pela URL (#entrar/<código>)
 */

export type Platform = FalaApi & { isWeb: boolean }

/** Endereço público da versão web (ex.: https://falacmg.vercel.app). Usado nos links de convite. */
export const PUBLIC_URL = ((import.meta.env.VITE_PUBLIC_URL as string | undefined) ?? '').replace(/\/+$/, '')

function webPlatform(): Platform {
  // ---------- PTT dentro da aba ----------
  let binding: PttBinding | null = null
  let capture: ((b: PttBinding | null) => void) | null = null
  let pressed = false
  const listeners = new Set<(down: boolean) => void>()
  const emit = (down: boolean) => {
    if (pressed === down) return
    pressed = down
    listeners.forEach((cb) => cb(down))
  }
  // Teclas do navegador são identificadas por KeyboardEvent.code (guardado no label); mouse pelo número do botão
  const isTyping = () => {
    const el = document.activeElement as HTMLElement | null
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
  }

  window.addEventListener('keydown', (e) => {
    if (capture) {
      e.preventDefault()
      const cb = capture
      capture = null
      cb(e.code === 'Escape' ? null : { kind: 'key', code: -1, label: e.code })
      return
    }
    if (binding?.kind === 'key' && binding.label === e.code && !isTyping()) {
      e.preventDefault()
      emit(true)
    }
  })
  window.addEventListener('keyup', (e) => binding?.kind === 'key' && binding.label === e.code && emit(false))
  window.addEventListener('mousedown', (e) => {
    if (capture && e.button >= 3) {
      e.preventDefault()
      const cb = capture
      capture = null
      cb({ kind: 'mouse', code: e.button, label: `Mouse ${e.button + 1}` })
      return
    }
    if (binding?.kind === 'mouse' && binding.code === e.button) emit(true)
  })
  window.addEventListener('mouseup', (e) => binding?.kind === 'mouse' && binding.code === e.button && emit(false))
  // Botões laterais do mouse fariam "voltar/avançar" na página
  window.addEventListener('auxclick', (e) => e.button >= 3 && e.preventDefault())
  window.addEventListener('blur', () => emit(false))

  // ---------- Convite pela URL ----------
  const inviteFromHash = () => (location.hash.startsWith('#entrar/') ? location.hash.slice(1) : null)
  const clearHash = () => history.replaceState(null, '', location.pathname + location.search)

  // ---------- Aviso de mensagem: título piscando ----------
  let flashTimer: ReturnType<typeof setInterval> | null = null
  const baseTitle = document.title
  window.addEventListener('focus', () => {
    if (flashTimer) clearInterval(flashTimer)
    flashTimer = null
    document.title = baseTitle
  })

  return {
    isWeb: true,
    platform: 'web' as NodeJS.Platform,
    screen: {
      sources: async (): Promise<ScreenSource[]> => [],
      select: () => {}
    },
    ptt: {
      available: async () => true,
      capture: () =>
        new Promise<PttBinding | null>((resolve) => {
          capture?.(null)
          capture = resolve
        }),
      cancelCapture: () => {
        capture?.(null)
        capture = null
      },
      set: (b) => {
        binding = b
        emit(false)
      },
      onState: (cb) => {
        listeners.add(cb)
        return () => {
          listeners.delete(cb)
        }
      }
    },
    flash: () => {
      if (document.hasFocus() || flashTimer) return
      let on = false
      flashTimer = setInterval(() => {
        on = !on
        document.title = on ? '💬 Nova mensagem' : baseTitle
      }, 1000)
    },
    invite: {
      take: async () => {
        const code = inviteFromHash()
        if (code) clearHash()
        return code
      },
      onInvite: (cb) => {
        const onHash = () => {
          const code = inviteFromHash()
          if (code) {
            clearHash()
            cb(code)
          }
        }
        window.addEventListener('hashchange', onHash)
        return () => window.removeEventListener('hashchange', onHash)
      }
    }
  }
}

export const platform: Platform = window.falacmg ? { ...window.falacmg, isWeb: false } : webPlatform()
