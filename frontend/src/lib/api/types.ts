/**
 * Friendly names for the generated API types.
 *
 * schema.d.ts is generated from the backend's OpenAPI document by
 * `make api-types`; never edit it by hand.
 */
import type { components } from './schema';

type Schemas = components['schemas'];

export type HostedZone = Schemas['HostedZoneOut'];
export type HostedZoneList = Schemas['HostedZoneList'];
