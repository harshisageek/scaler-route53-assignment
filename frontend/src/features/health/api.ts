import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';

export interface Health {
  status: string;
  environment: string;
  database: string;
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => apiRequest<Health>('/health', { signal }),
  });
}
