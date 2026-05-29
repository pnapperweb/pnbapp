import { Shield, MessageCircle } from 'lucide-react';

export default function ChatIndex() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <div className="w-16 h-16 rounded-3xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-2">
        <Shield size={28} className="text-accentL" />
      </div>
      <h2 className="text-xl font-bold text-textP">Your messages are private</h2>
      <p className="text-textS text-sm max-w-sm leading-relaxed">
        Select a conversation from the sidebar, or start a new one. All messages are end-to-end encrypted.
      </p>
      <div className="flex items-center gap-2 mt-2 px-4 py-2 bg-online/10 border border-online/20 rounded-full">
        <div className="w-1.5 h-1.5 rounded-full bg-online animate-pulse" />
        <span className="text-online text-xs font-medium">Encryption active</span>
      </div>
    </div>
  );
}
