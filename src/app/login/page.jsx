'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, Mail, Eye, EyeOff, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError('');
    try {
      await signIn({ email: email.trim(), password });
      router.replace('/chat');
    } catch (err) {
      const msg =
        err.code === 'auth/user-not-found'   || err.code === 'auth/wrong-password'  ? 'Incorrect email or password.' :
        err.code === 'auth/invalid-credential'                                       ? 'Incorrect email or password.' :
        err.code === 'auth/too-many-requests'                                        ? 'Too many attempts. Try again later.' :
        err.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg0 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-accent/20 border border-accent/30 flex items-center justify-center">
              <Shield size={20} className="text-accentL" />
            </div>
            <span className="text-2xl font-bold text-textP tracking-tight">P&amp;B</span>
          </div>
          <p className="text-textS text-sm">Private &amp; Bold — end-to-end encrypted</p>
        </div>

        <div className="bg-bg2 border border-border1 rounded-2xl p-8">
          <h1 className="text-xl font-bold text-textP mb-6">Sign in</h1>

          {error && (
            <div className="mb-4 px-4 py-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-textS uppercase tracking-wider mb-2">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-textT" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full bg-bg3 border border-border1 rounded-xl pl-9 pr-4 py-3 text-textP text-sm placeholder-textT focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-textS uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-textT" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-bg3 border border-border1 rounded-xl pl-9 pr-10 py-3 text-textP text-sm placeholder-textT focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition"
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-textT hover:text-textS transition">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-3 bg-accent hover:bg-accentD disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition flex items-center justify-center gap-2"
            >
              {loading
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : 'Sign In'
              }
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-textS">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-accentL hover:underline font-medium">Create one</Link>
          </p>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-textT">
          <Lock size={10} className="text-online" />
          <span>All messages are end-to-end encrypted</span>
        </div>
      </div>
    </div>
  );
}
