import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import type { HostedZoneList } from '@/lib/api/types';

export const hostedZoneKeys = {
  all: ['hosted-zones'] as const,
  list: () => [...hostedZoneKeys.all, 'list'] as const,
};

export function useHostedZones() {
  return useQuery({
    queryKey: hostedZoneKeys.list(),
    queryFn: ({ signal }) => apiRequest<HostedZoneList>('/hosted-zones', { signal }),
  });
}
