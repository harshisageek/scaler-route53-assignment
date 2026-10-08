import type { EditableRecordType, RecordType } from '@/lib/api/types';

export const EDITABLE_RECORD_TYPES: readonly EditableRecordType[] = [
  'A',
  'AAAA',
  'CNAME',
  'TXT',
  'MX',
  'NS',
  'PTR',
  'SRV',
  'CAA',
];

export const RECORD_TYPES: readonly RecordType[] = [...EDITABLE_RECORD_TYPES, 'SOA'];

export const RECORD_TYPE_HINTS: Record<EditableRecordType, string> = {
  A: 'IPv4 address, such as 192.0.2.1',
  AAAA: 'IPv6 address, such as 2001:db8::1',
  CNAME: 'Domain name, such as service.example.com',
  TXT: 'Text, usually enclosed in quotation marks',
  MX: 'Priority and mail server, such as 10 mail.example.com',
  NS: 'Name server, such as ns-1.example.com',
  PTR: 'Domain name used for reverse DNS',
  SRV: 'Priority, weight, port and target',
  CAA: 'Flags, tag and certificate authority value',
};
