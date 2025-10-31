import { DateTime } from "luxon";

export function parseDuration(duration: string): number | null {
  const match = duration.match(/^(\d+)([smhdw])$/);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'w': return value * 7 * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

export function convertUtcToUserTime(time: string, timezone: string): string {
  const [hour, minute] = time.split(':').map(Number);
  const utcTime = DateTime.fromObject({ hour, minute }, { zone: 'utc' });
  const userTime = utcTime.setZone(timezone);
  return userTime.toFormat('HH:mm');
}

export function convertUserToUtcTime(time: string, timezone: string): string {
  const [hour, minute] = time.split(':').map(Number);
  const userTime = DateTime.fromObject({ hour, minute }, { zone: timezone });
  const utcTime = userTime.toUTC();
  return utcTime.toFormat('HH:mm');
}
