import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import ProfileModal from '../components/ProfileModal';
import UserProfileModal from '../components/UserProfileModal';
import NewGroupModal from '../components/NewGroupModal';
import GroupInfoModal from '../components/GroupInfoModal';
import CallOverlay from '../components/CallOverlay';
import { useChat } from '../store/chat';
import { useSocketEvents } from '../hooks/useSocketEvents';

export default function ChatLayout() {
  useSocketEvents();
  const { activeId, metas, setActive } = useChat();
  const [showSettings, setShowSettings] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [groupInfo, setGroupInfo] = useState(false);
  const [newGroupType, setNewGroupType] = useState<'GROUP' | 'CHANNEL' | null>(null);

  const activeMeta = activeId ? metas[activeId] : null;

  return (
    <div className="h-dvh w-full overflow-hidden bg-slate-950 text-slate-100">
      <div className="mx-auto flex h-full max-w-6xl md:border-x md:border-slate-800">
        <aside className={`h-full w-full border-slate-800 md:block md:w-[340px] md:shrink-0 md:border-r ${activeId ? 'hidden md:block' : 'block'}`}>
          <Sidebar
            onSelect={setActive}
            onOpenProfile={setProfileUserId}
            onOpenSettings={() => setShowSettings(true)}
            onNewGroup={setNewGroupType}
          />
        </aside>

        <main className={`h-full flex-1 ${activeId ? 'block' : 'hidden md:block'}`}>
          {activeId ? (
            <div className="h-full animate-slide-in md:animate-none">
              <ChatWindow
                conversationId={activeId}
                onBack={() => setActive(null)}
                onOpenProfile={setProfileUserId}
                onOpenGroupInfo={() => setGroupInfo(true)}
              />
            </div>
          ) : (
            <div className="hidden h-full flex-col items-center justify-center text-center md:flex">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-800 text-4xl">💬</div>
              <h2 className="text-xl font-semibold text-white">Pulse Messenger</h2>
              <p className="mt-1 max-w-xs text-sm text-slate-500">Select a conversation, start a chat, or create a group to begin.</p>
            </div>
          )}
        </main>
      </div>

      {showSettings && <ProfileModal onClose={() => setShowSettings(false)} />}
      {profileUserId && (
        <UserProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} onOpenConversation={setActive} />
      )}
      {newGroupType && (
        <NewGroupModal
          initialType={newGroupType}
          onClose={() => setNewGroupType(null)}
          onCreated={(id) => { setNewGroupType(null); setActive(id); }}
        />
      )}
      {groupInfo && activeMeta && activeMeta.type !== 'DIRECT' && (
        <GroupInfoModal
          meta={activeMeta}
          onClose={() => setGroupInfo(false)}
          onLeft={() => { setGroupInfo(false); setActive(null); }}
          onOpenProfile={(uid) => { setGroupInfo(false); setProfileUserId(uid); }}
        />
      )}

      <CallOverlay />
    </div>
  );
}
