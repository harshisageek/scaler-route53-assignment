import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import type { HostedZoneCreate, HostedZoneDetail, HostedZoneList } from '@/lib/api/types';

export const hostedZoneKeys = {
  all: ['hosted-zones'] as const,
  list: () => [...hostedZoneKeys.all, 'list'] as const,
  detail: (zoneId: string) => [...hostedZoneKeys.all, 'detail', zoneId] as const,
};

export function useHostedZones() {
  return useQuery({
    queryKey: hostedZoneKeys.list(),
    queryFn: ({ signal }) => apiRequest<HostedZoneList>('/hosted-zones', { signal }),
  });
}

export function useHostedZone(zoneId: string | undefined) {
  return useQuery({
    queryKey: hostedZoneKeys.detail(zoneId ?? ''),
    queryFn: ({ signal }) =>
      apiRequest<HostedZoneDetail>(`/hosted-zones/${encodeURIComponent(zoneId ?? '')}`, {
        signal,
      }),
    enabled: zoneId !== undefined,
  });
}

export function useCreateHostedZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: HostedZoneCreate) =>
      apiRequest<HostedZoneDetail>('/hosted-zones', { method: 'POST', body }),
    onSuccess: (zone) => {
      queryClient.setQueryData(hostedZoneKeys.detail(zone.id), zone);
      void queryClient.invalidateQueries({ queryKey: hostedZoneKeys.list() });
    },
  });
}
