import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';

//Landing / Root entry page (redirects to login or dashboard).
export default function IndexPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard');
    } else if (status === 'unauthenticated') {
      router.replace('/auth/signin');
    }
  }, [status, router]);

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-800 border-t-indigo-400 animate-spin" />
        <span className="text-xs text-slate-500 font-medium">Redirecting to Dashboard...</span>
      </div>
    </div>
  );
}
