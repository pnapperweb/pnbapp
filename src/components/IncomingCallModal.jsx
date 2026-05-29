'use client';
import { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import Avatar from './Avatar';

function useRingtone() {
  const ctxRef      = useRef(null);
  const intervalRef = useRef(null);

  function ring() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctxRef.current = ctx;
      function beep(freq, start, dur) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq; osc.type = 'sine';
        gain.gain.setValueAtTime(0, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + start + 0.02);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + dur);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur + 0.05);
      }
      function playRing() { beep(440, 0, 0.4); beep(480, 0.05, 0.4); beep(440, 0.5, 0.4); beep(480, 0.55, 0.4); }
      playRing();
      intervalRef.current = setInterval(playRing, 2500);
    } catch {}
  }

  function stop() {
    clearInterval(intervalRef.current);
    try { ctxRef.current?.close(); } catch {}
  }

  return { ring, stop };
}

export default function IncomingCallModal({ callerName, callType, onAccept, onDecline }) {
  const { ring, stop } = useRingtone();
  useEffect(() => { ring(); return stop; }, []); // eslint-disable-line

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-sm bg-bg1 border border-border2 rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        {/* Caller avatar with ripple */}
        <div className="relative flex items-center justify-center py-10 bg-gradient-to-b from-accent/10 to-transparent">
          <div className="absolute w-36 h-36 rounded-full border border-accent/10 animate-ping" />
          <div className="absolute w-28 h-28 rounded-full border border-accent/20 animate-ping" style={{ animationDelay: '0.4s' }} />
          <div className="relative z-10">
            <Avatar name={callerName} size={76} />
          </div>
        </div>

        {/* Info */}
        <div className="text-center px-6 pb-2">
          <p className="text-textT text-[11px] font-semibold uppercase tracking-widest mb-1">
            Incoming {callType === 'video' ? 'Video' : 'Voice'} Call
          </p>
          <p className="text-textP text-2xl font-bold">{callerName}</p>
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-online/10 rounded-full border border-online/20">
            <div className="w-1.5 h-1.5 rounded-full bg-online animate-pulse" />
            <span className="text-online text-[11px] font-medium">End-to-end encrypted</span>
          </div>
        </div>

        {/* Accept / Decline */}
        <div className="flex items-center justify-center gap-12 p-8 pt-6">
          <div className="flex flex-col items-center gap-2">
            <button onClick={onDecline}
              className="w-16 h-16 rounded-full bg-danger flex items-center justify-center shadow-xl shadow-danger/40 hover:bg-danger/80 active:scale-95 transition">
              <PhoneOff size={24} className="text-white" />
            </button>
            <span className="text-textS text-xs font-medium">Decline</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button onClick={onAccept}
              className="w-16 h-16 rounded-full bg-online flex items-center justify-center shadow-xl shadow-online/40 hover:bg-online/80 active:scale-95 transition">
              {callType === 'video' ? <Video size={24} className="text-white" /> : <Phone size={24} className="text-white" />}
            </button>
            <span className="text-textS text-xs font-medium">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
}
