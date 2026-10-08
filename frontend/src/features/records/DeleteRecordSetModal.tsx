'use client';

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useFlash } from '@/features/shell/flash';
import type { RecordSet } from '@/lib/api/types';
import { useDeleteRecordSet } from './api';

interface Props {
  zoneId: string;
  record: RecordSet;
  onDismiss: () => void;
  onDeleted: () => void;
}

export function DeleteRecordSetModal({ zoneId, record, onDismiss, onDeleted }: Props) {
  const notify = useFlash();
  const remove = useDeleteRecordSet(zoneId, record.id);

  const deleteRecord = () => {
    remove.mutate(undefined, {
      onSuccess: () => {
        notify({
          type: 'success',
          content: `${record.name} ${record.type} was successfully deleted.`,
        });
        onDeleted();
      },
    });
  };

  return (
    <Modal
      visible
      onDismiss={onDismiss}
      closeAriaLabel="Close"
      header="Delete record"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss} disabled={remove.isPending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={deleteRecord} loading={remove.isPending}>
              Delete
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        <Alert type="warning" header={`Delete ${record.name} ${record.type}?`}>
          Deleting a record cannot be undone.
        </Alert>
        {remove.error && (
          <Alert type="error" header="The record could not be deleted.">
            {remove.error.message}
          </Alert>
        )}
      </SpaceBetween>
    </Modal>
  );
}
