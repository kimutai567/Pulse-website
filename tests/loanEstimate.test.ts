import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { calculateLoanEstimate } from '../src/lib/loanEstimate.ts';

test('calculates 10% flat interest and the total in cents', () => {
  assert.deepEqual(calculateLoanEstimate('1000'), {
    principalCents: 100000, interestCents: 10000, totalCents: 110000,
  });
  assert.deepEqual(calculateLoanEstimate('12.35'), {
    principalCents: 1235, interestCents: 124, totalCents: 1359,
  });
  assert.deepEqual(calculateLoanEstimate('0.01'), {
    principalCents: 1, interestCents: 0, totalCents: 1,
  });
});

test('rejects invalid amounts and amounts beyond the supported maximum', () => {
  for (const amount of ['', '0', '-1', '1.001', '1e3', '10000000000', 'NaN']) {
    assert.equal(calculateLoanEstimate(amount), null);
  }
  assert.notEqual(calculateLoanEstimate('9999999999.99'), null);
});
