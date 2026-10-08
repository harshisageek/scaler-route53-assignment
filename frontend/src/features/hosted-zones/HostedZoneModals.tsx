'use client';

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import FormField from '@cloudscape-design/components/form-field';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Textarea from '@cloudscape-design/components/textarea';
import { useState } from 'react';
import { useFlash } from '@/features/shell/flash';
import { fieldErrorsFrom } from '@/lib/api/fieldErrors';
import type { HostedZone } from '@/lib/api/types';
import { useDeleteHostedZone, useUpdateHostedZone } from './api';
import { COMMENT_MAX_LENGTH } from './validation';
import { displayZoneName } from './format';

interface ModalProps {
  zone: HostedZone;
  onDismiss: () => void;
}

export function EditHostedZoneModal({ zone, onDismiss }: ModalProps) {
  const notify = useFlash();
  const update = useUpdateHostedZone(zone.id);
  const [comment, setComment] = useState(zone.comment ?? '');
  const [clientError, setClientError] = useState<string>();
  const fieldError = fieldErrorsFrom(update.error).comment;
  const zoneName = displayZoneName(zone.name);

  const save = () => {
    if (comment.length > COMMENT_MAX_LENGTH) {
      setClientError(`The description cannot exceed ${COMMENT_MAX_LENGTH} characters.`);
      return;
    }
    update.mutate(
      { comment },
      {
        onSuccess: () => {
          notify({ type: 'success', content: `${zoneName} was successfully updated.` });
          onDismiss();
        },
      },
    );
  };

  return (
    <Modal
      visible
      onDismiss={onDismiss}
      header="Edit hosted zone"
      closeAriaLabel="Close"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss} disabled={update.isPending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} loading={update.isPending}>
              Save changes
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        <FormField label="Hosted zone name">
          <Box>{zoneName}</Box>
        </FormField>
        <FormField
          label="Description - optional"
          errorText={clientError ?? fieldError}
          constraintText={`The description can have up to ${COMMENT_MAX_LENGTH} characters. ${comment.length}/${COMMENT_MAX_LENGTH}`}
        >
          <Textarea
            value={comment}
            rows={4}
            placeholder="The hosted zone is used for..."
            onChange={({ detail }) => {
              setComment(detail.value);
              setClientError(undefined);
            }}
          />
        </FormField>
        {update.error && !fieldError && (
          <Alert type="error" header="The hosted zone could not be updated.">
            {update.error.message}
          </Alert>
        )}
      </SpaceBetween>
    </Modal>
  );
}

interface DeleteModalProps extends ModalProps {
  onDeleted: () => void;
  successPath?: string;
}

export function DeleteHostedZoneModal({
  zone,
  onDismiss,
  onDeleted,
  successPath,
}: DeleteModalProps) {
  const notify = useFlash();
  const remove = useDeleteHostedZone(zone.id);
  const zoneName = displayZoneName(zone.name);

  const deleteZone = () => {
    remove.mutate(undefined, {
      onSuccess: () => {
        notify({
          type: 'success',
          content: `${zoneName} was successfully deleted.`,
          showOn: successPath,
        });
        onDeleted();
      },
    });
  };

  return (
    <Modal
      visible
      onDismiss={onDismiss}
      header="Delete hosted zone"
      closeAriaLabel="Close"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss} disabled={remove.isPending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={deleteZone} loading={remove.isPending}>
              Delete
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        <Alert type="warning" header={`Delete ${zoneName}?`}>
          Deleting a hosted zone cannot be undone. Route 53 will delete its default NS and
          SOA records with it.
        </Alert>
        {remove.error && (
          <Alert type="error" header="The hosted zone could not be deleted.">
            {remove.error.message}
          </Alert>
        )}
      </SpaceBetween>
    </Modal>
  );
}
