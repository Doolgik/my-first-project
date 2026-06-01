import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import ProfileModal from '../components/ProfileModal';
import { useChat } from '../store/chat';
import { useSocketEvents } from '../hooks/useSocketEvents';

export default function ChatLayout() {
  useSocketEvents();
  const { activeId, setActive } = useChat();
  const [showProfile, setShowProfile] = useState(false);

  return (
    <div className="h-dvh w-full overflow-hidden bg-slate-950 text-slate-100">
      <div className="mx-auto flex h-full max-w-6xl md:border-x md:border-slate-800">
        {/* Sidebar: full width on mobile (hidden when a chat is open), fixed column on desktop */}
        <aside
          className={`h-full w-full border-slate-800 md:block md:w-[340px] md:shrink-0 md:border-r ${
            activeId ? 'hidden md:block' : 'block'
          }`}
        >
          <Sidebar onSelect={setActive} onOpenProfile={() => setShowProfile(true)} />
        </aside>

        {/* Chat area */}
        <main className={`h-full flex-1 ${activeId ? 'block' : 'hidden md:block'}`}>
          {activeId ? (
            <div className="h-full animate-slide-in md:animate-none">
              <ChatWindow conversationId={activeId} onBack={() => setActive(null)} />
            </div>
          ) : (
            <div className="hidden h-full flex-col items-center justify-center text-center md:flex">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-800 text-4xl">💬</div>
              <h2 className="text-xl font-semibold text-white">Pulse Messenger</h2>
              <p className="mt-1 max-w-xs text-sm text-slate-500">
                Select a conversation or search for someone to start chatting in real time.
              </p>
            </div>
          )}
        </main>
      </div>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </div>
  );
}
