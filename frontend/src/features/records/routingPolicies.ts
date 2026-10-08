import type { SelectProps } from '@cloudscape-design/components/select';
import type { RoutingPolicy } from '@/lib/api/types';

export const ROUTING_POLICY_LABELS: Record<RoutingPolicy, string> = {
  simple: 'Simple routing',
  weighted: 'Weighted',
  failover: 'Failover',
  latency: 'Latency',
  geolocation: 'Geolocation',
  multivalue: 'Multivalue answer',
};

export const ROUTING_POLICY_DESCRIPTIONS: Record<RoutingPolicy, string> = {
  simple: 'Use one record to answer queries.',
  weighted: 'Split traffic using relative weights from 0 to 255.',
  failover: 'Use a primary answer and a secondary answer.',
  latency: 'Route traffic to the configured AWS Region.',
  geolocation: 'Route traffic based on the request location.',
  multivalue: 'Return multiple healthy-looking answers in a random order.',
};

export const ROUTING_POLICY_OPTIONS: SelectProps.Option[] = Object.entries(
  ROUTING_POLICY_LABELS,
).map(([value, label]) => ({
  value,
  label,
  description: ROUTING_POLICY_DESCRIPTIONS[value as RoutingPolicy],
}));

export const FAILOVER_OPTIONS: SelectProps.Option[] = [
  { value: 'PRIMARY', label: 'Primary' },
  { value: 'SECONDARY', label: 'Secondary' },
];

export const GEOLOCATION_OPTIONS: SelectProps.Option[] = [
  { value: '*', label: 'Default (all other locations)' },
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'IN', label: 'India' },
  { value: 'DE', label: 'Germany' },
  { value: 'AU', label: 'Australia' },
  { value: 'BR', label: 'Brazil' },
  { value: 'JP', label: 'Japan' },
];
