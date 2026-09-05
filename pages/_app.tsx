import '@/styles/globals.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { useState } from 'react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

import { ToastContainer } from '@/components/ui/Toast';

export default function App({ Component, pageProps }: { Component: any; pageProps: any }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ErrorBoundary>
      <SessionProvider session={pageProps.session} refetchInterval={5 * 60}>
        <QueryClientProvider client={queryClient}>
          <Component {...pageProps} />
          <ToastContainer />
        </QueryClientProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}
