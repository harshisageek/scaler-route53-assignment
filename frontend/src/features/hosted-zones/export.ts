import { apiDownload } from '@/lib/api/client';

export type ZoneExportFormat = 'bind' | 'json';

export async function downloadHostedZone(
  zoneId: string,
  format: ZoneExportFormat,
): Promise<void> {
  const { blob, fileName } = await apiDownload(
    `/hosted-zones/${encodeURIComponent(zoneId)}/export`,
    { format },
  );
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
