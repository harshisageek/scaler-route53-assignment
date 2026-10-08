import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadHostedZone } from './export';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('downloadHostedZone', () => {
  it('downloads the API response using its attachment filename', async () => {
    const blob = new Blob(['$ORIGIN example.com.'], { type: 'text/dns' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({
          'Content-Disposition': 'attachment; filename="example.com.zone"',
        }),
        blob: async () => blob,
      }),
    );
    const anchor = document.createElement('a');
    const createElement = vi.spyOn(document, 'createElement');
    createElement.mockReturnValueOnce(anchor);
    const click = vi.spyOn(anchor, 'click').mockImplementation(() => undefined);
    const createObjectURL = vi.fn().mockReturnValue('blob:zone-export');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

    await downloadHostedZone('Z1', 'bind');

    expect(fetch).toHaveBeenCalledWith('/api/v1/hosted-zones/Z1/export?format=bind', {
      credentials: 'same-origin',
    });
    expect(anchor.download).toBe('example.com.zone');
    expect(anchor.href).toBe('blob:zone-export');
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:zone-export');
  });
});
