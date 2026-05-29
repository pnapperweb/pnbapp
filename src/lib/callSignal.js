// Firestore-based call signalling
// Completely independent of Stream's WebSocket — works even if Stream isn't connected yet.
// When caller starts a call → writes to /callSignals/{calleeUid}
// Callee listens to their doc → shows incoming call modal
// On accept/decline/timeout → doc is deleted

import {
  doc, setDoc, deleteDoc, onSnapshot, serverTimestamp, addDoc, collection,
} from 'firebase/firestore';
import { db } from './firebase';

const COLLECTION = 'callSignals';
const TIMEOUT_MS = 45000; // 45 seconds ring timeout

// Caller: write a signal to the callee's doc
export async function sendCallSignal({ callerUid, callerName, calleeUid, callType, callId }) {
  await setDoc(doc(db, COLLECTION, calleeUid), {
    callerUid,
    callerName,
    calleeUid,
    callType,   // 'voice' | 'video'
    callId,     // Stream call ID
    status:     'ringing',
    createdAt:  serverTimestamp(),
  });
}

// Caller: cancel the signal (hung up before answer)
export async function cancelCallSignal(calleeUid) {
  try { await deleteDoc(doc(db, COLLECTION, calleeUid)); } catch {}
}

// Callee: accept — just delete the doc (caller watches Stream for join)
export async function acceptCallSignal(calleeUid) {
  try { await deleteDoc(doc(db, COLLECTION, calleeUid)); } catch {}
}

// Callee: decline — delete doc
export async function declineCallSignal(calleeUid) {
  try { await deleteDoc(doc(db, COLLECTION, calleeUid)); } catch {}
}

// Log a call event as a message in the chat thread
export async function logCallMessage({ chatId, callType, status, callerUid, callerName, duration = null }) {
  if (!chatId) return;
  const icons = { missed: '📵', ended: callType === 'video' ? '📹' : '📞', declined: '❌' };
  const labels = { missed: 'Missed call', ended: 'Call ended', declined: 'Call declined' };
  const text = duration
    ? `${icons.ended} ${labels.ended} · ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`
    : `${icons[status] || '📞'} ${labels[status] || 'Call'}`;
  try {
    await addDoc(collection(db, 'messages'), {
      chatId, senderId: callerUid, senderName: callerName,
      text, type: 'call-event', callType, callStatus: status,
      createdAt: serverTimestamp(), read: false, reactions: {},
    });
  } catch {}
}

// Callee: subscribe to incoming calls
// Returns unsubscribe function
export function listenForIncomingCall(myUid, onCall, onCancel) {
  const ref = doc(db, COLLECTION, myUid);
  return onSnapshot(ref, snap => {
    if (snap.exists()) {
      const data = snap.data();
      // Ignore stale signals older than 60s
      const age = data.createdAt?.toDate
        ? Date.now() - data.createdAt.toDate().getTime()
        : 0;
      if (age > TIMEOUT_MS + 15000) {
        deleteDoc(ref).catch(() => {});
        return;
      }
      onCall(data);
    } else {
      onCancel(); // doc deleted = caller hung up or was answered
    }
  });
}
