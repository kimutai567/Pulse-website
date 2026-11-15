import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { sumVerifiedContributionAmount } from '../src/lib/contributions.ts';

test('sums verified contributions and excludes pending or rejected payments', () => {
  assert.equal(sumVerifiedContributionAmount([
    { amount: 1000, status: 'VERIFIED' },
    { amount: 250.5, status: 'VERIFIED' },
    { amount: 800, status: 'PENDING' },
    { amount: 400, status: 'REJECTED' },
  ]), 1250.5);
});

test('returns zero when there are no verified contributions', () => {
  assert.equal(sumVerifiedContributionAmount([
    { amount: 800, status: 'PENDING' },
    { amount: 400, status: 'REJECTED' },
  ]), 0);
  assert.equal(sumVerifiedContributionAmount([]), 0);
});
