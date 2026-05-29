'use client';
import { useState, useRef, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { Bot, Send, X, Loader2, Sparkles, ChevronDown } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

const QUICK_PROMPTS = [
  'Summarise my recent messages',
  'What tasks were discussed today?',
  'Draft a polite follow-up reply',
  'Show unresolved items',
  'What did I miss while away?',
];

const BOT_AVATAR = (
  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center flex-shrink-0">
    <Bot size={14} className="text-white" />
  </div>
);

export default function PnbBot({ chats = [], onClose }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    { role: 'bot', text: "Hi! I'm pnb-bot 👋 I can summarise chats, extract tasks, draft replies, and more. What would you like help with?" }
  ]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [chatCtx,  setChatCtx]  = useState('');
  const bottomRef = useRef(null);

  // Load recent message context from user's chats
  useEffect(() => {
    if (!user?.uid || chats.length === 0) return;
    const chatIds = chats.map(c => c.id).slice(0, 5); // last 5 chats

    const batches = [];
    for (let i = 0; i < chatIds.length; i += 10) batches.push(chatIds.slice(i, i + 10));

    Promise.all(batches.map(batch =>
      getDocs(query(collection(db, 'messages'), where('chatId', 'in', batch), orderBy('createdAt', 'desc'), limit(50)))
    )).then(snaps => {
      const msgs = snaps.flatMap(s => s.docs.map(d => d.data()))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        .slice(0, 100);

      const ctx = msgs.reverse().map(m => {
        const chat = chats.find(c => c.id === m.chatId);
        const time = m.createdAt?.toDate?.()?.toLocaleString() || '';
        return `[${chat?.name || 'Chat'} | ${m.senderName} | ${time}]: ${m.text || m.type}`;
      }).join('\n');

      setChatCtx(ctx);
    }).catch(() => {});
  }, [chats.length, user?.uid]); // eslint-disable-line

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(text) {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setLoading(true);

    try {
      const res = await fetch('/api/pnb-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: chatCtx, userQuery: q }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'bot', text: data.reply || data.error || 'Something went wrong.' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: 'Connection error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4 pointer-events-none">
      <div className="w-full max-w-sm pointer-events-auto bg-bg1 border border-border2 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ height: 520 }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-accent/10 to-purple-500/10 border-b border-border1 flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center shadow-lg shadow-accent/30">
            <Bot size={16} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-textP text-sm">pnb-bot</p>
            <p className="text-textT text-[11px] flex items-center gap-1"><Sparkles size={9} /> AI Assistant</p>
          </div>
          <button onClick={onClose} className="text-textT hover:text-textP transition">
            <X size={16} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {m.role === 'bot' && BOT_AVATAR}
              <div className={`max-w-[82%] px-3 py-2 rounded-2xl text-sm leading-relaxed
                ${m.role === 'user'
                  ? 'bg-accent text-white rounded-br-sm'
                  : 'bg-bg3 text-textP border border-border1 rounded-bl-sm'}`}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2">
              {BOT_AVATAR}
              <div className="bg-bg3 border border-border1 rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-textT animate-bounce" />
                <div className="w-1.5 h-1.5 rounded-full bg-textT animate-bounce" style={{ animationDelay: '0.15s' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-textT animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick prompts */}
        {messages.length <= 1 && (
          <div className="px-3 pb-2 flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map(p => (
              <button key={p} onClick={() => send(p)}
                className="text-[11px] px-2.5 py-1 bg-accent/10 hover:bg-accent/20 border border-accent/20 text-accentL rounded-full transition">
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-t border-border1 flex-shrink-0">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Ask pnb-bot anything…"
            disabled={loading}
            className="flex-1 bg-bg3 border border-border1 rounded-xl px-3 py-2 text-sm text-textP placeholder-textT focus:outline-none focus:border-accent/50 disabled:opacity-50 transition"
          />
          <button onClick={() => send()}
            disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-full bg-accent hover:bg-accentD disabled:opacity-30 flex items-center justify-center transition">
            {loading ? <Loader2 size={15} className="text-white animate-spin" /> : <Send size={15} className="text-white" />}
          </button>
        </div>
      </div>
    </div>
  );
}
