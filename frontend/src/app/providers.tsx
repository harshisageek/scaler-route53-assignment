'use client';

import { useState } from 'react';
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
  hashKey,
} from '@tanstack/react-query';
import { authKeys } from '@/features/auth/api';
import { ApiError } from '@/lib/api/errors';

/**
 * TanStack Query owns every piece of server data: fetching, caching, loading
 * and error states, and refreshing a list after a mutation.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  // Created in state so React Strict Mode's double render reuses one client.
  const [queryClient] = useState(() => {
    const client: QueryClient = new QueryClient({
      queryCache: new QueryCache({
        // A 401 anywhere means the session ended mid-visit. Re-checking the
        // current user lets the console layout send the visitor to sign in.
        // The /me query itself is skipped, or its own 401 would loop forever.
        onError: (error, query) => {
          const isMe = query.queryHash === hashKey(authKeys.me);
          if (error instanceof ApiError && error.status === 401 && !isMe) {
            void client.invalidateQueries({ queryKey: authKeys.me });
          }
        },
      }),
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
    });
    return client;
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
