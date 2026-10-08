'use client';

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Modal from '@cloudscape-design/components/modal';
import Select, { type SelectProps } from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Textarea from '@cloudscape-design/components/textarea';
import { useState } from 'react';
import { useFlash } from '@/features/shell/flash';
import { fieldErrorsFrom } from '@/lib/api/fieldErrors';
import type { EditableRecordType, RecordSet } from '@/lib/api/types';
import { useCreateRecordSet, useUpdateRecordSet } from './api';
import { EDITABLE_RECORD_TYPES, RECORD_TYPE_HINTS } from './recordTypes';

const TTL_MAX = 2_147_483_647;
const TYPE_OPTIONS: SelectProps.Option[] = EDITABLE_RECORD_TYPES.map((type) => ({
  value: type,
  label: type,
  description: RECORD_TYPE_HINTS[type],
}));

interface Props {
  zoneId: string;
  zoneName: string;
  record?: RecordSet;
  onDismiss: () => void;
}

export function RecordSetModal({ zoneId, zoneName, record, onDismiss }: Props) {
  const editing = record !== undefined;
  const notify = useFlash();
  const create = useCreateRecordSet(zoneId);
  const update = useUpdateRecordSet(zoneId, record?.id ?? 0);
  const mutation = editing ? update : create;
  const [name, setName] = useState(record?.name ?? '');
  const [type, setType] = useState<EditableRecordType>(
    record && record.type !== 'SOA' ? record.type : 'A',
  );
  const [ttl, setTtl] = useState(String(record?.ttl ?? 300));
  const [values, setValues] = useState(record?.values.join('\n') ?? '');
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const fieldErrors = fieldErrorsFrom(mutation.error);

  const submit = () => {
    const errors: Record<string, string> = {};
    const parsedTtl = Number(ttl);
    const parsedValues = values
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean);
    if (!Number.isInteger(parsedTtl) || parsedTtl < 0 || parsedTtl > TTL_MAX) {
      errors.ttl = `Enter a whole number from 0 to ${TTL_MAX}.`;
    }
    if (parsedValues.length === 0) {
      errors.values = 'Enter at least one value.';
    }
    if (type === 'CNAME' && parsedValues.length !== 1) {
      errors.values = 'A CNAME record must have exactly one value.';
    }
    if (type === 'CNAME' && (!name.trim() || name.trim() === '@')) {
      errors.name = 'A CNAME record cannot be created at the zone apex.';
    }
    setClientErrors(errors);
    if (Object.keys(errors).length > 0) return;

    mutation.mutate(
      { name, type, ttl: parsedTtl, values: parsedValues },
      {
        onSuccess: (saved) => {
          notify({
            type: 'success',
            content: `${saved.name} was successfully ${editing ? 'updated' : 'created'}.`,
          });
          onDismiss();
        },
      },
    );
  };

  return (
    <Modal
      visible
      size="medium"
      onDismiss={onDismiss}
      closeAriaLabel="Close"
      header={editing ? 'Edit record' : 'Create record'}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} loading={mutation.isPending}>
              {editing ? 'Save changes' : 'Create record'}
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        <FormField
          label="Record name"
          description={`Leave blank for the zone apex (${zoneName}).`}
          errorText={clientErrors.name ?? fieldErrors.name}
        >
          <Input
            value={name}
            disabled={editing}
            placeholder="www"
            onChange={({ detail }) => {
              setName(detail.value);
              setClientErrors((current) => ({ ...current, name: '' }));
            }}
          />
        </FormField>
        <FormField label="Record type" errorText={fieldErrors.type}>
          <Select
            selectedOption={TYPE_OPTIONS.find((option) => option.value === type) ?? null}
            options={TYPE_OPTIONS}
            disabled={editing}
            onChange={({ detail }) =>
              setType(detail.selectedOption.value as EditableRecordType)
            }
          />
        </FormField>
        <FormField
          label="Value"
          description={`${RECORD_TYPE_HINTS[type]}. Enter multiple values on separate lines.`}
          errorText={clientErrors.values ?? fieldErrors.values}
        >
          <Textarea
            value={values}
            rows={5}
            placeholder={RECORD_TYPE_HINTS[type]}
            onChange={({ detail }) => {
              setValues(detail.value);
              setClientErrors((current) => ({ ...current, values: '' }));
            }}
          />
        </FormField>
        <FormField
          label="TTL (seconds)"
          description="How long resolvers cache this record."
          errorText={clientErrors.ttl ?? fieldErrors.ttl}
        >
          <Input
            value={ttl}
            type="number"
            inputMode="numeric"
            onChange={({ detail }) => {
              setTtl(detail.value);
              setClientErrors((current) => ({ ...current, ttl: '' }));
            }}
          />
        </FormField>
        {mutation.error && Object.keys(fieldErrors).length === 0 && (
          <Alert
            type="error"
            header={`The record could not be ${editing ? 'updated' : 'created'}.`}
          >
            {mutation.error.message}
          </Alert>
        )}
      </SpaceBetween>
    </Modal>
  );
}
