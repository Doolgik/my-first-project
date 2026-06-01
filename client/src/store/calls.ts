import { create } from 'zustand';
import { api } from '../lib/api';
import type { CallMedia, CallState, User } from '../types';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];

interface CallSignal {
  type: 'offer' | 'answer' | 'ice' | 'end' | 'reject' | 'cancel' | 'busy';
  callId: string;
  media?: CallMedia;
  fromUserId: string;
  from?: User;
  payload?: any;
}

interface CallsState {
  state: CallState;
  callId: string | null;
  peer: User | null;
  media: CallMedia;
  isCaller: boolean;
  muted: boolean;
  cameraOff: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  error: string | null;

  startCall: (peer: User, media: CallMedia) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: (notify?: boolean) => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  handleSignal: (s: CallSignal) => Promise<void>;
}

let pc: RTCPeerConnection | null = null;
let pendingCandidates: RTCIceCandidateInit[] = [];
let pendingOffer: RTCSessionDescriptionInit | null = null;
let ringTimeout: ReturnType<typeof setTimeout> | null = null;

function send(toUserId: string, type: string, callId: string, extra: Record<string, unknown> = {}) {
  api.post('/calls/signal', { toUserId, type, callId, ...extra }).catch(() => {});
}

function teardown() {
  if (ringTimeout) {
    clearTimeout(ringTimeout);
    ringTimeout = null;
  }
  if (pc) {
    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.onconnectionstatechange = null;
    pc.close();
    pc = null;
  }
  pendingCandidates = [];
  pendingOffer = null;
}

export const useCalls = create<CallsState>((set, get) => {
  function createPeer(remoteUserId: string, callId: string) {
    const conn = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    conn.onicecandidate = (e) => {
      if (e.candidate) send(remoteUserId, 'ice', callId, { payload: e.candidate.toJSON() });
    };
    conn.ontrack = (e) => {
      const [stream] = e.streams;
      set({ remoteStream: stream });
    };
    conn.onconnectionstatechange = () => {
      if (conn.connectionState === 'connected') {
        if (ringTimeout) { clearTimeout(ringTimeout); ringTimeout = null; }
        set({ state: 'active' });
      }
      if (['failed', 'disconnected', 'closed'].includes(conn.connectionState)) {
        if (get().state === 'active') get().endCall(true);
      }
    };
    return conn;
  }

  async function getMedia(media: CallMedia) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Media devices unavailable (needs HTTPS and a mic/camera)');
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: media === 'video' ? { width: 1280, height: 720 } : false,
    });
    set({ localStream: stream });
    return stream;
  }

  return {
    state: 'idle',
    callId: null,
    peer: null,
    media: 'audio',
    isCaller: false,
    muted: false,
    cameraOff: false,
    localStream: null,
    remoteStream: null,
    error: null,

    startCall: async (peer, media) => {
      if (get().state !== 'idle') return;
      const callId = crypto.randomUUID();
      set({ state: 'outgoing', callId, peer, media, isCaller: true, muted: false, cameraOff: false, error: null });
      try {
        const stream = await getMedia(media);
        pc = createPeer(peer.id, callId);
        stream.getTracks().forEach((t) => pc!.addTrack(t, stream));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        send(peer.id, 'offer', callId, { media, payload: offer });
        // Auto-cancel if the callee doesn't pick up.
        ringTimeout = setTimeout(() => {
          if (get().state === 'outgoing') get().endCall(true);
        }, 35000);
      } catch (err) {
        set({ error: (err as Error)?.message ?? 'Could not access microphone/camera', state: 'idle' });
        teardown();
      }
    },

    acceptCall: async () => {
      const { peer, callId, media } = get();
      if (!peer || !callId || !pendingOffer) return;
      set({ state: 'connecting' });
      try {
        const stream = await getMedia(media);
        pc = createPeer(peer.id, callId);
        stream.getTracks().forEach((t) => pc!.addTrack(t, stream));
        await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer));
        for (const c of pendingCandidates) await pc.addIceCandidate(c).catch(() => {});
        pendingCandidates = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send(peer.id, 'answer', callId, { payload: answer });
      } catch (err) {
        set({ error: 'Could not access microphone/camera' });
        get().endCall(true);
      }
    },

    rejectCall: () => {
      const { peer, callId } = get();
      if (peer && callId) send(peer.id, 'reject', callId);
      teardown();
      set({ state: 'idle', callId: null, peer: null, localStream: null, remoteStream: null });
    },

    endCall: (notify = true) => {
      const { peer, callId, localStream, state } = get();
      if (notify && peer && callId) {
        send(peer.id, state === 'outgoing' ? 'cancel' : 'end', callId);
      }
      localStream?.getTracks().forEach((t) => t.stop());
      teardown();
      set({ state: 'idle', callId: null, peer: null, localStream: null, remoteStream: null, muted: false, cameraOff: false });
    },

    toggleMute: () => {
      const { localStream, muted } = get();
      localStream?.getAudioTracks().forEach((t) => (t.enabled = muted));
      set({ muted: !muted });
    },

    toggleCamera: () => {
      const { localStream, cameraOff } = get();
      localStream?.getVideoTracks().forEach((t) => (t.enabled = cameraOff));
      set({ cameraOff: !cameraOff });
    },

    handleSignal: async (s) => {
      const cur = get();
      switch (s.type) {
        case 'offer': {
          // Busy if already in a call with someone else.
          if (cur.state !== 'idle') {
            send(s.fromUserId, 'busy', s.callId);
            return;
          }
          pendingOffer = s.payload;
          pendingCandidates = [];
          set({
            state: 'incoming',
            callId: s.callId,
            peer: s.from ?? ({ id: s.fromUserId, username: '', displayName: 'Unknown' } as User),
            media: s.media ?? 'audio',
            isCaller: false,
          });
          break;
        }
        case 'answer': {
          if (pc && cur.callId === s.callId) {
            await pc.setRemoteDescription(new RTCSessionDescription(s.payload)).catch(() => {});
            for (const c of pendingCandidates) await pc.addIceCandidate(c).catch(() => {});
            pendingCandidates = [];
          }
          break;
        }
        case 'ice': {
          if (cur.callId !== s.callId) break;
          if (pc && pc.remoteDescription) await pc.addIceCandidate(s.payload).catch(() => {});
          else pendingCandidates.push(s.payload);
          break;
        }
        case 'end':
        case 'reject':
        case 'cancel':
        case 'busy': {
          if (cur.callId === s.callId || cur.state !== 'idle') {
            cur.localStream?.getTracks().forEach((t) => t.stop());
            teardown();
            set({
              state: 'idle',
              callId: null,
              peer: null,
              localStream: null,
              remoteStream: null,
              error: s.type === 'busy' ? 'User is busy' : null,
            });
          }
          break;
        }
      }
    },
  };
});
