type ContributionAmount = {
  amount: number;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
};

export function sumVerifiedContributionAmount(
  contributions: readonly ContributionAmount[],
): number {
  return contributions.reduce(
    (total, contribution) => contribution.status === 'VERIFIED'
      ? total + contribution.amount
      : total,
    0,
  );
}
