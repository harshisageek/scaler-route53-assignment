import type { SelectProps } from '@cloudscape-design/components/select';
import type { AliasTargetType, RecordSet, RecordType } from '@/lib/api/types';

export const ALIAS_TARGET_TYPE_OPTIONS: SelectProps.Option[] = [
  {
    value: 'cloudfront',
    label: 'CloudFront distribution',
    description: 'Mock global content delivery distribution',
  },
  {
    value: 's3-website',
    label: 'S3 website endpoint',
    description: 'Mock static website bucket',
  },
  {
    value: 'load-balancer',
    label: 'Application Load Balancer',
    description: 'Mock regional load balancer',
  },
  {
    value: 'api-gateway',
    label: 'API Gateway API',
    description: 'Mock regional API endpoint',
  },
  {
    value: 'record',
    label: 'Another record in this hosted zone',
    description: 'An existing record with the same A or AAAA type',
  },
];

const MOCK_TARGETS: Record<Exclude<AliasTargetType, 'record'>, SelectProps.Option> = {
  cloudfront: {
    value: 'd111111abcdef8.cloudfront.net.',
    label: 'd111111abcdef8.cloudfront.net.',
  },
  's3-website': {
    value: 'example-bucket.s3-website-us-east-1.amazonaws.com.',
    label: 'example-bucket.s3-website-us-east-1.amazonaws.com.',
  },
  'load-balancer': {
    value: 'dualstack.example.us-east-1.elb.amazonaws.com.',
    label: 'dualstack.example.us-east-1.elb.amazonaws.com.',
  },
  'api-gateway': {
    value: 'd-example.execute-api.us-east-1.amazonaws.com.',
    label: 'd-example.execute-api.us-east-1.amazonaws.com.',
  },
};

export function aliasTargetOptions(
  targetType: AliasTargetType | null,
  records: RecordSet[],
  recordType: RecordType,
  currentRecordId?: number,
): SelectProps.Option[] {
  if (targetType === null) return [];
  if (targetType !== 'record') return [MOCK_TARGETS[targetType]];
  return records
    .filter(
      (record) =>
        record.id !== currentRecordId && record.type === recordType && !record.alias,
    )
    .map((record) => ({
      value: record.name,
      label: record.name,
      description: record.values.join(', '),
    }));
}
