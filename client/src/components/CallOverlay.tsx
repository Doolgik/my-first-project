import { useEffect, useRef } from 'react';
import { useCalls } from '../store/calls';
import Avatar from './Avatar';

export default function CallOverlay() {
  const { state, peer, media, isCaller, muted, cameraOff, localStream, remoteStream, error, acceptCall, rejectCall, endCall, toggleMute, toggleCamera } = useCalls();
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localRef.current && localStream) localRef.current.srcObject = localStream;
  }, [localStream, state]);
  useEffect(() => {
    if (remoteRef.current && remoteStream) remoteRef.current.srcObject = remoteStream;
  }, [remoteStream, state]);

  if (state === 'idle' || !peer) return null;

  const isVideo = media === 'video';
  const label =
    state === 'incoming' ? `Incoming ${isVideo ? 'video ' : ''}call` :
    state === 'outgoing' ? 'Calling…' :
    state === 'connecting' ? 'Connecting…' : 'In call';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
      {/* Remote video / avatar */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {isVideo && remoteStream && state === 'active' ? (
          <video ref={remoteRef} autoPlay playsInline className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Avatar name={peer.displayName} src={peer.avatarUrl} size={128} />
            <div className="text-center">
              <h2 className="text-2xl font-bold">{peer.displayName}</h2>
              <p className="mt-1 text-slate-400">{error ?? label}</p>
            </div>
          </div>
        )}

        {/* Local preview */}
        {isVideo && localStream && (
          <video ref={localRef} autoPlay playsInline muted className="absolute bottom-4 right-4 h-40 w-28 rounded-xl border border-slate-700 object-cover shadow-lg" />
        )}

        {isVideo && remoteStream && state === 'active' && (
          <div className="absolute left-0 right-0 top-0 bg-gradient-to-b from-black/60 to-transparent p-4 text-center">
            <h2 className="text-lg font-semibold">{peer.displayName}</h2>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-5 bg-slate-900/80 py-6 pb-safe">
        {state === 'incoming' ? (
          <>
            <button onClick={rejectCall} className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 transition hover:bg-red-500" aria-label="Decline">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.34.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 3.07 9.5"/><path d="M22 2 2 22"/></svg>
            </button>
            <button onClick={acceptCall} className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 transition hover:bg-emerald-500" aria-label="Accept">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.81.36 1.6.7 2.34a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.74-1.27a2 2 0 0 1 2.11-.45c.74.34 1.53.57 2.34.7A2 2 0 0 1 22 16.92z"/></svg>
            </button>
          </>
        ) : (
          <>
            <button onClick={toggleMute} className={`flex h-14 w-14 items-center justify-center rounded-full transition ${muted ? 'bg-white text-slate-900' : 'bg-slate-700 hover:bg-slate-600'}`} aria-label="Mute">
              {muted ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1l22 22"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/></svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4"/></svg>
              )}
            </button>
            {isVideo && (
              <button onClick={toggleCamera} className={`flex h-14 w-14 items-center justify-center rounded-full transition ${cameraOff ? 'bg-white text-slate-900' : 'bg-slate-700 hover:bg-slate-600'}`} aria-label="Camera">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m23 7-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              </button>
            )}
            <button onClick={() => endCall(true)} className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 transition hover:bg-red-500" aria-label="Hang up">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.34.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 3.07 9.5"/><path d="M22 2 2 22"/></svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
