'use client';
import { useEffect } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useOnlineStatus(user) {
  useEffect(() => {
    if (!user?.uid) return;

    const ref = doc(db, 'users', user.uid);

    async function setOnline() {
      try { await updateDoc(ref, { online: true,  lastSeen: serverTimestamp() }); } catch {}
    }
    async function setOffline() {
      try { await updateDoc(ref, { online: false, lastSeen: serverTimestamp() }); } catch {}
    }

    setOnline();

    window.addEventListener('focus',            setOnline);
    window.addEventListener('blur',             setOffline);
    window.addEventListener('beforeunload',     setOffline);
    document.addEventListener('visibilitychange', () => {
      document.hidden ? setOffline() : setOnline();
    });

    return () => {
      setOffline();
      window.removeEventListener('focus',         setOnline);
      window.removeEventListener('blur',          setOffline);
      window.removeEventListener('beforeunload',  setOffline);
    };
  }, [user?.uid]); // eslint-disable-line
}
