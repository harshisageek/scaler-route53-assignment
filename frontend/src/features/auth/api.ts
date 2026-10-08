import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import type { SignInRequest, SignUpRequest, User } from '@/lib/api/types';

export const authKeys = {
  me: ['auth', 'me'] as const,
};

export function useMe() {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: ({ signal }) => apiRequest<User>('/auth/me', { signal }),
    staleTime: 5 * 60_000,
  });
}

/**
 * Every way of signing in ends the same: the old account's cached data is
 * dropped, so nothing from a previous user can flash on screen.
 */
function useSignInMutation<TBody>(request: (body: TBody) => Promise<User>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: (user) => {
      queryClient.clear();
      queryClient.setQueryData(authKeys.me, user);
    },
  });
}

export function useSignIn() {
  return useSignInMutation((body: SignInRequest) =>
    apiRequest<User>('/auth/sign-in', { method: 'POST', body }),
  );
}

export function useSignUp() {
  return useSignInMutation((body: SignUpRequest) =>
    apiRequest<User>('/auth/sign-up', { method: 'POST', body }),
  );
}

export function useDemoSignIn() {
  return useSignInMutation(() => apiRequest<User>('/auth/demo', { method: 'POST' }));
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<void>('/auth/sign-out', { method: 'POST' }),
    onSettled: () => queryClient.clear(),
  });
}
