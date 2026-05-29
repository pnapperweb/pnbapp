'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { PhoneOff, X, Mic, MicOff, Video, VideoOff, Signal } from 'lucide-react';
import { createCall, getMedia } from '../lib/webrtc';
import { sendCallSignal, cancelCallSignal } from '../lib/callSignal';
import Avatar from './Avatar';

export default function CallModal({ callType, chatName, chatId, otherUid, currentUser, profile, onClose }) {
  const [phase,     setPhase]     = useState('connecting');
  const [connState, setConnState] = useState('new');
  const [error,     setError]     = useState('');
  const [muted,     setMuted]     = useState(false);
  const [videoOff,  setVideoOff]  = useState(false);
  const [duration,  setDuration]  = useState(0);

  // Media element refs — passed directly to WebRTC so it can attach streams
  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null); // hidden audio element for video calls — carries remote audio

  const localStreamRef = useRef(null);
  const hangupRef      = useRef(null);
  const timerRef       = useRef(null);
  const mountedRef     = useRef(true);
  const callIdRef      = useRef(`${chatId}-${Date.now()}`);

  useEffect(() => {
    mountedRef.current = true;

    async function init() {
      try {
        const stream = await getMedia(callType === 'video');
        if (!mountedRef.current) return;
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const hangup = await createCall(
          callIdRef.current,
          stream,
          remoteVideoRef.current,  // video element — gets remote video+audio stream
          remoteAudioRef.current,  // audio element — fallback / voice-only
          (state) => {
            if (!mountedRef.current) return;
            setConnState(state);
            if (state === 'connected') {
              setPhase('active');
              if (!timerRef.current) {
                timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
              }
            }
            if (['ended', 'failed', 'disconnected'].includes(state)) {
              setTimeout(() => { if (mountedRef.current) onClose(); }, 1500);
            }
          }
        );

        if (!mountedRef.current) { hangup(); return; }
        hangupRef.current = hangup;

        if (otherUid) {
          await sendCallSignal({
            callerUid:  currentUser.uid,
            callerName: profile?.displayName || currentUser?.displayName || 'Someone',
            calleeUid:  otherUid,
            callType,
            callId:     callIdRef.current,
          });
        }

        if (mountedRef.current) setPhase('ringing');
      } catch (e) {
        console.error('[P&B] Call error:', e);
        if (mountedRef.current) { setError(e.message || 'Call failed'); setPhase('error'); }
      }
    }

    init();

    return () => {
      mountedRef.current = false;
      clearInterval(timerRef.current);
      hangupRef.current?.();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      if (otherUid) cancelCallSignal(otherUid).catch(() => {});
    };
  }, []); // eslint-disable-line

  const handleClose = useCallback(async () => {
    clearInterval(timerRef.current);
    hangupRef.current?.();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    if (otherUid) await cancelCallSignal(otherUid).catch(() => {});
    onClose();
  }, [otherUid, onClose]);

  function toggleMute() {
    const a = localStreamRef.current?.getAudioTracks()[0];
    if (a) { a.enabled = !a.enabled; setMuted(m => !m); }
  }
  function toggleVideo() {
    const v = localStreamRef.current?.getVideoTracks()[0];
    if (v) { v.enabled = !v.enabled; setVideoOff(x => !x); }
  }
  function fmt(s) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  const connLabel =
    connState === 'connected'    ? 'Connected' :
    connState === 'connecting'   ? 'Connecting…' :
    connState === 'disconnected' ? 'Reconnecting…' :
    connState === 'ended'        ? 'Call ended' : 'Waiting…';

  return (
    <div className="fixed inset-0 z-50 bg-bg0/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-bg1 border border-border2 rounded-3xl overflow-hidden shadow-2xl flex flex-col relative"
        style={{ height: callType === 'video' ? 560 : 420 }}>

        {phase !== 'active' && (
          <button onClick={handleClose}
            className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white/70 hover:text-white transition">
            <X size={15} />
          </button>
        )}

        {/* Hidden audio element — carries remote audio for BOTH voice and video calls */}
        {/* For video calls, remoteVideoRef also has the stream, but some browsers need this */}
        <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

        {phase === 'error' && (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
            <PhoneOff size={40} className="text-danger" />
            <p className="text-textP font-semibold">Call failed</p>
            <p className="text-textS text-sm">{error}</p>
            <button onClick={handleClose} className="px-6 py-2.5 bg-danger/10 border border-danger/30 text-danger rounded-xl text-sm font-semibold">Close</button>
          </div>
        )}

        {(phase === 'connecting' || phase === 'ringing') && (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="relative flex items-center justify-center">
              <div className="absolute w-36 h-36 rounded-full border border-accent/10 animate-ping" />
              <div className="absolute w-28 h-28 rounded-full border border-accent/20 animate-ping" style={{ animationDelay: '0.5s' }} />
              <Avatar name={chatName} size={76} />
            </div>
            <div className="text-center">
              <p className="text-textP font-bold text-xl">{chatName}</p>
              <p className="text-textS text-sm mt-1">
                {phase === 'connecting' ? 'Setting up call…' : `${callType === 'video' ? '📹 Video' : '📞 Voice'} ringing…`}
              </p>
            </div>
            <button onClick={handleClose}
              className="w-14 h-14 rounded-full bg-danger flex items-center justify-center shadow-lg shadow-danger/40 hover:bg-danger/80 transition">
              <PhoneOff size={22} className="text-white" />
            </button>
          </div>
        )}

        {phase === 'active' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-3">
                <Avatar name={chatName} size={32} />
                <div>
                  <p className="font-bold text-white text-sm">{chatName}</p>
                  <p className="text-white/40 text-xs">{fmt(duration)}</p>
                </div>
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border
                ${connState === 'connected' ? 'bg-green-500/20 border-green-500/30' : 'bg-warning/20 border-warning/30'}`}>
                <Signal size={10} className={connState === 'connected' ? 'text-green-400' : 'text-warning'} />
                <span className={`text-xs font-medium ${connState === 'connected' ? 'text-green-400' : 'text-warning'}`}>
                  {connLabel}
                </span>
              </div>
            </div>

            <div className="flex-1 bg-black relative overflow-hidden">
              {callType === 'video' ? (
                <>
                  {/* Remote video — has both video and audio tracks attached */}
                  <video ref={remoteVideoRef} autoPlay playsInline
                    className="w-full h-full object-cover" />
                  {/* Local preview — muted to avoid echo */}
                  <video ref={localVideoRef} autoPlay playsInline muted
                    className="absolute bottom-3 right-3 w-32 h-24 rounded-xl object-cover border-2 border-white/20 shadow-lg"
                    style={{ display: videoOff ? 'none' : 'block' }} />
                  {videoOff && (
                    <div className="absolute bottom-3 right-3 w-32 h-24 rounded-xl bg-bg3 border-2 border-white/20 flex items-center justify-center">
                      <VideoOff size={20} className="text-textT" />
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <Avatar name={chatName} size={80} />
                  <p className="text-white/50 text-sm">Voice call · {fmt(duration)}</p>
                  {/* Audio element rendered in JSX for voice — same ref as hidden one above */}
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-4 p-5 border-t border-white/10 flex-shrink-0 bg-bg1">
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
              <button onClick={handleClose}
                className="w-14 h-14 rounded-full bg-danger flex items-center justify-center shadow-lg shadow-danger/40 hover:bg-danger/80 transition">
                <PhoneOff size={22} className="text-white" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
