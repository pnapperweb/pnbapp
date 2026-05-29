'use client';
import { useState, useRef, useEffect } from 'react';
import { Upload, Plus, Loader2, X } from 'lucide-react';

const BUILT_IN = {
  '😊 Smileys':    ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳'],
  '👍 Gestures':   ['👍','👎','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👋','🤚','🖐','✋','🖖','👏','🙌','🤲','🤝','🙏'],
  '❤️ Hearts':     ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟'],
  '🎉 Celebrate':  ['🎉','🎊','🎈','🎁','🎀','🎂','🎆','🎇','✨','⭐','🌟','💫','🎯','🏆','🥇','🎮','🎲'],
  '🔥 Popular':    ['🔥','💯','✅','❌','⚡','💥','🌈','🎵','🎶','💪','🚀','👀','💀','🤡','👻','💩'],
  '🐶 Animals':    ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🦄','🐔','🐧','🦋','🐝'],
  '🍕 Food':       ['🍕','🍔','🍟','🌭','🍿','🥓','🥚','🍳','🧇','🥞','🍞','🥐','🧀','🥗','🍜','🍣','🍱','🍩','🍪','🎂'],
  '⚽ Sports':     ['⚽','🏀','🏈','⚾','🎾','🏐','🎱','🏓','🥊','⛸️','🏋️','🤸','🏊','🚴','🧗','🤺'],
  '🌍 Travel':     ['🌍','🌎','🌏','🗺️','🧭','🏔️','⛰️','🌋','🏕️','🏖️','🏜️','🌊','🌅','🌆','🏙️','✈️','🚂','🚢'],
  '💼 Objects':    ['💼','📱','💻','🖥️','⌨️','📷','📸','📹','🎥','📞','☎️','📺','📻','⏰','💡','🔦','🕯️','🔑','🗝️','🔒'],
};

const CUSTOM_KEY = 'pandb_custom_emojis_v2';

function loadCustom() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); } catch { return []; }
}
function saveCustom(list) {
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(list)); } catch {}
}

// Convert file to base64 data URL — stored in localStorage, no Firebase Storage needed
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function CustomEmojiImg({ emoji, size = 28 }) {
  if (emoji.type === 'image') {
    return <img src={emoji.value} alt={emoji.name}
      style={{ width: size, height: size, objectFit: 'contain', borderRadius: 4 }} />;
  }
  return <span style={{ fontSize: size * 0.75 }}>{emoji.value}</span>;
}

export default function EmojiPicker({ onSelect, onClose }) {
  const [category, setCategory]   = useState(Object.keys(BUILT_IN)[0]);
  const [search,   setSearch]     = useState('');
  const [custom,   setCustom]     = useState([]);
  const [addMode,  setAddMode]    = useState(false);
  const [newText,  setNewText]    = useState('');
  const [newName,  setNewName]    = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const ref     = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => { setCustom(loadCustom()); }, []);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  function addTextEmoji() {
    const emoji = newText.trim();
    if (!emoji) return;
    const item    = { name: newName.trim() || emoji, type: 'text', value: emoji };
    const updated = [item, ...custom].slice(0, 100);
    setCustom(updated);
    saveCustom(updated);
    setNewText('');
    setNewName('');
    setAddMode(false);
    setCategory('⭐ Custom');
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setUploadErr('Please select an image file'); return; }
    // Limit to 200KB to stay within localStorage limits
    if (file.size > 200 * 1024) { setUploadErr('Image must be under 200KB for local storage'); return; }

    setUploading(true);
    setUploadErr('');
    try {
      const dataUrl = await fileToDataUrl(file);
      const name    = newName.trim() || file.name.replace(/\.[^.]+$/, '');
      const item    = { name, type: 'image', value: dataUrl };
      const updated = [item, ...custom].slice(0, 50);
      setCustom(updated);
      saveCustom(updated);
      setNewName('');
      setAddMode(false);
      setCategory('⭐ Custom');
    } catch (err) {
      setUploadErr('Failed to load image: ' + err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function removeCustom(index) {
    const updated = custom.filter((_, i) => i !== index);
    setCustom(updated);
    saveCustom(updated);
  }

  function handleSelect(emoji) {
    if (typeof emoji === 'string') {
      onSelect(emoji);
    } else if (emoji.type === 'text') {
      onSelect(emoji.value);
    } else {
      // Image emoji — send as token the bubble renderer understands
      onSelect(`[emoji:${emoji.name}:${emoji.value}]`);
    }
  }

  const allCategories = custom.length > 0
    ? { '⭐ Custom': custom, ...BUILT_IN }
    : BUILT_IN;

  const allBuiltIn  = Object.values(BUILT_IN).flat();
  const isCustomCat = category === '⭐ Custom';
  const displayed   = search.trim()
    ? allBuiltIn.filter(e => e.includes(search))
    : isCustomCat ? custom : (BUILT_IN[category] || []);

  return (
    <div ref={ref}
      className="absolute bottom-full mb-2 left-0 w-80 bg-bg2 border border-border2 rounded-2xl shadow-2xl overflow-hidden z-50">

      {/* Search + add button */}
      <div className="flex items-center gap-2 p-2 border-b border-border1">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search emoji…" autoFocus
          className="flex-1 bg-bg3 rounded-xl px-3 py-1.5 text-sm text-textP placeholder-textT focus:outline-none border border-border1 focus:border-accent/50" />
        <button onClick={() => { setAddMode(v => !v); setUploadErr(''); }}
          className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition
            ${addMode ? 'bg-accent/20 text-accentL' : 'bg-surface2 text-textT hover:text-textP'}`}
          title="Add custom emoji">
          <Plus size={15} />
        </button>
      </div>

      {/* Add custom panel */}
      {addMode && (
        <div className="p-3 border-b border-border1 bg-bg3/60 space-y-2">
          <p className="text-textT text-[10px] uppercase tracking-wider font-semibold">Add Custom Emoji</p>

          <input value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Name (e.g. party-blob)"
            className="w-full bg-bg3 border border-border1 rounded-lg px-2 py-1.5 text-sm text-textP placeholder-textT focus:outline-none focus:border-accent/50" />

          {/* Paste text emoji */}
          <div className="flex gap-2">
            <input value={newText} onChange={e => setNewText(e.target.value)}
              placeholder="Paste any emoji 🎉"
              className="flex-1 bg-bg3 border border-border1 rounded-lg px-2 py-1.5 text-sm text-textP placeholder-textT focus:outline-none focus:border-accent/50"
              maxLength={8} />
            <button onClick={addTextEmoji} disabled={!newText.trim()}
              className="px-3 py-1.5 bg-accent/20 hover:bg-accent/30 disabled:opacity-40 text-accentL text-xs font-semibold rounded-lg transition whitespace-nowrap">
              Add
            </button>
          </div>

          {/* Upload image — stored as base64 in localStorage, no CORS */}
          <div>
            <input ref={fileRef} type="file" accept="image/png,image/gif,image/jpeg,image/webp"
              onChange={handleFileUpload} className="hidden" id="emoji-upload" />
            <label htmlFor="emoji-upload"
              className={`flex items-center justify-center gap-2 w-full py-2 border border-dashed rounded-lg text-xs cursor-pointer transition
                ${uploading
                  ? 'border-border1 opacity-50 cursor-not-allowed text-textT'
                  : 'border-border2 hover:border-accent/50 hover:bg-accent/5 text-textS hover:text-accentL'}`}>
              {uploading
                ? <><Loader2 size={13} className="animate-spin" /> Processing…</>
                : <><Upload size={13} /> Upload image (PNG/GIF/JPG · max 200KB)</>
              }
            </label>
          </div>

          {uploadErr && (
            <p className="text-danger text-[11px] flex items-center gap-1">
              <X size={10} /> {uploadErr}
            </p>
          )}
          <p className="text-textT text-[10px]">Images are stored locally in your browser</p>
        </div>
      )}

      {/* Category tabs */}
      {!search && (
        <div className="flex overflow-x-auto p-1 gap-1 border-b border-border1" style={{ scrollbarWidth: 'none' }}>
          {Object.keys(allCategories).map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`flex-shrink-0 text-xs px-2 py-1 rounded-lg transition whitespace-nowrap
                ${category === cat ? 'bg-accent/20 text-accentL' : 'text-textT hover:text-textP hover:bg-surface2'}`}>
              {cat.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      {/* Emoji grid */}
      <div className={`p-2 max-h-52 overflow-y-auto ${isCustomCat && !search ? 'grid grid-cols-6 gap-1' : 'grid grid-cols-8 gap-0.5'}`}>
        {isCustomCat && !search
          ? custom.map((emoji, i) => (
            <div key={i} className="relative group flex flex-col items-center gap-0.5">
              <button onClick={() => handleSelect(emoji)}
                className="w-10 h-10 flex items-center justify-center hover:bg-surface2 rounded-xl transition active:scale-90">
                <CustomEmojiImg emoji={emoji} size={28} />
              </button>
              <span className="text-textT text-[9px] truncate w-full text-center">{emoji.name}</span>
              <button onClick={() => removeCustom(i)}
                className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-danger rounded-full text-white hidden group-hover:flex items-center justify-center text-[9px] font-bold z-10">
                ×
              </button>
            </div>
          ))
          : displayed.map((emoji, i) => (
            <button key={i} onClick={() => handleSelect(emoji)}
              className="w-8 h-8 flex items-center justify-center text-xl hover:bg-surface2 rounded-lg transition active:scale-90">
              {emoji}
            </button>
          ))
        }
        {displayed.length === 0 && (
          <div className="col-span-8 py-6 text-center">
            <p className="text-textT text-xs">
              {isCustomCat ? 'No custom emojis yet — add one above ↑' : 'No results'}
            </p>
          </div>
        )}
      </div>

      <p className="text-textT text-[9px] text-center pb-1.5 px-2">
        {custom.length > 0
          ? `${custom.length} custom emoji${custom.length !== 1 ? 's' : ''} saved`
          : 'Use + to add custom emoji or upload an image'}
      </p>
    </div>
  );
}
