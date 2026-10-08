/**
 * The API stores names fully qualified ("example.com."), as Route 53 does,
 * but the console shows them without the trailing dot.
 */
export function displayZoneName(name: string): string {
  return name.endsWith('.') && name.length > 1 ? name.slice(0, -1) : name;
}

export function displayZoneType(privateZone: boolean): string {
  return privateZone ? 'Private' : 'Public';
}
