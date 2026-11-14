import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { getGreeting } from '../src/lib/greeting.ts';

test('greets according to the time in Nairobi', () => {
  assert.equal(getGreeting(new Date('2026-11-14T20:59:59Z')), 'Good evening');
  assert.equal(getGreeting(new Date('2026-11-14T21:00:00Z')), 'Good morning');
  assert.equal(getGreeting(new Date('2026-11-15T08:59:59Z')), 'Good morning');
  assert.equal(getGreeting(new Date('2026-11-15T09:00:00Z')), 'Good afternoon');
  assert.equal(getGreeting(new Date('2026-11-15T14:59:59Z')), 'Good afternoon');
  assert.equal(getGreeting(new Date('2026-11-15T15:00:00Z')), 'Good evening');
});
