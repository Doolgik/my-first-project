import { useState } from 'react';
import type { Message } from '../types';
import { formatTime } from '../lib/utils';

import { avatarColor } from '../lib/utils';

interface Props {
  message: Message;
  mine: boolean;
  peerId?: string;
  showSender?: boolean;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}

export default function MessageBubble({ message, mine, peerId, showSender, onEdit, onDelete }: Props) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content ?? '');

  const readByPeer = !!peerId && message.reads.some((r) => r.userId === peerId);

  if (message.deleted) {
    return (
      <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
        <div className="max-w-[78%] rounded-2xl glass px-4 py-2 text-sm italic text-slate-400">
          This message was deleted
        </div>
      </div>
    );
  }

  const saveEdit = () => {
    const v = draft.trim();
    if (v && v !== message.content) onEdit(message.id, v);
    setEditing(false);
  };

  return (
    <div className={`group flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className="relative max-w-[78%] sm:max-w-[65%]">
        {editing ? (
          <div className="rounded-2xl glass-card p-2">
            <textarea
              className="w-full resize-none rounded-xl bg-white/5 border border-white/10 p-2 text-sm text-slate-100 outline-none"
              value={draft}
              rows={2}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
            <div className="mt-1 flex justify-end gap-2 text-xs">
              <button onClick={() => setEditing(false)} className="px-2 py-1 text-slate-400">
                Cancel
              </button>
              <button onClick={saveEdit} className="rounded-lg bg-brand-600 px-2.5 py-1 font-medium text-white">
                Save
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => mine && setMenu((m) => !m)}
            className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[15px] leading-snug shadow-sm ${
              mine
                ? 'rounded-br-md bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-lg shadow-brand-600/20'
                : 'rounded-bl-md glass text-slate-100'
            } ${mine ? 'cursor-pointer' : ''}`}
          >
            {showSender && message.sender && (
              <span className="mb-0.5 block text-xs font-semibold" style={{ color: avatarColor(message.sender.displayName) }}>
                {message.sender.displayName}
              </span>
            )}
            {message.content}
            <span className={`ml-2 inline-flex translate-y-[2px] items-center gap-1 text-[10px] ${mine ? 'text-indigo-200' : 'text-slate-400'}`}>
              {message.editedAt && <span className="italic">edited</span>}
              {formatTime(message.createdAt)}
              {mine && (
                <span className={readByPeer ? 'text-sky-300' : ''} title={readByPeer ? 'Read' : 'Sent'}>
                  {message.pending ? '🕗' : readByPeer ? '✓✓' : '✓'}
                </span>
              )}
            </span>
          </div>
        )}

        {menu && mine && !editing && (
          <div className="absolute right-0 top-full z-10 mt-1 w-32 overflow-hidden rounded-2xl glass-card text-sm shadow-2xl animate-pop">
            <button
              className="block w-full px-4 py-2 text-left text-slate-200 hover:bg-white/10"
              onClick={() => {
                setEditing(true);
                setMenu(false);
              }}
            >
              Edit
            </button>
            <button
              className="block w-full px-4 py-2 text-left text-red-400 hover:bg-white/10"
              onClick={() => {
                onDelete(message.id);
                setMenu(false);
              }}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
