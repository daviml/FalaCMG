import { platform } from '../platform'
import { useEffect, useState, type ReactNode } from 'react'
import { useSettings, type NoiseMode } from '../state/settings'
import { useStore } from '../state/store'
import { acquireMic, getLevel, listDevices, releaseMic, setMonitor } from '../net/audio'
import { Avatar } from './Avatar'
import { Modal } from './Modal'
import { MicIcon, SignalIcon, SpeakerIcon, UserIcon, XIcon } from './icons'

type Tab = 'account' | 'voice' | 'notifications' | 'advanced'
const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'voice', label: 'Voz e áudio', icon: <MicIcon size={18} /> },
  { id: 'account', label: 'Perfil', icon: <UserIcon size={18} /> },
  { id: 'notifications', label: 'Sons', icon: <SpeakerIcon size={18} /> },
  { id: 'advanced', label: 'Conexão', icon: <SignalIcon size={18} /> }
]

export function SettingsModal() {
  const [tab, setTab] = useState<Tab>('voice')
  const close = () => useStore.getState().patch({ settingsOpen: false })

  return (
    <Modal onClose={close}>
      <div className="settings">
        <nav className="settings-nav">
          <div className="settings-nav-title">Configurações</div>
          {TABS.map((t) => (
            <button key={t.id} className={`settings-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.icon}
              {t.label}
            </button>
          ))}
          <div className="settings-nav-foot">Preferências ficam neste PC. Salas e conversas nunca são salvas.</div>
        </nav>
        <div className="settings-content">
          <button className="icon-btn settings-close" onClick={close} title="Fechar (Esc)">
            <XIcon size={20} />
          </button>
          {tab === 'account' && <AccountTab />}
          {tab === 'voice' && <VoiceTab />}
          {tab === 'notifications' && <SoundsTab />}
          {tab === 'advanced' && <AdvancedTab />}
        </div>
      </div>
    </Modal>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="settings-section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle-row">
      <div>
        <div className="toggle-label">{label}</div>
        {desc && <div className="toggle-desc">{desc}</div>}
      </div>
      <input type="checkbox" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

function AccountTab() {
  const { nick, hue, set } = useSettings()
  const [draft, setDraft] = useState(nick)
  const save = () => draft.trim() && set({ nick: draft.trim() })
  return (
    <>
      <h2>Perfil</h2>
      <div className="account-card">
        <Avatar nick={draft || nick} hue={hue} size={72} />
        <div className="account-fields">
          <label className="field">
            <span>Apelido</span>
            <input value={draft} maxLength={32} onChange={(e) => setDraft(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === 'Enter' && save()} />
          </label>
          <label className="field">
            <span>Cor do avatar</span>
            <input type="range" className="hue" min={0} max={359} value={hue} onChange={(e) => set({ hue: Number(e.target.value) })} />
          </label>
        </div>
      </div>
    </>
  )
}

function VoiceTab() {
  const s = useSettings()
  const [devices, setDevices] = useState<{ inputs: MediaDeviceInfo[]; outputs: MediaDeviceInfo[] }>({ inputs: [], outputs: [] })
  const [testing, setTesting] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [pttOk, setPttOk] = useState(true)

  useEffect(() => {
    const refresh = () => listDevices().then(setDevices)
    // Liga o mic enquanto as configurações estão abertas (medidor/teste) e lista dispositivos com nome
    acquireMic().then(refresh)
    navigator.mediaDevices.addEventListener('devicechange', refresh)
    platform.ptt.available().then(setPttOk)
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', refresh)
      platform.ptt.cancelCapture()
      setMonitor(false)
      releaseMic()
    }
  }, [])

  const toggleTest = () => {
    setMonitor(!testing)
    setTesting(!testing)
  }

  const recordKey = async () => {
    setCapturing(true)
    const binding = await platform.ptt.capture()
    setCapturing(false)
    if (binding) s.set({ pttBinding: binding })
  }

  const deviceLabel = (d: MediaDeviceInfo, i: number) =>
    d.deviceId === 'default' ? `Padrão do Windows${d.label ? ` (${d.label.replace(/^Default - |^Padrão - /, '')})` : ''}` : d.label || `Dispositivo ${i + 1}`

  return (
    <>
      <h2>Voz e áudio</h2>

      <div className="grid-2">
        <label className="field">
          <span>Dispositivo de entrada</span>
          <select value={s.inputDeviceId} onChange={(e) => s.set({ inputDeviceId: e.target.value })}>
            {devices.inputs.length === 0 && <option value="default">Padrão do Windows</option>}
            {devices.inputs.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{deviceLabel(d, i)}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Dispositivo de saída</span>
          <select value={s.outputDeviceId} onChange={(e) => s.set({ outputDeviceId: e.target.value })}>
            {devices.outputs.length === 0 && <option value="default">Padrão do Windows</option>}
            {devices.outputs.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{deviceLabel(d, i)}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Volume de entrada — {s.inputVolume}%</span>
          <input type="range" min={0} max={200} step={5} value={s.inputVolume} onChange={(e) => s.set({ inputVolume: Number(e.target.value) })} />
        </label>
        <label className="field">
          <span>Volume de saída — {s.outputVolume}%</span>
          <input type="range" min={0} max={200} step={5} value={s.outputVolume} onChange={(e) => s.set({ outputVolume: Number(e.target.value) })} />
        </label>
      </div>

      <Section title="Teste de microfone">
        <p className="muted">Fale algo e escute como você chega para os amigos (com supressão de ruído e volume aplicados). Use fone para não dar microfonia.</p>
        <div className="mic-test">
          <button className={testing ? 'danger-btn' : 'primary'} onClick={toggleTest}>{testing ? 'Parar teste' : 'Vamos checar'}</button>
          <LevelMeter />
        </div>
      </Section>

      <Section title="Modo de entrada">
        <div className="radio-list">
          <label className={`radio ${s.voiceMode === 'vad' ? 'checked' : ''}`}>
            <input type="radio" checked={s.voiceMode === 'vad'} onChange={() => s.set({ voiceMode: 'vad' })} />
            Detecção de voz
          </label>
          <label className={`radio ${s.voiceMode === 'ptt' ? 'checked' : ''}`}>
            <input type="radio" checked={s.voiceMode === 'ptt'} onChange={() => s.set({ voiceMode: 'ptt' })} />
            Aperte para falar (push-to-talk)
          </label>
        </div>

        {s.voiceMode === 'vad' && (
          <div className="field">
            <span>Sensibilidade de entrada</span>
            <p className="muted">Arraste a marca: o que passar dela (parte verde) é transmitido.</p>
            <LevelMeter threshold={s.vadThreshold} onThreshold={(v) => s.set({ vadThreshold: v })} />
          </div>
        )}

        {s.voiceMode === 'ptt' && (
          <div className="grid-2">
            <div className="field">
              <span>Atalho</span>
              <button className={`keybind ${capturing ? 'recording' : ''}`} onClick={capturing ? () => platform.ptt.cancelCapture() : recordKey}>
                {capturing ? 'Aperte uma tecla ou botão lateral do mouse… (Esc cancela)' : s.pttBinding?.label ?? 'Clique para gravar o atalho'}
              </button>
              {!pttOk && <p className="error-text">Atalho global indisponível neste PC.</p>}
              {platform.isWeb && (
                <p className="hint">No navegador o atalho só funciona com esta aba em foco. Para falar enquanto joga, use o app do Windows.</p>
              )}
            </div>
            <label className="field">
              <span>Atraso ao soltar — {s.pttReleaseMs} ms</span>
              <input type="range" min={0} max={1000} step={20} value={s.pttReleaseMs} onChange={(e) => s.set({ pttReleaseMs: Number(e.target.value) })} />
            </label>
          </div>
        )}
      </Section>

      <Section title="Processamento de voz">
        <label className="field">
          <span>Supressão de ruído</span>
          <select value={s.noise} onChange={(e) => s.set({ noise: e.target.value as NoiseMode })}>
            <option value="rnnoise">Avançada (RNNoise, IA): remove teclado, ventilador e ruído de fundo</option>
            <option value="standard">Padrão (WebRTC): mais leve</option>
            <option value="off">Desativada</option>
          </select>
        </label>
        <Toggle label="Cancelamento de eco" desc="Evita que o som dos alto-falantes volte pelo microfone." checked={s.echoCancellation} onChange={(v) => s.set({ echoCancellation: v })} />
        <Toggle label="Controle automático de ganho" desc="Ajusta o volume do microfone automaticamente." checked={s.autoGainControl} onChange={(v) => s.set({ autoGainControl: v })} />
      </Section>
    </>
  )
}

/** Medidor de nível do mic; com threshold vira o controle de sensibilidade (dBFS de -100 a 0). */
function LevelMeter({ threshold, onThreshold }: { threshold?: number; onThreshold?: (v: number) => void }) {
  const [level, setLevel] = useState(-100)
  useEffect(() => {
    let raf = 0
    const loop = () => {
      setLevel(getLevel())
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const pct = (db: number) => Math.max(0, Math.min(100, db + 100))
  const above = threshold === undefined || level > threshold
  return (
    <div className="meter-wrap">
      <div className="meter">
        <div className={`meter-fill ${above ? 'on' : 'off'}`} style={{ width: `${pct(level)}%` }} />
        {threshold !== undefined && <div className="meter-mark" style={{ left: `${pct(threshold)}%` }} />}
      </div>
      {onThreshold && threshold !== undefined && (
        <input
          className="meter-range"
          type="range"
          min={-100}
          max={0}
          value={threshold}
          onChange={(e) => onThreshold(Number(e.target.value))}
        />
      )}
    </div>
  )
}

function SoundsTab() {
  const { sounds, set } = useSettings()
  return (
    <>
      <h2>Sons</h2>
      <Toggle label="Sons de entrada/saída e mensagens" desc="Avisos curtos quando alguém entra, sai, você muta ou chega mensagem com o app em segundo plano." checked={sounds} onChange={(v) => set({ sounds: v })} />
    </>
  )
}

function AdvancedTab() {
  const { turnUrl, turnUser, turnPass, set } = useSettings()
  return (
    <>
      <h2>Conexão</h2>
      <Section title="Servidor TURN (opcional)">
        <p className="muted">
          Só é necessário se você não conseguir se conectar com algum amigo (redes muito restritas). Ex.: plano gratuito da Metered.
          Vale para a próxima vez que entrar em uma sala.
        </p>
        <label className="field">
          <span>URL</span>
          <input value={turnUrl} onChange={(e) => set({ turnUrl: e.target.value })} placeholder="turn:servidor.com:3478" />
        </label>
        <div className="grid-2">
          <label className="field">
            <span>Usuário</span>
            <input value={turnUser} onChange={(e) => set({ turnUser: e.target.value })} />
          </label>
          <label className="field">
            <span>Senha</span>
            <input type="password" value={turnPass} onChange={(e) => set({ turnPass: e.target.value })} />
          </label>
        </div>
      </Section>
    </>
  )
}
