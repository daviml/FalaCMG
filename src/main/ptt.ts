import type { WebContents } from 'electron'

// Push-to-talk global: detecta tecla/botão do mouse pressionado e solto mesmo com o jogo em foco.
export type PttBinding = { kind: 'key' | 'mouse'; code: number; label: string }

type Hook = typeof import('uiohook-napi')
let hook: Hook | null = null
try {
  hook = require('uiohook-napi') as Hook
} catch (e) {
  console.error('[ptt] uiohook-napi indisponível', e)
}

const keyNames = new Map<number, string>()
if (hook) for (const [name, code] of Object.entries(hook.UiohookKey)) if (!keyNames.has(code)) keyNames.set(code, name)

const mouseNames: Record<number, string> = { 1: 'Mouse Esquerdo', 2: 'Mouse Direito', 3: 'Mouse Meio', 4: 'Mouse 4', 5: 'Mouse 5' }

let binding: PttBinding | null = null
let pressed = false
let target: WebContents | null = null
let capture: ((b: PttBinding | null) => void) | null = null
let started = false

const emit = (down: boolean) => {
  if (pressed === down) return
  pressed = down
  if (target && !target.isDestroyed()) target.send('ptt:state', down)
}

const matches = (kind: PttBinding['kind'], code: number) => binding?.kind === kind && binding.code === code

export const pttAvailable = () => hook !== null

export function initPtt(wc: WebContents): void {
  target = wc
  if (!hook || started) return
  const { uIOhook } = hook

  uIOhook.on('keydown', (e) => {
    if (capture) {
      const cb = capture
      capture = null
      // Esc cancela a gravação do atalho
      cb(e.keycode === hook!.UiohookKey.Escape ? null : { kind: 'key', code: e.keycode, label: keyNames.get(e.keycode) ?? `Tecla ${e.keycode}` })
      return
    }
    if (matches('key', e.keycode)) emit(true)
  })
  uIOhook.on('keyup', (e) => matches('key', e.keycode) && emit(false))
  uIOhook.on('mousedown', (e) => {
    const button = Number(e.button)
    // Botões esquerdo/direito não servem como PTT (clicar na própria UI gravaria o atalho)
    if (capture && button >= 3) {
      const cb = capture
      capture = null
      cb({ kind: 'mouse', code: button, label: mouseNames[button] ?? `Mouse ${button}` })
      return
    }
    if (matches('mouse', button)) emit(true)
  })
  uIOhook.on('mouseup', (e) => matches('mouse', Number(e.button)) && emit(false))

  uIOhook.start()
  started = true
}

export function setPttBinding(b: PttBinding | null): void {
  binding = b
  emit(false)
}

export function capturePttBinding(): Promise<PttBinding | null> {
  capture?.(null)
  return new Promise((resolve) => {
    capture = resolve
  })
}

export function cancelCapture(): void {
  capture?.(null)
  capture = null
}

export function stopPtt(): void {
  if (hook && started) hook.uIOhook.stop()
  started = false
}
