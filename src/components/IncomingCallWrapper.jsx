'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { listenForIncomingCall, acceptCallSignal, declineCallSignal } from '../lib/callSignal';
import IncomingCallModal from './IncomingCallModal';
import ActiveCall from './ActiveCall';

export default function IncomingCallWrapper() {
  const { user } = useAuth();
  const [incoming, setIncoming] = useState(null);
  const [active,   setActive]   = useState(null);
  const dismissedRef = useRef(false);

  useEffect(() => {
    if (!user?.uid) return;
    dismissedRef.current = false;

    const unsub = listenForIncomingCall(
      user.uid,
      (signal) => {
        if (dismissedRef.current) return;
        if (signal.callerUid === user.uid) return;
        setIncoming(signal);
      },
      () => setIncoming(null)
    );

    return () => { dismissedRef.current = true; unsub(); };
  }, [user?.uid]);

  const handleAccept = useCallback(async () => {
    if (!incoming) return;
    const snap = { ...incoming };
    setIncoming(null);
    await acceptCallSignal(user.uid).catch(() => {});
    setActive(snap);
  }, [incoming, user]);

  const handleDecline = useCallback(async () => {
    if (!incoming) return;
    await declineCallSignal(user.uid).catch(() => {});
    setIncoming(null);
  }, [incoming, user]);

  return (
    <>
      {incoming && !active && (
        <IncomingCallModal
          callerName={incoming.callerName}
          callType={incoming.callType}
          onAccept={handleAccept}
          onDecline={handleDecline}
        />
      )}
      {active && (
        <ActiveCall
          callId={active.callId}
          callType={active.callType}
          callerName={active.callerName}
          onClose={() => setActive(null)}
        />
      )}
    </>
  );
}
