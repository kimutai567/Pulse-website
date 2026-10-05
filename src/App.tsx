import { useEffect, useState } from 'react';
import {
  Activity, ArrowDownLeft, ArrowUpRight, BadgeCheck, Bell, CalendarDays,
  ChartNoAxesColumnIncreasing, Check, CheckCircle2, ChevronDown, ChevronRight,
  CircleHelp, Clock3, Coins, CreditCard, FileClock, Gavel,
  HandCoins, HeartHandshake, Home, Landmark, LogOut, Menu, MessageSquareText,
  MoreHorizontal, Plus, RotateCcw, Settings, ShieldCheck, Users,
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
  createdAt: string;
  status: DemoPaymentStatus;
  rejectionReason?: string;
};

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

function App() {
  const previewMode = import.meta.env.DEV && (
    new URLSearchParams(window.location.search).get('preview') === '1'
  );
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileName, setProfileName] = useState('');
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
  const [membership, setMembership] = useState<'loading' | 'none' | 'active'>('loading');
  const [membershipError, setMembershipError] = useState('');
  const [circleId, setCircleId] = useState<string | null>(null);
  const viewRole = previewMode ? role : previewRole ?? role;
  const canPreviewRoles = previewMode || (!previewMode && role === 'SYSTEM_ADMIN');

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
      return;
    }

    let current = true;
    const metadataName = user.user_metadata.full_name;
    const fallbackName = typeof metadataName === 'string' && metadataName.trim()
      ? metadataName.trim()
      : user.email?.split('@')[0] || 'Pulse member';
    setProfileName(fallbackName);

    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (current && data?.full_name?.trim()) setProfileName(data.full_name.trim());
      });

    return () => {
      current = false;
    };
  }, [user]);

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3400);
  }

  function submitPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(event.currentTarget.querySelector<HTMLInputElement>('#payment-amount')?.value);
    const phone = event.currentTarget.querySelector<HTMLInputElement>('#payment-sender')?.value.trim() ?? '';
    if (!paymentCode.trim() || !Number.isFinite(amount) || amount <= 0 || !phone) return;

    const member = profileName || user?.email?.split('@')[0] || 'Preview member';
    setDemoPayments((current) => [{
      id: `DEMO-${crypto.randomUUID()}`,
      memberId: user?.id ?? 'preview-user',
      member,
      amount,
      reference: paymentCode.trim(),
      phone,
      weekNumber: 38,
      createdAt: new Date().toISOString(),
      status: 'PENDING',
    }, ...current]);
    setModal(null);
    setPaymentCode('');
    flash('Demo payment submitted to the accountant review queue.');
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

  if (authLoading) {
    return <main className="auth-shell"><section className="auth-card"><div className="auth-brand"><span className="brand-mark"><Activity size={21} strokeWidth={2.7} /></span><span className="brand-name">pulse<span>.</span></span></div><p className="auth-copy">Checking your secure session...</p></section></main>;
  }

  if (!user && !previewMode) {
    return <LoginScreen />;
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

  const displayName = profileName || user?.email?.split('@')[0] || 'Preview member';
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const memberTransactions = [
    ...demoPayments
      .filter((payment) => payment.memberId === (user?.id ?? 'preview-user'))
      .map((payment) => ({
        initials,
        name: payment.member,
        detail: `Weekly contribution · Week ${payment.weekNumber}`,
        amount: `${payment.status === 'VERIFIED' ? '+ ' : ''}${fmt(payment.amount)}`,
        time: new Date(payment.createdAt).toLocaleString(),
        status: payment.status === 'VERIFIED' ? 'Verified' : payment.status === 'REJECTED' ? 'Rejected' : 'Pending',
        tone: payment.status === 'VERIFIED' ? 'green' : 'amber',
      })),
    ...transactions,
  ];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#overview" onClick={() => setPage('Overview')} aria-label="Pulse home">
          <span className="brand-mark"><Activity size={21} strokeWidth={2.7} /></span>
          <span className="brand-name">pulse<span>.</span></span>
        </a>

        <button className="container-select" onClick={() => flash('Upendo Circle workspace selected.')}>
          <span className="container-avatar">U</span>
          <span className="container-copy"><strong>Upendo Circle</strong><small>Community · 8 members</small></span>
          <ChevronDown size={15} className="muted-icon" />
        </button>

        <div className="nav-caption">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-link ${page === label ? 'nav-active' : ''}`} onClick={() => { setPage(label); setSidebarOpen(false); }}>
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
              {label === 'Contributions' && <span className="nav-count">2</span>}
              {label === 'Votes & proposals' && <span className="nav-dot" />}
            </button>
          ))}
        </nav>

        <div className="nav-caption tools-caption">YOUR ACCOUNT</div>
        <button className="nav-link" onClick={() => flash('Notification preferences are up to date.')}><Bell size={17} strokeWidth={1.8} /><span>Notifications</span><span className="notification-count">3</span></button>
        <button className="nav-link" onClick={() => flash('Account settings are available to invited members.')}><Settings size={17} strokeWidth={1.8} /><span>Settings</span></button>

        <div className="sidebar-bottom">
          <div className="help-card"><span className="help-icon"><CircleHelp size={16} /></span><strong>Need a hand?</strong><span>We’re here to help your group grow.</span><button onClick={() => flash('Help centre opened.')}>Visit help centre <ArrowUpRight size={13} /></button></div>
          <div className="profile-row"><div className="profile-avatar">{initials}</div><div className="profile-copy"><strong>{displayName}</strong><span>{user?.email ?? 'Preview mode'} · {role}</span></div><button className="icon-button profile-more" aria-label={previewMode ? 'Profile options' : 'Sign out'} title={previewMode ? 'Profile options' : 'Sign out'} onClick={() => previewMode ? flash('Profile options') : supabase?.auth.signOut()}>{previewMode ? <MoreHorizontal size={19} /> : <LogOut size={18} />}</button></div>
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={19} /></button>
          <div className="breadcrumb"><span>Upendo Circle</span><ChevronRight size={14} /><strong>{page}</strong></div>
          <div className="topbar-actions">
            {canPreviewRoles && <label className="role-picker"><span>{previewMode ? 'DEMO VIEW' : 'PREVIEW AS'}</span><select value={viewRole} onChange={(event) => { const selectedRole = event.target.value as Role; if (previewMode) setRole(selectedRole); else setPreviewRole(selectedRole === role ? null : selectedRole); setPage('Overview'); }} aria-label="Preview dashboard role"><option value="MEMBER">Member</option><option value="ACCOUNTANT">Accountant</option><option value="CHAIRMAN">Chairman</option><option value="SYSTEM_ADMIN">System admin</option></select><ChevronDown size={14} /></label>}
            <span className="topbar-divider" />
            <span className="today-label"><CalendarDays size={15} /> Fri, 25 Sep 2026</span>
            <button className="icon-button top-notification" aria-label="Notifications" onClick={() => flash('You’re all caught up on important updates.')}><Bell size={18} /><i /></button>
          </div>
        </header>

        <div className="page-content">
          {previewMode && <section className="role-notice"><CircleHelp size={17} /><span><strong>Demo preview</strong> · dashboard figures are sample data.</span></section>}
          {!previewMode && previewRole && <section className="role-notice"><CircleHelp size={17} /><span><strong>Previewing {viewRole.replace('_', ' ')} screen</strong> · You remain signed in as System Admin; screen data is sample data and your permissions have not changed.</span><button onClick={() => setPreviewRole(null)}>Return to admin</button></section>}
          <section className="welcome-row">
            <div><div className="eyebrow"><span className="eyebrow-line" /> FRIDAY, 25 SEPTEMBER 2026</div><h1>{page !== 'Overview' ? page : viewRole === 'MEMBER' ? `Good morning, ${displayName}` : viewRole === 'ACCOUNTANT' ? 'Financial approvals' : viewRole === 'CHAIRMAN' ? 'Circle governance' : 'System operations'}</h1><p className="welcome-subtitle">{page !== 'Overview' ? `Your Upendo Circle ${page.toLowerCase()} at a glance.` : viewRole === 'MEMBER' ? 'Here’s what’s happening with your circle today.' : viewRole === 'ACCOUNTANT' ? 'Verify contributions, review disbursements and reconcile circle transactions.' : viewRole === 'CHAIRMAN' ? 'Support members and keep circle governance moving.' : 'Monitor containers, scheduled jobs and the Pulse system.'}</p></div>
            <div className="welcome-actions"><button className="button button-quiet" onClick={() => flash(viewRole === 'CHAIRMAN' ? 'Opening active proposals.' : viewRole === 'SYSTEM_ADMIN' ? 'System report is being prepared.' : 'Your monthly report is being prepared.')}><ChartNoAxesColumnIncreasing size={16} /> {viewRole === 'CHAIRMAN' ? 'Proposals' : viewRole === 'SYSTEM_ADMIN' ? 'System report' : 'Reports'}</button>{viewRole === 'MEMBER' ? <button className="button button-primary" onClick={() => setModal('payment')}><Plus size={17} /> Log a payment</button> : viewRole === 'ACCOUNTANT' ? <button className="button button-primary" onClick={() => flash('Financial approval queue refreshed.')}><RotateCcw size={15} /> Refresh queue</button> : viewRole === 'CHAIRMAN' ? <button className="button button-primary" onClick={() => flash('Complaint review opened in demo mode.')}><MessageSquareText size={15} /> Review complaint</button> : <button className="button button-primary" onClick={() => flash('New container setup opened in demo mode.')}><Plus size={17} /> Create container</button>}</div>
          </section>

          {viewRole === 'ACCOUNTANT' && <section className="role-notice"><ShieldCheck size={17} /><span><strong>Accountant workspace</strong> · 3 items need your review</span><button onClick={() => setPage('Contributions')}>Review queue <ArrowRightIcon /></button></section>}
          {viewRole === 'CHAIRMAN' && <section className="role-notice chairman-notice"><MessageSquareText size={17} /><span><strong>Chairman workspace</strong> · 1 complaint needs attention</span><button onClick={() => flash('Complaint review opened in demo mode.')}>Open complaint <ArrowRightIcon /></button></section>}
          {viewRole === 'SYSTEM_ADMIN' && <section className="role-notice admin-notice"><ShieldCheck size={17} /><span><strong>System admin overview</strong> · Container health is looking good</span><button onClick={() => flash('Admin system health: operational (demo).')}>System health <ArrowRightIcon /></button></section>}

          {viewRole === 'MEMBER' ? <>
          <section className="metrics-grid" aria-label="Circle summary">
            <article className="metric-card metric-savings"><div className="metric-heading"><span>MY SAVINGS</span><span className="metric-icon green-icon"><Wallet size={16} /></span></div><div className="metric-value">KES 24,800</div><div className="metric-foot"><span className="positive-change"><ArrowUpRight size={14} /> 8.2%</span><span>vs. last month</span><button aria-label="Savings details" onClick={() => setPage('Activity')}><ArrowUpRight size={15} /></button></div><span className="metric-spark spark-green" /></article>
            <article className="metric-card"><div className="metric-heading"><span>CONTRIBUTED THIS CYCLE</span><span className="metric-icon blue-icon"><Coins size={16} /></span></div><div className="metric-value">KES 4,000</div><div className="metric-foot"><span className="foot-dot green-dot" />4 of 4 weeks complete<button aria-label="Contribution details" onClick={() => setPage('Contributions')}><ArrowUpRight size={15} /></button></div><span className="metric-spark spark-blue" /></article>
            <article className="metric-card"><div className="metric-heading"><span>AVAILABLE TO BORROW</span><span className="metric-icon peach-icon"><HandCoins size={16} /></span></div><div className="metric-value">KES 12,400</div><div className="metric-foot"><span>Self-guaranteed limit</span><button aria-label="Loan details" onClick={() => setPage('Loans')}><ArrowUpRight size={15} /></button></div><span className="metric-spark spark-peach" /></article>
            <article className="metric-card metric-container"><div className="metric-heading"><span>CIRCLE RESERVE</span><span className="metric-icon teal-icon"><Landmark size={16} /></span></div><div className="metric-value">KES 43,200</div><div className="metric-foot"><span><span className="foot-dot teal-dot" />Aggregate · 86% of milestone</span><button aria-label="Reserve details" onClick={() => setPage('Reserve & dividends')}><ArrowUpRight size={15} /></button></div><span className="metric-spark spark-teal" /></article>
          </section>

          <div className="content-grid">
            <section className="panel growth-panel">
              <div className="panel-heading"><div><div className="section-kicker">YOUR PROGRESS</div><h2>Savings over time</h2></div><button className="period-select" onClick={() => flash('Showing the last 6 months.')}>Last 6 months <ChevronDown size={14} /></button></div>
              <div className="chart-legend"><span><i className="legend-dot savings-legend" /> My savings</span><span><i className="legend-dot reserve-legend" /> Circle reserve</span></div>
              <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 14, right: 5, left: -20, bottom: 0 }}><defs><linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#17856c" stopOpacity={0.16} /><stop offset="100%" stopColor="#17856c" stopOpacity={0.01} /></linearGradient><linearGradient id="reserveGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e7a75e" stopOpacity={0.12} /><stop offset="100%" stopColor="#e7a75e" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf0e9" strokeDasharray="3 5" /><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#929890', fontSize: 11 }} dy={10} /><YAxis tickLine={false} axisLine={false} tick={{ fill: '#929890', fontSize: 10 }} tickFormatter={(value: number) => `${value / 1000}k`} /><Tooltip formatter={(value) => fmt(Number(value))} contentStyle={{ border: '1px solid #e8ebe4', borderRadius: 6, fontSize: 12, fontFamily: 'DM Sans' }} /><Area type="monotone" dataKey="savings" stroke="#18866d" strokeWidth={2.3} fill="url(#savingsGradient)" /><Area type="monotone" dataKey="reserve" stroke="#e4a45b" strokeWidth={2} fill="url(#reserveGradient)" /></AreaChart></ResponsiveContainer></div>
              <div className="chart-foot"><span>Steady progress, {displayName}.</span><strong><ArrowUpRight size={14} /> Your savings grew by KES 1,200 this month</strong></div>
            </section>

            <section className="panel contribution-panel">
              <div className="panel-heading"><div><div className="section-kicker">WEEKLY CONTRIBUTION</div><h2>This week</h2></div><span className="status-pill status-due"><span /> Due soon</span></div>
              <div className="contribution-amount"><div><span>Amount due</span><strong>KES 1,000</strong></div><div className="amount-breakdown"><span>Rotation <b>KES 800</b></span><span>Reserve <b>KES 200</b></span></div></div>
              <div className="deadline-row"><Clock3 size={15} /><span>Due today by <strong>7:00 pm EAT</strong></span></div>
              <div className="week-progress"><div className="week-label"><span>Week 38 of 2026</span><span>4 / 4 complete</span></div><div className="progress-track"><span style={{ width: '100%' }} /></div><div className="week-dots"><span className="week-done">M</span><span className="week-done">T</span><span className="week-done">W</span><span className="week-done">T</span><span className="week-current">F</span><span>S</span><span>S</span></div></div>
              <button className="button button-pay" onClick={() => setModal('payment')}><Plus size={16} /> Record this week’s payment</button><p className="manual-note"><ShieldCheck size={13} /> Payments are manually verified by your accountant</p>
            </section>
          </div>

          <div className="lower-grid">
            <section className="panel transactions-panel"><div className="panel-heading"><div><div className="section-kicker">RECENT ACTIVITY</div><h2>Latest transactions</h2></div><button className="text-link" onClick={() => setPage('Activity')}>View all <ArrowUpRight size={14} /></button></div><div className="transaction-list">{memberTransactions.map((item) => <div className="transaction-row" key={`${item.name}-${item.detail}`}><div className={`transaction-avatar avatar-${item.tone}`}>{item.initials}</div><div className="transaction-description"><strong>{item.name}</strong><span>{item.detail}</span></div><div className="transaction-result"><strong className={item.status === 'Pending' ? '' : item.amount.startsWith('+') ? 'amount-in' : 'amount-out'}>{item.amount}</strong><span>{item.time}</span></div><span className={`table-status status-${item.tone}`}>{item.status}</span></div>)}</div><div className="privacy-foot"><ShieldCheck size={14} /> Only you can see your personal transaction history</div></section>

            <div className="right-stack"><section className="panel rotation-panel"><div className="panel-heading"><div><div className="section-kicker">UP NEXT</div><h2>Rotation schedule</h2></div><button className="icon-button small-icon" aria-label="Rotation details" onClick={() => setPage('Rotation')}><ArrowUpRight size={16} /></button></div><div className="next-payout"><div className="next-payout-icon"><ArrowUpRight size={17} /></div><div className="next-payout-copy"><span>Next payout · Week 39</span><strong>James Njoroge</strong></div><span className="payout-amount">KES 5,600</span></div><div className="rotation-foot"><span><Users size={14} /> 8 members</span><span><Check size={14} /> Order confirmed</span></div><button className="rotation-link" onClick={() => setPage('Rotation')}>See full schedule <ChevronRight size={14} /></button></section>

              <section className="vote-card"><div className="vote-topline"><span className="vote-icon"><Vote size={16} /></span><span className="vote-open">VOTE OPEN</span><span className="vote-deadline">Closes in 2 days</span></div><h2>Group reserve use</h2><p>Approve KES 8,000 for shared meeting space equipment.</p><div className="vote-stats"><span><Users size={14} /> 5 of 8 responded</span><span>Required: 5 votes</span></div><div className="vote-progress"><span style={{ width: '62.5%' }} /></div><div className="vote-actions"><button className={`vote-yes ${vote === 'yes' ? 'vote-selected' : ''}`} onClick={() => { setVote('yes'); flash('Your yes vote has been recorded in the demo.'); }}><Check size={15} /> Yes, approve</button><button className={`vote-no ${vote === 'no' ? 'vote-selected' : ''}`} onClick={() => { setVote('no'); flash('Your no vote has been recorded in the demo.'); }}><X size={15} /> No</button></div></section></div>
          </div>

          <footer className="page-footer"><span>Pulse <b>·</b> Community finance, together.</span><span><ShieldCheck size={13} /> Your circle. Your information stays private.</span><button onClick={() => flash('Pulse privacy and security settings.')}>Privacy &amp; security</button></footer>
          </> : viewRole === 'ACCOUNTANT' ? <AccountantDashboard payments={demoPayments} onReviewPayment={reviewDemoPayment} onNotify={flash} /> : viewRole === 'CHAIRMAN' ? <ChairmanDashboard onNotify={flash} /> : <AdminDashboard onNotify={flash} onInvite={() => role === 'SYSTEM_ADMIN' && !previewRole && !previewMode ? setModal('invite') : flash('Admin actions are unavailable in a role preview.')} />}
        </div>
      </main>

      {modal === 'invite' ? <InviteModal onClose={() => setModal(null)} onSend={sendInvite} /> : modal && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}><section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><span className="modal-icon">{modal === 'payment' ? <ArrowDownLeft size={19} /> : <HeartHandshake size={19} />}</span><button className="icon-button" aria-label="Close dialog" onClick={() => setModal(null)}><X size={19} /></button></div><div className="section-kicker">{modal === 'payment' ? 'WEEKLY CONTRIBUTION · WEEK 38' : 'UPENDO CIRCLE · MEMBER LOAN'}</div><h2 id="modal-title">{modal === 'payment' ? 'Record a payment' : 'Request a loan'}</h2><p className="modal-description">{modal === 'payment' ? 'Submit your M-Pesa details. Your accountant will verify the payment before it is added to your circle records.' : 'Your self-guaranteed borrowing limit is KES 12,400. Final eligibility is confirmed during review.'}</p><form onSubmit={modal === 'payment' ? submitPayment : submitLoan}>{modal === 'payment' ? <><label className="form-label" htmlFor="payment-amount">Amount paid</label><div className="input-with-prefix"><span>KES</span><input id="payment-amount" type="number" min="1" defaultValue="1000" required /></div><label className="form-label" htmlFor="payment-code">M-Pesa transaction code</label><input className="form-input" id="payment-code" value={paymentCode} onChange={(event) => setPaymentCode(event.target.value.toUpperCase())} placeholder="e.g. QJK4M8P2XA" maxLength={12} required /><label className="form-label" htmlFor="payment-sender">Sender phone number</label><input className="form-input" id="payment-sender" type="tel" placeholder="+254 7XX XXX XXX" required /><div className="form-safe-note"><ShieldCheck size={15} /> Only authorized accountants can review your payment reference.</div></> : <><label className="form-label" htmlFor="loan-amount">Amount requested</label><div className="input-with-prefix"><span>KES</span><input id="loan-amount" type="number" min="500" max="12400" step="100" value={loanAmount} onChange={(event) => setLoanAmount(event.target.value)} placeholder="e.g. 5,000" required /></div><label className="form-label" htmlFor="loan-purpose">Purpose</label><select id="loan-purpose" className="form-input" defaultValue=""><option value="" disabled>Select a purpose</option><option>Education</option><option>Medical</option><option>Business</option><option>Home & family</option><option>Other</option></select><div className="loan-term-box"><span>Standard terms</span><strong>10% flat interest · 14 days + 7-day grace</strong></div></>}<div className="modal-actions"><button type="button" className="button button-quiet" onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" type="submit">{modal === 'payment' ? 'Submit for review' : 'Continue request'} <ChevronRight size={16} /></button></div><p className="demo-disclaimer">Demo only. No real money or transactions are processed.</p></form></section></div>}

      {notice && <div className="toast" role="status"><BadgeCheck size={17} />{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={15} /></button></div>}
    </div>
  );
}

function LoginScreen() {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError('Supabase is not configured. Add the project URL and anon key to .env.local.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address to continue.');
      return;
    }
    setError('');
    setSubmitting(true);
    const { error: requestError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        ...(fullName.trim() ? { data: { full_name: fullName.trim() } } : {}),
      },
    });
    setSubmitting(false);
    if (requestError) {
      setError(requestError.message);
      return;
    }
    setStep('otp');
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError('Supabase is not configured. Add the project URL and anon key to .env.local.');
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
    if (verificationError) setError(verificationError.message);
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand"><span className="brand-mark"><Activity size={21} strokeWidth={2.7} /></span><span className="brand-name">pulse<span>.</span></span></div>
        <div className="auth-kicker">UPENDO CIRCLE</div>
        {step === 'email' ? <>
          <h1 id="auth-title">Sign in or join</h1>
          <p className="auth-copy">Enter your email to receive a sign-in link or code. The first person to join becomes the System Admin and can invite members with assigned roles.</p>
          <form className="auth-form" onSubmit={requestCode}>
          <label htmlFor="full-name">Your name (optional)</label>
            <input id="full-name" type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your name" autoComplete="name" />
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" autoFocus />
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="button button-primary auth-submit" type="submit" disabled={submitting}>{submitting ? 'Sending code...' : <>Continue <ChevronRight size={16} /></>}</button>
          </form>
          <p className="auth-note"><ShieldCheck size={14} /> Your email is used only to secure your account.</p>
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
          <p className="auth-note">Your verification code is sent by Supabase Auth.</p>
        </>}
      </section>
    </main>
  );
}

function AccountantDashboard({ payments, onReviewPayment, onNotify }: {
  payments: DemoPayment[];
  onReviewPayment: (id: string, status: Exclude<DemoPaymentStatus, 'PENDING'>, reason?: string) => void;
  onNotify: (message: string) => void;
}) {
  const [reviewed, setReviewed] = useState<Record<string, string>>({});
  const submittedPayments = payments.map((payment) => ({
    id: payment.id,
    member: payment.member,
    type: `Weekly contribution · Week ${payment.weekNumber}`,
    reference: payment.reference,
    amount: payment.amount,
    date: new Date(payment.createdAt).toLocaleString(),
    icon: CreditCard,
    reviewStatus: payment.status === 'VERIFIED' ? 'Approved' : payment.status === 'REJECTED' ? 'Rejected' : undefined,
  }));
  const samplePayments = [
    { id: 'MP-038-AM', member: 'Amina Mwangi', type: 'Weekly contribution · Week 38', reference: 'QJK4M8P2XA', amount: 1000, date: 'Today, 10:42 am', icon: CreditCard },
    { id: 'LN-014-DO', member: 'David Otieno', type: 'Loan disbursement · 14-day term', reference: 'Loan request #014', amount: 8000, date: 'Today, 9:18 am', icon: HandCoins },
    { id: 'RT-006-JN', member: 'James Njoroge', type: 'Rotation payout · Cycle 1', reference: 'Week 39 · Order confirmed', amount: 5600, date: 'Yesterday, 3:18 pm', icon: RotateCcw },
  ].map((item) => ({ ...item, reviewStatus: undefined as string | undefined }));
  const pending = [...submittedPayments, ...samplePayments];

  function decide(id: string, result: 'Approved' | 'Rejected') {
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
    if (payment) onReviewPayment(id, result === 'Approved' ? 'VERIFIED' : 'REJECTED', rejectionReason);
    setReviewed((current) => ({ ...current, [id]: result }));
    onNotify(`${id} ${result.toLowerCase()}.`);
  }

  return <>
    <section className="metrics-grid operator-metrics" aria-label="Accountant summary">
      <OperatorMetric label="PENDING REVIEWS" value={String(pending.filter((item) => !reviewed[item.id] && !item.reviewStatus).length)} detail="Across 2 workflows" icon={Clock3} tone="amber" />
      <OperatorMetric label="VERIFIED THIS WEEK" value="24" detail="Contribution records" icon={CheckCircle2} tone="green" />
      <OperatorMetric label="AWAITING PAYOUT" value={fmt(13600)} detail="Loan + rotation requests" icon={HandCoins} tone="blue" />
      <OperatorMetric label="RECONCILIATION" value="On track" detail="Last checked today" icon={ShieldCheck} tone="teal" />
    </section>
    <div className="operator-layout">
      <section className="panel operator-panel">
        <div className="panel-heading"><div><div className="section-kicker">ACTION REQUIRED</div><h2>Financial approval queue</h2></div><span className="status-pill status-due"><span /> {pending.filter((item) => !reviewed[item.id] && !item.reviewStatus).length} pending</span></div>
        <p className="operator-intro">Verify payment details against the M-Pesa record. Approve disbursements only after checking the supporting details.</p>
        <div className="approval-list">{pending.map((item) => {
          const Icon = item.icon;
          const decision = reviewed[item.id] ?? item.reviewStatus;
          return <article className="approval-item" key={item.id}>
            <span className="approval-icon"><Icon size={17} /></span>
            <div className="approval-main"><div className="approval-title"><strong>{item.member}</strong><span>{item.type}</span></div><div className="approval-meta"><span>Ref: {item.reference}</span><span>{item.date}</span></div></div>
            <div className="approval-amount">{fmt(item.amount)}</div>
            {decision ? <span className={`table-status ${decision === 'Approved' ? 'status-green' : 'status-amber'}`}>{decision}</span> : <div className="approval-actions"><button className="approval-reject" onClick={() => decide(item.id, 'Rejected')}>Reject</button><button className="approval-approve" onClick={() => decide(item.id, 'Approved')}><Check size={13} /> Approve</button></div>}
          </article>;
        })}</div>
      </section>
      <section className="panel operator-side-panel"><div className="section-kicker">RECONCILIATION</div><h2>Today’s activity</h2><div className="reconcile-total"><span>Verified contributions</span><strong>18 <small>/ 21</small></strong></div><div className="progress-track reconcile-progress"><span style={{ width: '86%' }} /></div><div className="reconcile-row"><span>Verified</span><strong>{fmt(18000)}</strong></div><div className="reconcile-row"><span>Pending review</span><strong>{fmt(3000)}</strong></div><div className="reconcile-row"><span>Rejected</span><strong>KES 0</strong></div><div className="operator-guardrail"><ShieldCheck size={16} /><span>Every approval creates a permanent transaction and audit record.</span></div><button className="operator-text-button" onClick={() => onNotify('Showing the Upendo Circle audit history.')}>Open audit history <ChevronRight size={14} /></button></section>
    </div>
    <section className="panel operator-panel recent-approvals"><div className="panel-heading"><div><div className="section-kicker">RECENTLY COMPLETED</div><h2>Approval history</h2></div><button className="text-link" onClick={() => onNotify('Full approval history opened in demo mode.')}>View history <ArrowUpRight size={14} /></button></div><div className="history-row"><span className="history-check"><Check size={13} /></span><span><strong>Grace Wanjiku</strong><small>Weekly contribution · Week 38</small></span><strong>{fmt(1000)}</strong><span className="table-status status-green">Verified</span><small>Yesterday, 11:24 am</small></div><div className="history-row"><span className="history-check"><Check size={13} /></span><span><strong>David Otieno</strong><small>Loan repayment · Principal</small></span><strong>{fmt(800)}</strong><span className="table-status status-green">Verified</span><small>Mon, Sep 21</small></div></section>
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

function AdminDashboard({ onNotify, onInvite }: { onNotify: (message: string) => void; onInvite: () => void }) {
  const [retried, setRetried] = useState(false);
  return <>
    <section className="metrics-grid operator-metrics" aria-label="System admin summary">
      <OperatorMetric label="ACTIVE CONTAINERS" value="12" detail="10 active · 2 forming" icon={Landmark} tone="green" />
      <OperatorMetric label="REGISTERED MEMBERS" value="84" detail="Across all containers" icon={Users} tone="blue" />
      <OperatorMetric label="ADMIN POOL" value={fmt(186400)} detail="System funds · separate" icon={Coins} tone="amber" />
      <OperatorMetric label="PLATFORM HEALTH" value="Operational" detail="All core jobs running" icon={Activity} tone="teal" />
    </section>
    <div className="admin-action-row"><div><div className="section-kicker">SYSTEM OPERATIONS</div><strong>Manage your Pulse network</strong></div><div><button className="button button-quiet" onClick={onInvite}><Plus size={15} /> Invite member</button><button className="button button-primary" onClick={() => onNotify('New container setup opened in demo mode.') }><Plus size={15} /> Create container</button></div></div>
    <div className="operator-layout admin-layout">
      <section className="panel operator-panel"><div className="panel-heading"><div><div className="section-kicker">NETWORK OVERVIEW</div><h2>Containers</h2></div><button className="text-link" onClick={() => onNotify('Showing all 12 containers.')}>All containers <ArrowUpRight size={14} /></button></div><div className="container-list"><AdminContainer name="Upendo Circle" members="8 members" state="ACTIVE" reserve="43,200" completion="96%" tone="green" onClick={onNotify} /><AdminContainer name="Jirani Savings Group" members="10 members" state="ACTIVE" reserve="58,600" completion="91%" tone="green" onClick={onNotify} /><AdminContainer name="Mwangaza Women’s Circle" members="6 members" state="FORMING" reserve="—" completion="60%" tone="amber" onClick={onNotify} /><AdminContainer name="Tumaini Chama" members="5 members" state="REVIEW" reserve="28,400" completion="74%" tone="red" onClick={onNotify} /></div><div className="operator-guardrail"><ShieldCheck size={16} /><span>Container balances and histories remain isolated from one another.</span></div></section>
      <div className="admin-side-stack"><section className="panel operator-side-panel"><div className="panel-heading"><div><div className="section-kicker">SCHEDULED OPERATIONS</div><h2>Job monitor</h2></div><span className="health-indicator"><i /> Healthy</span></div><div className="job-row"><span className="job-icon"><CalendarDays size={14} /></span><span><strong>Weekly contribution cycle</strong><small>Last run · Mon, 00:00 EAT</small></span><span className="job-ok"><CheckCircle2 size={15} /></span></div><div className="job-row"><span className="job-icon"><Coins size={14} /></span><span><strong>Grace period & fine check</strong><small>Next run · Today, 19:05 EAT</small></span><span className="job-ok"><CheckCircle2 size={15} /></span></div><div className="job-row"><span className="job-icon"><Bell size={14} /></span><span><strong>Rotation reminders</strong><small>Last run · 08:00 EAT</small></span><span className="job-ok"><CheckCircle2 size={15} /></span></div>{retried && <div className="recommendation-note"><CheckCircle2 size={14} /> Failed job retry queued.</div>}<button className="operator-text-button" onClick={() => { setRetried(true); onNotify('Scheduled job retry queued in this demo.'); }}><RotateCcw size={13} /> Retry failed jobs <ChevronRight size={14} /></button></section>
        <section className="panel operator-side-panel admin-pool-panel"><div className="section-kicker">SYSTEM FUNDS · NOT MEMBER SAVINGS</div><h2>Admin Pool</h2><div className="admin-pool-total">KES 186,400</div><div className="pool-breakdown"><span>Weekly pool allocation</span><strong>KES 14,200</strong></div><div className="pool-breakdown"><span>Loan interest & fines</span><strong>KES 8,600</strong></div><div className="admin-pool-note"><ShieldCheck size={14} /> Withdrawals require Accountant approval. You cannot approve your own withdrawal.</div><button className="operator-text-button" onClick={() => onNotify('Admin Pool ledger opened in demo mode.')}>Open pool ledger <ChevronRight size={14} /></button></section></div>
    </div>
    <section className="panel operator-panel admin-audit"><div className="panel-heading"><div><div className="section-kicker">GOVERNANCE & SECURITY</div><h2>Recent system events</h2></div><button className="text-link" onClick={() => onNotify('Full immutable audit log opened in demo mode.')}>Audit log <ArrowUpRight size={14} /></button></div><div className="admin-event"><span className="event-dot event-green" /><span><strong>Accountant appointment</strong><small>Upendo Circle · System Admin · 09:42 am</small></span><span className="event-kind">MEMBERSHIP</span></div><div className="admin-event"><span className="event-dot event-blue" /><span><strong>Contribution verified · Week 38</strong><small>Jirani Savings Group · Accountant · 09:26 am</small></span><span className="event-kind">TRANSACTION</span></div><div className="admin-event"><span className="event-dot event-amber" /><span><strong>Container flagged for minimum-member review</strong><small>Tumaini Chama · Automated check · Yesterday</small></span><span className="event-kind">CONTAINER</span></div></section>
  </>;
}

function OperatorMetric({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: typeof Home; tone: 'green' | 'blue' | 'amber' | 'teal' }) {
  return <article className="metric-card operator-metric"><div className="metric-heading"><span>{label}</span><span className={`metric-icon ${tone}-icon`}><Icon size={16} /></span></div><div className={`metric-value operator-metric-value ${value === 'Operational' || value === 'On track' || value === 'Governance' ? 'metric-word' : ''}`}>{value}</div><div className="metric-foot"><span className={`foot-dot ${tone}-dot`} />{detail}</div></article>;
}

function AdminContainer({ name, members, state, reserve, completion, tone, onClick }: { name: string; members: string; state: string; reserve: string; completion: string; tone: 'green' | 'amber' | 'red'; onClick: (message: string) => void }) {
  return <button className="admin-container-row" onClick={() => onClick(`${name} container details opened in demo mode.`)}><span className="admin-container-mark">{name.charAt(0)}</span><span className="admin-container-name"><strong>{name}</strong><small>{members} · {completion} contribution completion</small></span><span className={`container-state state-${tone}`}>{state}</span><span className="admin-reserve"><small>RESERVE</small><strong>{reserve === '—' ? reserve : `KES ${reserve}`}</strong></span><ChevronRight size={15} /></button>;
}

function ArrowRightIcon() {
  return <ChevronRight size={14} />;
}

export default App;
