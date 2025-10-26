import { redirect } from 'next/navigation';
import { getSession } from '../../lib/auth';
import { LoginForm } from '../../components/login-form';

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect('/inbox');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-semibold">Log in</h1>
        <p className="text-sm text-gray-600">Use your work email to sign in with a magic link.</p>
      </div>
      <LoginForm />
    </main>
  );
}
