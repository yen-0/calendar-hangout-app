'use client';

import { useState } from 'react';
import Link from 'next/link';
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/hooks/useLanguage';

const copy = {
  ja: {
    title: 'サインイン',
    subtitle: '保存済みの予定と候補をそのまま続けましょう。',
    google: 'Google でサインイン',
    divider: 'または',
    email: 'メールアドレス',
    password: 'パスワード',
    emailPlaceholder: 'you@example.com',
    passwordPlaceholder: '••••••••',
    submit: 'メールでサインイン',
    footerPrefix: 'まだアカウントがありませんか？',
    footerLink: '新規登録',
    errorEmail: 'サインインに失敗しました。認証情報を確認してください。',
    errorGoogle: 'Google サインインに失敗しました。',
  },
  en: {
    title: 'Sign in',
    subtitle: 'Continue with your saved schedules and candidate sets.',
    google: 'Sign in with Google',
    divider: 'Or',
    email: 'Email address',
    password: 'Password',
    emailPlaceholder: 'you@example.com',
    passwordPlaceholder: '••••••••',
    submit: 'Sign in with email',
    footerPrefix: 'Not a member yet?',
    footerLink: 'Create an account',
    errorEmail: 'Sign in failed. Check your credentials.',
    errorGoogle: 'Google sign in failed.',
  },
} as const;

const GoogleIcon = () => (
  <svg
    className="mr-2 h-4 w-4"
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fill="currentColor"
      d="M21.35 11.1H12v2.97h5.39c-.24 1.28-.99 2.36-2.13 3.08v2.56h3.45c2.02-1.86 3.19-4.59 3.19-7.84 0-.76-.07-1.49-.21-2.19Z"
    />
    <path
      fill="currentColor"
      d="M12 22c2.88 0 5.3-.95 7.07-2.6l-3.45-2.56c-.95.64-2.17 1.02-3.62 1.02-2.78 0-5.14-1.88-5.98-4.4H2.46v2.7A10 10 0 0 0 12 22Z"
    />
    <path
      fill="currentColor"
      d="M6.02 13.46c-.21-.64-.33-1.32-.33-2.02 0-.7.12-1.38.33-2.02V6.72H2.46A10 10 0 0 0 2 11.44c0 1.61.39 3.13 1.09 4.47l2.93-2.45Z"
    />
    <path
      fill="currentColor"
      d="M12 4.07c1.57 0 2.98.54 4.1 1.61l3.07-3.07C17.3.88 14.88 0 12 0A10 10 0 0 0 2.46 6.72l3.56 2.72C6.86 5.95 9.22 4.07 12 4.07Z"
    />
  </svg>
);

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { language } = useLanguage();
  const content = copy[language];

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      const message = err instanceof Error ? err.message : content.errorEmail;
      setError(message);
      console.error('Sign in error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      const message = err instanceof Error ? err.message : content.errorGoogle;
      setError(message);
      console.error('Google Sign in error:', err);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-700">Tsudoi</p>
        <h2 className="text-3xl font-black tracking-tight text-slate-950">{content.title}</h2>
        <p className="max-w-md text-sm leading-7 text-slate-600">{content.subtitle}</p>
      </div>

      <div className="mt-8">
        <Button
          variant="outline"
          className="w-full border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          onClick={handleGoogleSignIn}
          isLoading={isGoogleLoading}
          disabled={isLoading || isGoogleLoading}
        >
          <GoogleIcon />
          {content.google}
        </Button>
      </div>

      <div className="my-6 flex items-center before:mt-0.5 before:flex-1 before:border-t before:border-slate-200 after:mt-0.5 after:flex-1 after:border-t after:border-slate-200">
        <p className="mx-4 mb-0 text-center text-sm font-semibold text-slate-500">{content.divider}</p>
      </div>

      <form onSubmit={handleSignIn} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            {content.email}
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={content.emailPlaceholder}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            {content.password}
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={content.passwordPlaceholder}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" className="w-full bg-slate-950 text-white hover:bg-slate-800" isLoading={isLoading} disabled={isLoading || isGoogleLoading}>
          {isLoading ? 'Loading...' : content.submit}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-600">
        {content.footerPrefix}{' '}
        <Link href="/sign-up" className="font-semibold text-cyan-700 hover:text-cyan-600">
          {content.footerLink}
        </Link>
      </p>
    </>
  );
}
