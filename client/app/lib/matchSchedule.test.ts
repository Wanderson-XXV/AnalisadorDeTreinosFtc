import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dateAndTimeInZone,
  datetimeLocalInZone,
  formatMatchSchedule,
  zonedLocalDateTimeToIso,
} from './matchSchedule.ts';

test('preserves an official absolute timestamp', () => {
  assert.equal(zonedLocalDateTimeToIso('2026-07-24T14:30:00Z', 'America/Chicago'), '2026-07-24T14:30:00Z');
});

test('converts a Chicago wall-clock time to its July UTC instant', () => {
  assert.equal(zonedLocalDateTimeToIso('2026-07-24T09:30', 'America/Chicago'), '2026-07-24T14:30:00.000Z');
});

test('shows event city and both local and Brasilia times', () => {
  const display = formatMatchSchedule('2026-07-24T14:30:00Z', 'America/Chicago', 'Houston, TX, USA');
  assert.equal(display.date, '24/07');
  assert.equal(display.eventTime, '09:30');
  assert.equal(display.eventLabel, 'Horário de Houston, TX');
  assert.equal(display.brasiliaTime, '11:30');
});

test('prepares official timestamps for datetime-local inputs', () => {
  assert.equal(datetimeLocalInZone('2026-07-24T14:30:00Z', 'America/Chicago'), '2026-07-24T09:30');
  assert.deepEqual(dateAndTimeInZone('2026-07-24T14:30:00Z', 'America/Chicago'), { date: '2026-07-24', time: '09:30' });
});
