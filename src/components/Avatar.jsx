'use client';
import { useState } from 'react';

const COLORS = ['#60A5FA','#A78BFA','#F472B6','#34D399','#FBBF24','#F87171'];
function colorFor(str) { return COLORS[(str?.charCodeAt(0) || 0) % COLORS.length]; }

// Avatar with image support — falls back to initials if no src or image fails to load
export default function Avatar({ name = '?', src = null, size = 40, className = '' }) {
  const [imgError, setImgError] = useState(false);
  const initials = (name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const color    = colorFor(name);
  const showImg  = src && !imgError;

  if (showImg) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setImgError(true)}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full font-bold flex-shrink-0 select-none ${className}`}
      style={{ width: size, height: size, backgroundColor: color + '30', color, fontSize: size * 0.32 }}
    >
      {initials}
    </div>
  );
}
