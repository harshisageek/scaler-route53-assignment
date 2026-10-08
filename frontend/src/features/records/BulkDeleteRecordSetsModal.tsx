'use client';

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useFlash } from '@/features/shell/flash';
import type { RecordSet } from '@/lib/api/types';
import { useRecordSetChangeBatch } from './api';

interface Props {
  zoneId: string;
  records: RecordSet[];
  onDismiss: () => void;
  onDeleted: () => void;
}

export function BulkDeleteRecordSetsModal({
  zoneId,
  records,
  onDismiss,
  onDeleted,
}: Props) {
  const notify = useFlash();
  const remove = useRecordSetChangeBatch(zoneId);

  const deleteRecords = () => {
    remove.mutate(
      {
        changes: records.map((record) => ({
          action: 'DELETE',
          record_set_id: record.id,
          record_set: null,
        })),
      },
      {
        onSuccess: () => {
          notify({
            type: 'success',
            content: `${records.length} record sets were successfully deleted.`,
          });
          onDeleted();
        },
      },
    );
  };

  return (
    <Modal
      visible
      onDismiss={onDismiss}
      closeAriaLabel="Close"
      header={`Delete ${records.length} record sets`}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss} disabled={remove.isPending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={deleteRecords} loading={remove.isPending}>
              Delete record sets
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        <Alert type="warning" header="This action cannot be undone.">
          The selected record sets will be deleted in one atomic change batch.
        </Alert>
        <ul>
          {records.map((record) => (
            <li key={record.id}>
              {record.name} {record.type}
            </li>
          ))}
        </ul>
        {remove.error && (
          <Alert type="error" header="The record sets could not be deleted.">
            {remove.error.message}
          </Alert>
        )}
      </SpaceBetween>
    </Modal>
  );
}
