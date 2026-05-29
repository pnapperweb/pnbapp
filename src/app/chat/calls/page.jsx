'use client';
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { Phone, Video, Search, RefreshCw, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../context/AuthContext';
import Avatar from '../../../components/Avatar';
import CallModal from '../../../components/CallModal';

export default function CallsPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [contacts, setContacts]   = useState([]);
  const [filtered, setFiltered]   = useState([]);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [activeCall, setActiveCall] = useState(null);

  const loadContacts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'users')));
      const users = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.uid !== user.uid);
      setContacts(users);
      setFiltered(users);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  useEffect(() => {
    if (!search.trim()) { setFiltered(contacts); return; }
    const q = search.toLowerCase();
    setFiltered(contacts.filter(c =>
      c.displayName?.toLowerCase().includes(q) ||
      c.username?.toLowerCase().includes(q)
    ));
  }, [search, contacts]);

  async function startCall(contact, callType) {
    // Find or create a chat between the two users
    try {
      const snap = await getDocs(query(
        collection(db, 'chats'),
        where('members', 'array-contains', user.uid)
      ));
      const existing = snap.docs.find(d => {
        const m = d.data().members || [];
        return m.includes(contact.uid) && m.length === 2;
      });
      let chatId;
      if (existing) {
        chatId = existing.id;
      } else {
        const ref = await addDoc(collection(db, 'chats'), {
          members:       [user.uid, contact.uid],
          memberNames:   { [user.uid]: profile?.displayName || user.displayName, [contact.uid]: contact.displayName },
          isGroup:       false,
          lastMessage:   '',
          lastMessageAt: serverTimestamp(),
          createdAt:     serverTimestamp(),
        });
        chatId = ref.id;
      }
      setActiveCall({ callType, chatName: contact.displayName, chatId, otherUid: contact.uid });
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="flex flex-col h-full p-6 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-textP">Calls</h1>
          <p className="text-textS text-sm mt-1">Start an encrypted voice or video call</p>
        </div>
        <button onClick={loadContacts}
          className="w-9 h-9 rounded-full bg-surface2 hover:bg-surface3 flex items-center justify-center text-textS hover:text-textP transition">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Encrypt notice */}
      <div className="flex items-center gap-2 mb-4 px-4 py-2.5 bg-online/10 border border-online/20 rounded-xl">
        <Shield size={13} className="text-online" />
        <span className="text-online text-xs font-medium">All calls are end-to-end encrypted via Stream Video</span>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-surface2 border border-border1 rounded-xl px-4 py-2.5 mb-4">
        <Search size={14} className="text-textT" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search contacts…"
          className="flex-1 bg-transparent text-sm text-textP placeholder-textT focus:outline-none"
        />
      </div>

      {/* Contact list */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Phone size={36} className="text-textT" />
            <p className="text-textS text-sm text-center">
              {search ? 'No contacts match your search' : 'No other users found. Invite someone to join P&B!'}
            </p>
          </div>
        ) : filtered.map(contact => (
          <div key={contact.uid}
            className="flex items-center gap-3 px-4 py-3 bg-surface1 hover:bg-surface2 border border-border1 rounded-2xl transition">
            <div className="relative">
              <Avatar name={contact.displayName} size={46} />
              {contact.online && (
                <div className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-online border-2 border-bg0" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-textP text-sm truncate">{contact.displayName}</p>
              <p className="text-textT text-xs">@{contact.username}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => startCall(contact, 'voice')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 hover:bg-accent/20 border border-accent/20 text-accentL rounded-xl text-xs font-semibold transition"
              >
                <Phone size={13} /> Voice
              </button>
              <button
                onClick={() => startCall(contact, 'video')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 hover:bg-accent/20 border border-accent/20 text-accentL rounded-xl text-xs font-semibold transition"
              >
                <Video size={13} /> Video
              </button>
            </div>
          </div>
        ))}
      </div>

      {activeCall && (
        <CallModal
          callType={activeCall.callType}
          chatName={activeCall.chatName}
          chatId={activeCall.chatId}
          otherUid={activeCall.otherUid}
          currentUser={user}
          profile={profile}
          onClose={() => setActiveCall(null)}
        />
      )}
    </div>
  );
}
