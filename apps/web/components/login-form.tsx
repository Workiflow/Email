'use client';

import { useState } from 'react';
import { useSupabaseBrowser } from '../lib/supabase-client';
import { Button } from '@ui/inbox';
import { pushToast } from './toaster';

export function LoginForm() {
  const supabase = useSupabaseBrowser();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/inbox`
      }
    });
    setLoading(false);
    if (error) {
      pushToast(error.message);
    } else {
      pushToast('Check your email for a login link.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-md bg-white p-6 shadow">
      <label className="text-sm font-medium text-gray-700" htmlFor="email">
        Work email
      </label>
      <input
        id="email"
        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring"
        placeholder="you@example.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        type="email"
        required
      />
      <Button type="submit" disabled={loading}>
        {loading ? 'Sending…' : 'Send magic link'}
      </Button>
    </form>
  );
}
