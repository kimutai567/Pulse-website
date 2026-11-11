export type LoanEstimate = {
  principalCents: number;
  interestCents: number;
  totalCents: number;
};

export function calculateLoanEstimate(input: string): LoanEstimate | null {
  const match = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;

  const principalCents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  if (principalCents <= 0 || principalCents > 999999999999) return null;

  const interestCents = Math.floor((principalCents + 5) / 10);
  return { principalCents, interestCents, totalCents: principalCents + interestCents };
}
