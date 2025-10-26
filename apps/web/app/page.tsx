import { redirect } from 'next/navigation';
import { getSession } from '../lib/auth';

export default async function IndexPage() {
  const session = await getSession();
  if (session) {
    redirect('/inbox');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-semibold">Shared Inbox</h1>
      <p className="max-w-xl text-lg text-gray-600">
        A focused shared inbox for small teams. Connect your Gmail inboxes and collaborate with assignments,
        comments, and realtime presence.
      </p>
      <a
        className="rounded-md bg-blue-600 px-6 py-3 text-white shadow hover:bg-blue-700"
        href="/login"
      >
        Sign in
      </a>
    </main>
  );
}
