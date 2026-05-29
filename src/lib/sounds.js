// MSN Messenger-style notification sounds using Web Audio API
// No audio files needed — generated programmatically

let _ctx = null;

function ctx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

function note(freq, start, dur, vol = 0.3, type = 'sine') {
  const c    = ctx();
  const osc  = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type            = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, c.currentTime + start);
  gain.gain.linearRampToValueAtTime(vol,   c.currentTime + start + 0.01);
  gain.gain.linearRampToValueAtTime(vol,   c.currentTime + start + dur - 0.02);
  gain.gain.linearRampToValueAtTime(0,     c.currentTime + start + dur);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + dur + 0.01);
}

// Classic MSN "nudge/message" sound — ascending two-tone ding
// Sounds like: duh-DING (low then high)
export function playMessageSound() {
  try {
    note(523, 0,    0.12, 0.25); // C5
    note(659, 0.13, 0.18, 0.30); // E5 — slightly louder
    note(784, 0.25, 0.22, 0.28); // G5 — chord finish
  } catch {}
}

// Short "sent" confirmation — single soft tick
export function playSentSound() {
  try {
    note(1047, 0, 0.08, 0.10); // C6 — quick high tick
  } catch {}
}

// Incoming call ringing — repeating pattern
let _ringInterval = null;
export function startRingSound() {
  stopRingSound();
  function ring() {
    try {
      note(880, 0,   0.3, 0.25);
      note(880, 0.4, 0.3, 0.25);
    } catch {}
  }
  ring();
  _ringInterval = setInterval(ring, 2000);
}
export function stopRingSound() {
  if (_ringInterval) { clearInterval(_ringInterval); _ringInterval = null; }
}
