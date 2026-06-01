/* Simple WebAudio ringtone — no audio asset required. */
let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function beep(freq: number, start: number, duration: number) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + start + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + duration + 0.05);
}

function pattern() {
  beep(880, 0, 0.25);
  beep(660, 0.32, 0.3);
}

export function startRingtone() {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    ctx.resume?.();
    if (timer) return;
    pattern();
    timer = setInterval(pattern, 2000);
  } catch {
    /* audio may be blocked until a user gesture; non-fatal */
  }
}

export function stopRingtone() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
