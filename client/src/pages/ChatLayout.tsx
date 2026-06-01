import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import ProfileModal from '../components/ProfileModal';
import UserProfileModal from '../components/UserProfileModal';
import NewGroupModal from '../components/NewGroupModal';
import GroupInfoModal from '../components/GroupInfoModal';
import CallOverlay from '../components/CallOverlay';
import { useChat } from '../store/chat';
import { useSocketEvents } from '../hooks/useSocketEvents';
import { registerServiceWorker, enablePushNotifications } from '../lib/push';

export default function ChatLayout() {
  useSocketEvents();
  const { activeId, metas, setActive } = useChat();

  // Service worker + push: register, re-subscribe if already granted, and let
  // notification clicks open the right conversation.
  useEffect(() => {
    registerServiceWorker().then(() => {
      if ('Notification' in window && Notification.permission === 'granted') {
        enablePushNotifications().catch(() => {});
      }
    });
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'open-conversation' && e.data.conversationId) setActive(e.data.conversationId);
    };
    navigator.serviceWorker?.addEventListener('message', onMsg);
    const params = new URLSearchParams(window.location.search);
    const c = params.get('c');
    if (c) {
      setActive(c);
      window.history.replaceState({}, '', '/');
    }
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg);
  }, [setActive]);
  const [showSettings, setShowSettings] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [groupInfo, setGroupInfo] = useState(false);
  const [newGroupType, setNewGroupType] = useState<'GROUP' | 'CHANNEL' | null>(null);

  const activeMeta = activeId ? metas[activeId] : null;

  return (
    <div className="app-bg h-dvh w-full overflow-hidden text-slate-100">
      <div className="mx-auto flex h-full max-w-6xl">
        <aside className={`h-full w-full md:block md:w-[360px] md:shrink-0 md:border-r md:border-white/5 ${activeId ? 'hidden md:block' : 'block'}`}>
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
            <div className="chat-wallpaper hidden h-full flex-col items-center justify-center text-center md:flex">
              <div className="glass mb-5 flex h-24 w-24 items-center justify-center rounded-[1.75rem] text-5xl shadow-2xl">💬</div>
              <h2 className="text-2xl font-bold tracking-tight text-white">Pulse Messenger</h2>
              <p className="mt-2 max-w-xs text-sm text-slate-400">Select a conversation, start a chat, or create a group to begin.</p>
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
