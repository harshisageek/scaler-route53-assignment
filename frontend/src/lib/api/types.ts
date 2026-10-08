/**
 * Friendly names for the generated API types.
 *
 * schema.d.ts is generated from the backend's OpenAPI document by
 * `make api-types`; never edit it by hand.
 */
import type { components, operations } from './schema';

type Schemas = components['schemas'];

export type HostedZone = Schemas['HostedZoneOut'];
export type HostedZoneDetail = Schemas['HostedZoneDetail'];
export type HostedZoneCreate = Schemas['HostedZoneCreate'];
export type HostedZoneUpdate = Schemas['HostedZoneUpdate'];
export type HostedZoneListParams = NonNullable<
  operations['list_hosted_zones_api_v1_hosted_zones_get']['parameters']['query']
>;
export type HostedZoneSort = NonNullable<HostedZoneListParams['sort']>;
export type HostedZoneList = Schemas['HostedZoneList'];

export type RecordSet = Schemas['RecordSetOut'];
export type RecordSetCreate = Schemas['RecordSetCreate'];
export type RecordSetUpdate = Schemas['RecordSetUpdate'];
export type RecordSetList = Schemas['RecordSetList'];
export type RecordSetListParams = NonNullable<
  operations['list_record_sets_api_v1_hosted_zones__zone_id__records_get']['parameters']['query']
>;
export type RecordSetSort = NonNullable<RecordSetListParams['sort']>;
export type RecordType = RecordSet['type'];
export type EditableRecordType = RecordSetCreate['type'];

export type User = Schemas['UserOut'];
export type SignInRequest = Schemas['SignInRequest'];
export type SignUpRequest = Schemas['SignUpRequest'];
