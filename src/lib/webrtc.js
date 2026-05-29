import {
  doc, collection, addDoc, setDoc, getDoc,
  onSnapshot, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    {
      urls:       'turn:openrelay.metered.ca:80',
      username:   'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls:       'turn:openrelay.metered.ca:443',
      username:   'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls:       'turn:openrelay.metered.ca:443?transport=tcp',
      username:   'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

// Safely assign a remote stream to a media element
// Handles both video (which carries audio tracks too) and standalone audio
export function attachRemoteStream(stream, videoEl, audioEl) {
  if (!stream) return;

  // Always attach the full stream to the video element if present
  // The video element plays both video AND audio tracks from the stream
  if (videoEl) {
    videoEl.srcObject = stream;
    videoEl.muted     = false; // ensure not muted
    videoEl.play().catch(() => {});
  }

  // Attach to audio element as fallback / for voice-only calls
  if (audioEl) {
    audioEl.srcObject = stream;
    audioEl.muted     = false;
    audioEl.play().catch(() => {});
  }
}

// ontrack handler — uses streams[0] when available, validates track otherwise
function handleTrack(event, videoEl, audioEl) {
  if (event.streams?.[0]) {
    attachRemoteStream(event.streams[0], videoEl, audioEl);
    return;
  }
  // Fallback: build a stream from the individual track
  if (event.track instanceof MediaStreamTrack) {
    const stream = new MediaStream([event.track]);
    attachRemoteStream(stream, videoEl, audioEl);
  }
}

// Caller side — creates offer, sends to Firestore, returns hangup fn
export async function createCall(callId, localStream, videoEl, audioEl, onStateChange) {
  const pc  = new RTCPeerConnection(ICE_SERVERS);
  const ref = doc(db, 'calls', callId);
  const offerCandidates  = collection(ref, 'offerCandidates');
  const answerCandidates = collection(ref, 'answerCandidates');

  // Add all local tracks
  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

  pc.onicecandidate          = e => { if (e.candidate) addDoc(offerCandidates, e.candidate.toJSON()); };
  pc.onconnectionstatechange = () => {
    onStateChange?.(pc.connectionState);
    if (pc.connectionState === 'failed') {
      pc.restartIce(); // attempt ICE restart on failure
    }
  };
  pc.ontrack = e => handleTrack(e, videoEl, audioEl);

  const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
  await pc.setLocalDescription(offer);
  await setDoc(ref, {
    offer:     { type: offer.type, sdp: offer.sdp },
    status:    'ringing',
    createdAt: serverTimestamp(),
  });

  const unsubCall = onSnapshot(ref, snap => {
    const d = snap.data();
    if (!d) return;
    if (d.answer && !pc.currentRemoteDescription) {
      pc.setRemoteDescription(new RTCSessionDescription(d.answer)).catch(console.warn);
    }
    if (d.status === 'ended' || d.status === 'declined') onStateChange?.('ended');
  });

  const unsubCand = onSnapshot(answerCandidates, snap => {
    snap.docChanges().forEach(ch => {
      if (ch.type === 'added') pc.addIceCandidate(new RTCIceCandidate(ch.doc.data())).catch(() => {});
    });
  });

  return async function hangup() {
    unsubCall(); unsubCand();
    if (pc.signalingState !== 'closed') pc.close();
    await updateDoc(ref, { status: 'ended' }).catch(() => {});
  };
}

// Callee side — reads offer, creates answer
export async function answerCall(callId, localStream, videoEl, audioEl, onStateChange) {
  const pc  = new RTCPeerConnection(ICE_SERVERS);
  const ref = doc(db, 'calls', callId);
  const offerCandidates  = collection(ref, 'offerCandidates');
  const answerCandidates = collection(ref, 'answerCandidates');

  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

  pc.onicecandidate          = e => { if (e.candidate) addDoc(answerCandidates, e.candidate.toJSON()); };
  pc.onconnectionstatechange = () => {
    onStateChange?.(pc.connectionState);
    if (pc.connectionState === 'failed') pc.restartIce();
  };
  pc.ontrack = e => handleTrack(e, videoEl, audioEl);

  const snap = await getDoc(ref);
  if (!snap.exists()) { onStateChange?.('ended'); return null; }

  await pc.setRemoteDescription(new RTCSessionDescription(snap.data().offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await updateDoc(ref, { answer: { type: answer.type, sdp: answer.sdp }, status: 'active' });

  const unsubCand = onSnapshot(offerCandidates, snap => {
    snap.docChanges().forEach(ch => {
      if (ch.type === 'added') pc.addIceCandidate(new RTCIceCandidate(ch.doc.data())).catch(() => {});
    });
  });

  const unsubCall = onSnapshot(ref, snap => {
    const d = snap.data();
    if (!d || d.status === 'ended') onStateChange?.('ended');
  });

  return async function hangup() {
    unsubCand(); unsubCall();
    if (pc.signalingState !== 'closed') pc.close();
    await updateDoc(ref, { status: 'ended' }).catch(() => {});
  };
}

// Get user media — tries best constraints, falls back gracefully
export async function getMedia(wantVideo = false) {
  if (wantVideo) {
    try { return await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } }); }
    catch {}
    try { return await navigator.mediaDevices.getUserMedia({ audio: true, video: true }); }
    catch {}
  }
  try { return await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch {}
  return new MediaStream(); // silent fallback
}

// Compress image to JPEG base64, targeting under 400KB
export async function compressImage(file, maxDim = 1200, qualityStart = 0.85) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const scale   = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas  = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        let q = qualityStart;
        let d = canvas.toDataURL('image/jpeg', q);
        while (d.length > 400_000 && q > 0.3) { q -= 0.1; d = canvas.toDataURL('image/jpeg', q); }
        resolve(d);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
