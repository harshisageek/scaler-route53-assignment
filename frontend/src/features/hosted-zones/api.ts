import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import type {
  HostedZoneCreate,
  HostedZoneDetail,
  HostedZoneList,
  HostedZoneListParams,
  HostedZoneUpdate,
} from '@/lib/api/types';

export const hostedZoneKeys = {
  all: ['hosted-zones'] as const,
  lists: () => [...hostedZoneKeys.all, 'list'] as const,
  list: (params: HostedZoneListParams = {}) =>
    [...hostedZoneKeys.lists(), params] as const,
  detail: (zoneId: string) => [...hostedZoneKeys.all, 'detail', zoneId] as const,
};

export function useHostedZones(params: HostedZoneListParams = {}) {
  return useQuery({
    queryKey: hostedZoneKeys.list(params),
    queryFn: ({ signal }) =>
      apiRequest<HostedZoneList>('/hosted-zones', {
        searchParams: {
          q: params.q ?? undefined,
          sort: params.sort,
          page: params.page,
          page_size: params.page_size,
        },
        signal,
      }),
    placeholderData: (previous) => previous,
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
      void queryClient.invalidateQueries({ queryKey: hostedZoneKeys.lists() });
    },
  });
}

export function useUpdateHostedZone(zoneId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: HostedZoneUpdate) =>
      apiRequest<HostedZoneDetail>(`/hosted-zones/${encodeURIComponent(zoneId)}`, {
        method: 'PATCH',
        body,
      }),
    onSuccess: (zone) => {
      queryClient.setQueryData(hostedZoneKeys.detail(zone.id), zone);
      void queryClient.invalidateQueries({ queryKey: hostedZoneKeys.lists() });
    },
  });
}

export function useDeleteHostedZone(zoneId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<void>(`/hosted-zones/${encodeURIComponent(zoneId)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: hostedZoneKeys.detail(zoneId) });
      void queryClient.invalidateQueries({ queryKey: hostedZoneKeys.lists() });
    },
  });
}
