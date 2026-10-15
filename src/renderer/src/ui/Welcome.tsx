import { useState, type FormEvent } from 'react'
import { useSettings } from '../state/settings'
import { Logo } from './Logo'

export function Welcome() {
  const setSettings = useSettings((s) => s.set)
  const [nick, setNick] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (nick.trim()) setSettings({ nick: nick.trim() })
  }

  return (
    <div className="welcome">
      <form className="welcome-card" onSubmit={onSubmit}>
        <Logo size={64} />
        <h1>Fala<span>CMG</span></h1>
        <p>Voz, chat e tela compartilhada direto entre você e a galera. Sem servidor, sem conta, sem histórico.</p>
        <label className="field">
          <span>Como a galera vai te chamar?</span>
          <input autoFocus value={nick} maxLength={32} onChange={(e) => setNick(e.target.value)} placeholder="Seu apelido" />
        </label>
        <button type="submit" className="primary big" disabled={!nick.trim()}>Bora</button>
      </form>
    </div>
  )
}
