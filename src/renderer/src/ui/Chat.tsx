import { Fragment, useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent, type KeyboardEvent } from 'react'
import { useStore, type ChatMessage } from '../state/store'
import { sendImageFile, sendMessage } from '../net/room'
import { acceptInvite, parseInvite } from '../net/invite'
import { Avatar, hueOf, nameColor } from './Avatar'
import { ImageIcon, PlusIcon, SendIcon, SwapIcon, UserPlusIcon } from './icons'
import { Logo } from './Logo'
import { Stage } from './Stage'

const GROUP_MS = 5 * 60 * 1000
const time = (ts: number) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const URL_RE = /((?:https?|falacmg):\/\/[^\s<]+[^\s<.,;:!?)\]'"])/gi

function Linkified({ text }: { text: string }) {
  const parts = text.split(URL_RE)
  return (
    <>
      {parts.map((p, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{p}</Fragment>
        // Convite colado no chat vira um botão para entrar na outra sala
        if (/^falacmg:/i.test(p) || /\/convite\/?#/i.test(p)) {
          const room = parseInvite(p)
          return room ? (
            <button key={i} className="invite-chip" onClick={() => acceptInvite(p)}>
              Entrar na sala "{room.name}"
            </button>
          ) : (
            <Fragment key={i}>{p}</Fragment>
          )
        }
        return <a key={i} href={p} target="_blank" rel="noreferrer">{p}</a>
      })}
    </>
  )
}

export function ChatPane() {
  const current = useStore((s) => s.current)
  if (!current) return <EmptyState />
  return <Chat />
}

function EmptyState() {
  const patch = useStore((s) => s.patch)
  return (
    <main className="main panel empty">
      <div className="empty-state">
        <Logo size={72} />
        <h2>Bora juntar a galera?</h2>
        <p>Crie uma sala e mande o convite, ou cole um convite que te mandaram.</p>
        <button className="primary big" onClick={() => patch({ addRoomOpen: true })}>
          <PlusIcon size={18} /> Criar sala ou colar convite
        </button>
        <ul className="empty-tips">
          <li>Voz direto entre vocês, com pouco atraso</li>
          <li>Transmissão de tela com o som do PC</li>
          <li>Nada fica salvo: fechou, sumiu</li>
        </ul>
      </div>
    </main>
  )
}

function Chat() {
  const current = useStore((s) => s.current)!
  const messages = useStore((s) => s.messages)
  const peerCount = useStore((s) => Object.keys(s.peers).length)
  const [text, setText] = useState('')
  const [dragging, setDragging] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const roomHue = hueOf(current.name)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [current.name])

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    sendMessage(text)
    setText('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter envia, Shift+Enter quebra linha
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const sendFiles = (files: Iterable<File>) => {
    for (const f of files) if (f.type.startsWith('image/')) sendImageFile(f, f.name || 'imagem')
  }

  const onPaste = (e: ClipboardEvent) => {
    const files = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'))
    if (files.length) {
      e.preventDefault()
      sendFiles(files)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    sendFiles(e.dataTransfer.files)
  }

  return (
    <main
      className="main panel"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault()
          setDragging(true)
        }
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={onDrop}
    >
      <header className="main-header">
        <div className="room-tile" style={{ background: `hsl(${roomHue} 45% 22%)`, color: `hsl(${roomHue} 80% 75%)` }}>
          {current.name.trim()[0]?.toUpperCase()}
        </div>
        <div className="main-title">
          <h1>{current.name}</h1>
          <span>{peerCount ? `${peerCount + 1} pessoas conectadas` : 'Só você por enquanto: chame a galera'}</span>
        </div>
        <button className="secondary" title="Sair desta sala e entrar em outra (ou colar convite)" onClick={() => useStore.getState().patch({ addRoomOpen: true })}>
          <SwapIcon size={16} /> Trocar sala
        </button>
        <button className="accent-btn" onClick={() => useStore.getState().patch({ inviteOpen: true })}>
          <UserPlusIcon size={16} /> Convidar
        </button>
      </header>

      <Stage />

      <div className="messages">
        {messages.length === 0 && (
          <div className="messages-intro">
            <p>As mensagens vão direto para quem está na sala e somem quando vocês saem.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <MessageRow key={m.id} m={m} grouped={isGrouped(messages[i - 1], m)} />
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="composer">
        <button type="button" className="icon-btn" title="Enviar imagem (ou cole/arraste)" onClick={() => fileRef.current?.click()}>
          <ImageIcon size={20} />
        </button>
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder="Escreva uma mensagem…"
          maxLength={4000}
        />
        <button type="submit" className="send-btn" title="Enviar (Enter)" disabled={!text.trim()}>
          <SendIcon size={18} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          multiple
          hidden
          onChange={(e) => {
            sendFiles(e.target.files ?? [])
            e.target.value = ''
          }}
        />
      </form>

      {dragging && (
        <div className="drop-overlay">
          <div>Solte para mandar a imagem</div>
        </div>
      )}
    </main>
  )
}

function isGrouped(prev: ChatMessage | undefined, m: ChatMessage): boolean {
  return !!prev && prev.kind === 'user' && m.kind === 'user' && prev.from === m.from && m.ts - prev.ts < GROUP_MS
}

function MessageRow({ m, grouped }: { m: ChatMessage; grouped: boolean }) {
  const patch = useStore((s) => s.patch)

  if (m.kind === 'system') {
    return (
      <div className="msg-system">
        <span>{m.text}</span>
        <time>{time(m.ts)}</time>
      </div>
    )
  }

  return (
    <div className={`msg ${m.mine ? 'mine' : ''} ${grouped ? 'grouped' : 'first'}`}>
      {!m.mine && <div className="msg-avatar">{!grouped && <Avatar nick={m.nick} hue={m.hue} size={32} />}</div>}
      <div className={`bubble ${m.image && !m.text ? 'only-image' : ''}`}>
        {!m.mine && !grouped && (
          <div className="msg-author" style={{ color: nameColor(m.hue) }}>{m.nick}</div>
        )}
        {m.image && (
          <img
            className="msg-image"
            src={m.image.url}
            alt={m.image.name}
            style={m.image.w ? { aspectRatio: `${m.image.w} / ${m.image.h}` } : undefined}
            onClick={() => patch({ viewer: m.image })}
          />
        )}
        {m.text && (
          <div className="msg-text">
            <Linkified text={m.text} />
          </div>
        )}
        <time className="msg-time">{time(m.ts)}</time>
      </div>
    </div>
  )
}
