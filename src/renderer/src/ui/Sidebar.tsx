import { useSettings } from '../state/settings'
import { ME, useStore } from '../state/store'
import { disconnect, toggleDeafen, toggleMute } from '../net/room'
import { stopShare } from '../net/screen'
import { Avatar } from './Avatar'
import { Logo } from './Logo'
import { MemberList } from './MemberList'
import {
  GearIcon, HangupIcon, HeadphonesIcon, HeadphonesOffIcon, MicIcon, MicOffIcon, MonitorIcon, MonitorStopIcon, PlusIcon
} from './icons'

const canShareScreen = typeof navigator.mediaDevices?.getDisplayMedia === 'function'

/** Uma sala por vez: a barra lateral mostra quem está nela e os controles da chamada. */
export function Sidebar() {
  const current = useStore((s) => s.current)
  const patch = useStore((s) => s.patch)

  return (
    <aside className="sidebar panel">
      <header className="brand">
        <Logo size={30} />
        <span className="brand-name">Fala<b>CMG</b></span>
      </header>

      {current ? (
        <MemberList />
      ) : (
        <div className="members">
          <button className="room-empty" onClick={() => patch({ addRoomOpen: true })}>
            <PlusIcon size={18} />
            <span>Criar sala ou colar convite</span>
          </button>
        </div>
      )}

      {current && <CallCard />}
      <ProfileBar />
    </aside>
  )
}

/** Controles da chamada: microfone, áudio, tela e sair. */
function CallCard() {
  const current = useStore((s) => s.current)
  const micError = useStore((s) => s.micError)
  const peerCount = useStore((s) => Object.keys(s.peers).length)
  const { muted, deafened, myShare, patch } = useStore()
  const micOff = muted || deafened

  return (
    <div className="call-card">
      <div className="call-head">
        <span className={`call-dot ${micError ? 'error' : peerCount ? 'on' : 'waiting'}`} />
        <div className="call-text">
          <div className="call-title">{micError ? 'Microfone indisponível' : peerCount ? 'Em chamada' : 'Esperando a galera'}</div>
          <div className="call-sub">
            {current?.name} · {peerCount + 1} {peerCount ? 'pessoas' : 'pessoa'}
          </div>
        </div>
      </div>
      {myShare && <div className="call-sharing">Transmitindo: {myShare.name}</div>}
      <div className="call-actions">
        <button className={`round-btn ${micOff ? 'off' : ''}`} title={micOff ? 'Ativar microfone' : 'Silenciar microfone'} onClick={toggleMute}>
          {micOff ? <MicOffIcon /> : <MicIcon />}
        </button>
        <button className={`round-btn ${deafened ? 'off' : ''}`} title={deafened ? 'Ativar áudio' : 'Desativar áudio'} onClick={toggleDeafen}>
          {deafened ? <HeadphonesOffIcon /> : <HeadphonesIcon />}
        </button>
        {/* Celulares não conseguem transmitir a tela pelo navegador */}
        {canShareScreen && (
          <button
            className={`round-btn ${myShare ? 'sharing' : ''}`}
            title={myShare ? 'Parar transmissão' : 'Transmitir tela'}
            onClick={() => (myShare ? stopShare() : patch({ sharePickerOpen: true }))}
          >
            {myShare ? <MonitorStopIcon /> : <MonitorIcon />}
          </button>
        )}
        <button className="round-btn leave" title="Sair da chamada" onClick={() => disconnect()}>
          <HangupIcon />
        </button>
      </div>
    </div>
  )
}

function ProfileBar() {
  const { nick, hue, voiceMode, pttBinding } = useSettings()
  const { muted, deafened, speaking, patch, current } = useStore()
  const status = !current
    ? 'Fora de sala'
    : muted || deafened
      ? 'Microfone desligado'
      : voiceMode === 'ptt'
        ? `Aperte ${pttBinding?.label ?? '(sem tecla)'} para falar`
        : 'Detecção de voz ativa'
  return (
    <div className="profile-bar">
      <Avatar nick={nick} hue={hue} size={34} speaking={speaking[ME]} />
      <div className="profile-info">
        <div className="profile-nick">{nick}</div>
        <div className="profile-status">{status}</div>
      </div>
      <button className="icon-btn" title="Configurações" onClick={() => patch({ settingsOpen: true })}>
        <GearIcon />
      </button>
    </div>
  )
}
