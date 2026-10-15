import { useEffect, useState } from 'react'
import type { ScreenSource } from '../../../preload'
import { platform } from '../platform'
import { SHARE_PRESETS, useSettings, type SharePresetId } from '../state/settings'
import { useStore } from '../state/store'
import { startShare } from '../net/screen'
import { Modal } from './Modal'

export function SharePicker() {
  const { sharePreset, shareAudio, set } = useSettings()
  const close = () => useStore.getState().patch({ sharePickerOpen: false })
  const [sources, setSources] = useState<ScreenSource[] | null>(null)
  const [tab, setTab] = useState<'screen' | 'window'>('screen')
  const [selected, setSelected] = useState<ScreenSource | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    // Na web o navegador mostra o próprio seletor de tela
    if (platform.isWeb) return
    const load = () => platform.screen.sources().then(setSources)
    load()
    // Atualiza as miniaturas enquanto o seletor está aberto
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
  }, [])

  const list = (sources ?? []).filter((s) => s.kind === tab)

  const go = async (src: ScreenSource | null = selected) => {
    if (!src && !platform.isWeb) return
    setStarting(true)
    setError(null)
    try {
      await startShare(src, shareAudio, sharePreset)
      close()
    } catch (e) {
      console.error(e)
      // Cancelar o seletor do navegador também cai aqui
      setError((e as Error).name === 'NotAllowedError' ? null : 'Não foi possível iniciar a transmissão dessa fonte.')
      setStarting(false)
    }
  }

  return (
    <Modal onClose={close}>
      <div className="dialog share-picker">
        <h2>Transmitir tela</h2>

        {platform.isWeb ? (
          <p className="muted">
            Ao continuar, o navegador pergunta o que transmitir: a <b>tela inteira</b>, uma <b>janela</b> ou uma <b>aba</b>. Para mandar o
            som do PC, escolha a tela inteira (ou uma aba) e marque <b>"Compartilhar áudio do sistema"</b>. Janela sozinha vai sem som. Para
            transmitir o jogo com som, use o app do Windows.
          </p>
        ) : (
          <>
            <div className="tabs">
              <button className={tab === 'screen' ? 'active' : ''} onClick={() => setTab('screen')}>Telas</button>
              <button className={tab === 'window' ? 'active' : ''} onClick={() => setTab('window')}>Janelas</button>
            </div>

            <div className="source-grid">
              {sources === null && <p className="hint">Carregando…</p>}
              {sources !== null && list.length === 0 && <p className="hint">Nada encontrado.</p>}
              {list.map((s) => (
                <button
                  key={s.id}
                  className={`source ${selected?.id === s.id ? 'selected' : ''}`}
                  onClick={() => setSelected(s)}
                  onDoubleClick={() => {
                    setSelected(s)
                    go(s)
                  }}
                >
                  <img src={s.thumbnail} alt="" />
                  <span className="source-name">
                    {s.icon && <img src={s.icon} alt="" className="source-icon" />}
                    {s.name}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="grid-2">
          <label className="field">
            <span>Qualidade</span>
            <select value={sharePreset} onChange={(e) => set({ sharePreset: e.target.value as SharePresetId })}>
              {Object.entries(SHARE_PRESETS).map(([id, p]) => (
                <option key={id} value={id}>{p.label} · {p.desc}</option>
              ))}
            </select>
          </label>
          <div className="field">
            <span>Áudio</span>
            <label className="check share-audio">
              <input type="checkbox" checked={shareAudio} onChange={(e) => set({ shareAudio: e.target.checked })} />
              Transmitir o som do PC (jogo, vídeo, música)
            </label>
          </div>
        </div>
        {error && <p className="error-text">{error}</p>}

        <div className="dialog-actions">
          <button className="ghost" onClick={close}>Cancelar</button>
          <button className="primary" disabled={(!platform.isWeb && !selected) || starting} onClick={() => go()}>
            {starting ? 'Iniciando…' : platform.isWeb ? 'Escolher o que transmitir' : 'Transmitir ao vivo'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
