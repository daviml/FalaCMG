import { MicOffIcon, HeadphonesOffIcon } from './icons'

type Props = {
  nick: string
  hue: number
  size?: number
  speaking?: boolean
  muted?: boolean
  deafened?: boolean
}

export const avatarColor = (hue: number) => `hsl(${hue} 60% 52%)`
export const nameColor = (hue: number) => `hsl(${hue} 75% 72%)`

/** Cor estável a partir de um texto (ex.: nome da sala). */
export const hueOf = (text: string) => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)

export function Avatar({ nick, hue, size = 32, speaking, muted, deafened }: Props) {
  const badge = deafened ? <HeadphonesOffIcon size={10} /> : muted ? <MicOffIcon size={10} /> : null
  return (
    <div
      className={`avatar ${speaking ? 'speaking' : ''}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(135deg, ${avatarColor(hue)}, hsl(${(hue + 40) % 360} 60% 42%))`
      }}
    >
      {(nick.trim()[0] ?? '?').toUpperCase()}
      {badge && <span className="avatar-badge">{badge}</span>}
    </div>
  )
}
