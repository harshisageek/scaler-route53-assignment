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

/** "October 1, 2026 at 12:00 (UTC)": always in UTC, so it reads the same for everyone. */
export function displayTimestamp(iso: string): string {
  const formatted = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
    hourCycle: 'h23',
    timeZone: 'UTC',
  }).format(new Date(iso));
  return `${formatted} (UTC)`;
}
