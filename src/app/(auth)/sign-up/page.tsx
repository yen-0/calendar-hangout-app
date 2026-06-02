'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/hooks/useLanguage';

const copy = {
  ja: {
    title: 'アカウント作成',
    subtitle: '数分で登録して、候補作成から確定までをそのまま進めましょう。',
    email: 'メールアドレス',
    password: 'パスワード',
    confirmPassword: 'パスワードを確認',
    emailPlaceholder: 'you@example.com',
    passwordPlaceholder: '••••••••',
    confirmPasswordPlaceholder: '••••••••',
    submit: 'アカウントを作成',
    footerPrefix: 'すでにアカウントがありますか？',
    footerLink: 'サインイン',
    mismatchError: 'パスワードが一致しません。',
    lengthError: 'パスワードは 6 文字以上にしてください。',
    submitError: 'アカウント作成に失敗しました。もう一度お試しください。',
  },
  en: {
    title: 'Create account',
    subtitle: 'Register in minutes and move from candidate creation to confirmation.',
    email: 'Email address',
    password: 'Password',
    confirmPassword: 'Confirm password',
    emailPlaceholder: 'you@example.com',
    passwordPlaceholder: '••••••••',
    confirmPasswordPlaceholder: '••••••••',
    submit: 'Create account',
    footerPrefix: 'Already have an account?',
    footerLink: 'Sign in',
    mismatchError: 'Passwords do not match.',
    lengthError: 'Password must be at least 6 characters.',
    submitError: 'Failed to create the account. Please try again.',
  },
} as const;

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { language } = useLanguage();
  const content = copy[language];

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(content.mismatchError);
      return;
    }
    if (password.length < 6) {
      setError(content.lengthError);
      return;
    }

    setIsLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      const message = err instanceof Error ? err.message : content.submitError;
      setError(message);
      console.error('Sign up error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-700">Tsudoi</p>
        <h2 className="text-3xl font-black tracking-tight text-slate-950">{content.title}</h2>
        <p className="max-w-md text-sm leading-7 text-slate-600">{content.subtitle}</p>
      </div>

      <form onSubmit={handleSignUp} className="mt-8 space-y-5">
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
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={content.passwordPlaceholder}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700">
            {content.confirmPassword}
          </label>
          <Input
            id="confirm-password"
            name="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={content.confirmPasswordPlaceholder}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" className="w-full bg-slate-950 text-white hover:bg-slate-800" isLoading={isLoading} disabled={isLoading}>
          {isLoading ? 'Loading...' : content.submit}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-600">
        {content.footerPrefix}{' '}
        <Link href="/sign-in" className="font-semibold text-cyan-700 hover:text-cyan-600">
          {content.footerLink}
        </Link>
      </p>
    </>
  );
}
