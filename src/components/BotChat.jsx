'use client';
import { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Sparkles, Loader2 } from 'lucide-react';

const SUGGESTIONS = [
  'Summarise this conversation',
  'What tasks were discussed?',
  'Draft a follow-up reply',
  'What decisions were made?',
  'List unresolved items',
];

function BotMessage({ msg }) {
  const isBot = msg.role === 'bot';
  return (
    <div className={`flex gap-2 ${isBot ? '' : 'flex-row-reverse'}`}>
      {isBot && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center flex-shrink-0">
          <Bot size={13} className="text-white" />
        </div>
      )}
      <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
        ${isBot
          ? 'bg-bg3 text-textP border border-border1 rounded-bl-sm'
          : 'bg-accent text-white rounded-br-sm'
        }`}>
        {msg.text}
      </div>
    </div>
  );
}

export default function BotChat({ chatMessages = [], onClose }) {
  const [messages, setMessages] = useState([
    { role: 'bot', text: "Hi! I'm pnb-bot 🤖\n\nI can summarise this conversation, extract tasks, draft replies, and more. What would you like help with?" }
  ]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(text) {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setLoading(true);

    try {
      const res = await fetch('/api/bot', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          prompt:   msg,
          messages: chatMessages.slice(-30), // last 30 messages as context
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'bot', text: data.text || data.error || 'Something went wrong.' }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'bot', text: 'Failed to reach pnb-bot. Try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-bg1 border border-border2 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{ height: 520 }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border1 bg-gradient-to-r from-accent/10 to-purple-500/10 flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center">
            <Bot size={16} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-textP text-sm">pnb-bot</p>
            <p className="text-textT text-xs flex items-center gap-1">
              <Sparkles size={9} /> AI assistant
            </p>
          </div>
          <button onClick={onClose} className="ml-auto text-textT hover:text-textP transition">
            <X size={16} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => <BotMessage key={i} msg={m} />)}
          {loading && (
            <div className="flex gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center flex-shrink-0">
                <Bot size={13} className="text-white" />
              </div>
              <div className="px-3.5 py-2.5 bg-bg3 border border-border1 rounded-2xl rounded-bl-sm">
                <Loader2 size={14} className="text-textT animate-spin" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => send(s)}
                className="text-xs px-3 py-1.5 bg-accent/10 border border-accent/20 text-accentL rounded-full hover:bg-accent/20 transition">
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="flex items-center gap-2 px-3 py-3 border-t border-border1 flex-shrink-0">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Ask pnb-bot anything…"
            className="flex-1 bg-bg3 border border-border1 rounded-xl px-3 py-2 text-sm text-textP placeholder-textT focus:outline-none focus:border-accent/50"
          />
          <button onClick={() => send()}
            disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-full bg-accent disabled:opacity-30 flex items-center justify-center hover:bg-accentD transition">
            <Send size={14} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
