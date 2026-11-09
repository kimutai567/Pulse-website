import { useEffect, useState } from 'react';
import {
  Activity, ArrowDownLeft, ArrowUpRight, BadgeCheck, Bell, CalendarDays,
  ChartNoAxesColumnIncreasing, Check, CheckCircle2, ChevronDown, ChevronRight,
  CircleHelp, Clock3, Coins, CreditCard, FileClock, Gavel,
  HandCoins, HeartHandshake, Home, Landmark, LogOut, Menu, MessageSquareText,
  Plus, RotateCcw, Settings, ShieldCheck, Users,
  Vote, Wallet, X,
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { User } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';

type Role = 'MEMBER' | 'ACCOUNTANT' | 'CHAIRMAN' | 'SYSTEM_ADMIN';
type Page = 'Overview' | 'Contributions' | 'Rotation' | 'Loans' | 'Reserve & dividends' | 'Votes & proposals' | 'Activity';
type Modal = 'payment' | 'loan' | 'invite' | null;
type DemoPaymentStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
type DemoPayment = {
  id: string;
  memberId: string;
  member: string;
  amount: number;
  reference: string;
  phone: string;
  weekNumber: number;
  yearNumber?: number;
  createdAt: string;
  status: DemoPaymentStatus;
  rejectionReason?: string;
};
type ContributionRecord = {
  id: string;
  circle_id: string;
  member_id: string;
  contribution_year: number;
  week_number: number;
  contribution_type: 'WEEKLY' | 'RESERVE' | 'OTHER';
  amount: number;
  status: DemoPaymentStatus;
  created_at: string;
  verified_at: string | null;
  member_name: string;
  payment_reference: string | null;
  payment_phone: string | null;
  payment_rejection_reason: string | null;
};
type ContributionRow = Pick<ContributionRecord,
  'id' | 'circle_id' | 'member_id' | 'contribution_year' | 'week_number'
  | 'contribution_type' | 'amount' | 'status' | 'created_at' | 'verified_at'
>;

const navItems: { label: Page; icon: typeof Home }[] = [
  { label: 'Overview', icon: Home },
  { label: 'Contributions', icon: CreditCard },
  { label: 'Rotation', icon: ArrowUpRight },
  { label: 'Loans', icon: HandCoins },
  { label: 'Reserve & dividends', icon: Landmark },
  { label: 'Votes & proposals', icon: Vote },
  { label: 'Activity', icon: FileClock },
];

const chartData = [
  { month: 'Apr', savings: 34000, reserve: 22000 },
  { month: 'May', savings: 40500, reserve: 25800 },
  { month: 'Jun', savings: 49200, reserve: 30200 },
  { month: 'Jul', savings: 57500, reserve: 34800 },
  { month: 'Aug', savings: 64400, reserve: 38900 },
  { month: 'Sep', savings: 72800, reserve: 43200 },
];

const transactions = [
  { initials: 'AM', name: 'Amina Mwangi', detail: 'Weekly contribution · Week 38', amount: '+ KES 1,000', time: 'Today, 10:42 am', status: 'Verified', tone: 'green' },
  { initials: 'JN', name: 'James Njoroge', detail: 'Rotation payout · Cycle 1', amount: '− KES 5,600', time: 'Yesterday, 3:18 pm', status: 'Approved', tone: 'blue' },
  { initials: 'GW', name: 'Grace Wanjiku', detail: 'Weekly contribution · Week 38', amount: '+ KES 1,000', time: 'Yesterday, 11:06 am', status: 'Pending', tone: 'amber' },
  { initials: 'DO', name: 'David Otieno', detail: 'Loan repayment · Principal', amount: '+ KES 800', time: 'Mon, Sep 21', status: 'Verified', tone: 'green' },
];

const fmt = (amount: number) => `KES ${amount.toLocaleString('en-KE')}`;

function currentNairobiPeriod() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  const date = new Date(Date.UTC(Number(part('year')), Number(part('month')) - 1, Number(part('day'))));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const year = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year, week };
}

function App() {
  const [isDemo, setIsDemo] = useState(() => {
    return new URLSearchParams(window.location.search).get('preview') === '1';
  });
  const previewMode = isDemo;
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [role, setRole] = useState<Role>('MEMBER');
  const [previewRole, setPreviewRole] = useState<Role | null>(null);
  const [page, setPage] = useState<Page>('Overview');
  const [modal, setModal] = useState<Modal>(null);
  const [notice, setNotice] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [vote, setVote] = useState<'yes' | 'no' | null>(null);
  const [paymentCode, setPaymentCode] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [demoPayments, setDemoPayments] = useState<DemoPayment[]>([]);
  const [contributions, setContributions] = useState<ContributionRecord[]>([]);
  const [contributionLoading, setContributionLoading] = useState(true);
  const [contributionError, setContributionError] = useState('');
  const [contributionSubmitting, setContributionSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [contributionRefresh, setContributionRefresh] = useState(0);
  const [weeklyContribution, setWeeklyContribution] = useState(0);
  const [circleName, setCircleName] = useState('Savings circle');
  const [circleMemberCount, setCircleMemberCount] = useState(0);
  const [membership, setMembership] = useState<'loading' | 'none' | 'active'>('loading');
  const [membershipError, setMembershipError] = useState('');
  const [circleId, setCircleId] = useState<string | null>(null);
  const viewRole = previewMode ? role : previewRole ?? role;
  const canPreviewRoles = previewMode || role !== 'MEMBER';

  useEffect(() => {
    if (previewMode || !user || !supabase) return;

    let current = true;
    setMembership('loading');
    setMembershipError('');
    setCircleId(null);
    void (async () => {
      try {
        const { error: inviteError } = await supabase.rpc('accept_circle_invites');
        if (inviteError) throw new Error(inviteError.message);

        const { data, error } = await supabase
          .from('circle_members')
          .select('circle_id, role')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!current) return;

        if (data) {
          setCircleId(data.circle_id);
          setRole(data.role as Role);
          setMembership('active');
        } else {
          setMembership('none');
        }
      } catch (loadError) {
        if (!current) return;
        setMembershipError(loadError instanceof Error ? loadError.message : 'Could not load your circle membership.');
        setMembership('none');
      }
    })();

    return () => {
      current = false;
    };
  }, [user, previewMode]);

  useEffect(() => {
    if (previewMode || !supabase) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
    }).catch(() => {
      if (mounted) setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [previewMode]);

  useEffect(() => {
    if (!user || !supabase) {
      setProfileName('');
      setProfilePhone('');
      setProfileLoaded(false);
      return;
    }

    let current = true;
    setProfileLoaded(false);
    const metadataName = user.user_metadata.full_name;
    const fallbackName = typeof metadataName === 'string' && metadataName.trim()
      ? metadataName.trim()
      : user.email?.split('@')[0] || 'Pulse member';
    setProfileName(fallbackName);

    supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!current) return;
        if (data?.full_name?.trim()) setProfileName(data.full_name.trim());
        setProfilePhone(data?.phone?.trim() ?? '');
        setProfileLoaded(true);
      });

    return () => {
      current = false;
    };
  }, [user]);

  useEffect(() => {
    if (previewMode || !user || !supabase || membership !== 'active' || !circleId) {
      setContributions([]);
      setContributionLoading(false);
      setContributionError('');
      setCircleMemberCount(0);
      return;
    }

    let current = true;
    setContributionLoading(true);
    setContributionError('');
    setContributions([]);
    setWeeklyContribution(0);
    setCircleMemberCount(0);
    void (async () => {
      try {
        const { data: circle, error: circleError } = await supabase
          .from('circles')
          .select('name, weekly_contribution')
          .eq('id', circleId)
          .maybeSingle();
        if (circleError) throw new Error(circleError.message);
        if (!circle) throw new Error('The active circle settings were not found.');

        const { count: memberCount, error: memberError } = await supabase
          .from('circle_members')
          .select('user_id', { count: 'exact', head: true })
          .eq('circle_id', circleId);
        if (memberError) throw new Error(memberError.message);

        const pageSize = 100;
        const records: ContributionRow[] = [];
        for (let offset = 0; ; offset += pageSize) {
          const contributionsQuery = supabase
            .from('contributions')
            .select('id, circle_id, member_id, contribution_year, week_number, contribution_type, amount, status, created_at, verified_at')
            .eq('circle_id', circleId);
          const visibleContributions = role === 'ACCOUNTANT' || role === 'SYSTEM_ADMIN'
            ? contributionsQuery
            : contributionsQuery.eq('member_id', user.id);
          const { data, error } = await visibleContributions
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .range(offset, offset + pageSize - 1);
          if (error) throw new Error(error.message);
          const page = data ?? [];
          records.push(...page);
          if (page.length < pageSize) break;
        }

        const memberIds = [...new Set(records.map((record) => record.member_id))];
        let profileNames = new Map<string, string>();
        if (memberIds.length) {
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', memberIds);
          if (profilesError) throw new Error(profilesError.message);
          profileNames = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
        }

        const paymentDetailRows: { contribution_id: string; payment_reference: string; payment_phone: string; rejection_reason: string | null }[] = [];
        for (let offset = 0; offset < records.length; offset += 100) {
          const contributionIds = records.slice(offset, offset + 100).map((record) => record.id);
          const { data: details, error: detailsError } = await supabase
            .from('contribution_payment_details')
            .select('contribution_id, payment_reference, payment_phone, rejection_reason')
            .in('contribution_id', contributionIds);
          if (detailsError) throw new Error(detailsError.message);
          paymentDetailRows.push(...(details ?? []));
        }
        const paymentDetails = new Map(paymentDetailRows.map((detail) => [
          detail.contribution_id,
          {
            payment_reference: detail.payment_reference,
            payment_phone: detail.payment_phone,
            rejection_reason: detail.rejection_reason,
          },
        ]));

        if (!current) return;
        setCircleName(circle.name);
        setCircleMemberCount(memberCount ?? 0);
        setWeeklyContribution(Number(circle?.weekly_contribution ?? 0));
        setContributions(records.map((record) => ({
          ...record,
          amount: Number(record.amount),
          member_name: profileNames.get(record.member_id) ?? 'Circle member',
          payment_reference: paymentDetails.get(record.id)?.payment_reference ?? null,
          payment_phone: paymentDetails.get(record.id)?.payment_phone ?? null,
          payment_rejection_reason: paymentDetails.get(record.id)?.rejection_reason ?? null,
        })));
      } catch (loadError) {
        if (!current) return;
        const message = loadError instanceof Error ? loadError.message : 'Could not load circle contributions.';
        setContributionError(/contribution_year|contribution_payment_details|submit_contribution|review_contribution/i.test(message)
          ? 'Database setup is incomplete. Ask the administrator to apply Supabase migration 005 before loading live contribution records.'
          : message);
      } finally {
        if (current) setContributionLoading(false);
      }
    })();

    return () => {
      current = false;
    };
  }, [circleId, contributionRefresh, membership, previewMode, role, user]);

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3400);
  }

  async function submitPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!previewMode && previewRole !== null) {
      setPaymentError('This role preview is read-only. Return to your own dashboard to submit a real contribution.');
      return;
    }
    const form = event.currentTarget;
    const amount = Number(form.querySelector<HTMLInputElement>('#payment-amount')?.value);
    const phone = form.querySelector<HTMLInputElement>('#payment-sender')?.value.trim() ?? '';
    const reference = paymentCode.trim().toUpperCase();
    if (!reference || !Number.isFinite(amount) || amount <= 0 || !phone) {
      setPaymentError('Enter a valid amount, transaction reference, and sender phone number.');
      return;
    }

    if (sampleView) {
      const member = profileName || user?.email?.split('@')[0] || 'Preview member';
      const period = currentNairobiPeriod();
      setDemoPayments((current) => [{
        id: `DEMO-${crypto.randomUUID()}`,
        memberId: user?.id ?? 'preview-user',
        member,
        amount,
        reference,
        phone,
        weekNumber: period.week,
        yearNumber: period.year,
        createdAt: new Date().toISOString(),
        status: 'PENDING',
      }, ...current]);
      setModal(null);
      setPaymentCode('');
      flash('Demo payment submitted to the accountant review queue.');
      return;
    }

    if (!supabase || !user || !circleId) {
      setPaymentError('Your secure circle session is not ready. Refresh the page and try again.');
      return;
    }
    setPaymentError('');
    setContributionSubmitting(true);
    try {
      const { error } = await supabase.rpc('submit_contribution', {
        target_circle: circleId,
        contribution_amount: amount,
        transaction_reference: reference,
        sender_phone: phone,
      });
      if (error) {
        setPaymentError(error.code === '23505'
          ? 'That transaction reference has already been submitted for this circle.'
          : error.message);
        return;
      }
      setModal(null);
      setPaymentCode('');
      form.reset();
      setContributionRefresh((value) => value + 1);
      flash('Contribution saved and sent to the accountant for manual review.');
    } catch (submitError) {
      setPaymentError(submitError instanceof Error ? submitError.message : 'Could not submit the contribution.');
    } finally {
      setContributionSubmitting(false);
    }
  }

  async function reviewContribution(id: string, status: Exclude<DemoPaymentStatus, 'PENDING'>, rejectionReason?: string) {
    if (!supabase || !circleId) throw new Error('Your secure circle session is not ready. Refresh the page and try again.');
    const { error } = await supabase.rpc('review_contribution', {
      target_contribution: id,
      review_status: status,
      decision_reason: status === 'REJECTED' ? rejectionReason ?? null : null,
    });
    if (error) throw new Error(error.message);
    setContributionRefresh((value) => value + 1);
    flash(`Contribution ${status.toLowerCase()}.`);
  }

  function reviewDemoPayment(id: string, status: Exclude<DemoPaymentStatus, 'PENDING'>, rejectionReason?: string) {
    setDemoPayments((current) => current.map((payment) => payment.id === id
      ? { ...payment, status, rejectionReason }
      : payment));
    flash(`Demo payment ${status.toLowerCase()}.`);
  }

  function submitLoan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!loanAmount || Number(loanAmount) <= 0) return;
    setModal(null);
    setLoanAmount('');
    flash('Loan request submitted for review.');
  }

  async function sendInvite(email: string, fullName: string, invitedRole: Role) {
    if (!supabase || !user || !circleId) {
      throw new Error('Your circle admin session is not ready. Refresh the page and try again.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const { error: inviteError } = await supabase
      .from('circle_invites')
      .upsert({
        circle_id: circleId,
        email: normalizedEmail,
        role: invitedRole,
        invited_by: user.id,
      }, { onConflict: 'circle_id,email' });

    if (inviteError) {
      throw new Error(`Could not save this role assignment: ${inviteError.message}`);
    }

    const { error: emailError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: window.location.origin,
        ...(fullName.trim() ? { data: { full_name: fullName.trim() } } : {}),
      },
    });

    if (emailError) {
      throw new Error(`The role assignment was saved, but the invitation email could not be sent: ${emailError.message}`);
    }
  }

  function enterDemoMode() {
    const url = new URL(window.location.href);
    url.searchParams.set('preview', '1');
    window.history.pushState({}, '', url.toString());
    setIsDemo(true);
  }

  function exitDemoMode() {
    const url = new URL(window.location.href);
    url.searchParams.delete('preview');
    window.history.pushState({}, '', url.toString());
    setIsDemo(false);
  }

  if (authLoading) {
    return <main className="auth-shell"><section className="auth-card"><div className="auth-brand"><span className="brand-mark"><Activity size={21} strokeWidth={2.7} /></span><span className="brand-name">pulse<span>.</span></span></div><p className="auth-copy">Checking your secure session...</p></section></main>;
  }

  if (!user && !previewMode) {
    return <LoginScreen onEnterDemo={enterDemoMode} />;
  }

  if (!previewMode && membership !== 'active') {
    const brand = <div className="auth-brand"><span className="brand-mark"><Activity size={21} strokeWidth={2.7} /></span><span className="brand-name">pulse<span>.</span></span></div>;
    if (membership === 'loading') {
      return <main className="auth-shell"><section className="auth-card">{brand}<p className="auth-copy">Loading your circle...</p></section></main>;
    }
    return (
      <main className="auth-shell">
        <section className="auth-card">
          {brand}
          <div className="auth-kicker">UPENDO CIRCLE</div>
          <h1 id="auth-title">Waiting for approval</h1>
          <p className="auth-copy">
            {membershipError || <>You're signed in as <strong>{user?.email}</strong>, but this email hasn't been added to Upendo Circle yet. Ask the circle admin to invite you, then sign in again.</>}
          </p>
          <button className="button button-primary auth-submit" type="button" onClick={() => supabase?.auth.signOut()}>Sign out</button>
        </section>
      </main>
    );
  }

  if (!previewMode && user && !profileLoaded) {
    return <main className="auth-shell"><section className="auth-card"><p className="auth-copy">Loading your profile...</p></section></main>;
  }

  if (!previewMode && user && !profilePhone) {
    return <CompleteProfile
      email={user.email ?? ''}
      initialName={profileName}
      onSaved={(name, phone) => { setProfileName(name); setProfilePhone(phone); }}
      onSignOut={() => supabase?.auth.signOut()}
      userId={user.id}
    />;
  }

  const displayName = profileName || user?.email?.split('@')[0] || 'Preview member';
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const sampleView = previewMode;
  const period = currentNairobiPeriod();
  const memberContributionRows = contributions.filter((contribution) => contribution.member_id === user?.id);
  const currentWeekContributions = memberContributionRows.filter((contribution) =>
    contribution.contribution_year === period.year
      && contribution.week_number === period.week
      && contribution.contribution_type === 'WEEKLY');
  const verifiedCurrentWeek = currentWeekContributions
    .filter((contribution) => contribution.status === 'VERIFIED')
    .reduce((total, contribution) => total + contribution.amount, 0);
  const currentWeekPending = currentWeekContributions.some((contribution) => contribution.status === 'PENDING');
  const currentWeekVerified = currentWeekContributions.some((contribution) => contribution.status === 'VERIFIED');
  const currentWeekRejected = currentWeekContributions.some((contribution) => contribution.status === 'REJECTED');
  const currentWeekStatus = contributionError
    ? 'Unavailable'
    : currentWeekPending
      ? 'Awaiting review'
      : currentWeekVerified
        ? 'Verified'
        : currentWeekRejected
          ? 'Rejected'
          : 'No payment recorded';
  const contributionProgress = weeklyContribution > 0
    ? Math.min(100, verifiedCurrentWeek / weeklyContribution * 100)
    : 0;
  const yearToDateVerified = memberContributionRows
    .filter((contribution) => contribution.contribution_year === period.year && contribution.status === 'VERIFIED')
    .reduce((total, contribution) => total + contribution.amount, 0);
  const allTimeVerified = memberContributionRows
    .filter((contribution) => contribution.status === 'VERIFIED')
    .reduce((total, contribution) => total + contribution.amount, 0);
  const nairobiMonthParts = (date: Date) => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const currentMonthParts = nairobiMonthParts(new Date());
  const currentMonthYear = Number(currentMonthParts.find((part) => part.type === 'year')?.value);
  const currentMonthNumber = Number(currentMonthParts.find((part) => part.type === 'month')?.value);
  const memberSavingsChartData = Array.from({ length: 6 }, (_, index) => {
    const monthStart = new Date(Date.UTC(currentMonthYear, currentMonthNumber - 6 + index, 1));
    const year = monthStart.getUTCFullYear();
    const month = monthStart.getUTCMonth() + 1;
    return {
      key: `${year}-${String(month).padStart(2, '0')}`,
      month: new Intl.DateTimeFormat('en-KE', { timeZone: 'Africa/Nairobi', month: 'short' }).format(monthStart),
      savings: 0,
    };
  });
  const monthSavings = new Map(memberSavingsChartData.map((item) => [item.key, 0]));
  for (const contribution of memberContributionRows) {
    if (contribution.status !== 'VERIFIED') continue;
    const createdAtParts = nairobiMonthParts(new Date(contribution.created_at));
    const key = `${createdAtParts.find((part) => part.type === 'year')?.value}-${createdAtParts.find((part) => part.type === 'month')?.value}`;
    if (monthSavings.has(key)) monthSavings.set(key, (monthSavings.get(key) ?? 0) + contribution.amount);
  }
  let runningSavings = memberContributionRows
    .filter((contribution) => contribution.status === 'VERIFIED' && new Date(contribution.created_at) < new Date(Date.UTC(currentMonthYear, currentMonthNumber - 5, 1)))
    .reduce((total, contribution) => total + contribution.amount, 0);
  for (const item of memberSavingsChartData) {
    runningSavings += monthSavings.get(item.key) ?? 0;
    item.savings = runningSavings;
  }
  const memberTransactions = sampleView
    ? [
      ...demoPayments
        .filter((payment) => payment.memberId === (user?.id ?? 'preview-user'))
        .map((payment) => ({
        initials,
        name: payment.member,
        detail: `Weekly contribution · Week ${payment.weekNumber}${payment.yearNumber ? ` · ${payment.yearNumber}` : ''}`,
        amount: `${payment.status === 'VERIFIED' ? '+ ' : ''}${fmt(payment.amount)}`,
        time: new Date(payment.createdAt).toLocaleString(),
        status: payment.status === 'VERIFIED' ? 'Verified' : payment.status === 'REJECTED' ? 'Rejected' : 'Pending',
        tone: payment.status === 'VERIFIED' ? 'green' : payment.status === 'REJECTED' ? 'amber' : 'amber',
        })),
      ...transactions,
    ]
    : memberContributionRows
      .map((contribution) => ({
        initials,
        name: displayName,
        detail: `Weekly contribution · Week ${contribution.week_number} · ${contribution.contribution_year}${contribution.payment_rejection_reason ? ` · ${contribution.payment_rejection_reason}` : ''}`,
        amount: `${contribution.status === 'VERIFIED' ? '+ ' : ''}${fmt(contribution.amount)}`,
        time: new Date(contribution.created_at).toLocaleString(),
        status: contribution.status === 'VERIFIED' ? 'Verified' : contribution.status === 'REJECTED' ? 'Rejected' : 'Pending',
        tone: contribution.status === 'VERIFIED' ? 'green' : 'amber',
      }));
  const accountantPayments: DemoPayment[] = sampleView
    ? demoPayments
    : contributions.map((contribution) => ({
      id: contribution.id,
      memberId: contribution.member_id,
      member: contribution.member_name,
      amount: contribution.amount,
      reference: contribution.payment_reference ?? '',
      phone: contribution.payment_phone ?? '',
      weekNumber: contribution.week_number,
      yearNumber: contribution.contribution_year,
      createdAt: contribution.created_at,
      status: contribution.status,
      rejectionReason: contribution.payment_rejection_reason ?? undefined,
    }));
  const accountantPendingCount = accountantPayments.filter((payment) => payment.status === 'PENDING').length;
  const verifiedContributionTotal = contributions
    .filter((contribution) => contribution.status === 'VERIFIED')
    .reduce((total, contribution) => total + contribution.amount, 0);
  const pendingContributionTotal = contributions
    .filter((contribution) => contribution.status === 'PENDING')
    .reduce((total, contribution) => total + contribution.amount, 0);
  const rejectedContributionCount = contributions.filter((contribution) => contribution.status === 'REJECTED').length;
  const personalPendingCount = contributions.filter((contribution) =>
    contribution.member_id === user?.id && contribution.status === 'PENDING').length;
  const contributionNavCount = sampleView
    ? 2
    : role === 'ACCOUNTANT' || role === 'SYSTEM_ADMIN'
      ? accountantPendingCount
      : personalPendingCount;
  const currentDate = new Intl.DateTimeFormat('en-KE', {
    timeZone: 'Africa/Nairobi',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());
  const currentDateLong = new Intl.DateTimeFormat('en-KE', {
    timeZone: 'Africa/Nairobi',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date()).toUpperCase();

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#overview" onClick={() => setPage('Overview')} aria-label="Pulse home">
          <span className="brand-mark"><Activity size={21} strokeWidth={2.7} /></span>
          <span className="brand-name">pulse<span>.</span></span>
        </a>

        <button className="container-select" onClick={() => flash(`${sampleView ? 'Upendo Circle' : circleName} workspace selected.`)}>
          <span className="container-avatar">{(sampleView ? 'Upendo Circle' : circleName).charAt(0).toUpperCase()}</span>
          <span className="container-copy"><strong>{sampleView ? 'Upendo Circle' : circleName}</strong><small>{sampleView ? 'Community · 8 members' : `Circle · ${contributionLoading ? '...' : circleMemberCount} members`}</small></span>
          <ChevronDown size={15} className="muted-icon" />
        </button>

        <div className="nav-caption">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-link ${page === label ? 'nav-active' : ''}`} onClick={() => { setPage(label); setSidebarOpen(false); }}>
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
              {label === 'Contributions' && (sampleView || contributionNavCount > 0) && <span className="nav-count">{contributionNavCount}</span>}
              {label === 'Votes & proposals' && sampleView && <span className="nav-dot" />}
            </button>
          ))}
        </nav>

        <div className="nav-caption tools-caption">YOUR ACCOUNT</div>
        <button className="nav-link" onClick={() => flash(sampleView ? 'Demo notifications opened.' : 'Notification preferences are not connected yet.')}><Bell size={17} strokeWidth={1.8} /><span>Notifications</span>{sampleView && <span className="notification-count">3</span>}</button>
        <button className="nav-link" onClick={() => flash('Account settings are available to invited members.')}><Settings size={17} strokeWidth={1.8} /><span>Settings</span></button>

        <div className="sidebar-bottom">
          <div className="help-card"><span className="help-icon"><CircleHelp size={16} /></span><strong>Need a hand?</strong><span>We’re here to help your group grow.</span><button onClick={() => flash('Help centre opened.')}>Visit help centre <ArrowUpRight size={13} /></button></div>
          <div className="profile-row"><div className="profile-avatar">{initials}</div><div className="profile-copy"><strong>{displayName}</strong><span>{user?.email ?? 'Preview mode'}{profilePhone ? ` · ${profilePhone}` : ''} · {role}</span></div><button className="icon-button profile-more" aria-label={previewMode ? 'Exit demo' : 'Sign out'} title={previewMode ? 'Exit demo' : 'Sign out'} onClick={() => previewMode ? exitDemoMode() : supabase?.auth.signOut()}><LogOut size={18} /></button></div>
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={19} /></button>
          <div className="breadcrumb"><span>{sampleView ? 'Upendo Circle' : circleName}</span><ChevronRight size={14} /><strong>{page}</strong></div>
          <div className="topbar-actions">
            {canPreviewRoles && <label className="role-picker"><span>{previewMode ? 'DEMO VIEW' : 'PREVIEW AS'}</span><select value={viewRole} onChange={(event) => { const selectedRole = event.target.value as Role; if (previewMode) setRole(selectedRole); else setPreviewRole(selectedRole === role ? null : selectedRole); setPage('Overview'); }} aria-label="Preview dashboard role"><option value="MEMBER">Member</option>{(previewMode || role === 'SYSTEM_ADMIN' || role === 'ACCOUNTANT') && <option value="ACCOUNTANT">Accountant</option>}{(previewMode || role === 'SYSTEM_ADMIN' || role === 'CHAIRMAN') && <option value="CHAIRMAN">Chairman</option>}{(previewMode || role === 'SYSTEM_ADMIN') && <option value="SYSTEM_ADMIN">System admin</option>}</select><ChevronDown size={14} /></label>}
            <span className="topbar-divider" />
            <span className="today-label"><CalendarDays size={15} /> {sampleView ? 'Fri, 25 Sep 2026' : currentDate}</span>
            <button className="icon-button top-notification" aria-label="Notifications" onClick={() => flash(sampleView ? 'Demo notifications opened.' : 'Notifications are not connected yet.')}><Bell size={18} />{sampleView && <i />}</button>
          </div>
        </header>

        <div className="page-content">
          {previewMode && <section className="role-notice"><CircleHelp size={17} /><span><strong>Demo preview</strong> · dashboard figures are sample data.</span><button onClick={exitDemoMode}>Return to sign in</button></section>}
          {!previewMode && <section className="role-notice"><CircleHelp size={17} /><span><strong>Live workspace</strong> · Connected figures come from Supabase. Other features are marked unavailable. Payments are not processed here.</span></section>}
          {!previewMode && previewRole && <section className="role-notice"><CircleHelp size={17} /><span><strong>Previewing {viewRole.replace('_', ' ')} screen</strong> · Your account is still {role.replace('_', ' ')}. Member figures use only your own verified records; actions are read-only.</span><button onClick={() => setPreviewRole(null)}>Return to my dashboard</button></section>}
          <section className="welcome-row">
            <div><div className="eyebrow"><span className="eyebrow-line" /> {sampleView ? 'FRIDAY, 25 SEPTEMBER 2026' : currentDateLong}</div><h1>{page !== 'Overview' ? page : viewRole === 'MEMBER' ? `Good morning, ${displayName}` : viewRole === 'ACCOUNTANT' ? 'Financial approvals' : viewRole === 'CHAIRMAN' ? 'Circle governance' : sampleView ? 'System operations preview' : 'Circle administration'}</h1><p className="welcome-subtitle">{page !== 'Overview' ? `Your ${sampleView ? 'Upendo Circle' : circleName} ${page.toLowerCase()} at a glance.` : viewRole === 'MEMBER' ? 'Here’s what’s happening with your circle today.' : viewRole === 'ACCOUNTANT' ? sampleView ? 'Verify contributions, review disbursements and reconcile circle transactions.' : 'Match member-submitted weekly payments and record your review.' : viewRole === 'CHAIRMAN' ? 'Support members and keep circle governance moving.' : sampleView ? 'This preview contains demo-only system figures.' : 'Manage membership and review real contribution activity for your circle.'}</p></div>
            <div className="welcome-actions"><button className="button button-quiet" onClick={() => viewRole === 'CHAIRMAN' && !sampleView ? document.getElementById('chairman-proposals')?.scrollIntoView({ behavior: 'smooth' }) : flash(viewRole === 'CHAIRMAN' ? 'Opening active proposals.' : viewRole === 'SYSTEM_ADMIN' ? sampleView ? 'The system report is a demo preview.' : 'System-wide reporting is not connected yet.' : 'Your monthly report is being prepared.')}><ChartNoAxesColumnIncreasing size={16} /> {viewRole === 'CHAIRMAN' ? 'Proposals' : viewRole === 'SYSTEM_ADMIN' ? 'System report' : 'Reports'}</button>{viewRole === 'MEMBER' ? <button className="button button-primary" disabled={previewRole !== null && !sampleView} onClick={() => { setPaymentError(''); setModal('payment'); }}><Plus size={17} /> {previewRole !== null && !sampleView ? 'Preview only' : 'Log a payment'}</button> : viewRole === 'ACCOUNTANT' || (viewRole === 'SYSTEM_ADMIN' && page === 'Contributions') ? <button className="button button-primary" onClick={() => { if (sampleView || previewRole !== null) flash('Role preview is read-only.'); else setContributionRefresh((value) => value + 1); }}><RotateCcw size={15} /> Refresh queue</button> : viewRole === 'CHAIRMAN' ? <button className="button button-primary" onClick={() => sampleView ? flash('Complaint review opened in demo mode.') : document.getElementById('chairman-complaints')?.scrollIntoView({ behavior: 'smooth' })}><MessageSquareText size={15} /> View complaints</button> : sampleView ? <button className="button button-primary" onClick={() => flash('Container creation is a demo-only preview.')}><Plus size={17} /> Create container · demo</button> : <button className="button button-primary" onClick={() => role === 'SYSTEM_ADMIN' && previewRole === null ? setModal('invite') : flash('Admin actions are unavailable in a role preview.')}><Plus size={17} /> Invite member</button>}</div>
          </section>

          {viewRole === 'ACCOUNTANT' && <section className="role-notice"><ShieldCheck size={17} /><span><strong>Accountant workspace</strong> · {sampleView ? '3 demo items need your review' : contributionError ? 'Contribution queue unavailable' : `${accountantPendingCount} contribution${accountantPendingCount === 1 ? '' : 's'} need review`}</span><button onClick={() => setPage('Contributions')}>Review queue <ArrowRightIcon /></button></section>}
          {viewRole === 'CHAIRMAN' && <section className="role-notice chairman-notice"><MessageSquareText size={17} /><span><strong>Chairman workspace</strong> · {sampleView ? '1 demo complaint needs attention' : 'Circle governance records are shown below.'}</span></section>}
          {viewRole === 'SYSTEM_ADMIN' && <section className="role-notice admin-notice"><ShieldCheck size={17} /><span><strong>{sampleView ? 'System admin preview' : 'Circle administration'}</strong> · {sampleView ? 'The preview contains sample figures.' : 'Live membership and contribution records for this circle.'}</span>{!sampleView && <button onClick={() => setPage('Contributions')}>Review contributions <ArrowRightIcon /></button>}</section>}

          {viewRole === 'MEMBER' ? <>
          <section className="metrics-grid" aria-label="Circle summary">
            <article className="metric-card metric-savings"><div className="metric-heading"><span>{sampleView ? 'MY SAVINGS' : 'MY VERIFIED CONTRIBUTIONS'}</span><span className="metric-icon green-icon"><Wallet size={16} /></span></div><div className="metric-value">{sampleView ? 'KES 24,800' : contributionError ? 'Unavailable' : contributionLoading ? '...' : fmt(allTimeVerified)}</div><div className="metric-foot"><span className="positive-change">{sampleView ? '8.2%' : 'Confirmed records only'}</span><span>{sampleView ? 'vs. last month' : 'All time'}</span><button aria-label="Savings details" onClick={() => setPage('Activity')}><ArrowUpRight size={15} /></button></div>{sampleView && <span className="metric-spark spark-green" />}</article>
            <article className="metric-card"><div className="metric-heading"><span>{sampleView ? 'CONTRIBUTED THIS CYCLE' : 'VERIFIED THIS YEAR'}</span><span className="metric-icon blue-icon"><Coins size={16} /></span></div><div className="metric-value">{sampleView ? 'KES 4,000' : contributionError ? 'Unavailable' : contributionLoading ? '...' : fmt(yearToDateVerified)}</div><div className="metric-foot"><span className="foot-dot green-dot" />{sampleView ? '4 of 4 weeks complete' : `${period.year} verified records`}<button aria-label="Contribution details" onClick={() => setPage('Contributions')}><ArrowUpRight size={15} /></button></div>{sampleView && <span className="metric-spark spark-blue" />}</article>
            <article className="metric-card"><div className="metric-heading"><span>{sampleView ? 'AVAILABLE TO BORROW' : 'AVAILABLE TO BORROW'}</span><span className="metric-icon peach-icon"><HandCoins size={16} /></span></div><div className="metric-value">{sampleView ? 'KES 12,400' : 'Not available'}</div><div className="metric-foot"><span>{sampleView ? 'Self-guaranteed limit' : 'Loan calculations are not connected'}</span>{sampleView && <button aria-label="Loan details" onClick={() => setPage('Loans')}><ArrowUpRight size={15} /></button>}</div>{sampleView && <span className="metric-spark spark-peach" />}</article>
            <article className="metric-card metric-container"><div className="metric-heading"><span>CIRCLE RESERVE</span><span className="metric-icon teal-icon"><Landmark size={16} /></span></div><div className="metric-value">{sampleView ? 'KES 43,200' : 'Not available'}</div><div className="metric-foot"><span>{sampleView ? <><span className="foot-dot teal-dot" />Aggregate · 86% of milestone</> : 'Reserve ledger is not connected'}</span>{sampleView && <button aria-label="Reserve details" onClick={() => setPage('Reserve & dividends')}><ArrowUpRight size={15} /></button>}</div>{sampleView && <span className="metric-spark spark-teal" />}</article>
          </section>

          <div className="content-grid">
            <section className="panel growth-panel">
              <div className="panel-heading"><div><div className="section-kicker">YOUR PROGRESS</div><h2>Savings over time</h2></div><button className="period-select" onClick={() => flash('Showing the last 6 months.')}>Last 6 months <ChevronDown size={14} /></button></div>
              <div className="chart-legend"><span><i className="legend-dot savings-legend" /> {sampleView ? 'My savings' : 'Cumulative verified contributions'}</span>{sampleView && <span><i className="legend-dot reserve-legend" /> Circle reserve</span>}</div>
              {contributionError && !sampleView
                ? <div className="chart-wrap"><p className="operator-intro">Verified contribution history is unavailable.</p></div>
                : !sampleView && contributionLoading
                  ? <div className="chart-wrap"><p className="operator-intro">Loading verified contribution history...</p></div>
                  : <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={sampleView ? chartData : memberSavingsChartData} margin={{ top: 14, right: 5, left: -20, bottom: 0 }}><defs><linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#17856c" stopOpacity={0.16} /><stop offset="100%" stopColor="#17856c" stopOpacity={0.01} /></linearGradient><linearGradient id="reserveGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e7a75e" stopOpacity={0.12} /><stop offset="100%" stopColor="#e7a75e" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf0e9" strokeDasharray="3 5" /><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#929890', fontSize: 11 }} dy={10} /><YAxis tickLine={false} axisLine={false} tick={{ fill: '#929890', fontSize: 10 }} tickFormatter={(value: number) => `${value / 1000}k`} /><Tooltip formatter={(value) => fmt(Number(value))} contentStyle={{ border: '1px solid #e8ebe4', borderRadius: 6, fontSize: 12, fontFamily: 'DM Sans' }} /><Area type="monotone" dataKey="savings" stroke="#18866d" strokeWidth={2.3} fill="url(#savingsGradient)" />{sampleView && <Area type="monotone" dataKey="reserve" stroke="#e4a45b" strokeWidth={2} fill="url(#reserveGradient)" />}</AreaChart></ResponsiveContainer></div>}
              <div className="chart-foot"><span>{sampleView ? `Steady progress, ${displayName}.` : contributions.some((contribution) => contribution.status === 'VERIFIED') ? 'Only verified contribution records are included.' : 'No verified contributions to chart yet.'}</span><strong>{sampleView ? <><ArrowUpRight size={14} /> Your savings grew by KES 1,200 this month</> : `All-time verified: ${contributionError ? 'Unavailable' : contributionLoading ? '...' : fmt(allTimeVerified)}`}</strong></div>
            </section>

            <section className="panel contribution-panel">
              <div className="panel-heading"><div><div className="section-kicker">WEEKLY CONTRIBUTION</div><h2>{sampleView ? 'This week' : `Week ${period.week}`}</h2></div><span className={`status-pill ${sampleView || currentWeekPending || !currentWeekContributions.length ? 'status-due' : 'status-green'}`}><span /> {sampleView ? 'Due soon' : currentWeekStatus}</span></div>
              <div className="contribution-amount"><div><span>{sampleView ? 'Amount due' : 'Weekly amount'}</span><strong>{sampleView ? 'KES 1,000' : contributionError ? 'Unavailable' : contributionLoading ? 'Loading...' : fmt(weeklyContribution)}</strong></div><div className="amount-breakdown"><span>{sampleView ? 'Rotation' : 'Verified this week'}</span><b>{sampleView ? 'KES 800' : fmt(verifiedCurrentWeek)}</b></div></div>
              <div className="deadline-row"><Clock3 size={15} /><span>{sampleView ? <>Due today by <strong>7:00 pm EAT</strong></> : <>Current contribution period · <strong>{period.year}</strong></>}</span></div>
              <div className="week-progress"><div className="week-label"><span>{sampleView ? 'Week 38 of 2026' : `Week ${period.week} of ${period.year}`}</span><span>{sampleView ? '4 / 4 complete' : `${currentWeekContributions.length} payment${currentWeekContributions.length === 1 ? '' : 's'} recorded`}</span></div><div className="progress-track"><span style={{ width: sampleView ? '100%' : `${contributionProgress}%` }} /></div><div className="week-label"><span>{sampleView ? 'Reserve' : 'Verified amount'}</span><span>{sampleView ? 'KES 200' : `${fmt(verifiedCurrentWeek)} / ${fmt(weeklyContribution)}`}</span></div></div>
              {contributionError && <p className="auth-error" role="alert">Could not load contribution records: {contributionError}</p>}
              <button className="button button-pay" onClick={() => { setPaymentError(''); setModal('payment'); }}><Plus size={16} /> {sampleView ? 'Record this week’s payment' : 'Record a payment'}</button><p className="manual-note"><ShieldCheck size={13} /> {sampleView ? 'Payments are manually verified by your accountant' : 'Accountant manually matches your M-Pesa reference'}</p>
            </section>
          </div>

          <div className="lower-grid">
            <section className="panel transactions-panel"><div className="panel-heading"><div><div className="section-kicker">RECENT ACTIVITY</div><h2>Latest transactions</h2></div><button className="text-link" onClick={() => setPage('Activity')}>View all <ArrowUpRight size={14} /></button></div><div className="transaction-list">{memberTransactions.length ? memberTransactions.map((item) => <div className="transaction-row" key={`${item.name}-${item.detail}`}><div className={`transaction-avatar avatar-${item.tone}`}>{item.initials}</div><div className="transaction-description"><strong>{item.name}</strong><span>{item.detail}</span></div><div className="transaction-result"><strong className={item.status === 'Pending' ? '' : item.amount.startsWith('+') ? 'amount-in' : 'amount-out'}>{item.amount}</strong><span>{item.time}</span></div><span className={`table-status status-${item.tone}`}>{item.status}</span></div>) : <p className="operator-intro">{contributionError ? 'Contribution history is unavailable.' : contributionLoading ? 'Loading your contribution history...' : 'No contribution records yet. Record a payment to get started.'}</p>}</div><div className="privacy-foot"><ShieldCheck size={14} /> {sampleView ? 'Only you can see your personal transaction history' : 'Payment details are restricted to you and authorized circle finance admins'}</div></section>

            <div className="right-stack">{sampleView ? <>
              <section className="panel rotation-panel"><div className="panel-heading"><div><div className="section-kicker">UP NEXT</div><h2>Rotation schedule</h2></div><button className="icon-button small-icon" aria-label="Rotation details" onClick={() => setPage('Rotation')}><ArrowUpRight size={16} /></button></div><div className="next-payout"><div className="next-payout-icon"><ArrowUpRight size={17} /></div><div className="next-payout-copy"><span>Next payout · Week 39</span><strong>James Njoroge</strong></div><span className="payout-amount">KES 5,600</span></div><div className="rotation-foot"><span><Users size={14} /> 8 members</span><span><Check size={14} /> Order confirmed</span></div><button className="rotation-link" onClick={() => setPage('Rotation')}>See full schedule <ChevronRight size={14} /></button></section>
              <section className="vote-card"><div className="vote-topline"><span className="vote-icon"><Vote size={16} /></span><span className="vote-open">VOTE OPEN</span><span className="vote-deadline">Closes in 2 days</span></div><h2>Group reserve use</h2><p>Approve KES 8,000 for shared meeting space equipment.</p><div className="vote-stats"><span><Users size={14} /> 5 of 8 responded</span><span>Required: 5 votes</span></div><div className="vote-progress"><span style={{ width: '62.5%' }} /></div><div className="vote-actions"><button className={`vote-yes ${vote === 'yes' ? 'vote-selected' : ''}`} onClick={() => { setVote('yes'); flash('Your yes vote has been recorded in the demo.'); }}><Check size={15} /> Yes, approve</button><button className="vote-no" onClick={() => { setVote('no'); flash('Your no vote has been recorded in the demo.'); }}><X size={15} /> No</button></div></section>
            </> : <>
              <section className="panel rotation-panel"><div className="panel-heading"><div><div className="section-kicker">ROTATION PAYOUTS</div><h2>Not connected</h2></div><Landmark size={17} /></div><p className="operator-intro">This circle’s payout schedule hasn’t been connected yet. No payout date, recipient, or amount is shown as live data.</p></section>
              <section className="panel rotation-panel"><div className="panel-heading"><div><div className="section-kicker">VOTES & PROPOSALS</div><h2>Not connected</h2></div><Vote size={17} /></div><p className="operator-intro">Proposal records and voting aren’t connected yet, so there are no live proposals to display.</p></section>
            </>}</div>
          </div>

          <footer className="page-footer"><span>Pulse <b>·</b> Community finance, together.</span><span><ShieldCheck size={13} /> Your circle. Your information stays private.</span><button onClick={() => flash('Pulse privacy and security settings.')}>Privacy &amp; security</button></footer>
          </> : viewRole === 'ACCOUNTANT' ? <AccountantDashboard
            payments={accountantPayments}
            isPreview={sampleView}
            isReadOnly={previewRole !== null && !sampleView}
            isLoading={contributionLoading}
            error={contributionError}
            onReviewPayment={sampleView ? reviewDemoPayment : reviewContribution}
            onNotify={flash}
          /> : viewRole === 'CHAIRMAN' ? sampleView ? <ChairmanDashboard onNotify={flash} /> : <LiveChairmanDashboard circleId={circleId} /> : viewRole === 'SYSTEM_ADMIN' && page === 'Contributions' ? <AccountantDashboard
            payments={accountantPayments}
            isPreview={sampleView}
            isReadOnly={previewRole !== null && !sampleView}
            isLoading={contributionLoading}
            error={contributionError}
            onReviewPayment={sampleView ? reviewDemoPayment : reviewContribution}
            onNotify={flash}
          /> : <AdminDashboard
            circleName={sampleView ? 'Upendo Circle' : circleName}
            memberCount={circleMemberCount}
            isLoading={contributionLoading}
            error={contributionError}
            pendingCount={accountantPendingCount}
            verifiedCount={contributions.filter((contribution) => contribution.status === 'VERIFIED').length}
            verifiedTotal={verifiedContributionTotal}
            pendingTotal={pendingContributionTotal}
            rejectedCount={rejectedContributionCount}
            isPreview={sampleView}
            onInvite={() => role === 'SYSTEM_ADMIN' && !previewRole && !previewMode ? setModal('invite') : flash('Admin actions are unavailable in a role preview.')}
            onReviewQueue={() => setPage('Contributions')}
          />}
        </div>
      </main>

      {modal === 'invite' ? <InviteModal onClose={() => setModal(null)} onSend={sendInvite} /> : modal && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !contributionSubmitting) setModal(null); }}>
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="modal-heading">
              <span className="modal-icon">{modal === 'payment' ? <ArrowDownLeft size={19} /> : <HeartHandshake size={19} />}</span>
              <button className="icon-button" aria-label="Close dialog" onClick={() => setModal(null)} disabled={contributionSubmitting}><X size={19} /></button>
            </div>
            <div className="section-kicker">{modal === 'payment' ? `WEEKLY CONTRIBUTION · WEEK ${period.week}` : 'UPENDO CIRCLE · MEMBER LOAN'}</div>
            <h2 id="modal-title">{modal === 'payment' ? 'Record a payment' : 'Request a loan'}</h2>
            <p className="modal-description">{modal === 'payment'
              ? 'Record a payment you have already made. Your accountant will manually match the details before it is marked verified.'
              : 'Your self-guaranteed borrowing limit is KES 12,400. Final eligibility is confirmed during review.'}</p>
            <form onSubmit={modal === 'payment' ? submitPayment : submitLoan}>
              {modal === 'payment' ? <>
                <label className="form-label" htmlFor="payment-amount">Amount paid</label>
                <div className="input-with-prefix"><span>KES</span><input id="payment-amount" type="number" min="0.01" step="0.01" defaultValue={sampleView ? 1000 : weeklyContribution || ''} required /></div>
                <label className="form-label" htmlFor="payment-code">M-Pesa transaction code</label>
                <input className="form-input" id="payment-code" value={paymentCode} onChange={(event) => setPaymentCode(event.target.value.toUpperCase())} placeholder="e.g. QJK4M8P2XA" maxLength={32} required />
                <label className="form-label" htmlFor="payment-sender">Sender phone number</label>
                <input className="form-input" id="payment-sender" type="tel" placeholder="+254 7XX XXX XXX" maxLength={32} required />
                <div className="form-safe-note"><ShieldCheck size={15} /> Payment details are visible only to you and authorized circle finance admins.</div>
                {paymentError && <p className="auth-error" role="alert">{paymentError}</p>}
              </> : <>
                <label className="form-label" htmlFor="loan-amount">Amount requested</label>
                <div className="input-with-prefix"><span>KES</span><input id="loan-amount" type="number" min="500" max="12400" step="100" value={loanAmount} onChange={(event) => setLoanAmount(event.target.value)} placeholder="e.g. 5,000" required /></div>
                <label className="form-label" htmlFor="loan-purpose">Purpose</label>
                <select id="loan-purpose" className="form-input" defaultValue=""><option value="" disabled>Select a purpose</option><option>Education</option><option>Medical</option><option>Business</option><option>Home & family</option><option>Other</option></select>
                <div className="loan-term-box"><span>Standard terms</span><strong>10% flat interest · 14 days + 7-day grace</strong></div>
              </>}
              <div className="modal-actions">
                <button type="button" className="button button-quiet" onClick={() => setModal(null)} disabled={contributionSubmitting}>Cancel</button>
                <button className="button button-primary" type="submit" disabled={modal === 'payment' && contributionSubmitting}>
                  {modal === 'payment' && contributionSubmitting ? 'Submitting...' : modal === 'payment' ? 'Submit for review' : 'Continue request'} <ChevronRight size={16} />
                </button>
              </div>
              <p className="demo-disclaimer">{modal === 'payment' && !sampleView
                ? 'This records a manual payment claim; it does not charge or transfer money.'
                : 'Demo only. No real money or transactions are processed.'}</p>
            </form>
          </section>
        </div>
      )}

      {notice && <div className="toast" role="status"><BadgeCheck size={17} />{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={15} /></button></div>}
    </div>
  );
}

function LoginScreen({ onEnterDemo }: { onEnterDemo: () => void }) {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  function friendlyAuthError(message: string, status?: number) {
    if (status === 429 || /rate limit|too many|security purposes/i.test(message)) {
      return 'Too many emails requested. Wait a few minutes before asking for another code.';
    }
    if (/email address not authorized|recipient.*not authorized/i.test(message)) {
      return 'Supabase is not allowed to email this address yet. Configure custom SMTP in your Supabase project, or test with an address on the project team.';
    }
    if (/error sending (the )?(magic link|email)|failed to send.*email/i.test(message)) {
      return 'Supabase could not deliver the email. Configure custom SMTP in Authentication → SMTP Settings. The default sender is limited to project-team addresses and 2 emails per hour.';
    }
    if (/expired|invalid/i.test(message)) {
      return 'That code is invalid or has expired. Request a new one.';
    }
    return message;
  }

  async function requestCode(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (submitting || cooldown > 0) return;
    if (!supabase) {
      setError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables, or explore in demo mode below.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address to continue.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const { error: requestError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: window.location.origin,
        },
      });
      if (requestError) {
        setError(friendlyAuthError(requestError.message, requestError.status));
        return;
      }
      setCooldown(60);
      setStep('otp');
    } catch (requestError) {
      setError(requestError instanceof Error
        ? `Could not reach Supabase Auth: ${requestError.message}`
        : 'Could not reach Supabase Auth. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables, or explore in demo mode below.');
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit verification code.');
      return;
    }
    setError('');
    setSubmitting(true);
    const { error: verificationError } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: otp,
      type: 'email',
    });
    setSubmitting(false);
    if (verificationError) setError(friendlyAuthError(verificationError.message, verificationError.status));
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand"><span className="brand-mark"><Activity size={21} strokeWidth={2.7} /></span><span className="brand-name">pulse<span>.</span></span></div>
        <div className="auth-kicker">UPENDO CIRCLE</div>
        {step === 'email' ? <>
          <h1 id="auth-title">Welcome back</h1>
          <p className="auth-copy">Sign in with the email address your invitation was sent to. We'll email you a secure sign-in link and code. No password needed.</p>
          <form className="auth-form" onSubmit={requestCode}>
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" autoFocus />
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="button button-primary auth-submit" type="submit" disabled={submitting}>            {submitting ? 'Sending code...' : <>Email me a sign-in code <ChevronRight size={16} /></>}</button>
          </form>
          <div style={{ marginTop: '14px' }}>
            <button type="button" className="button button-quiet" style={{ width: '100%' }} onClick={onEnterDemo}>
              Explore demo mode without signing in
            </button>
          </div>
          <p className="auth-note"><ShieldCheck size={14} /> Invited by your circle admin? Use the same email. Not invited yet? Ask your admin to add you.</p>
        </> : <>
          <button className="auth-back" type="button" onClick={() => { setStep('email'); setError(''); }}><ArrowDownLeft size={15} /> Change email</button>
          <h1 id="auth-title">Enter your code</h1>
          <p className="auth-copy">We sent a sign-in link and a 6-digit verification code to <strong>{email}</strong>. You can use either.</p>
          <form className="auth-form" onSubmit={verifyCode}>
            <label htmlFor="otp">Verification code</label>
            <input id="otp" className="otp-input" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))} placeholder="000000" autoComplete="one-time-code" autoFocus />
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="button button-primary auth-submit" type="submit" disabled={submitting}>{submitting ? 'Verifying...' : <>Sign in <ChevronRight size={16} /></>}</button>
          </form>
          <p className="auth-note">
            Your verification code is sent by Supabase Auth.{' '}
            <button className="operator-text-button" type="button" disabled={submitting || cooldown > 0} onClick={() => void requestCode()}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
          </p>
        </>}
      </section>
    </main>
  );
}

function CompleteProfile({ userId, email, initialName, onSaved, onSignOut }: {
  userId: string;
  email: string;
  initialName: string;
  onSaved: (name: string, phone: string) => void;
  onSignOut: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanPhone = phone.replace(/[\s-]/g, '');
    if (cleanName.length < 2) { setError('Enter your full name.'); return; }
    if (!/^\+?\d{9,15}$/.test(cleanPhone)) { setError('Enter a valid phone number, e.g. +254 7XX XXX XXX.'); return; }
    if (!supabase) { setError('Supabase is not configured.'); return; }
    setError('');
    setSaving(true);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ full_name: cleanName, phone: cleanPhone })
      .eq('id', userId);
    setSaving(false);
    if (updateError) { setError(updateError.message); return; }
    onSaved(cleanName, cleanPhone);
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="profile-title">
        <div className="auth-brand"><span className="brand-mark"><Activity size={21} strokeWidth={2.7} /></span><span className="brand-name">pulse<span>.</span></span></div>
        <div className="auth-kicker">WELCOME TO UPENDO CIRCLE</div>
        <h1 id="profile-title">Complete your profile</h1>
        <p className="auth-copy">Confirm your details so your circle can recognise you on the dashboard.</p>
        <form className="auth-form" onSubmit={save}>
          <label htmlFor="profile-name">Full name</label>
          <input id="profile-name" type="text" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" autoFocus required />
          <label htmlFor="profile-email">Email address</label>
          <input id="profile-email" type="email" value={email} readOnly disabled />
          <label htmlFor="profile-phone">Phone number</label>
          <input id="profile-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+254 7XX XXX XXX" autoComplete="tel" required />
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="button button-primary auth-submit" type="submit" disabled={saving}>{saving ? 'Saving...' : <>Continue to dashboard <ChevronRight size={16} /></>}</button>
        </form>
        <p className="auth-note"><ShieldCheck size={14} /> Visible only to members of your circle. <button className="operator-text-button" type="button" onClick={onSignOut}>Sign out</button></p>
      </section>
    </main>
  );
}

function AccountantDashboard({ payments, isPreview, isReadOnly, isLoading, error, onReviewPayment, onNotify }: {
  payments: DemoPayment[];
  isPreview: boolean;
  isReadOnly: boolean;
  isLoading: boolean;
  error: string;
  onReviewPayment: (id: string, status: Exclude<DemoPaymentStatus, 'PENDING'>, reason?: string) => void | Promise<void>;
  onNotify: (message: string) => void;
}) {
  const [reviewed, setReviewed] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState<string | null>(null);
  const submittedPayments = payments.map((payment) => ({
    id: payment.id,
    member: payment.member,
    type: `Weekly contribution · Week ${payment.weekNumber}${payment.yearNumber ? ` · ${payment.yearNumber}` : ''}`,
    reference: payment.reference || 'Payment reference unavailable',
    phone: payment.phone,
    amount: payment.amount,
    date: new Date(payment.createdAt).toLocaleString(),
    icon: CreditCard,
    reviewStatus: payment.status === 'VERIFIED' ? 'Approved' : payment.status === 'REJECTED' ? 'Rejected' : undefined,
  }));
  const samplePayments = isPreview ? [
    { id: 'MP-038-AM', member: 'Amina Mwangi', type: 'Weekly contribution · Week 38', reference: 'QJK4M8P2XA', phone: '+254 712 345 678', amount: 1000, date: 'Today, 10:42 am', icon: CreditCard },
    { id: 'LN-014-DO', member: 'David Otieno', type: 'Loan disbursement · 14-day term', reference: 'Loan request #014', phone: '', amount: 8000, date: 'Today, 9:18 am', icon: HandCoins },
    { id: 'RT-006-JN', member: 'James Njoroge', type: 'Rotation payout · Cycle 1', reference: 'Week 39 · Order confirmed', phone: '', amount: 5600, date: 'Yesterday, 3:18 pm', icon: RotateCcw },
  ].map((item) => ({ ...item, reviewStatus: undefined as string | undefined })) : [];
  const pending = [...submittedPayments, ...samplePayments];
  const pendingCount = pending.filter((item) => !reviewed[item.id] && !item.reviewStatus).length;
  const verifiedPayments = payments.filter((payment) => payment.status === 'VERIFIED');
  const rejectedPayments = payments.filter((payment) => payment.status === 'REJECTED');
  const verifiedTotal = verifiedPayments.reduce((total, payment) => total + payment.amount, 0);
  const pendingTotal = payments.filter((payment) => payment.status === 'PENDING').reduce((total, payment) => total + payment.amount, 0);
  const reconcilePercent = payments.length ? Math.round(verifiedPayments.length / payments.length * 100) : 0;

  async function decide(id: string, result: 'Approved' | 'Rejected') {
    if (isReadOnly) {
      onNotify('Role preview is read-only. Return to your own dashboard to review contributions.');
      return;
    }
    let rejectionReason: string | undefined;
    if (result === 'Rejected') {
      const reason = window.prompt('Enter a reason for rejecting this financial record:');
      if (!reason?.trim()) {
        onNotify('A recorded reason is required to reject a financial record.');
        return;
      }
      rejectionReason = reason.trim();
    }
    const payment = payments.find((item) => item.id === id);
    setReviewing(id);
    try {
      if (payment) await onReviewPayment(id, result === 'Approved' ? 'VERIFIED' : 'REJECTED', rejectionReason);
      else onNotify(`${id} ${result.toLowerCase()} in the demo.`);
    } catch (reviewError) {
      onNotify(reviewError instanceof Error ? `Could not review contribution: ${reviewError.message}` : 'Could not review contribution.');
      return;
    } finally {
      setReviewing(null);
    }
    setReviewed((current) => ({ ...current, [id]: result }));
  }

  return <>
    {error && <section className="role-notice" role="alert"><CircleHelp size={17} /><span><strong>Contribution records could not be loaded</strong> · {error}</span></section>}
    <section className="metrics-grid operator-metrics" aria-label="Accountant summary">
      <OperatorMetric label="PENDING REVIEWS" value={isLoading ? '...' : error ? 'Unavailable' : String(pendingCount)} detail={isPreview ? 'Across demo workflows' : 'Contribution records'} icon={Clock3} tone="amber" />
      <OperatorMetric label="VERIFIED CONTRIBUTIONS" value={isLoading ? '...' : error ? 'Unavailable' : String(isPreview ? 24 : verifiedPayments.length)} detail="Stored records" icon={CheckCircle2} tone="green" />
      <OperatorMetric label="PENDING AMOUNT" value={isLoading ? '...' : error ? 'Unavailable' : fmt(isPreview ? 13600 : pendingTotal)} detail="Awaiting manual review" icon={HandCoins} tone="blue" />
      <OperatorMetric label="RECONCILIATION" value={error ? 'Unavailable' : isPreview ? 'On track' : pendingCount ? 'Needs review' : 'Up to date'} detail={isPreview ? 'Last checked today' : `${rejectedPayments.length} rejected records`} icon={ShieldCheck} tone="teal" />
    </section>
    <div className="operator-layout">
      <section className="panel operator-panel">
        <div className="panel-heading"><div><div className="section-kicker">ACTION REQUIRED</div><h2>{isPreview ? 'Financial approval queue' : 'Contribution review queue'}</h2></div><span className="status-pill status-due"><span /> {error ? 'Unavailable' : `${pendingCount} pending`}</span></div>
        <p className="operator-intro">Match each submitted M-Pesa reference and sender number against your records before approving or rejecting it.</p>
        <div className="approval-list">{isLoading ? <p className="operator-intro">Loading contribution records...</p> : error ? null : pending.length === 0 ? <p className="operator-intro">No contribution records yet. New member submissions will appear here.</p> : pending.map((item) => {
          const Icon = item.icon;
          const decision = reviewed[item.id] ?? item.reviewStatus;
          return <article className="approval-item" key={item.id}>
            <span className="approval-icon"><Icon size={17} /></span>
            <div className="approval-main"><div className="approval-title"><strong>{item.member}</strong><span>{item.type}</span></div><div className="approval-meta"><span>Ref: {item.reference}{item.phone ? ` · ${item.phone}` : ''}</span><span>{item.date}</span></div></div>
            <div className="approval-amount">{fmt(item.amount)}</div>
            {decision ? <span className={`table-status ${decision === 'Approved' ? 'status-green' : 'status-amber'}`}>{decision}</span> : <div className="approval-actions"><button className="approval-reject" onClick={() => void decide(item.id, 'Rejected')} disabled={isReadOnly || reviewing === item.id}>Reject</button><button className="approval-approve" onClick={() => void decide(item.id, 'Approved')} disabled={isReadOnly || reviewing === item.id}>{isReadOnly ? 'Preview only' : reviewing === item.id ? 'Saving...' : <><Check size={13} /> Approve</>}</button></div>}
          </article>;
        })}</div>
      </section>
      <section className="panel operator-side-panel"><div className="section-kicker">RECONCILIATION</div><h2>Contribution totals</h2><div className="reconcile-total"><span>Verified contributions</span><strong>{error ? 'Unavailable' : <>{verifiedPayments.length} <small>/ {payments.length}</small></>}</strong></div><div className="progress-track reconcile-progress"><span style={{ width: `${error ? 0 : isPreview ? 86 : reconcilePercent}%` }} /></div><div className="reconcile-row"><span>Verified</span><strong>{error ? 'Unavailable' : fmt(isPreview ? 18000 : verifiedTotal)}</strong></div><div className="reconcile-row"><span>Pending review</span><strong>{error ? 'Unavailable' : fmt(isPreview ? 3000 : pendingTotal)}</strong></div><div className="reconcile-row"><span>Rejected</span><strong>{error ? 'Unavailable' : isPreview ? 'KES 0' : String(rejectedPayments.length)}</strong></div><div className="operator-guardrail"><ShieldCheck size={16} /><span>Contribution submissions and every review decision are written to the audit log.</span></div><button className="operator-text-button" onClick={() => onNotify(isPreview ? 'Demo audit history is not connected.' : 'Audit events are recorded; a history screen is not available yet.')}>Audit history <ChevronRight size={14} /></button></section>
    </div>
    <section className="panel operator-panel recent-approvals"><div className="panel-heading"><div><div className="section-kicker">RECENTLY COMPLETED</div><h2>Approval history</h2></div><button className="text-link" onClick={() => onNotify(isPreview ? 'Full approval history opened in demo mode.' : 'A full approval-history page is not available yet.')}>View history <ArrowUpRight size={14} /></button></div>{isPreview ? <><div className="history-row"><span className="history-check"><Check size={13} /></span><span><strong>Grace Wanjiku</strong><small>Weekly contribution · Week 38</small></span><strong>{fmt(1000)}</strong><span className="table-status status-green">Verified</span><small>Yesterday, 11:24 am</small></div><div className="history-row"><span className="history-check"><Check size={13} /></span><span><strong>David Otieno</strong><small>Loan repayment · Principal</small></span><strong>{fmt(800)}</strong><span className="table-status status-green">Verified</span><small>Mon, Sep 21</small></div></> : payments.filter((payment) => payment.status !== 'PENDING').slice(0, 3).map((payment) => <div className="history-row" key={payment.id}><span className="history-check"><Check size={13} /></span><span><strong>{payment.member}</strong><small>Weekly contribution · Week {payment.weekNumber} · {payment.yearNumber}</small></span><strong>{fmt(payment.amount)}</strong><span className={`table-status ${payment.status === 'VERIFIED' ? 'status-green' : 'status-amber'}`}>{payment.status === 'VERIFIED' ? 'Verified' : 'Rejected'}</span><small>{new Date(payment.createdAt).toLocaleDateString()}</small></div>)}</section>
  </>;
}

type ChairmanComplaint = {
  id: string;
  subject: string;
  description: string;
  status: 'OPEN' | 'UNDER_INVESTIGATION';
  created_at: string;
};

type ChairmanProposal = {
  id: string;
  title: string;
  closes_at: string;
};

function LiveChairmanDashboard({ circleId }: { circleId: string | null }) {
  const [complaints, setComplaints] = useState<ChairmanComplaint[]>([]);
  const [proposals, setProposals] = useState<ChairmanProposal[]>([]);
  const [complaintCount, setComplaintCount] = useState<number | null>(null);
  const [proposalCount, setProposalCount] = useState<number | null>(null);
  const [voteCount, setVoteCount] = useState<number | null>(null);
  const [complaintError, setComplaintError] = useState('');
  const [proposalError, setProposalError] = useState('');
  const [voteError, setVoteError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let current = true;
    setComplaints([]);
    setProposals([]);
    setComplaintCount(null);
    setProposalCount(null);
    setVoteCount(null);
    setComplaintError('');
    setProposalError('');
    setVoteError('');
    setLoading(true);
    if (!circleId || !supabase) {
      setComplaintError('Circle records are unavailable.');
      setProposalError('Circle records are unavailable.');
      setVoteError('Circle records are unavailable.');
      setLoading(false);
      return () => { current = false; };
    }

    void (async () => {
      try {
        const [complaintResult, proposalResult, voteResult] = await Promise.all([
          supabase.from('complaints')
            .select('id, subject, description, status, created_at', { count: 'exact' })
            .eq('circle_id', circleId)
            .in('status', ['OPEN', 'UNDER_INVESTIGATION'])
            .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(10),
          supabase.from('proposals')
            .select('id, title, closes_at', { count: 'exact' })
            .eq('circle_id', circleId).eq('status', 'OPEN')
            .order('closes_at', { ascending: true }).order('id', { ascending: true }).limit(10),
          supabase.from('proposal_votes')
            .select('proposal_id, proposals!inner(circle_id, status)', { count: 'exact', head: true })
            .eq('proposals.circle_id', circleId).eq('proposals.status', 'OPEN'),
        ]);
        if (!current) return;
        if (complaintResult.error || complaintResult.count === null) {
          setComplaintError(complaintResult.error?.message ?? 'Could not count complaints.');
        } else {
          setComplaintCount(complaintResult.count);
          setComplaints(complaintResult.data ?? []);
        }
        if (proposalResult.error || proposalResult.count === null) {
          setProposalError(proposalResult.error?.message ?? 'Could not count proposals.');
        } else {
          setProposalCount(proposalResult.count);
          setProposals(proposalResult.data ?? []);
        }
        if (voteResult.error || voteResult.count === null) {
          setVoteError(voteResult.error?.message ?? 'Could not count proposal responses.');
        } else {
          setVoteCount(voteResult.count);
        }
      } catch (error) {
        if (!current) return;
        const message = error instanceof Error ? error.message : 'Could not load governance records.';
        setComplaintError(message);
        setProposalError(message);
        setVoteError(message);
      } finally {
        if (current) setLoading(false);
      }
    })();

    return () => { current = false; };
  }, [circleId]);

  const figure = (count: number | null, error: string) => error ? 'Unavailable' : loading ? '...' : count === null ? 'Unavailable' : String(count);
  const date = (value: string) => new Date(value).toLocaleDateString('en-KE', {
    timeZone: 'Africa/Nairobi', day: 'numeric', month: 'short', year: 'numeric',
  });

  return <>
    <section className="metrics-grid operator-metrics" aria-label="Chairman summary">
      <OperatorMetric label="OPEN COMPLAINTS" value={figure(complaintCount, complaintError)} detail="Open or under investigation" icon={MessageSquareText} tone="amber" />
      <OperatorMetric label="OPEN PROPOSALS" value={figure(proposalCount, proposalError)} detail="Records marked open" icon={Vote} tone="blue" />
      <OperatorMetric label="VOTES RECORDED" value={figure(voteCount, voteError)} detail="Across open proposals" icon={Users} tone="green" />
      <OperatorMetric label="YOUR AUTHORITY" value="Governance" detail="No financial approvals" icon={Gavel} tone="teal" />
    </section>
    <div className="operator-layout chairman-layout">
      <section id="chairman-complaints" className="panel operator-panel complaint-panel">
        <div className="panel-heading"><div><div className="section-kicker">MEMBER SUPPORT</div><h2>Open complaints</h2></div></div>
        {loading ? <p className="operator-intro">Loading complaints...</p> : complaintError ? <p className="operator-intro" role="alert">Could not load complaints: {complaintError}</p> : complaintCount === 0 ? <p className="operator-intro">No open complaints recorded.</p> : <>
          {complaints.map((complaint) => <div className="complaint-body" key={complaint.id}>
            <strong>{complaint.subject}</strong>
            <p>{complaint.description}</p>
            <small>{complaint.status === 'OPEN' ? 'Open' : 'Under investigation'} · Submitted {date(complaint.created_at)}</small>
          </div>)}
          {complaintCount !== null && complaintCount > complaints.length && <p className="operator-intro">Showing the latest {complaints.length} of {complaintCount} open complaints.</p>}
        </>}
      </section>
      <section className="panel operator-side-panel"><div className="section-kicker">ROLE BOUNDARIES</div><h2>Governance, not finance</h2><p className="operator-intro chairman-copy">These records are read-only. Complaint handling, recommendations, and voting actions are not connected in this workspace yet.</p><div className="authority-row authority-restricted"><X size={15} /><span>Chairmen cannot approve payments or payouts</span></div></section>
    </div>
    <section id="chairman-proposals" className="panel operator-panel recent-approvals">
      <div className="panel-heading"><div><div className="section-kicker">GROUP GOVERNANCE</div><h2>Open proposals</h2></div></div>
      {loading ? <p className="operator-intro">Loading proposals...</p> : proposalError ? <p className="operator-intro" role="alert">Could not load proposals: {proposalError}</p> : proposalCount === 0 ? <p className="operator-intro">No open proposals recorded.</p> : <>
        {proposals.map((proposal) => <div className="proposal-row" key={proposal.id}><span className="proposal-icon"><Vote size={16} /></span><span><strong>{proposal.title}</strong><small>Closing date: {date(proposal.closes_at)}</small></span><span className="status-pill status-due"><span /> Open</span></div>)}
        {proposalCount !== null && proposalCount > proposals.length && <p className="operator-intro">Showing {proposals.length} of {proposalCount} open proposals.</p>}
      </>}
      {voteError && <p className="operator-intro" role="alert">Could not load vote count: {voteError}</p>}
    </section>
  </>;
}

function ChairmanDashboard({ onNotify }: { onNotify: (message: string) => void }) {
  const [complaintStatus, setComplaintStatus] = useState('Under investigation');
  const [recommendationSent, setRecommendationSent] = useState(false);
  return <>
    <section className="metrics-grid operator-metrics" aria-label="Chairman summary">
      <OperatorMetric label="OPEN COMPLAINTS" value={complaintStatus === 'Resolved' ? '0' : '1'} detail="1 requires follow-up" icon={MessageSquareText} tone="amber" />
      <OperatorMetric label="ACTIVE PROPOSALS" value="2" detail="Member votes in progress" icon={Vote} tone="blue" />
      <OperatorMetric label="MEMBER RESPONSES" value="7 / 8" detail="Across open proposals" icon={Users} tone="green" />
      <OperatorMetric label="YOUR AUTHORITY" value="Governance" detail="No financial approvals" icon={Gavel} tone="teal" />
    </section>
    <div className="operator-layout chairman-layout">
      <section className="panel operator-panel complaint-panel"><div className="panel-heading"><div><div className="section-kicker">MEMBER SUPPORT</div><h2>Complaint review</h2></div><span className="status-pill status-due"><span /> {complaintStatus}</span></div><div className="complaint-subject"><span className="complaint-avatar">DO</span><span><strong>Contribution record query</strong><small>Raised by David Otieno · 23 Sep 2026</small></span><span className="complaint-ref">CMP-008</span></div><div className="complaint-body"><div className="section-kicker">MEMBER’S MESSAGE</div><p>“I think my Week 37 contribution has not appeared in my history. I sent it before the deadline and would appreciate a review.”</p></div><div className="complaint-context"><span><CreditCard size={14} /> Related record: Week 37 contribution</span><span><Clock3 size={14} /> Response requested by 27 Sep</span></div><div className="complaint-actions"><button className="button button-quiet" onClick={() => { setComplaintStatus('Under investigation'); onNotify('Complaint set to Under investigation.'); }}><Clock3 size={14} /> Investigating</button><button className="button button-primary" onClick={() => { setRecommendationSent(true); onNotify('Recommendation sent to the accountant for financial review.'); }}><MessageSquareText size={14} /> Send recommendation</button></div>{recommendationSent && <div className="recommendation-note"><CheckCircle2 size={15} /> Recommendation sent. The accountant retains authority over payment verification.</div>}</section>
      <section className="panel operator-side-panel"><div className="section-kicker">ROLE BOUNDARIES</div><h2>Governance, not finance</h2><p className="operator-intro chairman-copy">Help members resolve complaints and participate in circle governance. Financial decisions remain with the Accountant and System Admin.</p><div className="authority-row"><CheckCircle2 size={15} /><span>Investigate and track complaints</span></div><div className="authority-row"><CheckCircle2 size={15} /><span>Submit recommendations for review</span></div><div className="authority-row"><CheckCircle2 size={15} /><span>Monitor votes and proposal deadlines</span></div><div className="authority-row authority-restricted"><X size={15} /><span>Cannot approve payments or payouts</span></div><button className="operator-text-button" onClick={() => onNotify('Chairman governance guide opened in demo mode.')}>View governance guide <ChevronRight size={14} /></button></section>
    </div>
    <section className="panel operator-panel recent-approvals"><div className="panel-heading"><div><div className="section-kicker">GROUP GOVERNANCE</div><h2>Open proposals</h2></div><button className="text-link" onClick={() => onNotify('Showing all circle proposals.')}>View proposals <ArrowUpRight size={14} /></button></div><div className="proposal-row"><span className="proposal-icon"><Landmark size={16} /></span><span><strong>Shared meeting space equipment</strong><small>Reserve use · Closes 27 Sep</small></span><span className="proposal-votes">5 of 8 responded</span><span className="proposal-progress"><i style={{ width: '62.5%' }} /></span><span className="status-pill status-due"><span /> Voting</span></div><div className="proposal-row"><span className="proposal-icon proposal-icon-blue"><Coins size={16} /></span><span><strong>Annual contribution review</strong><small>Rules proposal · Closes 30 Sep</small></span><span className="proposal-votes">2 of 8 responded</span><span className="proposal-progress"><i style={{ width: '25%' }} /></span><span className="status-pill status-due"><span /> Voting</span></div></section>
  </>;
}

function InviteModal({ onClose, onSend }: {
  onClose: () => void;
  onSend: (email: string, fullName: string, role: Role) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Role>('MEMBER');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSending(true);
    try {
      await onSend(email, fullName, role);
      setSent(true);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'The invitation could not be sent. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !sending) onClose(); }}>
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="invite-title">
        <div className="modal-heading">
          <span className="modal-icon"><Users size={19} /></span>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose} disabled={sending}><X size={19} /></button>
        </div>
        <div className="section-kicker">UPENDO CIRCLE · MEMBER ACCESS</div>
        <h2 id="invite-title">Invite a member</h2>
        <p className="modal-description">Choose the role they should have. Their invitation email will link their account to Upendo Circle with that role.</p>
        <form onSubmit={submit}>
          <label className="form-label" htmlFor="invite-name">Full name (optional)</label>
          <input className="form-input" id="invite-name" value={fullName} onChange={(event) => { setFullName(event.target.value); setSent(false); }} placeholder="Member's name" autoComplete="name" />
          <label className="form-label" htmlFor="invite-email">Email address</label>
          <input className="form-input" id="invite-email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setSent(false); }} placeholder="member@example.com" autoComplete="email" required />
          <label className="form-label" htmlFor="invite-role">Assign role</label>
          <select className="form-input" id="invite-role" value={role} onChange={(event) => { setRole(event.target.value as Role); setSent(false); }}>
            <option value="MEMBER">Member</option>
            <option value="ACCOUNTANT">Accountant</option>
            <option value="CHAIRMAN">Chairman</option>
            <option value="SYSTEM_ADMIN">System Admin</option>
          </select>
          {error && <p className="auth-error" role="alert">{error}</p>}
          {sent && <p className="form-safe-note" role="status"><CheckCircle2 size={15} /> Invitation link sent to {email.trim().toLowerCase()} as {role.replace('_', ' ')}.</p>}
          <div className="modal-actions">
            <button type="button" className="button button-quiet" onClick={onClose} disabled={sending}>Close</button>
            <button className="button button-primary" type="submit" disabled={sending || sent}>
              {sending ? 'Sending invitation...' : sent ? 'Invitation sent' : <>Send invite link <ChevronRight size={16} /></>}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AdminDashboard({
  circleName,
  memberCount,
  isLoading,
  error,
  pendingCount,
  verifiedCount,
  verifiedTotal,
  pendingTotal,
  rejectedCount,
  isPreview,
  onInvite,
  onReviewQueue,
}: {
  circleName: string;
  memberCount: number;
  isLoading: boolean;
  error: string;
  pendingCount: number;
  verifiedCount: number;
  verifiedTotal: number;
  pendingTotal: number;
  rejectedCount: number;
  isPreview: boolean;
  onInvite: () => void;
  onReviewQueue: () => void;
}) {
  return <>
    {error && <section className="role-notice" role="alert"><CircleHelp size={17} /><span><strong>Circle data could not be loaded</strong> · {error}</span></section>}
    <section className="metrics-grid operator-metrics" aria-label="System admin summary">
      <OperatorMetric label="CIRCLE MEMBERS" value={isPreview ? 'Preview' : isLoading ? '...' : error ? 'Unavailable' : String(memberCount)} detail={isPreview ? 'Demo preview only' : 'Live membership records'} icon={Users} tone="blue" />
      <OperatorMetric label="VERIFIED CONTRIBUTIONS" value={isPreview ? 'Preview' : isLoading ? '...' : error ? 'Unavailable' : fmt(verifiedTotal)} detail={isPreview ? 'Demo preview only' : `${verifiedCount} verified records`} icon={Coins} tone="green" />
      <OperatorMetric label="PENDING CONTRIBUTIONS" value={isPreview ? 'Preview' : isLoading ? '...' : error ? 'Unavailable' : String(pendingCount)} detail={isPreview ? 'Demo preview only' : error ? 'Live queue unavailable' : `${fmt(pendingTotal)} awaiting review`} icon={Clock3} tone="amber" />
      <OperatorMetric label="REJECTED CONTRIBUTIONS" value={isPreview ? 'Preview' : isLoading ? '...' : error ? 'Unavailable' : String(rejectedCount)} detail={isPreview ? 'Demo preview only' : 'Live review records'} icon={FileClock} tone="teal" />
    </section>
    <div className="admin-action-row"><div><div className="section-kicker">CIRCLE ADMINISTRATION</div><strong>{circleName}</strong></div><div><button className="button button-quiet" onClick={onReviewQueue}><CreditCard size={15} /> Review contributions</button>{!isPreview && <button className="button button-primary" onClick={onInvite}><Plus size={15} /> Invite member</button>}</div></div>
    <div className="operator-layout admin-layout">
      <section className="panel operator-panel"><div className="panel-heading"><div><div className="section-kicker">{isPreview ? 'DEMO PREVIEW' : 'LIVE CIRCLE DATA'}</div><h2>Contribution overview</h2></div><span className={`status-pill ${!isPreview && pendingCount ? 'status-due' : 'status-green'}`}><span /> {isPreview ? 'Preview only' : isLoading ? 'Loading' : error ? 'Unavailable' : `${pendingCount} pending`}</span></div><p className="operator-intro">{isPreview ? 'Demo contribution figures are intentionally hidden. Return to your real System Admin dashboard to view stored circle data.' : 'Verified and pending totals are calculated from this circle’s stored contribution records. Submitted amounts are member-reported and are not confirmed by an automatic M-Pesa integration.'}</p><div className="reconcile-row"><span>Circle members</span><strong>{isPreview ? 'Preview only' : isLoading ? '...' : error ? 'Unavailable' : memberCount}</strong></div><div className="reconcile-row"><span>Verified contribution records</span><strong>{isPreview ? 'Preview only' : isLoading ? '...' : error ? 'Unavailable' : `${verifiedCount} · ${fmt(verifiedTotal)}`}</strong></div><div className="reconcile-row"><span>Awaiting accountant review</span><strong>{isPreview ? 'Preview only' : isLoading ? '...' : error ? 'Unavailable' : `${pendingCount} · ${fmt(pendingTotal)}`}</strong></div><div className="reconcile-row"><span>Rejected records</span><strong>{isPreview ? 'Preview only' : isLoading ? '...' : error ? 'Unavailable' : rejectedCount}</strong></div><div className="operator-guardrail"><ShieldCheck size={16} /><span>Members, accountants, and system admins see only the circle records allowed by their account role.</span></div><button className="operator-text-button" onClick={onReviewQueue}>Open contribution queue <ChevronRight size={14} /></button></section>
      <section className="panel operator-side-panel"><div className="section-kicker">CONNECTED WORKFLOWS</div><h2>{isPreview ? 'Preview is not live' : 'What’s live today'}</h2><div className="authority-row"><CheckCircle2 size={15} /><span>Circle membership and invited roles</span></div><div className="authority-row"><CheckCircle2 size={15} /><span>Contribution submissions and reviews</span></div><div className="authority-row authority-restricted"><Clock3 size={15} /><span>Payment processing, loans, payouts, platform-wide network monitoring, and scheduled jobs are not connected.</span></div>{!isPreview && <button className="operator-text-button" onClick={onInvite}><Users size={14} /> Manage circle invitations <ChevronRight size={14} /></button>}</section>
    </div>
  </>;
}

function OperatorMetric({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: typeof Home; tone: 'green' | 'blue' | 'amber' | 'teal' }) {
  return <article className="metric-card operator-metric"><div className="metric-heading"><span>{label}</span><span className={`metric-icon ${tone}-icon`}><Icon size={16} /></span></div><div className={`metric-value operator-metric-value ${value === 'Operational' || value === 'On track' || value === 'Governance' ? 'metric-word' : ''}`}>{value}</div><div className="metric-foot"><span className={`foot-dot ${tone}-dot`} />{detail}</div></article>;
}

function ArrowRightIcon() {
  return <ChevronRight size={14} />;
}

export default App;
