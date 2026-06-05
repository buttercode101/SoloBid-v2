import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { ArrowRight, BadgeCheck, FileSignature, FileText, Gauge, ReceiptText, ShieldCheck, Wifi } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';

interface PasswordStrength {
  score: number; // 0-100
  feedback: string[];
  isValid: boolean;
}

function validatePassword(password: string): PasswordStrength {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) {
    score += 20;
  } else {
    feedback.push("At least 8 characters");
  }

  if (password.match(/[a-z]/)) {
    score += 20;
  } else {
    feedback.push("Include lowercase letters");
  }

  if (password.match(/[A-Z]/)) {
    score += 20;
  } else {
    feedback.push("Include uppercase letters");
  }

  if (password.match(/[0-9]/)) {
    score += 20;
  } else {
    feedback.push("Include numbers");
  }

  if (password.match(/[^a-zA-Z0-9]/)) {
    score += 20;
  } else {
    feedback.push("Include special characters (!@#$%^&*)");
  }

  return {
    score,
    feedback,
    isValid: score >= 80
  };
}

const PasswordStrengthIndicator = ({ password }: { password: string }) => {
  if (!password) return null;
  const strength = validatePassword(password);

  return (
    <div className="space-y-2 mt-2">
      <div className="w-full bg-zinc-200 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${strength.score < 40 ? 'bg-red-500' : strength.score < 80 ? 'bg-amber-500' : 'bg-green-500'}`}
          style={{ width: `${strength.score}%` }}
        />
      </div>
      {strength.feedback.length > 0 && (
        <ul className="text-xs text-zinc-500 space-y-1">
          {strength.feedback.map((msg, i) => (
            <li key={i}>• {msg}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

const FeaturePill = ({ icon: Icon, label }: { icon: React.ElementType; label: string }) => (
  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-medium text-white/85 backdrop-blur-sm">
    <Icon className="h-3.5 w-3.5 text-emerald-300" />
    {label}
  </div>
);

const FlowStep = ({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) => (
  <div className="flex gap-3 rounded-2xl border border-zinc-100 bg-white/80 p-3 shadow-sm shadow-zinc-200/40 backdrop-blur">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
      <Icon className="h-5 w-5" />
    </div>
    <div>
      <p className="text-sm font-semibold text-zinc-900">{title}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{description}</p>
    </div>
  </div>
);

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleStartFree = () => {
    navigate('/quotes/new');
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await signInWithPopup(auth, googleProvider);
      navigate('/quotes/new');
    } catch (error: any) {
      toast.error(error.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate('/quotes/new');
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#061f1b] px-4 py-6 text-zinc-950 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.28),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(20,184,166,0.22),_transparent_34%)]" />
      <div className="absolute inset-x-0 top-0 h-72 bg-[linear-gradient(120deg,_rgba(255,255,255,0.11)_1px,_transparent_1px),linear-gradient(210deg,_rgba(255,255,255,0.08)_1px,_transparent_1px)] bg-[length:38px_38px] opacity-40" />

      <main className="relative mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="space-y-8 text-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100 shadow-2xl shadow-black/10 backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.9)]" />
            SoloBid
          </div>

          <div className="max-w-2xl space-y-5">
            <h1 className="text-5xl font-black tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">
              Quote it. Approve it. Invoice it.
            </h1>
            <p className="max-w-xl text-lg leading-8 text-emerald-50/80 sm:text-xl">
              SoloBid helps solo contractors create professional quotes from the jobsite, collect client approval, and turn approved quotes into invoices in seconds.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <FeaturePill icon={Gauge} label="Fast mobile quotes" />
            <FeaturePill icon={FileSignature} label="Client signatures" />
            <FeaturePill icon={ReceiptText} label="Instant invoices" />
            <FeaturePill icon={Wifi} label="Offline draft saving" />
          </div>

          <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
            <FlowStep icon={FileText} title="Build" description="Add labor, materials, tax, terms, and job notes while details are fresh." />
            <FlowStep icon={BadgeCheck} title="Approve" description="Send a client link so customers can review and sign digitally." />
            <FlowStep icon={ReceiptText} title="Invoice" description="Convert accepted work into a polished invoice without retyping." />
          </div>
        </section>

        <Card className="w-full overflow-hidden rounded-[2rem] border-white/50 bg-white/95 shadow-2xl shadow-black/25 backdrop-blur-xl">
          <CardContent className="p-6 sm:p-8">
            <div className="mb-7 space-y-3 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-950 text-white shadow-lg shadow-emerald-950/20">
                <ReceiptText className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-3xl font-black tracking-tight text-zinc-950">Start your first job free</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  No account needed to start. Save, send, and invoice when you&apos;re ready.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                className="h-13 w-full rounded-2xl bg-[#03423a] text-base font-bold text-white shadow-lg shadow-emerald-950/20 hover:bg-[#02352f] active:scale-[0.99]"
                onClick={handleStartFree}
                disabled={loading}
              >
                Create first quote free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>

              <Button
                className="h-12 w-full rounded-2xl border-zinc-200 bg-white text-sm font-semibold shadow-sm hover:bg-zinc-50"
                variant="outline"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </Button>
            </div>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-zinc-200" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">or</span>
              <div className="h-px flex-1 bg-zinc-200" />
            </div>

            {!showEmailForm ? (
              <div className="space-y-4 text-center">
                <button
                  type="button"
                  className="text-sm font-semibold text-zinc-700 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-950"
                  onClick={() => setShowEmailForm(true)}
                >
                  Sign in or create account with email
                </button>
                <p className="mx-auto flex max-w-xs items-center justify-center gap-1.5 text-xs text-zinc-400">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Keep working now. Create an account later to sync across devices.
                </p>
              </div>
            ) : (
              <form onSubmit={handleEmailAuth} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
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
                  <div className="space-y-2 sm:col-span-2">
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
                </div>
                <Button type="submit" className="h-11 w-full rounded-xl bg-zinc-950 font-semibold text-white hover:bg-zinc-800" disabled={loading}>
                  {loading ? 'Please wait...' : (isSignUp ? 'Create account' : 'Sign in')}
                </Button>
                <div className="text-center text-sm">
                  <button
                    type="button"
                    className="font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900"
                    onClick={() => setIsSignUp(!isSignUp)}
                  >
                    {isSignUp ? 'Already have an account? Sign in' : "Need an account? Create one"}
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
