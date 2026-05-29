'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, Mail, User, AtSign, Eye, EyeOff, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function SignupPage() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [form, setForm]     = useState({ displayName: '', username: '', email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    setError('');
    try {
      await signUp(form);
      router.replace('/chat');
    } catch (err) {
      const msg =
        err.code === 'auth/email-already-in-use' ? 'An account with this email already exists.' :
        err.code === 'auth/weak-password'         ? 'Password is too weak.' :
        err.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg0 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-accent/20 border border-accent/30 flex items-center justify-center">
              <Shield size={20} className="text-accentL" />
            </div>
            <span className="text-2xl font-bold text-textP tracking-tight">P&amp;B</span>
          </div>
          <p className="text-textS text-sm">Create your encrypted account</p>
        </div>

        <div className="bg-bg2 border border-border1 rounded-2xl p-8">
          <h1 className="text-xl font-bold text-textP mb-6">Create account</h1>

          {error && (
            <div className="mb-4 px-4 py-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { label: 'Display name', key: 'displayName', icon: User,   type: 'text',     placeholder: 'Sarah Chen' },
              { label: 'Username',     key: 'username',    icon: AtSign,  type: 'text',     placeholder: 'sarahchen' },
              { label: 'Email',        key: 'email',       icon: Mail,    type: 'email',    placeholder: 'you@example.com' },
            ].map(({ label, key, icon: Icon, type, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-textS uppercase tracking-wider mb-2">{label}</label>
                <div className="relative">
                  <Icon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-textT" />
                  <input
                    type={type}
                    value={form[key]}
                    onChange={set(key)}
                    placeholder={placeholder}
                    required
                    className="w-full bg-bg3 border border-border1 rounded-xl pl-9 pr-4 py-3 text-textP text-sm placeholder-textT focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition"
                  />
                </div>
              </div>
            ))}

            <div>
              <label className="block text-xs font-semibold text-textS uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-textT" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  placeholder="Min. 6 characters"
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
              disabled={loading || Object.values(form).some(v => !v)}
              className="w-full py-3 bg-accent hover:bg-accentD disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition flex items-center justify-center"
            >
              {loading
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : 'Create Account'
              }
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-textS">
            Already have an account?{' '}
            <Link href="/login" className="text-accentL hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
