// Synthesized retro "terminal" chimes for the FOCUS timer. These are generated
// with the Web Audio API rather than loaded from an audio file, so they behave
// identically in dev and in the packaged (file://) build — no asset paths to break.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

// Warm up the audio engine on a user gesture (clicking START) so the chime can
// still fire later when a session ends on its own while the window is in the
// background. Browsers only allow audio to start after such a gesture.
export function primeAudio(): void {
  getCtx();
}

function blip(
  ac: AudioContext,
  freq: number,
  startAt: number,
  dur: number,
  type: OscillatorType,
  peak: number,
): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  // quick attack + exponential decay = a clean retro beep with no clicks
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(startAt);
  osc.stop(startAt + dur + 0.02);
}

// A soft, very short UI tick. Played on any interactive click (and on a BOARD
// card move). Kept quiet and brief since it fires on every interaction.
export function playClick(): void {
  const ac = getCtx();
  if (!ac) return;
  const t = ac.currentTime + 0.001;
  blip(ac, 1200, t, 0.025, 'triangle', 0.06);
}

// The startup "warp" whoosh: a band-passed noise sweep that rises in pitch and
// volume as the tunnel accelerates, capped with a low boom as the logo lands.
// Fully synthesized (no audio file) so it survives the packaged file:// build.
export function playWhoosh(): void {
  const ac = getCtx();
  if (!ac) return;
  const t = ac.currentTime;
  const dur = 1.9;

  // white-noise rush through a sweeping band-pass filter
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 0.8;
  filter.frequency.setValueAtTime(180, t);
  filter.frequency.exponentialRampToValueAtTime(3200, t + dur * 0.85);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.34, t + dur * 0.8);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(t);
  src.stop(t + dur);

  // low "boom"/thunk on arrival
  const bt = t + dur * 0.82;
  const osc = ac.createOscillator();
  const og = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, bt);
  osc.frequency.exponentialRampToValueAtTime(48, bt + 0.3);
  og.gain.setValueAtTime(0.0001, bt);
  og.gain.exponentialRampToValueAtTime(0.45, bt + 0.02);
  og.gain.exponentialRampToValueAtTime(0.0001, bt + 0.36);
  osc.connect(og).connect(ac.destination);
  osc.start(bt);
  osc.stop(bt + 0.4);
}

// Played when a timer reaches 0. Work sessions get a bright rising three-note
// chime ("done!"); breaks get two lower notes ("back to work").
export function playSessionEnd(mode: 'work' | 'break'): void {
  const ac = getCtx();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  if (mode === 'work') {
    blip(ac, 660, t, 0.16, 'square', 0.18);
    blip(ac, 880, t + 0.12, 0.16, 'square', 0.18);
    blip(ac, 1320, t + 0.24, 0.3, 'triangle', 0.2);
  } else {
    blip(ac, 520, t, 0.16, 'square', 0.16);
    blip(ac, 392, t + 0.14, 0.26, 'square', 0.16);
  }
}
