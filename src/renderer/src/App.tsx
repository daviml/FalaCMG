import { useSettings } from './state/settings'
import { useStore } from './state/store'
import { Welcome } from './ui/Welcome'
import { Sidebar } from './ui/Sidebar'
import { ChatPane } from './ui/Chat'
import { SettingsModal } from './ui/Settings'
import { AddRoomModal } from './ui/AddRoomModal'
import { ImageViewer } from './ui/ImageViewer'
import { SharePicker } from './ui/SharePicker'
import { InviteModal } from './ui/InviteModal'

export function App() {
  const nick = useSettings((s) => s.nick)
  const { current, settingsOpen, addRoomOpen, viewer, sharePickerOpen, inviteOpen } = useStore()

  if (!nick) return <Welcome />

  return (
    <div className="shell">
      <Sidebar />
      <ChatPane />
      {settingsOpen && <SettingsModal />}
      {addRoomOpen && <AddRoomModal />}
      {viewer && <ImageViewer />}
      {sharePickerOpen && current && <SharePicker />}
      {inviteOpen && current && <InviteModal />}
    </div>
  )
}
