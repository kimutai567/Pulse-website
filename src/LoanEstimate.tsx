import { useState } from 'react';
import { calculateLoanEstimate } from './lib/loanEstimate';

const formatMoney = (cents: number) => `KES ${(cents / 100).toLocaleString('en-KE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

export default function LoanEstimate() {
  const [amount, setAmount] = useState('');
  const estimate = calculateLoanEstimate(amount);

  return (
    <section className="panel operator-panel" aria-labelledby="loan-estimate-title">
      <div className="section-kicker">LOAN ESTIMATE</div>
      <h2 id="loan-estimate-title">Calculate repayment</h2>
      <p className="operator-intro">Estimate the cost of a standard loan. This does not check eligibility or available reserve and does not submit a loan request.</p>
      <label className="form-label" htmlFor="estimate-amount">Loan amount (KES)</label>
      <input id="estimate-amount" className="form-input" type="number" min="0.01" max="9999999999.99" step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="e.g. 1000" aria-describedby="estimate-help" />
      <p id="estimate-help" className="operator-intro">Enter an amount greater than zero with up to two decimal places.</p>
      {amount && !estimate && <p className="chat-error" role="alert">Enter a valid amount between KES 0.01 and KES 9,999,999,999.99.</p>}
      {estimate && <div aria-live="polite">
        <div className="reconcile-row"><span>Principal</span><strong>{formatMoney(estimate.principalCents)}</strong></div>
        <div className="reconcile-row"><span>Flat interest (10%)</span><strong>{formatMoney(estimate.interestCents)}</strong></div>
        <div className="reconcile-row"><span>Total before any fines</span><strong>{formatMoney(estimate.totalCents)}</strong></div>
      </div>}
      <p className="operator-intro">Repayment is due after 14 days, followed by a 7-day grace period. A KES 150 fine applies when grace ends and every 7 days afterward while a balance remains. Interest and fines go to the admin pool.</p>
      <p className="operator-intro"><strong>Real loans are not connected yet.</strong> Rotation, savings, guarantors, reserve cash, approvals and repayments are not checked or recorded here.</p>
    </section>
  );
}
