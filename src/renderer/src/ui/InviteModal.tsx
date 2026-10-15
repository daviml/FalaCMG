import { useState } from 'react'
import { useStore } from '../state/store'
import { inviteMessage, makeInvite } from '../net/invite'
import { Modal } from './Modal'

export function InviteModal() {
  const current = useStore((s) => s.current)
  const close = () => useStore.getState().patch({ inviteOpen: false })
  const [copied, setCopied] = useState<'link' | 'msg' | null>(null)
  if (!current) return null

  const link = makeInvite(current)
  const copy = async (what: 'link' | 'msg') => {
    await navigator.clipboard.writeText(what === 'link' ? link : inviteMessage(current))
    setCopied(what)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <Modal onClose={close}>
      <div className="dialog">
        <h2>Convidar para {current.name}</h2>
        <p className="muted">
          {link.startsWith('http')
            ? 'Mande o link para a galera. Quem abrir pode entrar direto pelo navegador ou pelo app do Windows.'
            : 'Mande o link para a galera. É preciso ter o app do Windows: é só clicar no link ou colar em "Criar sala ou colar convite".'}
        </p>
        <div className="invite-box">
          <input readOnly value={link} onFocus={(e) => e.target.select()} />
          <button className="primary" onClick={() => copy('link')}>{copied === 'link' ? 'Copiado!' : 'Copiar'}</button>
        </div>
        <button className="secondary" onClick={() => copy('msg')}>
          {copied === 'msg' ? 'Mensagem copiada!' : 'Copiar mensagem pronta para WhatsApp/Discord'}
        </button>
        <p className="hint">O link contém a senha da sala: quem tiver o link consegue entrar.</p>
      </div>
    </Modal>
  )
}
