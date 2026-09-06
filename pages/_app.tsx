import '@/styles/globals.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { useState } from 'react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

import { ToastContainer } from '@/components/ui/Toast';

export default function App({ Component, pageProps }: { Component: any; pageProps: any }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 2, // 2 mins
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <ErrorBoundary>
      <SessionProvider
        session={pageProps.session}
        refetchInterval={0}
        refetchOnWindowFocus={false}
      >
        <QueryClientProvider client={queryClient}>
          <Component {...pageProps} />
          <ToastContainer />
        </QueryClientProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}
