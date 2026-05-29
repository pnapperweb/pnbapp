export default function ChatIndex() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 text-center px-8">
      {/* Logo */}
      <img
        src="/pnb-logo.png"
        alt="P&B"
        className="w-24 h-24 object-contain opacity-90 drop-shadow-lg"
      />

      {/* Love quote */}
      <div className="space-y-1">
        <p className="text-2xl font-bold text-textP tracking-wide">&ldquo;I LOVE YOU&rdquo;</p>
        <p className="text-textT text-sm italic">&mdash; Paul Napper</p>
      </div>

      {/* Encryption badge */}
      <div className="flex items-center gap-2 mt-1 px-4 py-2 bg-online/10 border border-online/20 rounded-full">
        <div className="w-1.5 h-1.5 rounded-full bg-online animate-pulse" />
        <span className="text-online text-xs font-medium">All messages end-to-end encrypted</span>
      </div>
    </div>
  );
}
