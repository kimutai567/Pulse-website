export function getGreeting(date: Date): string {
  const hour = Number(new Intl.DateTimeFormat('en-KE', {
    timeZone: 'Africa/Nairobi',
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(date));

  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
