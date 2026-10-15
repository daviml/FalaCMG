import { useState, type FormEvent } from 'react'
import { useSettings } from '../state/settings'
import { useStore } from '../state/store'
import { connect } from '../net/room'
import { acceptInvite, parseInvite } from '../net/invite'
import { Modal } from './Modal'

export function AddRoomModal() {
  const saveRoom = useSettings((s) => s.saveRoom)
  const close = () => useStore.getState().patch({ addRoomOpen: false })
  const [invite, setInvite] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const inviteRoom = invite.trim() ? parseInvite(invite) : null

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (invite.trim()) {
      if (acceptInvite(invite)) close()
      return
    }
    const room = { name: name.trim(), password }
    if (!room.name) return
    saveRoom(room)
    connect(room)
    close()
  }

  return (
    <Modal onClose={close}>
      <form className="dialog" onSubmit={onSubmit}>
        <h2>{useStore.getState().current ? 'Trocar de sala' : 'Nova sala'}</h2>

        <label className="field">
          <span>Tenho um convite</span>
          <input autoFocus value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="Cole aqui o link do convite" />
          {invite.trim() && (
            <span className={inviteRoom ? 'invite-ok' : 'error-text'}>
              {inviteRoom ? `Convite para a sala "${inviteRoom.name}"` : 'Convite inválido'}
            </span>
          )}
        </label>

        <div className="divider"><span>ou crie/entre combinando nome e senha</span></div>

        <label className="field">
          <span>Nome da sala</span>
          <input value={name} maxLength={64} disabled={!!invite.trim()} onChange={(e) => setName(e.target.value)} placeholder="ex: resenha" />
        </label>
        <label className="field">
          <span>Senha</span>
          <input value={password} disabled={!!invite.trim()} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="opcional, mas recomendado" />
        </label>
        <p className="hint">Depois de entrar, use o botão <b>Convidar</b> no topo da sala para mandar o link aos amigos.</p>

        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={close}>Cancelar</button>
          <button type="submit" className="primary" disabled={invite.trim() ? !inviteRoom : !name.trim()}>Entrar</button>
        </div>
      </form>
    </Modal>
  )
}
