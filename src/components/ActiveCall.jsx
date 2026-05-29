'use client';
import { useEffect, useState, useRef } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff, Signal } from 'lucide-react';
import { answerCall, getMedia } from '../lib/webrtc';
import Avatar from './Avatar';

export default function ActiveCall({ callId, callType, callerName, onClose }) {
  const [connState, setConnState] = useState('new');
  const [muted,     setMuted]     = useState(false);
  const [videoOff,  setVideoOff]  = useState(false);
  const [duration,  setDuration]  = useState(0);

  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null); // hidden — carries audio for both voice and video calls

  const localStreamRef = useRef(null);
  const hangupRef      = useRef(null);
  const timerRef       = useRef(null);
  const mountedRef     = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function init() {
      const stream = await getMedia(callType === 'video');
      if (!mountedRef.current) return;
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const hangup = await answerCall(
        callId,
        stream,
        remoteVideoRef.current,
        remoteAudioRef.current,
        (state) => {
          if (!mountedRef.current) return;
          setConnState(state);
          if (state === 'connected' && !timerRef.current) {
            timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
          }
          if (state === 'ended' || state === 'failed') {
            setTimeout(() => { if (mountedRef.current) onClose(); }, 1000);
          }
        }
      );

      if (!mountedRef.current) { hangup?.(); return; }
      hangupRef.current = hangup;
    }

    init().catch(console.error);

    return () => {
      mountedRef.current = false;
      clearInterval(timerRef.current);
      hangupRef.current?.();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []); // eslint-disable-line

  function fmt(s) { return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }
  function toggleMute()  { const a = localStreamRef.current?.getAudioTracks()[0]; if (a) { a.enabled = !a.enabled; setMuted(m => !m); } }
  function toggleVideo() { const v = localStreamRef.current?.getVideoTracks()[0]; if (v) { v.enabled = !v.enabled; setVideoOff(x => !x); } }

  const connLabel =
    connState === 'connected'  ? 'Connected' :
    connState === 'ended'      ? 'Call ended' : 'Connecting…';

  return (
    <div className="fixed inset-0 z-50 bg-bg0 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-bg1 border border-border2 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
        style={{ height: callType === 'video' ? 560 : 420 }}>

        {/* Hidden audio element — plays remote audio for BOTH voice and video calls */}
        <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

        <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Avatar name={callerName} size={32} />
            <div>
              <p className="font-bold text-white text-sm">{callerName}</p>
              <p className="text-white/40 text-xs">{connState === 'connected' ? fmt(duration) : connLabel}</p>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border
            ${connState === 'connected' ? 'bg-green-500/20 border-green-500/30' : 'bg-accent/20 border-accent/30'}`}>
            <Signal size={10} className={connState === 'connected' ? 'text-green-400' : 'text-accentL'} />
            <span className={`text-xs font-medium ${connState === 'connected' ? 'text-green-400' : 'text-accentL'}`}>
              {connLabel}
            </span>
          </div>
        </div>

        <div className="flex-1 bg-black relative overflow-hidden">
          {callType === 'video' ? (
            <>
              <video ref={remoteVideoRef} autoPlay playsInline
                className="w-full h-full object-cover" />
              <video ref={localVideoRef} autoPlay playsInline muted
                className="absolute bottom-3 right-3 w-32 h-24 rounded-xl object-cover border-2 border-white/20 shadow-lg"
                style={{ display: videoOff ? 'none' : 'block' }} />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Avatar name={callerName} size={80} />
              <p className="text-white/50 text-sm">{connLabel}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-4 p-5 border-t border-white/10 flex-shrink-0">
          <button onClick={toggleMute}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition
              ${muted ? 'bg-danger/20 text-danger border border-danger/30' : 'bg-surface2 text-textP hover:bg-surface3'}`}>
            {muted ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          {callType === 'video' && (
            <button onClick={toggleVideo}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition
                ${videoOff ? 'bg-danger/20 text-danger border border-danger/30' : 'bg-surface2 text-textP hover:bg-surface3'}`}>
              {videoOff ? <VideoOff size={18} /> : <Video size={18} />}
            </button>
          )}
          <button onClick={onClose}
            className="w-14 h-14 rounded-full bg-danger flex items-center justify-center shadow-lg shadow-danger/40 hover:bg-danger/80 transition">
            <PhoneOff size={22} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
