export const BRASILIA_TIME_ZONE = 'America/Sao_Paulo';

const timezonePlaceNames: Record<string, string> = {
  'America/Sao_Paulo': 'Brasília',
  'America/New_York': 'Nova York',
  'America/Chicago': 'Chicago',
  'America/Denver': 'Denver',
  'America/Los_Angeles': 'Los Angeles',
  'America/Phoenix': 'Phoenix',
  'America/Anchorage': 'Anchorage',
  'Pacific/Honolulu': 'Honolulu',
  'America/Toronto': 'Toronto',
  'America/Mexico_City': 'Cidade do México',
  'Europe/London': 'Londres',
  'Europe/Paris': 'Paris',
  'Asia/Tokyo': 'Tóquio',
};

function shortEventLocation(location?: string | null): string | null {
  if (!location) return null;
  const parts = location.split(',').map(part => part.trim()).filter(Boolean);
  if (parts.length >= 2 && /^[A-Z]{2}$/.test(parts[1])) {
    const city = parts[0].split(/[—–-]/).pop()?.trim();
    return city ? `${city}, ${parts[1]}` : null;
  }
  return parts[0]?.split(/[—–-]/).pop()?.trim() || null;
}

function partsFor(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function offsetAt(instant: Date, timeZone: string): number {
  const parts = partsFor(instant, timeZone);
  const representedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return representedAsUtc - instant.getTime();
}

export function zonedLocalDateTimeToIso(value: string, timeZone: string): string {
  if (!value || /(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return value;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return value;

  const wallClockAsUtc = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] ?? 0),
  );
  let instant = new Date(wallClockAsUtc - offsetAt(new Date(wallClockAsUtc), timeZone));
  instant = new Date(wallClockAsUtc - offsetAt(instant, timeZone));
  return instant.toISOString();
}

export function datetimeLocalInZone(value: string, timeZone: string): string {
  if (!value) return '';
  const absolute = zonedLocalDateTimeToIso(value, timeZone);
  const date = new Date(absolute);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const parts = partsFor(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function dateAndTimeInZone(value: string, timeZone: string): { date: string; time: string } {
  const local = datetimeLocalInZone(value, timeZone);
  const [date = '', time = ''] = local.split('T');
  return { date, time };
}

function dateInZone(value: string, timeZone: string): string {
  const absolute = zonedLocalDateTimeToIso(value, timeZone);
  const date = new Date(absolute);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

function timeInZone(value: string, timeZone: string): string {
  const absolute = zonedLocalDateTimeToIso(value, timeZone);
  const date = new Date(absolute);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

export interface MatchScheduleDisplay {
  date: string;
  eventTime: string;
  eventLabel: string;
  eventTimeZone: string;
  brasiliaTime?: string;
}

export function formatMatchSchedule(value: string, eventTimeZone = BRASILIA_TIME_ZONE, eventLocation?: string | null): MatchScheduleDisplay {
  const date = dateInZone(value, eventTimeZone);
  const eventTime = timeInZone(value, eventTimeZone);
  const place = shortEventLocation(eventLocation) ?? timezonePlaceNames[eventTimeZone] ?? eventTimeZone;
  const eventLabel = `Horário de ${place}`;
  if (eventTimeZone === BRASILIA_TIME_ZONE) return { date, eventTime, eventLabel, eventTimeZone };
  return {
    date,
    eventTime,
    eventLabel,
    eventTimeZone,
    brasiliaTime: timeInZone(value, BRASILIA_TIME_ZONE),
  };
}
