import { fxOutput } from './audio'
import { useSettings } from '../state/settings'

// Efeitos curtos gerados na hora (sem arquivos de áudio)
function tones(freqs: number[], step = 0.09): void {
  if (!useSettings.getState().sounds) return
  const { ctx, out } = fxOutput()
  const t0 = ctx.currentTime + 0.01
  freqs.forEach((f, i) => {
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = f
    const t = t0 + i * step
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(1, t + 0.01)
    env.gain.exponentialRampToValueAtTime(0.001, t + step * 1.6)
    osc.connect(env).connect(out)
    osc.start(t)
    osc.stop(t + step * 1.7)
  })
}

export const sounds = {
  join: () => tones([523, 784]),
  leave: () => tones([784, 523]),
  selfJoin: () => tones([523, 659, 784]),
  mute: () => tones([440, 330], 0.06),
  unmute: () => tones([330, 440], 0.06),
  message: () => tones([880], 0.07)
}
