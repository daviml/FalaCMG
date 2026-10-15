import { contextBridge, ipcRenderer } from 'electron'

export type PttBinding = { kind: 'key' | 'mouse'; code: number; label: string }
export type ScreenSource = { id: string; name: string; kind: 'screen' | 'window'; thumbnail: string; icon: string | null }

const api = {
  platform: process.platform,
  screen: {
    sources: (): Promise<ScreenSource[]> => ipcRenderer.invoke('screen:sources'),
    /** Define a fonte usada pelo próximo getDisplayMedia */
    select: (id: string, audio: boolean) => ipcRenderer.send('screen:select', { id, audio })
  },
  ptt: {
    available: (): Promise<boolean> => ipcRenderer.invoke('ptt:available'),
    /** Espera a próxima tecla / botão lateral do mouse (Esc cancela → null) */
    capture: (): Promise<PttBinding | null> => ipcRenderer.invoke('ptt:capture'),
    cancelCapture: () => ipcRenderer.send('ptt:cancel-capture'),
    set: (binding: PttBinding | null) => ipcRenderer.send('ptt:set', binding),
    onState: (cb: (down: boolean) => void) => {
      const listener = (_e: unknown, down: boolean) => cb(down)
      ipcRenderer.on('ptt:state', listener)
      return (): void => {
        ipcRenderer.removeListener('ptt:state', listener)
      }
    }
  },
  flash: () => ipcRenderer.send('win:flash'),
  invite: {
    /** Convite recebido antes da interface carregar (app aberto pelo link) */
    take: (): Promise<string | null> => ipcRenderer.invoke('invite:take'),
    onInvite: (cb: (url: string) => void) => {
      const listener = (_e: unknown, url: string) => cb(url)
      ipcRenderer.on('invite', listener)
      return (): void => {
        ipcRenderer.removeListener('invite', listener)
      }
    }
  }
}

export type FalaApi = typeof api

contextBridge.exposeInMainWorld('falacmg', api)
