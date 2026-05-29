'use client';
import { useEffect, useState, useRef, startTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  MessageCircle, Phone, LogOut, Shield,
  Search, PenSquare, X, AlertCircle, Menu, Bot, User,
  Trash2, MoreVertical,
} from 'lucide-react';
import {
  collection, query, where, onSnapshot,
  orderBy, addDoc, serverTimestamp, getDocs, getDoc,
  deleteDoc, doc, writeBatch,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../../components/Avatar';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import dynamic from 'next/dynamic';
const IncomingCallWrapper = dynamic(
  () => import('../../components/IncomingCallWrapper'),
  { ssr: false }
);
const PnbBot = dynamic(
  () => import('../../components/PnbBot'),
  { ssr: false }
);
const MessageSearch = dynamic(
  () => import('../../components/MessageSearch'),
  { ssr: false }
);

function formatTime(date) {
  const now = new Date(), diff = now - date;
  if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 604800000) return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()];
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ── New chat modal ──────────────────────────────────────────────────────────
function NewChatModal({ onClose, currentUser }) {
  const router = useRouter();
  const [q, setQ]               = useState('');
  const [results, setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating]   = useState(false);
  const [error, setError]         = useState('');

  async function search() {
    if (!q.trim()) return;
    setSearching(true); setError(''); setResults([]);
    try {
      const snap = await getDocs(query(
        collection(db, 'users'),
        where('username', '>=', q.toLowerCase()),
        where('username', '<=', q.toLowerCase() + '\uf8ff'),
      ));
      const found = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.uid !== currentUser.uid);
      setResults(found);
      if (found.length === 0) setError(`No users found for "${q}"`);
    } catch (e) { setError('Search failed: ' + e.message); }
    finally { setSearching(false); }
  }

  async function startChat(other) {
    setCreating(true);
    try {
      const snap = await getDocs(query(collection(db, 'chats'), where('members', 'array-contains', currentUser.uid)));
      const existing = snap.docs.find(d => { const m = d.data().members||[]; return m.includes(other.uid) && m.length === 2; });
      let chatId;
      if (existing) { chatId = existing.id; }
      else {
        const ref = await addDoc(collection(db, 'chats'), {
          members: [currentUser.uid, other.uid],
          memberNames:   { [currentUser.uid]: currentUser.displayName,   [other.uid]: other.displayName },
          memberAvatars: { [currentUser.uid]: currentUser.avatar || null, [other.uid]: other.avatar || null },
          isGroup: false, lastMessage: '', lastMessageAt: serverTimestamp(), createdAt: serverTimestamp(),
        });
        chatId = ref.id;
      }
      onClose(); router.push(`/chat/${chatId}`);
    } catch (e) { setError('Failed: ' + e.message); }
    finally { setCreating(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-bg2 border border-border2 rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border1">
          <h2 className="font-bold text-textP">New Message</h2>
          <button onClick={onClose} className="text-textS hover:text-textP transition"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="Search by username…" autoFocus
              className="flex-1 bg-bg3 border border-border1 rounded-xl px-4 py-2.5 text-sm text-textP placeholder-textT focus:outline-none focus:border-accent/50 transition" />
            <button onClick={search} disabled={searching || !q.trim()}
              className="px-4 py-2.5 bg-accent hover:bg-accentD disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition">
              {searching ? '…' : 'Search'}
            </button>
          </div>
          {error && <div className="flex items-center gap-2 text-warning text-xs px-1"><AlertCircle size={13} />{error}</div>}
        </div>
        <div className="max-h-72 overflow-y-auto px-4 pb-4 space-y-2">
          {results.length === 0 && !error && !searching
            ? <p className="text-textT text-sm text-center py-8">Search for a username to start chatting</p>
            : results.map(u => (
              <button key={u.uid} onClick={() => startChat(u)} disabled={creating}
                className="w-full flex items-center gap-3 p-3 bg-surface1 hover:bg-surface2 border border-border1 rounded-xl transition text-left disabled:opacity-50">
                <Avatar name={u.displayName} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-textP text-sm truncate">{u.displayName}</p>
                  <p className="text-textT text-xs">@{u.username}</p>
                </div>
                <span className="text-xs font-semibold text-accentL bg-accent/10 px-3 py-1 rounded-full flex-shrink-0">
                  {creating ? '…' : 'Chat'}
                </span>
              </button>
            ))
          }
        </div>
      </div>
    </div>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────
// ── Delete a chat and all its messages ────────────────────────────────────────
async function deleteChat(chatId, userId, router, currentPath) {
  if (!confirm('Delete this conversation? This cannot be undone.')) return;
  try {
    // Delete all messages in the chat
    const msgsSnap = await getDocs(
      query(collection(db, 'messages'), where('chatId', '==', chatId))
    );
    const batch = writeBatch(db);
    msgsSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(doc(db, 'calls', chatId)); // batch ops don't return promises
    await batch.commit();
    // Delete the chat doc itself
    await deleteDoc(doc(db, 'chats', chatId));
    // If we're currently in that chat, go back to chats list
    if (currentPath === `/chat/${chatId}`) router.push('/chat');
  } catch (e) {
    console.error('Delete chat failed:', e);
    alert('Failed to delete chat. Please try again.');
  }
}

// ── Single chat list item with hover-reveal delete button ─────────────────────
function ChatListItem({ chat, active, hasUnread, unread, user, memberAvatarCache, onNavigate }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef  = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    function handle(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showMenu]);

  return (
    <div className={`relative flex items-center gap-3 px-4 py-3 border-b border-border1/50 group
      hover:bg-surface1 transition
      ${active    ? 'bg-accent/10 border-l-2 border-l-accent' : ''}
      ${hasUnread ? 'bg-accent/5 border-l-2 border-l-accent/50' : ''}`}>

      {/* Main click area — navigate to chat */}
      <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
        onClick={() => { onNavigate?.(); router.push(`/chat/${chat.id}`); }}>
        <div className="relative flex-shrink-0">
          <Avatar
            name={chat.name}
            src={chat.otherAvatar || memberAvatarCache?.[chat.members?.find(m => m !== user?.uid)] || null}
            size={44}
          />
          {hasUnread && (
            <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-accent flex items-center justify-center px-1 shadow-lg shadow-accent/40">
              <span className="text-white text-[10px] font-bold leading-none">
                {unread > 99 ? '99+' : unread}
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <p className={`text-sm truncate ${hasUnread ? 'font-bold text-textP' : 'font-semibold text-textP'}`}>
              {chat.name}
            </p>
            <p className={`text-xs flex-shrink-0 ml-2 ${hasUnread ? 'text-accent font-semibold' : 'text-textT'}`}>
              {chat.lastMessageAt?.toDate ? formatTime(chat.lastMessageAt.toDate()) : ''}
            </p>
          </div>
          <p className={`text-xs truncate ${hasUnread ? 'text-textP font-medium' : 'text-textS'}`}>
            {hasUnread ? `${unread} new message${unread !== 1 ? 's' : ''}` : (chat.lastMessage || 'No messages yet')}
          </p>
        </div>
      </div>

      {/* More options button — appears on hover */}
      <div className="relative flex-shrink-0" ref={menuRef}>
        <button
          onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
          className="w-7 h-7 rounded-full flex items-center justify-center text-textT hover:text-textP hover:bg-surface3 transition opacity-0 group-hover:opacity-100">
          <MoreVertical size={14} />
        </button>

        {showMenu && (
          <div className="absolute right-0 top-8 z-30 bg-bg2 border border-border2 rounded-xl shadow-2xl overflow-hidden min-w-[140px]">
            <button
              onClick={e => {
                e.stopPropagation();
                setShowMenu(false);
                deleteChat(chat.id, user?.uid, router, pathname);
              }}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-danger hover:bg-danger/10 transition text-left">
              <Trash2 size={14} />
              Delete chat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Sidebar({ chats, loading, indexError, user, profile, logOut, sidebarOpen, setSidebarOpen, unreadCounts = {}, onNavigate, memberAvatarCache = {} }) {
  const pathname = usePathname();
  const [search, setSearch]           = useState('');
  const [showSearch, setShowSearch]   = useState(false);
  const [showNewChat,  setShowNewChat]  = useState(false);
  const [showBot,      setShowBot]      = useState(false);
  const filtered = chats; // all chats — search is now handled by MessageSearch modal

  return (
    <>
      <aside className={`flex-shrink-0 flex flex-col bg-bg1 border-r border-border1 h-full z-40 transition-all duration-200
        ${sidebarOpen ? 'w-80' : 'w-0 lg:w-80 overflow-hidden'}
        fixed lg:relative inset-y-0 left-0 lg:inset-auto`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border1">
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden mr-2 text-textS hover:text-textP"><X size={18} /></button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center">
              <Shield size={14} className="text-accentL" />
            </div>
            <span className="font-bold text-textP tracking-tight">P&amp;B</span>
          </div>
          <button onClick={() => setShowNewChat(true)}
            className="w-8 h-8 rounded-full bg-accent flex items-center justify-center hover:bg-accentD transition shadow-lg shadow-accent/30">
            <PenSquare size={14} className="text-white" />
          </button>
        </div>

        <div className="px-3 py-2">
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-2 bg-surface2 border border-border1 rounded-xl px-3 py-2 w-full hover:bg-surface3 transition">
            <Search size={14} className="text-textT" />
            <span className="text-textT text-sm">Search messages…</span>
          </button>
        </div>

        <div className="mx-3 mb-2 px-3 py-1.5 bg-online/10 border border-online/20 rounded-lg flex items-center gap-2">
          <Shield size={11} className="text-online" />
          <span className="text-xs text-online font-medium">All chats end-to-end encrypted</span>
        </div>

        {indexError && (
          <div className="mx-3 mb-2 px-3 py-2 bg-warning/10 border border-warning/20 rounded-lg flex items-start gap-2">
            <AlertCircle size={13} className="text-warning mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-warning text-xs font-semibold">Firestore index needed</p>
              <p className="text-textT text-xs mt-0.5">
                <a href={indexError} target="_blank" rel="noopener noreferrer" className="text-accentL underline">Click here to create it</a> then refresh.
              </p>
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto">
          {/* pnb-bot — only visible if enabled in profile settings */}
          {profile?.botEnabled && (
          <Link href="/chat/bot"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition hover:bg-surface2
              ${pathname === '/chat/bot' ? 'bg-accent/10 border-r-2 border-accent' : ''}`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-accent/20">
              <Bot size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-textP text-sm truncate">pnb-bot</p>
              <p className="text-textT text-xs truncate">AI Assistant · Always here</p>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 bg-accent/20 text-accentL rounded-full font-medium">AI</span>
          </Link>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 px-8">
              <MessageCircle size={36} className="text-textT" />
              <p className="text-textS text-sm text-center">No conversations yet.</p>
              <button onClick={() => setShowNewChat(true)}
                className="px-4 py-2 bg-accent/10 border border-accent/20 text-accentL rounded-xl text-xs font-semibold hover:bg-accent/20 transition">
                Start a chat
              </button>
            </div>
          ) : filtered.map(chat => {
            const active    = pathname === `/chat/${chat.id}`;
            const unread    = unreadCounts[chat.id] || 0;
            const hasUnread = unread > 0 && !active;
            return (
              <ChatListItem
                key={chat.id}
                chat={chat}
                active={active}
                hasUnread={hasUnread}
                unread={unread}
                user={user}
                memberAvatarCache={memberAvatarCache}
                onNavigate={onNavigate}
              />
            );
          })}
        </nav>

        <div className="border-t border-border1 p-3">
          <div className="flex items-center gap-3 mb-3">
            {profile?.avatar
              ? <img src={profile.avatar} alt="Avatar" className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-border2" />
              : <Avatar name={profile?.displayName || user?.displayName || 'You'} size={36} />
            }
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-textP text-sm truncate">{profile?.displayName || user?.displayName}</p>
              <p className="text-textT text-xs">@{profile?.username || ''}</p>
            </div>
            <Link href="/profile" title="Edit profile"
              className="text-textT hover:text-accentL transition mr-1">
              <User size={15} />
            </Link>
            <button onClick={logOut} className="text-danger hover:text-danger/80 transition" title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
          <div className="flex gap-2">
            <Link href="/chat"
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition
                ${pathname.startsWith('/chat') && pathname !== '/chat/calls' ? 'bg-accent/20 text-accentL' : 'text-textS hover:bg-surface2'}`}>
              <MessageCircle size={14} /> Chats
            </Link>
            <Link href="/chat/calls"
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition
                ${pathname === '/chat/calls' ? 'bg-accent/20 text-accentL' : 'text-textS hover:bg-surface2'}`}>
              <Phone size={14} /> Calls
            </Link>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      {showSearch && (
        <MessageSearch
          chats={chats}
          onJumpToChat={(chatId) => { onNavigate?.(chatId); setSidebarOpen(false); setShowSearch(false); }}
          onClose={() => setShowSearch(false)}
        />
      )}
      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          currentUser={{ uid: user?.uid, displayName: profile?.displayName || user?.displayName, avatar: profile?.avatar || null }}
        />
      )}
    </>
  );
}

// ── Root layout ───────────────────────────────────────────────────────────
export default function ChatLayout({ children }) {
  const { user, profile, loading: authLoading, logOut } = useAuth();
  const router = useRouter();
  const [chats, setChats]           = useState([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [unreadCounts,      setUnreadCounts]      = useState({});
  const [memberAvatarCache, setMemberAvatarCache] = useState({}); // { uid: avatarUrl } // { chatId: number }
  const [indexError, setIndexError]   = useState('');
  const [sidebarOpen, setSidebarOpen]   = useState(false);

  // Track this user's online status in Firestore
  useOnlineStatus(user);

  // Option B: register push notifications for this device
  usePushNotifications(user);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    setChatsLoading(true);
    const q = query(
      collection(db, 'chats'),
      where('members', 'array-contains', user.uid),
      orderBy('lastMessageAt', 'desc'),
    );
    const unsub = onSnapshot(q,
      async snap => {
        const raw = snap.docs.map(d => {
          const c = { id: d.id, ...d.data() };
          if (!c.isGroup && c.memberNames) {
            const otherId  = c.members.find(m => m !== user.uid);
            c.otherId      = otherId;
            c.name         = c.memberNames[otherId] || 'Unknown';
            c.otherAvatar  = c.memberAvatars?.[otherId] || null;
          }
          return c;
        });

        // Fetch live avatars for any chat missing one
        const missing = raw.filter(c => c.otherId && !c.otherAvatar);
        if (missing.length > 0) {
          const avatarMap = {};
          await Promise.all(missing.map(async c => {
            try {
              const snap = await getDoc(doc(db, 'users', c.otherId));
              if (snap.exists()) avatarMap[c.otherId] = snap.data().avatar || null;
            } catch {}
          }));
          raw.forEach(c => {
            if (c.otherId && avatarMap[c.otherId] !== undefined) {
              c.otherAvatar = avatarMap[c.otherId];
            }
          });
        }

        startTransition(() => {
          setIndexError('');
          setChats(raw);
          setChatsLoading(false);
        });
      },
      err => {
        const link = err.message?.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)?.[0];
        if (link) setIndexError(link);
        getDocs(query(collection(db, 'chats'), where('members', 'array-contains', user.uid))).then(snap => {
          const data = snap.docs.map(d => {
            const c = { id: d.id, ...d.data() };
            if (!c.isGroup && c.memberNames) {
              const o = c.members.find(m => m !== user.uid);
              c.name = c.memberNames[o] || 'Unknown';
              c.otherAvatar = c.memberAvatars?.[o] || null;
            }
            return c;
          }).sort((a, b) => (b.lastMessageAt?.seconds||0) - (a.lastMessageAt?.seconds||0));
          setChats(data);
          setChatsLoading(false);
        }).catch(() => setChatsLoading(false));
      }
    );
    return unsub;
  }, [user]);

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg0">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Unread listener — watch all unread messages, filter in JS to avoid index requirements
  useEffect(() => {
    if (!user?.uid || chats.length === 0) return;

    const myChatIds = new Set(chats.map(c => c.id));

    // Only filter by read=false — no != operator avoids composite index requirement
    const q = query(
      collection(db, 'messages'),
      where('read', '==', false),
    );

    const unsub = onSnapshot(q, snap => {
      startTransition(() => {
        const counts = {};
        snap.docs.forEach(d => {
          const data = d.data();
          // Filter in JS: only other people's messages in MY chats
          if (
            data.chatId &&
            myChatIds.has(data.chatId) &&
            data.senderId &&
            data.senderId !== user.uid
          ) {
            counts[data.chatId] = (counts[data.chatId] || 0) + 1;
          }
        });
        setUnreadCounts(counts);
      });
    }, err => {
      console.warn('Unread listener error:', err.message);
    });

    return unsub;
  }, [user?.uid, chats]); // eslint-disable-line

  return (
    <div className="flex h-screen bg-bg0 overflow-hidden">
      <Sidebar chats={chats} loading={chatsLoading} indexError={indexError} user={user} profile={profile} logOut={logOut} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} unreadCounts={unreadCounts} onNavigate={(chatId) => router.push('/chat/' + chatId)} memberAvatarCache={memberAvatarCache} />
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Mobile header with hamburger */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-bg1 border-b border-border1 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-textS hover:text-textP">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
              <Shield size={11} className="text-accentL" />
            </div>
            <span className="font-bold text-textP text-sm">P&amp;B</span>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">{children}</div>
      </main>
      {/* Global incoming call listener — Firestore-based, no third-party SDK */}
      {/* Global incoming call listener */}
      <IncomingCallWrapper />
    </div>
  );
}
