'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, updateProfile,
} from 'firebase/auth';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(undefined);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let profileUnsub = () => {};

    const authUnsub = onAuthStateChanged(auth, firebaseUser => {
      profileUnsub(); // clean up previous listener

      if (firebaseUser) {
        setUser(firebaseUser);
        // Live listener — profile updates instantly everywhere when saved
        profileUnsub = onSnapshot(
          doc(db, 'users', firebaseUser.uid),
          snap => { if (snap.exists()) setProfile(snap.data()); },
          err  => console.warn('Profile listener error:', err)
        );
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => { authUnsub(); profileUnsub(); };
  }, []);

  async function signUp({ email, password, displayName, username }) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid, displayName,
      username: username.toLowerCase().replace(/\s/g, ''),
      email, status: "Hey, I'm using P&B!", avatar: null,
      online: true, createdAt: serverTimestamp(), lastSeen: serverTimestamp(),
      botEnabled: false,
    });
    return cred.user;
  }

  async function signIn({ email, password }) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  }

  async function logOut() {
    setUser(null); setProfile(null);
    try { await signOut(auth); } catch {}
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading: user === undefined, signUp, signIn, logOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
