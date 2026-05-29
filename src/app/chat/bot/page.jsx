'use client';
import { useState, useRef, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, limit, doc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { Bot, Send, Loader2, Sparkles, Clock, X, Check, CalendarClock } from 'lucide-react';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../context/AuthContext';

const QUICK_PROMPTS = [
  'Summarise my recent messages',
  'What tasks were discussed today?',
  'Draft a polite follow-up reply',
  "Send 'Good morning!' to Brooke Napper at 8am",
  'What did I miss while away?',
];

const BOT_AVATAR = (
  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center flex-shrink-0 shadow-md">
    <Bot size={15} className="text-white" />
  </div>
);

// Parse "8am", "8:30pm", "14:00" → { hours, minutes }
function parseTime(str) {
  const s = str.trim().toLowerCase();
  const match = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;
  let h = parseInt(match[1]);
  const m = parseInt(match[2] || '0');
  const period = match[3];
  if (period === 'pm' && h < 12) h += 12;
  if (period === 'am' && h === 12) h = 0;
  return { hours: h, minutes: m };
}

// Build a Date for today at the given time (or tomorrow if already past)
function buildScheduledDate(timeStr) {
  const parsed = parseTime(timeStr);
  if (!parsed) return null;
  const d = new Date();
  d.setSeconds(0, 0);
  d.setHours(parsed.hours, parsed.minutes);
  if (d <= new Date()) d.setDate(d.getDate() + 1); // schedule for tomorrow if past
  return d;
}

// ScheduleConfirm modal
function ScheduleConfirm({ action, chats, onConfirm, onCancel }) {
  const [selectedChat, setSelectedChat] = useState('');
  const [timeStr,      setTimeStr]      = useState(action.timeStr || '');
  const [error,        setError]        = useState('');

  const matchedChats = chats.filter(c =>
    c.name?.toLowerCase().includes(action.targetName?.toLowerCase())
  );

  useEffect(() => {
    if (matchedChats.length === 1) setSelectedChat(matchedChats[0].id);
  }, []);

  function confirm() {
    if (!selectedChat) { setError('Please select a recipient chat'); return; }
    const scheduledAt = buildScheduledDate(timeStr);
    if (!scheduledAt) { setError('Invalid time — try "8am" or "14:30"'); return; }
    onConfirm({ chatId: selectedChat, message: action.message, scheduledAt });
  }

  return (
    <div className="mx-3 my-2 bg-bg3 border border-accent/30 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-accentL font-semibold text-sm">
        <CalendarClock size={15} /> Schedule Message
      </div>

      <div className="bg-bg2 rounded-xl px-3 py-2 text-sm text-textP border border-border1">
        "{action.message}"
      </div>

      <div>
        <label className="text-xs text-textT mb-1 block">Send to</label>
        <select value={selectedChat} onChange={e => setSelectedChat(e.target.value)}
          className="w-full bg-bg2 border border-border1 rounded-xl px-3 py-2 text-sm text-textP focus:outline-none focus:border-accent/50">
          <option value="">Select recipient…</option>
          {chats.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-textT mb-1 block">Send at</label>
        <input value={timeStr} onChange={e => setTimeStr(e.target.value)}
          placeholder='e.g. 8am or 14:30'
          className="w-full bg-bg2 border border-border1 rounded-xl px-3 py-2 text-sm text-textP focus:outline-none focus:border-accent/50" />
      </div>

      {error && <p className="text-danger text-xs">{error}</p>}

      <div className="flex gap-2">
        <button onClick={confirm}
          className="flex-1 py-2 bg-accent hover:bg-accentD text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-1.5 transition">
          <Check size={14} /> Confirm
        </button>
        <button onClick={onCancel}
          className="px-4 py-2 bg-surface2 hover:bg-surface3 text-textS text-sm rounded-xl transition">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function BotPage() {
  const { user } = useAuth();
  const [messages,  setMessages]  = useState([
    { role: 'bot', text: "Hi! I'm pnb-bot 👋 I can summarise chats, extract tasks, draft replies, and schedule messages.\n\nTry: \"Send 'Good morning!' to Brooke at 8am\"" }
  ]);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [chatCtx,   setChatCtx]   = useState('');
  const [chats,     setChats]     = useState([]);
  const [scheduled, setScheduled] = useState([]); // list of pending scheduled msgs
  const bottomRef = useRef(null);

  // Load chats list + recent message context
  useEffect(() => {
    if (!user?.uid) return;
    getDocs(query(collection(db, 'chats'), where('members', 'array-contains', user.uid)))
      .then(async snap => {
        // Build chat list with names
        const chatList = snap.docs.map(d => {
          const data = d.data();
          const otherUid = data.members?.find(m => m !== user.uid);
          const name = data.memberNames?.[otherUid] || data.name || 'Unknown';
          return { id: d.id, name };
        });
        setChats(chatList);

        const chatIds = snap.docs.map(d => d.id).slice(0, 5);
        if (!chatIds.length) return;
        const batches = [];
        for (let i = 0; i < chatIds.length; i += 10) batches.push(chatIds.slice(i, i + 10));
        const allSnaps = await Promise.all(batches.map(batch =>
          getDocs(query(collection(db, 'messages'), where('chatId', 'in', batch), orderBy('createdAt', 'desc'), limit(50)))
        ));
        const msgs = allSnaps.flatMap(s => s.docs.map(d => d.data()))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
          .slice(0, 100);
        const ctx = msgs.reverse().map(m => {
          const time = m.createdAt?.toDate?.()?.toLocaleString() || '';
          return `[${m.senderName} | ${time}]: ${m.text || m.type}`;
        }).join('\n');
        setChatCtx(ctx);
      }).catch(() => {});
  }, [user?.uid]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Ticker — check scheduled messages every 30s
  useEffect(() => {
    const interval = setInterval(async () => {
      const now = new Date();
      const due = scheduled.filter(s => s.scheduledAt <= now);
      if (!due.length) return;

      for (const s of due) {
        try {
          await addDoc(collection(db, 'messages'), {
            chatId:     s.chatId,
            text:       s.message,
            senderId:   user.uid,
            senderName: user.displayName || 'You',
            type:       'text',
            read:       false,
            createdAt:  serverTimestamp(),
          });
          setMessages(prev => [...prev, {
            role: 'bot',
            text: `✅ Scheduled message sent: "${s.message}"`,
          }]);
        } catch {
          setMessages(prev => [...prev, {
            role: 'bot',
            text: `❌ Failed to send scheduled message: "${s.message}"`,
          }]);
        }
      }
      setScheduled(prev => prev.filter(s => s.scheduledAt > now));
    }, 30_000);
    return () => clearInterval(interval);
  }, [scheduled, user]);

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
        body: JSON.stringify({ context: chatCtx, userQuery: q, userId: user?.uid }),
      });
      const data = await res.json();

      if (data.scheduleAction) {
        setMessages(prev => [...prev, {
          role: 'bot',
          text: data.reply || `I detected a schedule request. Please confirm the details below.`,
          scheduleAction: data.scheduleAction,
        }]);
      } else {
        setMessages(prev => [...prev, { role: 'bot', text: data.reply || data.error || 'Something went wrong.' }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: 'Connection error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  function handleConfirmSchedule(msgIndex, { chatId, message, scheduledAt }) {
    setScheduled(prev => [...prev, { chatId, message, scheduledAt }]);
    const timeLabel = scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateLabel = scheduledAt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    setMessages(prev => prev.map((m, i) => i === msgIndex
      ? { ...m, scheduleAction: null, scheduleConfirmed: true,
          text: m.text + `\n\n✅ Scheduled! "${message}" will be sent at ${timeLabel} on ${dateLabel}.` }
      : m
    ));
  }

  function handleCancelSchedule(msgIndex) {
    setMessages(prev => prev.map((m, i) => i === msgIndex
      ? { ...m, scheduleAction: null }
      : m
    ));
  }

  return (
    <div className="flex flex-col h-full bg-bg1">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border1 bg-bg1 flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center shadow-lg shadow-accent/20">
          <Bot size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-textP text-sm">pnb-bot</p>
          <p className="text-textT text-xs flex items-center gap-1">
            <Sparkles size={9} className="text-accentL" /> AI Assistant · Powered by Claude
          </p>
        </div>
        {scheduled.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-accentL bg-accent/10 border border-accent/20 px-2.5 py-1 rounded-full">
            <Clock size={11} /> {scheduled.length} scheduled
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i}>
            <div className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {m.role === 'bot' && BOT_AVATAR}
              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                ${m.role === 'user'
                  ? 'bg-accent text-white rounded-br-sm'
                  : 'bg-bg3 text-textP border border-border1 rounded-bl-sm'}`}>
                {m.text}
              </div>
            </div>
            {/* Schedule confirmation widget */}
            {m.scheduleAction && !m.scheduleConfirmed && (
              <div className="mt-2 ml-11">
                <ScheduleConfirm
                  action={m.scheduleAction}
                  chats={chats}
                  onConfirm={(opts) => handleConfirmSchedule(i, opts)}
                  onCancel={() => handleCancelSchedule(i)}
                />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            {BOT_AVATAR}
            <div className="bg-bg3 border border-border1 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
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
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {QUICK_PROMPTS.map(p => (
            <button key={p} onClick={() => send(p)}
              className="text-xs px-3 py-1.5 bg-accent/10 hover:bg-accent/20 border border-accent/20 text-accentL rounded-full transition">
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-3 px-4 py-3 border-t border-border1 bg-bg1 flex-shrink-0">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Ask pnb-bot… or: Send 'Good morning!' to Brooke at 9am"
          disabled={loading}
          className="flex-1 bg-bg3 border border-border1 rounded-2xl px-4 py-2.5 text-sm text-textP placeholder-textT focus:outline-none focus:border-accent/50 disabled:opacity-50 transition"
        />
        <button onClick={() => send()}
          disabled={!input.trim() || loading}
          className="w-10 h-10 rounded-full bg-accent hover:bg-accentD disabled:opacity-30 flex items-center justify-center transition shadow-lg shadow-accent/30">
          {loading
            ? <Loader2 size={16} className="text-white animate-spin" />
            : <Send size={16} className="text-white" />}
        </button>
      </div>
    </div>
  );
}
