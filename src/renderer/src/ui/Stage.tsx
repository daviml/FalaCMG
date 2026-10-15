import { useEffect, useRef, type MouseEvent } from 'react'
import { useSettings } from '../state/settings'
import { ME, useStore } from '../state/store'
import { stopShare, unwatch, watch } from '../net/screen'
import { Avatar } from './Avatar'
import { EyeIcon, MaximizeIcon, MonitorStopIcon, VolumeIcon, VolumeOffIcon, XIcon } from './icons'

/** Palco com as transmissões ao vivo da sala (acima do chat). */
export function Stage() {
  const { myShare, peers, focused, patch } = useStore()
  const live = [...(myShare ? [ME] : []), ...Object.values(peers).filter((p) => p.sharing).map((p) => p.id)]
  if (live.length === 0) return null

  const main = focused && live.includes(focused) ? focused : null
  const others = live.filter((id) => id !== main)

  return (
    <section className={`stage ${main ? 'has-main' : ''}`}>
      {main && (
        <div className="stage-main">
          <Tile id={main} big />
        </div>
      )}
      {others.length > 0 && (
        <div className="stage-strip">
          {others.map((id) => (
            <Tile key={id} id={id} onFocus={() => patch({ focused: id })} />
          ))}
        </div>
      )}
    </section>
  )
}

function Tile({ id, big, onFocus }: { id: string; big?: boolean; onFocus?: () => void }) {
  const isMe = id === ME
  const { myShare, peers, watching, screenVolumes, deafened, patch } = useStore()
  const { nick: myNick, hue: myHue, outputDeviceId, outputVolume } = useSettings()
  const ref = useRef<HTMLDivElement>(null)
  const peer = peers[id]
  const nick = isMe ? myNick : (peer?.nick ?? '???')
  const hue = isMe ? myHue : (peer?.hue ?? 0)
  const stream = isMe ? (myShare?.stream ?? null) : (watching[id] ?? null)
  const requested = isMe || id in watching
  const volume = screenVolumes[id] ?? 100
  const hasAudio = !isMe && !!stream?.getAudioTracks().length

  const fullscreen = (e: MouseEvent) => {
    e.stopPropagation()
    if (document.fullscreenElement) document.exitFullscreen()
    else ref.current?.requestFullscreen()
  }
  const stop = (e: MouseEvent) => {
    e.stopPropagation()
    if (isMe) stopShare()
    else unwatch(id)
  }
  const setVolume = (v: number) => patch({ screenVolumes: { ...screenVolumes, [id]: v } })

  return (
    <div ref={ref} className={`tile ${big ? 'big' : ''}`} onClick={onFocus} onDoubleClick={fullscreen}>
      {stream ? (
        <Video
          stream={stream}
          muted={isMe || deafened}
          volume={(volume / 100) * Math.min(1, outputVolume / 100)}
          sinkId={outputDeviceId}
        />
      ) : (
        <div className="tile-placeholder">
          <Avatar nick={nick} hue={hue} size={big ? 80 : 48} />
          {requested ? (
            <span className="muted">Conectando à transmissão…</span>
          ) : (
            <button
              className="primary"
              onClick={(e) => {
                e.stopPropagation()
                watch(id)
              }}
            >
              <EyeIcon size={16} /> Assistir transmissão
            </button>
          )}
        </div>
      )}

      <div className="tile-label">
        <span className="live">ao vivo</span>
        {isMe ? `Você · ${myShare?.name ?? ''}` : nick}
      </div>

      {requested && (
        <div className="tile-controls" onClick={(e) => e.stopPropagation()}>
          {hasAudio && (
            <div className="tile-volume">
              <button className="icon-btn" title={volume ? 'Silenciar transmissão' : 'Ativar som'} onClick={() => setVolume(volume ? 0 : 100)}>
                {volume ? <VolumeIcon size={18} /> : <VolumeOffIcon size={18} />}
              </button>
              <input type="range" min={0} max={100} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
            </div>
          )}
          <button className="icon-btn" title="Tela cheia" onClick={fullscreen}>
            <MaximizeIcon size={18} />
          </button>
          <button className="icon-btn" title={isMe ? 'Parar de transmitir' : 'Parar de assistir'} onClick={stop}>
            {isMe ? <MonitorStopIcon size={18} /> : <XIcon size={18} />}
          </button>
        </div>
      )}
    </div>
  )
}

function Video({ stream, muted, volume, sinkId }: { stream: MediaStream; muted: boolean; volume: number; sinkId: string }) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.srcObject = stream
    el.play().catch(() => {})
  }, [stream])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.muted = muted
    el.volume = Math.max(0, Math.min(1, volume))
  }, [muted, volume])

  useEffect(() => {
    ref.current?.setSinkId?.(sinkId === 'default' ? '' : sinkId).catch(() => {})
  }, [sinkId])

  return <video ref={ref} autoPlay playsInline />
}
