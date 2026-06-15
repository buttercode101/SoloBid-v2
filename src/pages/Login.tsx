import React, { useState } from 'react';
import { ArrowRight, BadgeCheck, FileText, Loader2, Mail, ReceiptText, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';

interface PasswordStrength {
  score: number;
  feedback: string[];
  isValid: boolean;
}

function validatePassword(password: string): PasswordStrength {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score += 25;
  else feedback.push('Use at least 8 characters');

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 25;
  else feedback.push('Mix uppercase and lowercase letters');

  if (/[0-9]/.test(password)) score += 25;
  else feedback.push('Include a number');

  if (/[^a-zA-Z0-9]/.test(password)) score += 25;
  else feedback.push('Add a symbol for extra protection');

  return { score, feedback, isValid: score >= 75 };
}

const PasswordStrengthIndicator = ({ password }: { password: string }) => {
  if (!password) return null;
  const strength = validatePassword(password);

  return (
    <div className="mt-2 space-y-2">
      <div className="h-1.5 w-full rounded-full bg-zinc-200">
        <div
          className={`h-1.5 rounded-full transition-all ${strength.score < 50 ? 'bg-red-500' : strength.score < 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${strength.score}%` }}
        />
      </div>
      {strength.feedback.length > 0 && (
        <ul className="space-y-1 text-xs text-zinc-500">
          {strength.feedback.map((msg) => (
            <li key={msg}>• {msg}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

const FeatureBadge = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-emerald-50 shadow-sm backdrop-blur">
    {children}
  </span>
);

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || 'Failed to sign in with Google. Please try again.');
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const strength = validatePassword(password);

    if (isSignUp && !strength.isValid) {
      toast.error('Please choose a stronger password before creating your account.');
      return;
    }

    try {
      setLoading(true);
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed. Check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#061f1b] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(52,211,153,0.22),_transparent_34%),linear-gradient(180deg,_rgba(255,255,255,0.04),_transparent_28%)]" />
      <main className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col items-center justify-center text-center">
        <section className="flex w-full flex-col items-center">
          <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-emerald-950 shadow-2xl shadow-black/20">
            <ReceiptText className="h-8 w-8" />
          </div>

          <p className="mb-6 text-sm font-black uppercase tracking-[0.32em] text-emerald-100">SoloBid</p>

          <h1 className="max-w-2xl text-5xl font-black leading-[0.95] tracking-[-0.06em] text-white sm:text-6xl md:text-7xl">
            Quote it.<br />Sign it.<br />Get paid.
          </h1>

          <p className="mt-8 max-w-xl text-base leading-8 text-emerald-50/80 sm:text-lg">
            Professional quotes. Client approval. Invoice — done. In minutes.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <FeatureBadge>Built-in Templates</FeatureBadge>
            <FeatureBadge>Client Sign-off</FeatureBadge>
          </div>

          <div className="mt-8 flex items-center justify-center gap-3 text-sm font-semibold text-emerald-50/80 sm:text-base">
            <span>Quote</span>
            <ArrowRight className="h-4 w-4 text-emerald-300" />
            <span>Sign</span>
            <ArrowRight className="h-4 w-4 text-emerald-300" />
            <span>Get Paid</span>
          </div>
        </section>

        <section className="mt-10 w-full max-w-md rounded-[2rem] border border-white/12 bg-white/95 p-4 text-zinc-950 shadow-2xl shadow-black/25 backdrop-blur sm:p-6">
          <div className="space-y-3">
            <Button
              className="h-12 w-full rounded-2xl bg-[#03423a] text-base font-bold text-white shadow-lg shadow-emerald-950/20 hover:bg-[#02352f]"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : (
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              Continue with Google
            </Button>

            <Button
              className="h-12 w-full rounded-2xl border-zinc-200 bg-white text-sm font-bold text-zinc-800 shadow-sm hover:bg-zinc-50"
              variant="outline"
              onClick={() => setShowEmailForm((value) => !value)}
              disabled={loading}
            >
              <Mail className="mr-2 h-4 w-4" />
              Sign in with Email
            </Button>
          </div>

          {showEmailForm && (
            <form onSubmit={handleEmailAuth} className="mt-6 space-y-4 text-left">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-zinc-500">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-zinc-500">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 rounded-xl"
                />
                {isSignUp && <PasswordStrengthIndicator password={password} />}
              </div>
              <Button type="submit" className="h-11 w-full rounded-xl bg-zinc-950 font-bold text-white hover:bg-zinc-800" disabled={loading}>
                {loading ? 'Please wait…' : (isSignUp ? 'Create account' : 'Sign in')}
              </Button>
              <button
                type="button"
                className="w-full text-center text-sm font-semibold text-zinc-600 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-950"
                onClick={() => setIsSignUp((value) => !value)}
              >
                {isSignUp ? 'Already have an account? Sign in' : 'New to SoloBid? Create an account'}
              </button>
            </form>
          )}

          <div className="mt-6 grid grid-cols-2 gap-2 border-t border-zinc-100 pt-4 text-xs font-medium text-zinc-500">
            <span className="inline-flex items-center justify-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />Secure setup</span>
            <span className="inline-flex items-center justify-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-emerald-700" />No demo mode</span>
          </div>
        </section>

        <p className="mt-6 inline-flex items-center gap-2 text-xs font-medium text-emerald-50/60">
          <FileText className="h-3.5 w-3.5" />
          Setup takes less than 60 seconds.
        </p>
      </main>
    </div>
  );
}
