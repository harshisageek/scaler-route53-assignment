import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { hostedZoneKeys } from '@/features/hosted-zones/api';
import { apiRequest, apiUpload } from '@/lib/api/client';
import type {
  BatchResult,
  BindImportPreview,
  BindImportResult,
  RecordSet,
  RecordSetChangeBatch,
  RecordSetCreate,
  RecordSetList,
  RecordSetListParams,
  RecordSetUpdate,
} from '@/lib/api/types';

export const recordSetKeys = {
  all: ['record-sets'] as const,
  lists: (zoneId: string) => [...recordSetKeys.all, zoneId, 'list'] as const,
  list: (zoneId: string, params: RecordSetListParams) =>
    [...recordSetKeys.lists(zoneId), params] as const,
};

const path = (zoneId: string) => `/hosted-zones/${encodeURIComponent(zoneId)}/records`;

export function useRecordSets(zoneId: string, params: RecordSetListParams) {
  return useQuery({
    queryKey: recordSetKeys.list(zoneId, params),
    queryFn: ({ signal }) =>
      apiRequest<RecordSetList>(path(zoneId), {
        searchParams: {
          q: params.q ?? undefined,
          type: params.type ?? undefined,
          routing_policy: params.routing_policy ?? undefined,
          sort: params.sort,
          page: params.page,
          page_size: params.page_size,
        },
        signal,
      }),
    placeholderData: (previous) => previous,
  });
}

function useInvalidateRecords(zoneId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: recordSetKeys.lists(zoneId) });
    void queryClient.invalidateQueries({ queryKey: hostedZoneKeys.detail(zoneId) });
  };
}

export function useCreateRecordSet(zoneId: string) {
  const invalidate = useInvalidateRecords(zoneId);
  return useMutation({
    mutationFn: (body: RecordSetCreate) =>
      apiRequest<RecordSet>(path(zoneId), { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useUpdateRecordSet(zoneId: string, recordSetId: number) {
  const invalidate = useInvalidateRecords(zoneId);
  return useMutation({
    mutationFn: (body: RecordSetUpdate) =>
      apiRequest<RecordSet>(`${path(zoneId)}/${recordSetId}`, {
        method: 'PUT',
        body,
      }),
    onSuccess: invalidate,
  });
}

export function useDeleteRecordSet(zoneId: string, recordSetId: number) {
  const invalidate = useInvalidateRecords(zoneId);
  return useMutation({
    mutationFn: () =>
      apiRequest<void>(`${path(zoneId)}/${recordSetId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function usePreviewBindImport(zoneId: string) {
  return useMutation({
    mutationFn: (file: File) =>
      apiUpload<BindImportPreview>(`${path(zoneId)}/import/preview`, file),
  });
}

export function useApplyBindImport(zoneId: string) {
  const invalidate = useInvalidateRecords(zoneId);
  return useMutation({
    mutationFn: (file: File) =>
      apiUpload<BindImportResult>(`${path(zoneId)}/import`, file),
    onSuccess: invalidate,
  });
}

export function useRecordSetChangeBatch(zoneId: string) {
  const invalidate = useInvalidateRecords(zoneId);
  return useMutation({
    mutationFn: (body: RecordSetChangeBatch) =>
      apiRequest<BatchResult>(
        `/hosted-zones/${encodeURIComponent(zoneId)}/records:batch`,
        { method: 'POST', body },
      ),
    onSuccess: invalidate,
  });
}
