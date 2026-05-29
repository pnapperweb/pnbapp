'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, serverTimestamp, doc, updateDoc, getDoc,
  writeBatch, getDocs, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import {
  Phone, Video, Lock, Send, ArrowLeft, Smile, ImagePlus,
  X, Loader2, CornerUpLeft, Reply, Sparkles, ChevronRight,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../context/AuthContext';
import Avatar from '../../../components/Avatar';
import { compressImage } from '../../../lib/webrtc';
import { playMessageSound, playSentSound } from '../../../lib/sounds';
import CallModal from '../../../components/CallModal';
import EmojiPicker from '../../../components/EmojiPicker';
import GifPicker from '../../../components/GifPicker';

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];


// ── MessageText ───────────────────────────────────────────────────────────────
const URL_SPLIT = /(https?:\/\/[^\s<>"]+)/;  // no g flag — safe to reuse for split

function MessageText({ text }) {
  const parts = text.split(/(\[emoji:[^\]]+\])/g);
  return (
    <span>
      {parts.map((part, i) => {
        const m = part.match(/^\[emoji:([^:]+):(.+)\]$/);
        if (m) return <img key={i} src={m[2]} alt={m[1]} title={m[1]}
          className="inline-block align-middle"
          style={{ width: 22, height: 22, objectFit: 'contain', borderRadius: 3, margin: '0 1px' }} />;
        // Split on URLs — alternating [text, url, text, url, ...]
        const segments = part.split(URL_SPLIT);
        return (
          <span key={i}>
            {segments.map((seg, j) =>
              /^https?:\/\//.test(seg)
                ? <a key={j} href={seg} target="_blank" rel="noopener noreferrer"
                    className="underline underline-offset-2 break-all hover:opacity-80 transition-opacity"
                    onClick={e => e.stopPropagation()}>{seg}</a>
                : <span key={j}>{seg}</span>
            )}
          </span>
        );
      })}
    </span>
  );
}

// ── Reaction bar ──────────────────────────────────────────────────────────────
function ReactionBar({ reactions = {}, myUid, onReact }) {
  const entries = Object.entries(reactions).filter(([, u]) => u.length > 0);
  if (!entries.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {entries.map(([emoji, uids]) => (
        <button key={emoji} onClick={() => onReact(emoji)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition border
            ${uids.includes(myUid)
              ? 'bg-accent/20 border-accent/40 text-accentL'
              : 'bg-surface2 border-border1 text-textS hover:bg-surface3'}`}>
          {emoji} <span className="font-semibold">{uids.length}</span>
        </button>
      ))}
    </div>
  );
}

// ── WhatsApp-style reply preview (inside bubble) ──────────────────────────────
function ReplyQuote({ replyTo, isMe }) {
  if (!replyTo) return null;
  return (
    <div className={`flex items-start gap-2 mb-1.5 px-3 py-2 rounded-xl text-left w-full
      ${isMe
        ? 'bg-white/10 border-r-[3px] border-accentL'
        : 'bg-black/20 border-l-[3px] border-accentL'}`}>
      <div className="min-w-0 flex-1">
        <p className="text-accentL text-[11px] font-bold truncate mb-0.5">{replyTo.senderName}</p>
        <p className="text-white/60 text-xs truncate leading-tight">
          {replyTo.mediaType === 'image' ? '📷 Photo'
           : replyTo.mediaType === 'video' ? '🎥 Video'
           : replyTo.mediaType === 'gif'   ? '🎞️ GIF'
           : replyTo.text?.slice(0, 80) || '…'}
        </p>
      </div>
    </div>
  );
}

// ── Bubble ────────────────────────────────────────────────────────────────────
function Bubble({ msg, isMe, myUid, onReact, onReply, myAvatar }) {
  const [showActions, setShowActions]       = useState(false);
  const [showCustomReact, setShowCustomReact] = useState(false);
  const time = msg.createdAt?.toDate ? formatTime(msg.createdAt.toDate()) : '';

  const bubbleContent = () => {
    if (msg.type === 'call-event') return (
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-bg3/60 border border-border1">
        <span className="text-base">{msg.callStatus === 'missed' ? '📵' : msg.callType === 'video' ? '📹' : '📞'}</span>
        <p className={`text-sm font-medium ${msg.callStatus === 'missed' ? 'text-danger' : 'text-textS'}`}>
          {msg.text}
        </p>
      </div>
    );
    if (msg.type === 'gif') return (
      <div className="rounded-2xl overflow-hidden max-w-[220px]">
        <img src={msg.gifUrl} alt="GIF" className="w-full h-auto block" loading="lazy" />
      </div>
    );
    if (msg.type === 'image') return (
      <img src={msg.mediaUrl} alt="Photo"
        className="max-w-[260px] rounded-2xl cursor-pointer hover:opacity-90 transition block"
        onClick={() => window.open(msg.mediaUrl, '_blank')} loading="lazy" />
    );
    if (msg.type === 'video') return (
      <video src={msg.mediaUrl} controls
        className="max-w-[260px] rounded-2xl block" style={{ maxHeight: 200 }} />
    );
    return (
      <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed w-full
        ${isMe ? 'bg-accent text-white rounded-br-sm' : 'bg-bg3 text-textP rounded-bl-sm border border-border1'}`}>
        <ReplyQuote replyTo={msg.replyTo} isMe={isMe} />
        <MessageText text={msg.text || ''} />
      </div>
    );
  };

  return (
    <div className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''} group items-end`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}>

      {!isMe && <Avatar name={msg.senderName || '?'} src={msg.senderAvatar || null} size={26} className="flex-shrink-0 mb-1" />}

      <div className={`max-w-[72%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
        {/* For media messages, show reply quote above */}
        {msg.replyTo && msg.type !== 'text' && <ReplyQuote replyTo={msg.replyTo} isMe={isMe} />}

        {bubbleContent()}

        <ReactionBar reactions={msg.reactions || {}} myUid={myUid} onReact={e => onReact(msg.id, e)} />

        <div className={`flex items-center gap-1.5 mt-0.5 ${isMe ? 'flex-row-reverse' : ''}`}>
          <span className="text-textT text-[10px]">{time}</span>
          {isMe && <span className="text-accentL text-[10px]">✓✓</span>}
        </div>
      </div>

      {/* Action buttons — appear on hover */}
      <div className={`flex items-center gap-1 transition-opacity duration-150 mb-2 flex-shrink-0
        ${showActions ? 'opacity-100' : 'opacity-0'}`}>
        {/* Reply */}
        <button onClick={() => onReply(msg)} title="Reply"
          className="w-7 h-7 rounded-full bg-surface2 hover:bg-surface3 flex items-center justify-center text-textT hover:text-textP transition">
          <Reply size={13} />
        </button>
        {/* React */}
        <div className="relative">
          <button
            onClick={() => setShowActions(a => !a)}
            className="w-7 h-7 rounded-full bg-surface2 hover:bg-surface3 flex items-center justify-center text-sm transition">
            😊
          </button>
          {showActions && (
            <div className={`absolute bottom-9 ${isMe ? 'right-0' : 'left-0'} flex items-center gap-1 bg-bg2 border border-border2 rounded-2xl px-2 py-1.5 shadow-xl z-20 whitespace-nowrap`}>
              {QUICK_REACTIONS.map(e => (
                <button key={e} onClick={() => { onReact(msg.id, e); setShowActions(false); }}
                  className="text-xl hover:scale-125 transition active:scale-95">
                  {e}
                </button>
              ))}
              {/* Custom emoji button */}
              <button
                onClick={() => setShowCustomReact(v => !v)}
                className="w-7 h-7 rounded-full bg-surface3 hover:bg-surface2 flex items-center justify-center text-textT hover:text-textP transition text-base">
                ➕
              </button>
            </div>
          )}
          {/* Custom emoji picker for reactions */}
          {showCustomReact && (
            <div className={`absolute bottom-9 ${isMe ? 'right-0' : 'left-0'} z-30`}>
              <EmojiPicker
                onSelect={emoji => {
                  const str = typeof emoji === 'string' ? emoji : (emoji?.native || emoji?.emoji || String(emoji));
                  if (str && !str.startsWith('[emoji:')) {
                    onReact(msg.id, str);
                  }
                  setShowCustomReact(false);
                  setShowActions(false);
                }}
                onClose={() => setShowCustomReact(false)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Reply bar (WhatsApp style — sits above compose bar) ───────────────────────
function ReplyBar({ replyTo, onCancel }) {
  if (!replyTo) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-bg3 border-t border-border1 border-b border-b-border1/50">
      <div className="w-0.5 h-full min-h-[36px] bg-accentL rounded-full flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-accentL text-[11px] font-bold truncate">{replyTo.senderName}</p>
        <p className="text-textT text-xs truncate">
          {replyTo.type === 'image' ? '📷 Photo'
           : replyTo.type === 'video' ? '🎥 Video'
           : replyTo.type === 'gif'   ? '🎞️ GIF'
           : replyTo.text?.slice(0, 60) || '…'}
        </p>
      </div>
      <button onClick={onCancel} className="text-textT hover:text-textP transition flex-shrink-0">
        <X size={16} />
      </button>
    </div>
  );
}

// ── Media preview bar ─────────────────────────────────────────────────────────
function MediaPreview({ file, progress, onCancel }) {
  const isVideo = file.type.startsWith('video/');
  const url     = useRef(URL.createObjectURL(file)).current;
  const pct     = Math.round(progress);

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-bg3 border-t border-border1">
      <div className="relative w-12 h-12 flex-shrink-0">
        {isVideo
          ? <video src={url} className="w-12 h-12 rounded-lg object-cover" />
          : <img src={url} alt="preview" className="w-12 h-12 rounded-lg object-cover" />
        }
        {pct > 0 && pct < 100 && (
          <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
            <span className="text-white text-[9px] font-bold">{pct}%</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-textP text-xs font-medium truncate">{file.name}</p>
        <p className="text-textT text-[10px]">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
        {pct > 0 && pct < 100 && (
          <div className="w-full h-1 bg-surface3 rounded-full mt-1">
            <div className="h-1 bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      <button onClick={onCancel} className="text-textT hover:text-danger transition flex-shrink-0">
        <X size={16} />
      </button>
    </div>
  );
}

// ── Main chat page ────────────────────────────────────────────────────────────
export default function ChatPage({ params }) {
  const { id } = params;
  const { user, profile } = useAuth();
  const router = useRouter();

  const [messages,       setMessages]       = useState([]);
  const [text,           setText]           = useState('');
  const [chatName,       setChatName]       = useState('');
  const [otherUid,       setOtherUid]       = useState('');
  const [loading,        setLoading]        = useState(true);
  const [sending,        setSending]        = useState(false);
  const [callType,       setCallType]       = useState(null);
  const [showEmoji,      setShowEmoji]      = useState(false);
  const [showGif,        setShowGif]        = useState(false);
  const [replyTo,        setReplyTo]        = useState(null);
  const [mediaFile,      setMediaFile]      = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading,      setUploading]      = useState(false);
  const [avatarCache,    setAvatarCache]    = useState({});
  const [eiSuggestions,  setEiSuggestions]  = useState([]);
  const [eiLoading,      setEiLoading]      = useState(false);
  const [eiDismissed,    setEiDismissed]    = useState(null); // last msgId dismissed
  const lastReceivedIdRef = useRef(null);

  const bottomRef        = useRef(null);
  const inputRef         = useRef(null);
  const fileInputRef     = useRef(null);
  const prevCountRef     = useRef(0);
  const initialScrollRef = useRef(false); // has first-load scroll happened?

  // Reset scroll flag when chat changes
  useEffect(() => {
    initialScrollRef.current = false;
    prevCountRef.current = 0;
  }, [id]);

  // Load chat metadata
  useEffect(() => {
    if (!id || !user) return;
    getDoc(doc(db, 'chats', id)).then(snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      if (!d.isGroup && d.memberNames) {
        const oid = d.members.find(m => m !== user.uid);
        setOtherUid(oid || '');
        setChatName(d.memberNames[oid] || 'Chat');
      } else {
        setChatName(d.name || 'Group Chat');
      }
    });
  }, [id, user]);

  // Live messages + notification sound
  useEffect(() => {
    if (!id) return;
    const q = query(
      collection(db, 'messages'),
      where('chatId', '==', id),
      orderBy('createdAt', 'asc'),
    );
    const unsub = onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Play sound for new incoming messages (not our own)
      if (msgs.length > prevCountRef.current) {
        const newest = msgs[msgs.length - 1];
        if (newest && newest.senderId !== user?.uid) playMessageSound();
      }
      prevCountRef.current = msgs.length;
      setMessages(msgs);
      setLoading(false);

      // Mark unread incoming messages as read
      if (user?.uid) {
        getDocs(query(
          collection(db, 'messages'),
          where('chatId',   '==', id),
          where('read',     '==', false),
          where('senderId', '!=', user.uid),
        )).then(unreadSnap => {
          if (unreadSnap.empty) return;
          const batch = writeBatch(db);
          unreadSnap.docs.forEach(d => batch.update(d.ref, { read: true }));
          batch.commit().catch(() => {});
        }).catch(() => {});
      }
    }, () => setLoading(false));
    return unsub;
  }, [id, user?.uid]);

  // Fetch avatars for all unique message senders
  useEffect(() => {
    if (messages.length === 0) return;
    const uids = [...new Set(messages.map(m => m.senderId).filter(Boolean))];
    const missing = uids.filter(uid => !(uid in avatarCache));
    if (missing.length === 0) return;

    // Batch fetch user docs for senders we haven't cached yet
    Promise.all(
      missing.map(uid => getDoc(doc(db, 'users', uid)))
    ).then(snaps => {
      const updates = {};
      snaps.forEach(s => {
        if (s.exists()) updates[s.id] = s.data()?.avatar || null;
      });
      if (Object.keys(updates).length > 0) {
        setAvatarCache(prev => ({ ...prev, ...updates }));
      }
    }).catch(() => {});
  }, [messages.length]); // eslint-disable-line

  // ── Scroll to bottom ──────────────────────────────────────────────────────
  // On first load: instant scroll (no animation, avoids the "flash mid-screen" bug)
  // On new message: smooth scroll
  useEffect(() => {
    if (messages.length === 0) return;
    const el = bottomRef.current;
    if (!el) return;
    if (!initialScrollRef.current) {
      // First render — jump instantly so user never sees mid-scroll
      el.scrollIntoView({ behavior: 'instant' });
      initialScrollRef.current = true;
    } else if (messages.length > prevCountRef.current) {
      // New message arrived — smooth scroll
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // ── EI suggestions — only for @paulnapper ─────────────────────────────
  // Derive the last-received message ID so the effect only fires on real changes
  const lastIncomingMsg = profile?.username === 'paulnapper'
    ? [...messages].reverse().find(m => m.senderId !== user?.uid) ?? null
    : null;
  const lastIncomingId   = lastIncomingMsg?.id   ?? null;
  const lastIncomingText = lastIncomingMsg?.text  ?? null;

  useEffect(() => {
    if (!lastIncomingId || !lastIncomingText) return;
    if (lastIncomingId === eiDismissed) return;
    // If this is the same message we already generated for, don't re-fetch
    if (lastIncomingId === lastReceivedIdRef.current) return;

    // New incoming message — mark it and clear stale suggestions
    lastReceivedIdRef.current = lastIncomingId;
    setEiSuggestions([]);

    // Debounce — fetch after 1.2s of no new messages
    const timer = setTimeout(async () => {
      setEiLoading(true);
      try {
        const res = await fetch('/api/pnb-bot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context: '',
            userQuery: `You are an emotionally intelligent messaging assistant. 
The user received this message: "${lastIncomingText}"
Generate exactly 3 short, warm, emotionally intelligent reply suggestions.
Respond ONLY with a JSON array of 3 strings, no explanation. Example: ["That means a lot, thank you 💙","I hear you, let's talk about it","I'm here for you ❤️"]`,
          }),
        });
        const data = await res.json();
        try {
          const raw = data.reply?.trim();
          const arr = JSON.parse(raw.match(/\[[\s\S]*\]/)?.[0] || '[]');
          if (Array.isArray(arr) && arr.length) {
            setEiSuggestions(arr.slice(0, 3));
          }
        } catch {}
      } catch {}
      finally { setEiLoading(false); }
    }, 1200);

    return () => clearTimeout(timer);
  }, [lastIncomingId, lastIncomingText, eiDismissed]); // eslint-disable-line

  async function sendMessage(payload) {
    setSending(true);
    try {
      const replyData = replyTo ? {
        replyTo: {
          id:         replyTo.id,
          text:       replyTo.text?.slice(0, 80) || '',
          senderName: replyTo.senderName || '',
          mediaType:  replyTo.type || 'text',
        }
      } : {};

      await addDoc(collection(db, 'messages'), {
        chatId:    id,
        senderId:  user.uid,
        senderName:   profile?.displayName || user.displayName || 'You',
        senderAvatar: profile?.avatar || null,
        createdAt: serverTimestamp(),
        read:      false,
        reactions: {},
        ...replyData,
        ...payload,
      });
      await updateDoc(doc(db, 'chats', id), {
        lastMessage:
          payload.type === 'image' ? '📷 Photo'
          : payload.type === 'video' ? '🎥 Video'
          : payload.type === 'gif' ? '🎞️ GIF'
          : payload.text || '',
        lastMessageAt: serverTimestamp(),
      });
      setReplyTo(null);
      // Clear EI suggestions when Paul sends a reply
      setEiSuggestions([]);
      setEiLoading(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function sendText() {
    if (!text.trim() || sending) return;
    const t = text.trim();
    setText('');
    await sendMessage({ type: 'text', text: t });
  }

  async function sendGif(gif) {
    setShowGif(false);
    await sendMessage({ type: 'gif', gifUrl: gif.url, text: '' });
  }

  async function sendMedia() {
    if (!mediaFile || uploading) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const isVideo = mediaFile.type.startsWith('video/');
      if (isVideo) {
        // Videos: store as object URL (base64 too large) — use Storage only if rules allow,
        // otherwise fall back to a data URL approach for small videos
        // For now convert to base64 for consistency (videos capped at 10MB)
        if (mediaFile.size > 10 * 1024 * 1024) {
          alert('Video must be under 10MB for direct upload');
          return;
        }
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload  = e => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsDataURL(mediaFile);
        });
        setUploadProgress(100);
        await sendMessage({ type: 'video', mediaUrl: base64, text: '' });
      } else {
        // Images: compress to base64 and store directly in Firestore
        setUploadProgress(30);
        const base64 = await compressImage(mediaFile);
        setUploadProgress(100);
        await sendMessage({ type: 'image', mediaUrl: base64, text: '' });
      }
      setMediaFile(null);
      setUploadProgress(0);
    } catch (e) {
      console.error('Upload failed:', e);
      alert('Upload failed — please try again');
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const max = file.type.startsWith('video/') ? 100 * 1024 * 1024 : 50 * 1024 * 1024;
    if (file.size > max) { alert(file.type.startsWith('video/') ? 'Video must be under 100MB' : 'Image must be under 50MB'); return; }
    setMediaFile(file);
    e.target.value = '';
  }

  const handleReact = useCallback(async (messageId, emoji) => {
    const msgRef  = doc(db, 'messages', messageId);
    const msgSnap = await getDoc(msgRef);
    if (!msgSnap.exists()) return;
    const existing = msgSnap.data().reactions?.[emoji] || [];
    const already  = existing.includes(user.uid);
    await updateDoc(msgRef, {
      [`reactions.${emoji}`]: already ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
  }, [user]);

  function insertEmoji(emoji) {
    const str = typeof emoji === 'string' ? emoji : (emoji?.native || emoji?.emoji || String(emoji));
    if (str.startsWith('[emoji:')) { setShowEmoji(false); sendMessage({ type: 'text', text: str }); return; }
    const input = inputRef.current;
    const start = input?.selectionStart ?? text.length;
    const end   = input?.selectionEnd   ?? text.length;
    setText(t => t.slice(0, start) + str + t.slice(end));
    setTimeout(() => { if (input) { const p = start + str.length; input.focus(); input.setSelectionRange(p, p); } }, 0);
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); mediaFile ? sendMedia() : sendText(); }
    if (e.key === 'Escape' && replyTo) setReplyTo(null);
  }

  const canSend = (text.trim() || mediaFile) && !sending && !uploading;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border1 bg-bg1 flex-shrink-0">
        <button onClick={() => router.push('/chat')} className="lg:hidden text-textS hover:text-textP">
          <ArrowLeft size={18} />
        </button>
        <Avatar name={chatName} size={38} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-textP text-sm truncate">{chatName}</p>
          <div className="flex items-center gap-1.5">
            <Lock size={9} className="text-online" />
            <span className="text-online text-[11px] font-medium">End-to-end encrypted · v10</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCallType('voice')}
            className="w-9 h-9 rounded-full bg-surface2 hover:bg-accent/20 flex items-center justify-center text-accent transition" title="Voice call">
            <Phone size={16} />
          </button>
          <button onClick={() => setCallType('video')}
            className="w-9 h-9 rounded-full bg-surface2 hover:bg-accent/20 flex items-center justify-center text-accent transition" title="Video call">
            <Video size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center">
              <Lock size={20} className="text-accentL" />
            </div>
            <p className="text-textS text-sm">No messages yet — say hello! 👋</p>
          </div>
        ) : messages.map(m => (
          <Bubble
            key={m.id} msg={m}
            isMe={m.senderId === user?.uid}
            myUid={user?.uid}
            onReact={handleReact}
            onReply={setReplyTo}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* EI Reply Suggestions — paulnapper only */}
      {profile?.username === 'paulnapper' && (eiSuggestions.length > 0 || eiLoading) && (
        <div className="px-3 pt-2 pb-1 border-t border-border1 bg-bg1 flex-shrink-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles size={10} className="text-accentL" />
            <span className="text-[10px] font-semibold text-textT uppercase tracking-wider">EI Suggestions</span>
            {eiSuggestions.length > 0 && (
              <button onClick={() => { setEiSuggestions([]); const last = [...messages].reverse().find(m => m.senderId !== user?.uid); setEiDismissed(last?.id); }}
                className="ml-auto text-textT hover:text-textP transition">
                <X size={11} />
              </button>
            )}
          </div>
          {eiLoading && !eiSuggestions.length ? (
            <div className="flex items-center gap-2 text-textT text-xs py-1">
              <Loader2 size={11} className="animate-spin text-accentL" /> Thinking of thoughtful replies…
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {eiSuggestions.map((s, i) => (
                <button key={i}
                  onClick={() => { setText(s); setEiSuggestions([]); inputRef.current?.focus(); }}
                  className="flex-shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 bg-accent/10 hover:bg-accent/20 border border-accent/20 text-accentL rounded-full transition max-w-[220px] text-left">
                  <span className="truncate">{s}</span>
                  <ChevronRight size={10} className="flex-shrink-0 opacity-60" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reply bar */}
      <ReplyBar replyTo={replyTo} onCancel={() => setReplyTo(null)} />

      {/* Media preview */}
      {mediaFile && (
        <MediaPreview
          file={mediaFile}
          progress={uploadProgress}
          onCancel={() => { setMediaFile(null); setUploadProgress(0); }}
        />
      )}

      {/* Compose */}
      <div className="flex items-end gap-2 px-3 py-3 border-t border-border1 bg-bg1 flex-shrink-0 relative">
        {showEmoji && <EmojiPicker onSelect={insertEmoji} onClose={() => setShowEmoji(false)} />}
        {showGif   && <GifPicker  onSelect={sendGif}     onClose={() => setShowGif(false)} />}

        <button onClick={() => { setShowEmoji(v => !v); setShowGif(false); }}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition flex-shrink-0
            ${showEmoji ? 'bg-accent/20 text-accent' : 'bg-surface2 text-textT hover:text-textP hover:bg-surface3'}`}>
          <Smile size={18} />
        </button>

        <button onClick={() => { setShowGif(v => !v); setShowEmoji(false); }}
          className={`flex-shrink-0 px-2.5 h-9 rounded-full text-xs font-bold flex items-center justify-center transition
            ${showGif ? 'bg-accent/20 text-accent' : 'bg-surface2 text-textT hover:text-textP hover:bg-surface3'}`}>
          GIF
        </button>

        <button onClick={() => fileInputRef.current?.click()}
          className="w-9 h-9 rounded-full bg-surface2 hover:bg-surface3 flex items-center justify-center text-textT hover:text-textP transition flex-shrink-0"
          title="Upload photo or video">
          {uploading ? <Loader2 size={16} className="animate-spin text-accent" /> : <ImagePlus size={16} />}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileChange} className="hidden" />

        <div className="flex-1 bg-bg3 border border-border1 rounded-2xl px-4 py-2.5 focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/20 transition">
          <textarea ref={inputRef} rows={1} value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder={replyTo ? 'Reply…' : mediaFile ? 'Add a caption…' : 'Message…'}
            className="w-full bg-transparent text-textP text-sm placeholder-textT focus:outline-none resize-none max-h-32"
            style={{ height: 'auto' }}
            onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }} />
        </div>

        <button onClick={mediaFile ? sendMedia : sendText} disabled={!canSend}
          className="w-10 h-10 rounded-full bg-accent hover:bg-accentD disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-accent/30 transition flex-shrink-0">
          {(sending || uploading)
            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <Send size={16} className="text-white" />
          }
        </button>
      </div>

      {callType && (
        <CallModal
          callType={callType}
          chatName={chatName}
          chatId={id}
          otherUid={otherUid}
          currentUser={user}
          profile={profile}
          onClose={() => setCallType(null)}
        />
      )}
    </div>
  );
}
