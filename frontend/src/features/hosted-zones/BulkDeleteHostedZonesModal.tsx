'use client';

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useFlash } from '@/features/shell/flash';
import type { HostedZone } from '@/lib/api/types';
import { useDeleteHostedZones } from './api';
import { displayZoneName } from './format';

interface Props {
  zones: HostedZone[];
  onDismiss: () => void;
  onDeleted: () => void;
}

export function BulkDeleteHostedZonesModal({ zones, onDismiss, onDeleted }: Props) {
  const notify = useFlash();
  const remove = useDeleteHostedZones();

  const deleteZones = () => {
    remove.mutate(
      { hosted_zone_ids: zones.map((zone) => zone.id) },
      {
        onSuccess: () => {
          notify({
            type: 'success',
            content: `${zones.length} hosted zones were successfully deleted.`,
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
      header={`Delete ${zones.length} hosted zones`}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss} disabled={remove.isPending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={deleteZones} loading={remove.isPending}>
              Delete hosted zones
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        <Alert type="warning" header="Every selected zone must be empty.">
          A zone with records besides its default NS and SOA records blocks the entire
          operation. No selected zone is deleted unless all can be deleted.
        </Alert>
        <ul>
          {zones.map((zone) => (
            <li key={zone.id}>{displayZoneName(zone.name)}</li>
          ))}
        </ul>
        {remove.error && (
          <Alert type="error" header="The hosted zones could not be deleted.">
            {remove.error.message}
          </Alert>
        )}
      </SpaceBetween>
    </Modal>
  );
}
