'use client';

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import FileUpload from '@cloudscape-design/components/file-upload';
import Header from '@cloudscape-design/components/header';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Table, { type TableProps } from '@cloudscape-design/components/table';
import { useState } from 'react';
import { useFlash } from '@/features/shell/flash';
import type { BindImportRecord } from '@/lib/api/types';
import { useApplyBindImport, usePreviewBindImport } from './api';

const MAX_FILE_SIZE = 1024 * 1024;

const COLUMNS: TableProps.ColumnDefinition<BindImportRecord>[] = [
  { id: 'name', header: 'Record name', cell: (record) => record.name },
  { id: 'type', header: 'Type', cell: (record) => record.type },
  { id: 'ttl', header: 'TTL', cell: (record) => record.ttl },
  {
    id: 'values',
    header: 'Value',
    cell: (record) => record.values.join('\n'),
  },
  {
    id: 'status',
    header: 'Import status',
    cell: (record) => {
      const status = {
        add: { type: 'success' as const, text: 'To add' },
        already_present: { type: 'info' as const, text: 'Already present' },
        unsupported: { type: 'warning' as const, text: 'Unsupported' },
      }[record.status];
      return (
        <SpaceBetween size="xxs">
          <StatusIndicator type={status.type}>{status.text}</StatusIndicator>
          {record.reason && <Box variant="small">{record.reason}</Box>}
        </SpaceBetween>
      );
    },
  },
];

interface Props {
  zoneId: string;
  onDismiss: () => void;
}

export function BindImportModal({ zoneId, onDismiss }: Props) {
  const notify = useFlash();
  const preview = usePreviewBindImport(zoneId);
  const apply = useApplyBindImport(zoneId);
  const [files, setFiles] = useState<File[]>([]);
  const file = files[0];
  const fileError =
    file && file.size > MAX_FILE_SIZE ? 'Choose a file no larger than 1 MB.' : undefined;
  const canImport =
    preview.data !== undefined &&
    preview.data.add_count > 0 &&
    preview.data.unsupported_count === 0;

  const importRecords = () => {
    if (!file) return;
    apply.mutate(file, {
      onSuccess: (result) => {
        notify({
          type: 'success',
          content: `${result.imported_count} record set${
            result.imported_count === 1 ? '' : 's'
          } imported successfully.`,
        });
        onDismiss();
      },
    });
  };

  return (
    <Modal
      visible
      size="large"
      onDismiss={onDismiss}
      closeAriaLabel="Close"
      header="Import records from a BIND file"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              Cancel
            </Button>
            {preview.data ? (
              <Button
                variant="primary"
                disabled={!canImport}
                loading={apply.isPending}
                onClick={importRecords}
              >
                Import records
              </Button>
            ) : (
              <Button
                variant="primary"
                disabled={!file || Boolean(fileError)}
                loading={preview.isPending}
                onClick={() => file && preview.mutate(file)}
              >
                Preview
              </Button>
            )}
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        {!preview.data && (
          <>
            <Box variant="p">
              Upload a UTF-8 BIND zone file. The preview shows which record sets will be
              added before anything changes.
            </Box>
            <FileUpload
              value={files}
              accept=".zone,.bind,.txt,text/plain"
              showFileSize
              errorText={fileError}
              constraintText="One file, up to 1 MB."
              onChange={({ detail }) => {
                setFiles(detail.value.slice(0, 1));
                preview.reset();
                apply.reset();
              }}
              i18nStrings={{
                uploadButtonText: () => 'Choose file',
                dropzoneText: () => 'Drop a BIND file here',
                removeFileAriaLabel: (_, fileName) => `Remove ${fileName}`,
                errorIconAriaLabel: 'Error',
              }}
            />
          </>
        )}
        {preview.data && (
          <>
            <Header
              counter={`(${preview.data.records.length})`}
              description={`${preview.data.add_count} to add, ${preview.data.already_present_count} already present, ${preview.data.unsupported_count} unsupported`}
            >
              Preview
            </Header>
            {preview.data.unsupported_count > 0 && (
              <Alert type="warning" header="Import blocked">
                Remove unsupported or invalid records from the file, then preview it
                again.
              </Alert>
            )}
            <Table
              trackBy={(record) => `${record.name}-${record.type}`}
              columnDefinitions={COLUMNS}
              items={preview.data.records}
              wrapLines
              empty={<Box textAlign="center">No record sets found.</Box>}
            />
            <Button
              onClick={() => {
                preview.reset();
                apply.reset();
              }}
            >
              Choose another file
            </Button>
          </>
        )}
        {(preview.error || apply.error) && (
          <Alert type="error" header="The BIND file could not be imported.">
            {(preview.error ?? apply.error)?.message}
          </Alert>
        )}
      </SpaceBetween>
    </Modal>
  );
}
