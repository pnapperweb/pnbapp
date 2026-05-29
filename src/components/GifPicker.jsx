'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, AlertCircle } from 'lucide-react';

// Calls our own /api/gifs proxy — no CORS, no exposed key
async function fetchGifs(q = '') {
  const url = q.trim()
    ? `/api/gifs?q=${encodeURIComponent(q)}&limit=24`
    : `/api/gifs?limit=24`;
  const res  = await fetch(url);
  const json = await res.json();
  return json.data || [];
}

export default function GifPicker({ onSelect, onClose }) {
  const [query,   setQuery]   = useState('');
  const [gifs,    setGifs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [noKey,   setNoKey]   = useState(false);
  const ref         = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const load = useCallback(async (q) => {
    setLoading(true);
    setNoKey(false);
    try {
      const results = await fetchGifs(q);
      if (results.length === 0 && !q) setNoKey(true);
      setGifs(results);
    } catch {
      setGifs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(''); }, [load]);

  function handleInput(e) {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(val), 400);
  }

  return (
    <div ref={ref}
      className="absolute bottom-full mb-2 left-0 w-80 bg-bg2 border border-border2 rounded-2xl shadow-2xl overflow-hidden z-50">

      <div className="flex items-center justify-between px-3 py-2 border-b border-border1">
        <span className="text-textP text-sm font-semibold">GIFs</span>
        <button onClick={onClose} className="text-textT hover:text-textP transition"><X size={15} /></button>
      </div>

      <div className="p-2 border-b border-border1">
        <div className="flex items-center gap-2 bg-bg3 border border-border1 rounded-xl px-3 py-1.5">
          <Search size={13} className="text-textT flex-shrink-0" />
          <input value={query} onChange={handleInput} placeholder="Search GIFs…" autoFocus
            className="flex-1 bg-transparent text-sm text-textP placeholder-textT focus:outline-none" />
          {query && <button onClick={() => { setQuery(''); load(''); }} className="text-textT hover:text-textP"><X size={12} /></button>}
        </div>
      </div>

      <div className="p-2 max-h-64 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : noKey ? (
          <div className="text-center py-6 px-4">
            <AlertCircle size={24} className="text-warning mx-auto mb-2" />
            <p className="text-textS text-xs font-semibold mb-1">Giphy API key needed</p>
            <p className="text-textT text-[11px] leading-relaxed">
              Get a free key at{' '}
              <a href="https://developers.giphy.com" target="_blank" rel="noreferrer"
                className="text-accentL hover:underline">developers.giphy.com</a>
              {' '}then add it to your <code className="bg-bg3 px-1 rounded">.env.local</code>:
            </p>
            <code className="block mt-2 bg-bg3 border border-border1 rounded-lg px-3 py-2 text-[11px] text-accentL text-left">
              GIPHY_API_KEY=your_key_here
            </code>
            <button onClick={() => load(query)}
              className="mt-3 text-xs text-accentL hover:underline">Retry</button>
          </div>
        ) : gifs.length === 0 ? (
          <p className="text-textT text-xs text-center py-8">No GIFs found</p>
        ) : (
          <div className="columns-2 gap-1.5 space-y-1.5">
            {gifs.map(gif => {
              const src = gif.images?.fixed_height_small?.url || gif.images?.downsized?.url;
              if (!src) return null;
              return (
                <button key={gif.id} onClick={() => onSelect({ url: src })}
                  className="w-full rounded-lg overflow-hidden hover:opacity-80 active:scale-95 transition block">
                  <img src={src} alt={gif.title || 'GIF'} className="w-full h-auto" loading="lazy" />
                </button>
              );
            })}
          </div>
        )}
        {!noKey && !loading && (
          <p className="text-textT text-[10px] text-center mt-2 font-bold">GIPHY</p>
        )}
      </div>
    </div>
  );
}
