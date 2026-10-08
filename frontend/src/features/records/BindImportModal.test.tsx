import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FlashMessages, FlashProvider } from '@/features/shell/flash';
import type { BindImportPreview } from '@/lib/api/types';
import { BindImportModal } from './BindImportModal';

const PREVIEW: BindImportPreview = {
  file_name: 'example.zone',
  records: [
    {
      name: 'www.example.com.',
      type: 'A',
      ttl: 300,
      values: ['192.0.2.10'],
      status: 'add',
      reason: null,
    },
    {
      name: 'example.com.',
      type: 'SOA',
      ttl: 900,
      values: ['ns-1.example.net. hostmaster.example.com. 1 7200 900 1209600 86400'],
      status: 'already_present',
      reason: null,
    },
  ],
  add_count: 1,
  already_present_count: 1,
  unsupported_count: 0,
};

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status < 400, status, json: async () => body } as Response;
}

function renderModal(onDismiss = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <FlashProvider>
        <FlashMessages />
        <BindImportModal zoneId="Z1" onDismiss={onDismiss} />
      </FlashProvider>
    </QueryClientProvider>,
  );
  return { ...result, onDismiss };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('BindImportModal', () => {
  it('previews and imports the selected BIND file', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, PREVIEW))
      .mockResolvedValueOnce(jsonResponse(201, { imported_count: 1, skipped_count: 1 }));
    vi.stubGlobal('fetch', fetchMock);
    const { onDismiss } = renderModal();
    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('File input missing.');
    const file = new File(['www 300 IN A 192.0.2.10'], 'example.zone', {
      type: 'text/plain',
    });

    await userEvent.upload(input, file);
    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));

    expect(await screen.findByText('www.example.com.')).toBeInTheDocument();
    expect(screen.getByText('To add')).toBeInTheDocument();
    expect(screen.getByText('Already present')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Import records' }));

    expect(
      await screen.findByText('1 record set imported successfully.'),
    ).toBeInTheDocument();
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/hosted-zones/Z1/records/import/preview',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/hosted-zones/Z1/records/import',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    );
  });

  it('blocks import when the preview has unsupported records', async () => {
    const blocked: BindImportPreview = {
      ...PREVIEW,
      records: [
        ...PREVIEW.records,
        {
          name: 'key.example.com.',
          type: 'DNSKEY',
          ttl: 300,
          values: ['256 3 8 AwEAAQ=='],
          status: 'unsupported',
          reason: 'DNSKEY records are not supported for import.',
        },
      ],
      unsupported_count: 1,
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, blocked)));
    renderModal();
    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('File input missing.');
    await userEvent.upload(input, new File(['zone'], 'example.zone'));
    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));

    expect(await screen.findByText('Import blocked')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Import records' })).toBeDisabled(),
    );
  });
});
