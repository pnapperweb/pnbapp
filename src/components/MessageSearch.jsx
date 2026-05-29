'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { Search, X, Clock, MessageSquare, ArrowRight } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';

const RECENT_KEY = 'pandb_recent_searches_v1';

function loadRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
function saveRecent(term) {
  if (!term.trim()) return;
  try {
    const prev = loadRecent().filter(t => t !== term).slice(0, 7);
    localStorage.setItem(RECENT_KEY, JSON.stringify([term, ...prev]));
  } catch {}
}

function highlight(text, term) {
  if (!term || !text) return text;
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-accent/30 text-accent rounded px-0.5">{text.slice(idx, idx + term.length)}</mark>
      {text.slice(idx + term.length)}
    </>
  );
}

export default function MessageSearch({ chats = [], onJumpToChat, onClose }) {
  const { user } = useAuth();
  const [q,        setQ]        = useState('');
  const [results,  setResults]  = useState([]);
  const [searching, setSearching] = useState(false);
  const [recent,   setRecent]   = useState([]);
  const [tab,      setTab]      = useState('messages'); // 'messages' | 'people' | 'chats'
  const inputRef  = useRef(null);
  const debounce  = useRef(null);

  useEffect(() => {
    setRecent(loadRecent());
    inputRef.current?.focus();
  }, []);

  const doSearch = useCallback(async (term) => {
    if (!term.trim() || !user?.uid) { setResults([]); return; }
    setSearching(true);
    try {
      const termLower = term.toLowerCase();
      const chatIds   = chats.map(c => c.id);
      const allResults = [];

      // Search messages — Firestore doesn't support full-text, so we fetch recent
      // messages from the user's chats and filter client-side
      if (tab === 'messages' && chatIds.length > 0) {
        // Query in batches of 10 (Firestore 'in' limit)
        const batches = [];
        for (let i = 0; i < chatIds.length; i += 10) {
          batches.push(chatIds.slice(i, i + 10));
        }
        const msgSnaps = await Promise.all(batches.map(batch =>
          getDocs(query(
            collection(db, 'messages'),
            where('chatId', 'in', batch),
            orderBy('createdAt', 'desc'),
            limit(200)
          ))
        ));
        msgSnaps.forEach(snap => {
          snap.docs.forEach(d => {
            const data = d.data();
            if (data.text?.toLowerCase().includes(termLower)) {
              const chat = chats.find(c => c.id === data.chatId);
              allResults.push({
                type:      'message',
                id:        d.id,
                chatId:    data.chatId,
                chatName:  chat?.name || 'Chat',
                text:      data.text,
                senderName: data.senderName,
                createdAt: data.createdAt,
                score:     data.text?.toLowerCase().indexOf(termLower) === 0 ? 2 : 1,
              });
            }
          });
        });
      }

      // Search people
      if (tab === 'people') {
        const snap = await getDocs(query(
          collection(db, 'users'),
          where('displayName', '>=', term),
          where('displayName', '<=', term + '\uf8ff'),
          limit(20)
        ));
        snap.docs.forEach(d => {
          const data = d.data();
          if (data.uid !== user.uid) {
            allResults.push({
              type:        'person',
              id:          d.id,
              uid:         data.uid,
              displayName: data.displayName,
              username:    data.username,
              avatar:      data.avatar,
            });
          }
        });
      }

      // Search chats by name
      if (tab === 'chats') {
        chats.filter(c => c.name?.toLowerCase().includes(termLower)).forEach(c => {
          allResults.push({ type: 'chat', id: c.id, chatId: c.id, chatName: c.name, lastMessage: c.lastMessage });
        });
      }

      // Sort by relevance score
      allResults.sort((a, b) => (b.score || 0) - (a.score || 0));
      setResults(allResults.slice(0, 50));
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setSearching(false);
    }
  }, [user?.uid, chats, tab]);

  function handleInput(e) {
    const val = e.target.value;
    setQ(val);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => doSearch(val), 350);
  }

  function handleSelect(result) {
    saveRecent(q);
    setRecent(loadRecent());
    if (result.chatId) onJumpToChat(result.chatId, result.id);
    onClose();
  }

  function formatTime(ts) {
    if (!ts?.toDate) return '';
    const d = ts.toDate();
    const now = new Date();
    if (now - d < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-16 px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-xl bg-bg2 border border-border2 rounded-2xl shadow-2xl overflow-hidden">

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border1">
          <Search size={18} className="text-textT flex-shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={handleInput}
            placeholder="Search messages, people, chats…"
            className="flex-1 bg-transparent text-textP text-sm placeholder-textT focus:outline-none"
          />
          {searching && <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin flex-shrink-0" />}
          {q && !searching && (
            <button onClick={() => { setQ(''); setResults([]); }} className="text-textT hover:text-textP">
              <X size={16} />
            </button>
          )}
          <button onClick={onClose} className="text-textT hover:text-textP ml-1">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border1">
          {[['messages', 'Messages'], ['people', 'People'], ['chats', 'Chats']].map(([t, label]) => (
            <button key={t} onClick={() => { setTab(t); if (q) doSearch(q); }}
              className={`flex-1 py-2 text-xs font-semibold transition
                ${tab === t ? 'text-accent border-b-2 border-accent' : 'text-textT hover:text-textP'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {!q && recent.length > 0 && (
            <div className="p-3">
              <p className="text-textT text-[11px] font-semibold uppercase tracking-wider mb-2">Recent</p>
              {recent.map((term, i) => (
                <button key={i} onClick={() => { setQ(term); doSearch(term); }}
                  className="flex items-center gap-2 w-full px-3 py-2 hover:bg-surface2 rounded-xl text-left transition">
                  <Clock size={13} className="text-textT" />
                  <span className="text-textS text-sm">{term}</span>
                </button>
              ))}
            </div>
          )}

          {results.length === 0 && q && !searching && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Search size={28} className="text-textT" />
              <p className="text-textS text-sm">No results for "{q}"</p>
            </div>
          )}

          {results.map(r => (
            <button key={r.id} onClick={() => handleSelect(r)}
              className="flex items-center gap-3 w-full px-4 py-3 hover:bg-surface1 transition text-left border-b border-border1/30 last:border-0">
              {r.type === 'message' && (
                <>
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <MessageSquare size={14} className="text-accentL" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-textS text-[11px] font-medium">{r.chatName} · {r.senderName}</p>
                      <p className="text-textT text-[10px]">{formatTime(r.createdAt)}</p>
                    </div>
                    <p className="text-textP text-sm truncate">{highlight(r.text, q)}</p>
                  </div>
                  <ArrowRight size={13} className="text-textT flex-shrink-0" />
                </>
              )}
              {r.type === 'person' && (
                <>
                  <Avatar name={r.displayName} src={r.avatar} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-textP text-sm font-medium">{highlight(r.displayName, q)}</p>
                    <p className="text-textT text-xs">@{r.username}</p>
                  </div>
                </>
              )}
              {r.type === 'chat' && (
                <>
                  <Avatar name={r.chatName} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-textP text-sm font-medium">{highlight(r.chatName, q)}</p>
                    <p className="text-textT text-xs truncate">{r.lastMessage}</p>
                  </div>
                  <ArrowRight size={13} className="text-textT flex-shrink-0" />
                </>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
