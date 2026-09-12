let actx: AudioContext | null = null;
let muted = false;

function ctx() {
  if (!actx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    actx = new AC();
  }
  if (actx.state === "suspended") void actx.resume();
  return actx;
}

export function setMuted(m: boolean) {
  muted = m;
}
export function isMuted() {
  return muted;
}

function blip(freq: number, dur: number, type: OscillatorType, gain: number, slide = 0) {
  if (muted) return;
  const a = ctx();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), a.currentTime + dur);
  g.gain.setValueAtTime(0.0001, a.currentTime);
  g.gain.exponentialRampToValueAtTime(gain, a.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + dur + 0.02);
}

function noise(dur: number, gain: number) {
  if (muted) return;
  const a = ctx();
  if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const g = a.createGain();
  g.gain.value = gain;
  const f = a.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 1400;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

export const sfx = {
  jump: () => blip(420, 0.13, "square", 0.05, 260),
  walljump: () => blip(340, 0.13, "square", 0.05, 300),
  dash: () => blip(760, 0.16, "sawtooth", 0.045, -420),
  land: () => noise(0.08, 0.05),
  gem: () => {
    blip(880, 0.09, "triangle", 0.07);
    setTimeout(() => blip(1320, 0.12, "triangle", 0.06), 70);
  },
  spring: () => blip(300, 0.18, "sine", 0.07, 620),
  death: () => {
    blip(220, 0.3, "sawtooth", 0.06, -170);
    noise(0.22, 0.08);
  },
  win: () => {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.16, "triangle", 0.07), i * 95));
  },
  ui: () => blip(600, 0.05, "square", 0.035),
};

export function unlockAudio() {
  ctx();
}
