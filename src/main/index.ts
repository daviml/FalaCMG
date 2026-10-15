import { app, BrowserWindow, desktopCapturer, ipcMain, Menu, Tray, nativeImage, session, shell } from 'electron'
import { join, resolve } from 'node:path'
import { cancelCapture, capturePttBinding, initPtt, pttAvailable, setPttBinding, stopPtt, type PttBinding } from './ptt'

// Permite rodar várias instâncias para teste local: `npm run dev -- --profile=b`
const profile = process.argv.find((a) => a.startsWith('--profile='))?.split('=')[1]
if (profile) app.setPath('userData', join(app.getPath('appData'), `FalaCMG-${profile}`))

const iconPath = join(__dirname, '../../resources/icon.png')
let win: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false

// Links de convite: falacmg://entrar/<código>. Abrir o link inicia o app (ou chama a instância aberta).
const PROTOCOL = 'falacmg'
if (profile) {
  // Instâncias de teste não registram o protocolo (ficaria apontando para o perfil de teste)
} else if (process.defaultApp) {
  // Em desenvolvimento o Windows precisa saber qual script o electron.exe deve abrir
  app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [resolve(process.argv[1])])
} else if (process.env.PORTABLE_EXECUTABLE_FILE) {
  // Versão portátil roda de uma pasta temporária: o link deve abrir o .exe original
  app.setAsDefaultProtocolClient(PROTOCOL, process.env.PORTABLE_EXECUTABLE_FILE, [])
} else {
  app.setAsDefaultProtocolClient(PROTOCOL)
}
let pendingInvite: string | null = null
const findInvite = (argv: string[]) => argv.find((a) => a.toLowerCase().startsWith(`${PROTOCOL}://`)) ?? null

function deliverInvite(url: string | null): void {
  if (!url) return
  if (win && !win.webContents.isLoading()) win.webContents.send('invite', url)
  else pendingInvite = url
}
pendingInvite = findInvite(process.argv)

function createWindow(): void {
  win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 760,
    minHeight: 500,
    title: profile ? `FalaCMG (${profile})` : 'FalaCMG',
    icon: iconPath,
    backgroundColor: '#111318',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      // Chamada continua rodando com a janela minimizada / na bandeja
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required'
    }
  })

  // Fechar a janela só esconde para a bandeja; sair de verdade é pelo menu da bandeja
  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault()
      win?.hide()
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  initPtt(win.webContents)

  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

function createTray(): void {
  tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 }))
  tray.setToolTip('FalaCMG')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Abrir FalaCMG', click: () => win?.show() },
      { type: 'separator' },
      { label: 'Sair', click: () => { quitting = true; app.quit() } }
    ])
  )
  tray.on('click', () => win?.show())
}

if (!profile && !app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', (_e, argv) => {
    win?.show()
    win?.focus()
    deliverInvite(findInvite(argv))
  })

  app.whenReady().then(() => {
    app.setAppUserModelId('br.com.falacmg')
    // Microfone e captura de tela sem pop-up de permissão
    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
      cb(['media', 'display-capture', 'notifications'].includes(permission))
    })
    // Transmissão de tela: o renderer mostra o próprio seletor e avisa qual fonte quer antes do getDisplayMedia
    let pendingShare: { id: string; audio: boolean } | null = null
    ipcMain.handle('screen:sources', async () => {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: true
      })
      return sources
        .filter((s) => s.name !== win?.getTitle())
        .map((s) => ({
          id: s.id,
          name: s.name,
          kind: s.id.startsWith('screen:') ? 'screen' : 'window',
          thumbnail: s.thumbnail.toDataURL(),
          icon: s.appIcon && !s.appIcon.isEmpty() ? s.appIcon.toDataURL() : null
        }))
    })
    ipcMain.on('screen:select', (_e, choice: { id: string; audio: boolean }) => {
      pendingShare = choice
    })
    session.defaultSession.setDisplayMediaRequestHandler(async (_req, cb) => {
      const choice = pendingShare
      pendingShare = null
      if (!choice) return cb({})
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] })
      const source = sources.find((s) => s.id === choice.id)
      if (!source) return cb({})
      // 'loopback' = áudio do sistema (só Windows); o renderer pede restrictOwnAudio para não capturar as vozes do próprio app
      cb(choice.audio ? { video: source, audio: 'loopback' } : { video: source })
    })

    // Convite que abriu o app antes da janela estar pronta
    ipcMain.handle('invite:take', () => {
      const url = pendingInvite
      pendingInvite = null
      return url
    })

    ipcMain.handle('ptt:available', () => pttAvailable())
    ipcMain.handle('ptt:capture', () => capturePttBinding())
    ipcMain.on('ptt:cancel-capture', () => cancelCapture())
    ipcMain.on('ptt:set', (_e, b: PttBinding | null) => setPttBinding(b))
    // Pisca o ícone na barra de tarefas quando chega mensagem com a janela em segundo plano
    ipcMain.on('win:flash', () => {
      if (win && !win.isFocused()) win.flashFrame(true)
    })
    createWindow()
    createTray()
  })

  app.on('before-quit', () => {
    quitting = true
    stopPtt()
  })
}
