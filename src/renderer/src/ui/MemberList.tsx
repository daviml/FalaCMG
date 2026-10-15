import { useEffect, useRef, useState } from 'react'
import { useSettings } from '../state/settings'
import { ME, useStore, type Peer } from '../state/store'
import { Avatar } from './Avatar'

const statusOf = (s: { speaking?: boolean; muted: boolean; deafened: boolean; sharing: boolean }) =>
  s.deafened ? 'áudio desligado' : s.muted ? 'mutado' : s.speaking ? 'falando…' : s.sharing ? 'transmitindo a tela' : 'na chamada'

/** Pessoas na sala atual (fica na barra lateral). Clicar em alguém abre o volume dessa pessoa. */
export function MemberList() {
  const { nick, hue } = useSettings()
  const { peers, speaking, muted, deafened, myShare } = useStore()
  const [open, setOpen] = useState<{ id: string; top: number; left: number } | null>(null)
  const list = Object.values(peers)

  return (
    <div className="members">
      <div className="section-title"><span>Na sala · {list.length + 1}</span></div>

      <div className="member me">
        <Avatar nick={nick} hue={hue} size={34} speaking={speaking[ME]} muted={muted} deafened={deafened} />
        <div className="member-info">
          <div className="member-nick">{nick} <span className="you">você</span></div>
          <div className="member-status">{statusOf({ speaking: speaking[ME], muted, deafened, sharing: !!myShare })}</div>
        </div>
        {myShare && <span className="live">ao vivo</span>}
      </div>

      {list.map((p) => (
        <div key={p.id}>
          <div
            className={`member clickable ${open?.id === p.id ? 'open' : ''}`}
            title="Ajustar volume"
            onClick={(e) => {
              // Popover fixo à direita da barra lateral (a lista tem rolagem e cortaria um absoluto)
              const r = e.currentTarget.getBoundingClientRect()
              setOpen(open?.id === p.id ? null : { id: p.id, top: Math.min(r.top, window.innerHeight - 260), left: r.right + 14 })
            }}
          >
            <Avatar nick={p.nick} hue={p.hue} size={34} speaking={speaking[p.id]} muted={p.muted} deafened={p.deafened} />
            <div className="member-info">
              <div className="member-nick">{p.nick}</div>
              <div className="member-status">{statusOf({ ...p, speaking: speaking[p.id] })}</div>
            </div>
            {p.sharing && <span className="live">ao vivo</span>}
          </div>
          {open?.id === p.id && <PeerPopover peer={p} pos={open} onClose={() => setOpen(null)} />}
        </div>
      ))}

      {list.length === 0 && (
        <div className="members-empty">
          <p>Ninguém mais aqui ainda.</p>
          <button className="ghost-btn" onClick={() => useStore.getState().patch({ inviteOpen: true })}>Mandar convite</button>
        </div>
      )}
    </div>
  )
}

function PeerPopover({ peer, pos, onClose }: { peer: Peer; pos: { top: number; left: number }; onClose: () => void }) {
  const volume = useSettings((s) => s.peerVolumes[peer.nick] ?? 100)
  const setPeerVolume = useSettings((s) => s.setPeerVolume)
  const ref = useRef<HTMLDivElement>(null)
  const [lastVolume, setLastVolume] = useState(100)

  useEffect(() => {
    const onDown = (e: MouseEvent) => !ref.current?.parentElement?.contains(e.target as Node) && onClose()
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [onClose])

  const toggleLocalMute = () => {
    if (volume > 0) {
      setLastVolume(volume)
      setPeerVolume(peer.nick, 0)
    } else setPeerVolume(peer.nick, lastVolume || 100)
  }

  return (
    <div className="popover" ref={ref} style={{ top: pos.top, left: pos.left }}>
      <div className="popover-head">
        <Avatar nick={peer.nick} hue={peer.hue} size={44} />
        <div>
          <div className="member-nick">{peer.nick}</div>
          <div className="member-status">{statusOf(peer)}</div>
        </div>
      </div>
      <label className="field">
        <span>Volume para você · {volume}%</span>
        <input type="range" min={0} max={200} step={5} value={volume} onChange={(e) => setPeerVolume(peer.nick, Number(e.target.value))} />
      </label>
      <label className="check">
        <input type="checkbox" checked={volume === 0} onChange={toggleLocalMute} />
        Silenciar só para mim
      </label>
    </div>
  )
}
