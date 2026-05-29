'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Save, ArrowLeft, User, AtSign, FileText, Loader2, Check, Bot, Sparkles } from 'lucide-react';
import { doc, updateDoc, getDocs, collection, query, where, writeBatch } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';

const COLORS = ['#60A5FA','#A78BFA','#F472B6','#34D399','#FBBF24','#F87171'];
function colorFor(str) { return COLORS[(str?.charCodeAt(0) || 0) % COLORS.length]; }

// Compress image to max dimensions using canvas — handles any file size
function compressImage(file, maxDim = 400, quality = 0.80) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = e => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale   = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas  = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

        // Try quality steps until under 200KB for avatar
        let q = quality;
        let dataUrl = canvas.toDataURL('image/jpeg', q);
        while (dataUrl.length > 200_000 && q > 0.3) {
          q -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', q);
        }
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function ProfilePage() {
  const { user, profile } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [username,    setUsername]    = useState('');
  const [status,      setStatus]      = useState('');
  const [avatar,      setAvatar]      = useState(null);
  const [botEnabled,  setBotEnabled]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [error,       setError]       = useState('');
  const [avatarErr,   setAvatarErr]   = useState('');
  const [processing,  setProcessing]  = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setUsername(profile.username || '');
      setStatus(profile.status || '');
      setAvatar(profile.avatar || null);
      setBotEnabled(profile.botEnabled ?? false);
    }
  }, [profile]);

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarErr('Please select an image file');
      return;
    }
    setAvatarErr('');
    setProcessing(true);
    try {
      const compressed = await compressImage(file, 400, 0.80);
      setAvatar(compressed);
    } catch (err) {
      setAvatarErr('Failed to process image — try a different file');
      console.error('Avatar compress error:', err);
    } finally {
      setProcessing(false);
      // Reset file input so same file can be re-selected
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleSave() {
    if (!displayName.trim()) { setError('Display name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: displayName.trim(),
        username:    username.trim().toLowerCase().replace(/\s/g, '') || profile?.username,
        status:      status.trim(),
        avatar:      avatar || null,
        botEnabled,
      });
      await updateProfile(auth.currentUser, { displayName: displayName.trim() });

      // Sync avatar and name into all chats this user is part of
      // so other users see the updated avatar in their sidebar
      try {
        const chatSnap = await getDocs(query(
          collection(db, 'chats'),
          where('members', 'array-contains', user.uid)
        ));
        if (!chatSnap.empty) {
          const batch = writeBatch(db);
          chatSnap.docs.forEach(chatDoc => {
            batch.update(chatDoc.ref, {
              [`memberAvatars.${user.uid}`]: avatar || null,
              [`memberNames.${user.uid}`]:   displayName.trim(),
            });
          });
          await batch.commit();
        }
      } catch (e) {
        console.warn('Chat sync failed:', e.message);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError('Failed to save: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  const initials    = displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  const avatarColor = colorFor(displayName);

  return (
    <div className="min-h-screen bg-bg0 flex items-start justify-center p-6">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-full bg-surface2 hover:bg-surface3 flex items-center justify-center text-textS hover:text-textP transition">
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-xl font-bold text-textP">Edit Profile</h1>
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative group cursor-pointer" onClick={() => !processing && fileRef.current?.click()}>
            {avatar ? (
              <img src={avatar} alt="Avatar"
                className="w-24 h-24 rounded-full object-cover border-2 border-border2" />
            ) : (
              <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold border-2 border-border2"
                style={{ backgroundColor: avatarColor + '30', color: avatarColor }}>
                {initials}
              </div>
            )}
            <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
              {processing
                ? <Loader2 size={22} className="text-white animate-spin" />
                : <Camera size={22} className="text-white" />
              }
            </div>
          </div>

          <button
            onClick={() => !processing && fileRef.current?.click()}
            disabled={processing}
            className="mt-3 text-accentL text-sm hover:underline disabled:opacity-50">
            {processing ? 'Processing…' : 'Change photo'}
          </button>

          {avatar && !processing && (
            <button onClick={() => setAvatar(null)}
              className="mt-1 text-textT text-xs hover:text-danger transition">
              Remove photo
            </button>
          )}

          {avatarErr && <p className="text-danger text-xs mt-2 text-center">{avatarErr}</p>}

          {/* Hidden file input — no size restriction wording */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>

        {/* Fields */}
        <div className="bg-bg2 border border-border1 rounded-2xl p-6 space-y-5">
          {[
            { label: 'Display Name', key: 'displayName', icon: User,    value: displayName, set: setDisplayName, placeholder: 'Your name',             maxLength: 50  },
            { label: 'Username',     key: 'username',    icon: AtSign,   value: username,    set: setUsername,    placeholder: 'yourname',               maxLength: 30  },
            { label: 'Status',       key: 'status',      icon: FileText, value: status,      set: setStatus,      placeholder: "What's on your mind?",   maxLength: 100 },
          ].map(({ label, key, icon: Icon, value, set, placeholder, maxLength }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-textS uppercase tracking-wider mb-2">
                {label}
              </label>
              <div className="relative">
                <Icon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-textT" />
                <input
                  value={value}
                  onChange={e => set(e.target.value)}
                  placeholder={placeholder}
                  maxLength={maxLength}
                  className="w-full bg-bg3 border border-border1 rounded-xl pl-9 pr-4 py-3 text-textP text-sm placeholder-textT focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition"
                />
              </div>
            </div>
          ))}

          {error && <p className="text-danger text-sm px-1">{error}</p>}

          {/* pnb-bot toggle — paulnapper only */}
          {profile?.username === 'paulnapper' && (
            <div className="border-t border-border1 pt-5 mt-1">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center flex-shrink-0">
                    <Bot size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-textP flex items-center gap-1.5">
                      pnb-bot <span className="text-[10px] px-1.5 py-0.5 bg-accent/15 text-accentL border border-accent/20 rounded-full">AI</span>
                    </p>
                    <p className="text-xs text-textT">Show AI assistant in your chat list</p>
                  </div>
                </div>
                {/* Toggle switch */}
                <button
                  onClick={() => setBotEnabled(v => !v)}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${botEnabled ? 'bg-accent' : 'bg-surface3'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${botEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
              {botEnabled && (
                <p className="mt-2 text-xs text-accentL flex items-center gap-1.5 pl-12">
                  <Sparkles size={10} /> pnb-bot will appear at the top of your chat list
                </p>
              )}
            </div>
          )}

          <button onClick={handleSave} disabled={saving || processing || !displayName.trim()}
            className="w-full py-3 bg-accent hover:bg-accentD disabled:opacity-40 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2">
            {saving  ? <><Loader2 size={16} className="animate-spin" /> Saving…</>
             : saved ? <><Check size={16} /> Saved!</>
             : <><Save size={16} /> Save Changes</>}
          </button>
        </div>

        <div className="mt-4 px-2 space-y-1">
          <p className="text-textT text-xs">Email: {user.email}</p>
          <p className="text-textT text-xs">UID: {user.uid}</p>
        </div>
      </div>
    </div>
  );
}
