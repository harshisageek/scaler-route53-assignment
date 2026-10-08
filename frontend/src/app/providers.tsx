'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * TanStack Query owns every piece of server data: fetching, caching, loading
 * and error states, and refreshing a list after a mutation.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  // Created in state so React Strict Mode's double render reuses one client.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // A 404 or a validation error will not succeed on a retry.
            retry: (failureCount, error) => {
              const status = (error as { status?: number }).status;
              if (status !== undefined && status >= 400 && status < 500) return false;
              return failureCount < 2;
            },
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
