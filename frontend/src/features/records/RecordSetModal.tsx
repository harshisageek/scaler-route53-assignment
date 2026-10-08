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
import Toggle from '@cloudscape-design/components/toggle';
import { useState } from 'react';
import { AWS_REGIONS } from '@/features/hosted-zones/regions';
import { useFlash } from '@/features/shell/flash';
import { fieldErrorsFrom } from '@/lib/api/fieldErrors';
import type {
  AliasTargetType,
  EditableRecordType,
  FailoverRole,
  RecordSet,
  RoutingPolicy,
} from '@/lib/api/types';
import { useCreateRecordSet, useUpdateRecordSet } from './api';
import { ALIAS_TARGET_TYPE_OPTIONS, aliasTargetOptions } from './aliasTargets';
import { EDITABLE_RECORD_TYPES, RECORD_TYPE_HINTS } from './recordTypes';
import {
  FAILOVER_OPTIONS,
  GEOLOCATION_OPTIONS,
  ROUTING_POLICY_DESCRIPTIONS,
  ROUTING_POLICY_OPTIONS,
} from './routingPolicies';

const TTL_MAX = 2_147_483_647;
const TYPE_OPTIONS: SelectProps.Option[] = EDITABLE_RECORD_TYPES.map((type) => ({
  value: type,
  label: type,
  description: RECORD_TYPE_HINTS[type],
}));
const REGION_OPTIONS: SelectProps.Option[] = AWS_REGIONS.map((region) => ({
  value: region.code,
  label: region.name,
  description: region.code,
}));

interface Props {
  zoneId: string;
  zoneName: string;
  records?: RecordSet[];
  record?: RecordSet;
  onDismiss: () => void;
}

export function RecordSetModal({
  zoneId,
  zoneName,
  records = [],
  record,
  onDismiss,
}: Props) {
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
  const [routingPolicy, setRoutingPolicy] = useState<RoutingPolicy>(
    record?.routing_policy ?? 'simple',
  );
  const [setIdentifier, setSetIdentifier] = useState(record?.set_identifier ?? '');
  const [weight, setWeight] = useState(String(record?.weight ?? 0));
  const [failoverRole, setFailoverRole] = useState<FailoverRole | null>(
    record?.failover_role ?? null,
  );
  const [region, setRegion] = useState(record?.region ?? '');
  const [geolocation, setGeolocation] = useState(record?.geolocation ?? '');
  const [alias, setAlias] = useState(record?.alias ?? false);
  const [aliasTargetType, setAliasTargetType] = useState<AliasTargetType | null>(
    record?.alias_target_type ?? null,
  );
  const [aliasTarget, setAliasTarget] = useState(record?.alias_target ?? '');
  const [evaluateTargetHealth, setEvaluateTargetHealth] = useState(
    record?.evaluate_target_health ?? false,
  );
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const fieldErrors = fieldErrorsFrom(mutation.error);
  const targetOptions = aliasTargetOptions(aliasTargetType, records, type, record?.id);

  const submit = () => {
    const errors: Record<string, string> = {};
    const parsedTtl = Number(ttl);
    const parsedValues = values
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean);
    if (
      !alias &&
      (!Number.isInteger(parsedTtl) || parsedTtl < 0 || parsedTtl > TTL_MAX)
    ) {
      errors.ttl = `Enter a whole number from 0 to ${TTL_MAX}.`;
    }
    if (!alias && parsedValues.length === 0) {
      errors.values = 'Enter at least one value.';
    }
    if (!alias && type === 'CNAME' && parsedValues.length !== 1) {
      errors.values = 'A CNAME record must have exactly one value.';
    }
    if (!alias && type === 'CNAME' && (!name.trim() || name.trim() === '@')) {
      errors.name = 'A CNAME record cannot be created at the zone apex.';
    }
    if (alias && (!aliasTargetType || !aliasTarget)) {
      errors.alias_target = 'Choose an alias target.';
    }
    const requiresIdentifier = [
      'weighted',
      'failover',
      'latency',
      'geolocation',
    ].includes(routingPolicy);
    if (requiresIdentifier && !setIdentifier.trim()) {
      errors.set_identifier = 'Enter a set identifier.';
    }
    const parsedWeight = Number(weight);
    if (
      routingPolicy === 'weighted' &&
      (!Number.isInteger(parsedWeight) || parsedWeight < 0 || parsedWeight > 255)
    ) {
      errors.weight = 'Enter a whole number from 0 to 255.';
    }
    if (routingPolicy === 'failover' && !failoverRole) {
      errors.failover_role = 'Choose Primary or Secondary.';
    }
    if (routingPolicy === 'latency' && !region) {
      errors.region = 'Choose an AWS Region.';
    }
    if (routingPolicy === 'geolocation' && !geolocation) {
      errors.geolocation = 'Choose a location.';
    }
    setClientErrors(errors);
    if (Object.keys(errors).length > 0) return;

    mutation.mutate(
      {
        name,
        type,
        ttl: alias ? null : parsedTtl,
        values: alias ? [] : parsedValues,
        routing_policy: routingPolicy,
        set_identifier: requiresIdentifier ? setIdentifier.trim() : null,
        weight: routingPolicy === 'weighted' ? parsedWeight : null,
        failover_role: routingPolicy === 'failover' ? failoverRole : null,
        region: routingPolicy === 'latency' ? region : null,
        geolocation: routingPolicy === 'geolocation' ? geolocation : null,
        alias,
        alias_target_type: alias ? aliasTargetType : null,
        alias_target: alias ? aliasTarget : null,
        evaluate_target_health: alias && evaluateTargetHealth,
      },
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
            onChange={({ detail }) => {
              const selectedType = detail.selectedOption.value as EditableRecordType;
              setType(selectedType);
              if (!['A', 'AAAA'].includes(selectedType)) {
                setAlias(false);
                setAliasTargetType(null);
                setAliasTarget('');
                setEvaluateTargetHealth(false);
              }
            }}
          />
        </FormField>
        <FormField
          label="Routing policy"
          description={ROUTING_POLICY_DESCRIPTIONS[routingPolicy]}
          errorText={fieldErrors.routing_policy}
        >
          <Select
            selectedOption={
              ROUTING_POLICY_OPTIONS.find((option) => option.value === routingPolicy) ??
              null
            }
            options={ROUTING_POLICY_OPTIONS}
            onChange={({ detail }) => {
              setRoutingPolicy(detail.selectedOption.value as RoutingPolicy);
              setClientErrors({});
            }}
          />
        </FormField>
        <Toggle
          checked={alias}
          disabled={!['A', 'AAAA'].includes(type)}
          onChange={({ detail }) => {
            setAlias(detail.checked);
            setClientErrors({});
            if (!detail.checked) {
              setAliasTargetType(null);
              setAliasTarget('');
              setEvaluateTargetHealth(false);
            }
          }}
        >
          Alias
        </Toggle>
        {alias && (
          <>
            <FormField
              label="Route traffic to"
              description="Choose a mocked AWS resource or another record in this zone."
              errorText={clientErrors.alias_target ?? fieldErrors.alias_target_type}
            >
              <Select
                selectedOption={
                  ALIAS_TARGET_TYPE_OPTIONS.find(
                    (option) => option.value === aliasTargetType,
                  ) ?? null
                }
                options={ALIAS_TARGET_TYPE_OPTIONS}
                placeholder="Choose an endpoint"
                onChange={({ detail }) => {
                  setAliasTargetType(detail.selectedOption.value as AliasTargetType);
                  setAliasTarget('');
                  setClientErrors((current) => ({
                    ...current,
                    alias_target: '',
                  }));
                }}
              />
            </FormField>
            <FormField
              label="Alias target"
              errorText={clientErrors.alias_target ?? fieldErrors.alias_target}
            >
              <Select
                selectedOption={
                  targetOptions.find((option) => option.value === aliasTarget) ?? null
                }
                options={targetOptions}
                placeholder={
                  aliasTargetType === 'record' && targetOptions.length === 0
                    ? `No eligible ${type} records`
                    : 'Choose a target'
                }
                empty="No eligible records"
                onChange={({ detail }) => {
                  setAliasTarget(detail.selectedOption.value ?? '');
                  setClientErrors((current) => ({
                    ...current,
                    alias_target: '',
                  }));
                }}
              />
            </FormField>
            <Toggle
              checked={evaluateTargetHealth}
              onChange={({ detail }) => setEvaluateTargetHealth(detail.checked)}
            >
              Evaluate target health
            </Toggle>
          </>
        )}
        {['weighted', 'failover', 'latency', 'geolocation'].includes(routingPolicy) && (
          <FormField
            label="Set identifier"
            description="A unique label for this answer, such as blue or primary."
            errorText={clientErrors.set_identifier ?? fieldErrors.set_identifier}
          >
            <Input
              value={setIdentifier}
              placeholder="blue"
              onChange={({ detail }) => {
                setSetIdentifier(detail.value);
                setClientErrors((current) => ({
                  ...current,
                  set_identifier: '',
                }));
              }}
            />
          </FormField>
        )}
        {routingPolicy === 'weighted' && (
          <FormField
            label="Weight"
            description="A relative share from 0 to 255."
            errorText={clientErrors.weight ?? fieldErrors.weight}
          >
            <Input
              value={weight}
              type="number"
              inputMode="numeric"
              onChange={({ detail }) => {
                setWeight(detail.value);
                setClientErrors((current) => ({ ...current, weight: '' }));
              }}
            />
          </FormField>
        )}
        {routingPolicy === 'failover' && (
          <FormField
            label="Failover record type"
            errorText={clientErrors.failover_role ?? fieldErrors.failover_role}
          >
            <Select
              selectedOption={
                FAILOVER_OPTIONS.find((option) => option.value === failoverRole) ?? null
              }
              options={FAILOVER_OPTIONS}
              placeholder="Choose a failover role"
              onChange={({ detail }) => {
                setFailoverRole(detail.selectedOption.value as FailoverRole);
                setClientErrors((current) => ({ ...current, failover_role: '' }));
              }}
            />
          </FormField>
        )}
        {routingPolicy === 'latency' && (
          <FormField label="Region" errorText={clientErrors.region ?? fieldErrors.region}>
            <Select
              selectedOption={
                REGION_OPTIONS.find((option) => option.value === region) ?? null
              }
              options={REGION_OPTIONS}
              placeholder="Choose an AWS Region"
              filteringType="auto"
              onChange={({ detail }) => {
                setRegion(detail.selectedOption.value ?? '');
                setClientErrors((current) => ({ ...current, region: '' }));
              }}
            />
          </FormField>
        )}
        {routingPolicy === 'geolocation' && (
          <FormField
            label="Location"
            errorText={clientErrors.geolocation ?? fieldErrors.geolocation}
          >
            <Select
              selectedOption={
                GEOLOCATION_OPTIONS.find((option) => option.value === geolocation) ?? null
              }
              options={GEOLOCATION_OPTIONS}
              placeholder="Choose a location"
              filteringType="auto"
              onChange={({ detail }) => {
                setGeolocation(detail.selectedOption.value ?? '');
                setClientErrors((current) => ({ ...current, geolocation: '' }));
              }}
            />
          </FormField>
        )}
        {!alias && (
          <>
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
          </>
        )}
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
