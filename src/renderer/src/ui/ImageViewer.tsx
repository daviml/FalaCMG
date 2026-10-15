import { useStore } from '../state/store'
import { Modal } from './Modal'

export function ImageViewer() {
  const viewer = useStore((s) => s.viewer)
  const close = () => useStore.getState().patch({ viewer: null })
  if (!viewer) return null
  return (
    <Modal onClose={close} className="viewer">
      <img src={viewer.url} alt={viewer.name} onClick={close} />
      <a className="viewer-save" href={viewer.url} download={viewer.name}>Salvar imagem</a>
    </Modal>
  )
}
