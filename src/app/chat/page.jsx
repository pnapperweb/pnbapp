'use client';
import { useState, useEffect } from 'react';

const QUOTES = [
  { text: 'i love you :)',                                          author: 'Paul',   date: '20 Apr 2005' },
  { text: 'i love you ;)',                                          author: 'Paul',   date: '1 Sep 2004'  },
  { text: 'its ok i get to talk to you now :)',                     author: 'Paul',   date: '22 May 2005' },
  { text: 'it was ok, i missed you a lot but :(',                   author: 'Paul',   date: '22 May 2005' },
  { text: 'i miss you:(',                                           author: 'Brooke', date: '22 May 2005' },
  { text: 'so we should get dinner or something',                   author: 'Brooke', date: '1 Sep 2004'  },
  { text: 'sounds like a plan :)',                                   author: 'Paul',   date: '1 Sep 2004'  },
  { text: 'i buy u chocolate:)',                                     author: 'Brooke', date: '1 Sep 2004'  },
  { text: 'and we get chocolate:)',                                  author: 'Brooke', date: '1 Sep 2004'  },
  { text: 'i just went :| because i cant believe you got chocolate and i didnt', author: 'Paul', date: '20 Apr 2005' },
  { text: 'awww he has too eat ;) xxxxxxxxx',                       author: 'Paul',   date: '20 Apr 2005' },
  { text: 'but still see you if you want to',                       author: 'Paul',   date: '1 Sep 2004'  },
  { text: 'we could go on the weekend if you wanted 2',             author: 'Paul',   date: '1 Sep 2004'  },
  { text: 'nobody loves me everybody hates me do do do;)',           author: 'Brooke', date: '1 Sep 2004'  },
  { text: 'ill come with you then :)',                               author: 'Paul',   date: '1 Sep 2004'  },
  { text: 'can i come to the library and read with you?',           author: 'Paul',   date: '1 Sep 2004'  },
  { text: "he would like to go to the movies with you in 'grad' week", author: 'Paul', date: '1 Sep 2004' },
  { text: 'yey:)',                                                   author: 'Brooke', date: '1 Sep 2004'  },
  { text: 'the photos of tara were cool:)',                          author: 'Brooke', date: '12 May 2005' },
  { text: 'haha cool you saw them :)',                               author: 'Paul',   date: '12 May 2005' },
  { text: 'i saw that in my inbox and im like aaaaaaaaaaawwwwwwwwwwwwwwwwwww', author: 'Brooke', date: '12 May 2005' },
  { text: 'yey! congradulations:)',                                  author: 'Brooke', date: '12 May 2005' },
  { text: 'my mums knitting me a jumper 8-| hehehe',                author: 'Paul',   date: '22 May 2005' },
  { text: 'i made the salad:P',                                      author: 'Brooke', date: '22 May 2005' },
  { text: 'and this raspberry sauce for ice cream',                  author: 'Brooke', date: '22 May 2005' },
  { text: 'awww sounds nice ;)',                                     author: 'Paul',   date: '22 May 2005' },
  { text: 'well then ill do it all 2night :P',                       author: 'Paul',   date: '1 Sep 2004'  },
  { text: 'aww cool :)',                                             author: 'Paul',   date: '22 May 2005' },
  { text: 'yey:P',                                                   author: 'Brooke', date: '22 May 2005' },
  { text: 'and ones knittd:P',                                       author: 'Brooke', date: '22 May 2005' },
];

export default function ChatIndex() {
  const [idx, setIdx]       = useState(() => Math.floor(Math.random() * QUOTES.length));
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out, swap, fade in
      setVisible(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % QUOTES.length);
        setVisible(true);
      }, 500);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const q = QUOTES[idx];

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-8 select-none">
      {/* Logo */}
      <img
        src="/pnb-logo.png"
        alt="P&B"
        className="w-28 h-28 object-contain opacity-90 drop-shadow-lg"
      />

      {/* MSN Messenger quote — fades between messages */}
      <div
        className="max-w-sm space-y-1 transition-opacity duration-500"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {/* MSN-style badge */}
        <div className="flex items-center justify-center gap-1.5 mb-2">
          <span className="text-[10px] text-textT tracking-widest uppercase font-medium opacity-60">
            MSN Messenger · {q.date}
          </span>
        </div>

        <p className="text-lg font-semibold text-textP leading-snug">
          &ldquo;{q.text}&rdquo;
        </p>
        <p className="text-sm text-textT italic">&mdash; {q.author}</p>
      </div>

      {/* Dot indicators */}
      <div className="flex gap-1.5">
        {QUOTES.map((_, i) => (
          <button
            key={i}
            onClick={() => { setVisible(false); setTimeout(() => { setIdx(i); setVisible(true); }, 300); }}
            className={`rounded-full transition-all duration-300 ${
              i === idx
                ? 'w-4 h-1.5 bg-accent'
                : 'w-1.5 h-1.5 bg-surface3 hover:bg-surface2'
            }`}
          />
        ))}
      </div>

      {/* Encryption badge */}
      <div className="flex items-center gap-2 px-4 py-1.5 bg-online/10 border border-online/20 rounded-full">
        <div className="w-1.5 h-1.5 rounded-full bg-online animate-pulse" />
        <span className="text-online text-xs font-medium">All messages end-to-end encrypted</span>
      </div>
    </div>
  );
}
