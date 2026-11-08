import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

type Circle = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

type PendingEmail = { email: string; circleName: string };

export function PlatformAdmin({ onCircleView, onSignOut }: {
  onCircleView?: () => void;
  onSignOut: () => void;
}) {
  const [circles, setCircles] = useState<Circle[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [targetCircle, setTargetCircle] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [pendingEmail, setPendingEmail] = useState<PendingEmail | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function loadCircles() {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data, error: loadError } = await supabase.rpc('list_platform_circles');
    if (loadError) throw new Error(loadError.message);
    setCircles(data);
  }

  useEffect(() => {
    let active = true;
    if (!supabase) {
      setError('Supabase is not configured.');
      setLoading(false);
      return;
    }
    supabase.rpc('list_platform_circles').then(({ data, error: loadError }) => {
      if (!active) return;
      if (loadError) setError(loadError.message);
      else setCircles(data);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function sendEmail(pending: PendingEmail) {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { error: emailError } = await supabase.auth.signInWithOtp({
      email: pending.email,
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
    });
    if (emailError) throw new Error(emailError.message);
    setPendingEmail(null);
    setNotice(`Sign-in email requested for ${pending.email}, administrator of ${pending.circleName}.`);
  }

  async function createCircle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError('Supabase is not configured.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    const pending = { email: email.trim().toLowerCase(), circleName: name.trim() };
    const { error: createError } = await supabase.rpc('create_platform_circle', {
      circle_name: pending.circleName,
      admin_email: pending.email,
    });
    if (createError) {
      setError(`Could not create the container: ${createError.message}`);
      setBusy(false);
      return;
    }
    setName('');
    setEmail('');
    setPendingEmail(pending);
    try {
      await loadCircles();
    } catch (loadError) {
      setError(`The container was created, but the list could not be refreshed: ${loadError instanceof Error ? loadError.message : 'Unknown error'}. Retry the email below.`);
      setBusy(false);
      return;
    }
    try {
      await sendEmail(pending);
    } catch (sendError) {
      setError(`The container and administrator assignment were saved, but the email could not be sent: ${sendError instanceof Error ? sendError.message : 'Unknown error'}. Retry the email below.`);
    }
    setBusy(false);
  }

  async function appointAdmin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError('Supabase is not configured.');
      return;
    }
    const circle = circles.find((item) => item.id === targetCircle);
    if (!circle) {
      setError('Select a container.');
      return;
    }
    const pending = { email: adminEmail.trim().toLowerCase(), circleName: circle.name };
    setBusy(true);
    setError('');
    setNotice('');
    const { error: inviteError } = await supabase.rpc('invite_circle_admin', {
      target_circle: circle.id,
      admin_email: pending.email,
    });
    if (inviteError) {
      setError(`Could not save the administrator assignment: ${inviteError.message}`);
      setBusy(false);
      return;
    }
    setAdminEmail('');
    setPendingEmail(pending);
    try {
      await sendEmail(pending);
    } catch (sendError) {
      setError(`The administrator assignment was saved, but the email could not be sent: ${sendError instanceof Error ? sendError.message : 'Unknown error'}. Retry the email below.`);
    }
    setBusy(false);
  }

  async function retryEmail() {
    if (!pendingEmail) return;
    setBusy(true);
    setError('');
    try {
      await sendEmail(pendingEmail);
    } catch (sendError) {
      setError(`The email could not be sent: ${sendError instanceof Error ? sendError.message : 'Unknown error'}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-kicker">PULSE PLATFORM</div>
        <h1>Container administration</h1>
        <p className="auth-copy">Platform administration is separate from circle membership and does not grant access to financial records.</p>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {notice && <p className="form-safe-note" role="status">{notice}</p>}
        {pendingEmail && <div>
          <button className="button button-quiet" type="button" disabled={busy} onClick={retryEmail}>Retry email to {pendingEmail.email}</button>
          <button className="button button-quiet" type="button" disabled={busy} onClick={() => setPendingEmail(null)}>Dismiss retry</button>
        </div>}
        <h2>Containers</h2>
        {loading ? <p>Loading containers...</p> : circles.length === 0 ? <p>No containers yet.</p> : (
          <ul>{circles.map((circle) => <li key={circle.id}>{circle.name}</li>)}</ul>
        )}
        <h2>Create a container</h2>
        <form onSubmit={createCircle}>
          <label className="form-label" htmlFor="circle-name">Container name</label>
          <input className="form-input" id="circle-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required />
          <label className="form-label" htmlFor="circle-admin-email">Circle administrator email</label>
          <input className="form-input" id="circle-admin-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <button className="button button-primary auth-submit" disabled={busy || !!pendingEmail} type="submit">{busy ? 'Working...' : 'Create and invite admin'}</button>
        </form>
        <h2>Appoint a circle administrator</h2>
        <form onSubmit={appointAdmin}>
          <label className="form-label" htmlFor="admin-circle">Container</label>
          <select className="form-input" id="admin-circle" value={targetCircle} onChange={(event) => setTargetCircle(event.target.value)} required>
            <option value="">Select a container</option>
            {circles.map((circle) => <option key={circle.id} value={circle.id}>{circle.name}</option>)}
          </select>
          <label className="form-label" htmlFor="existing-admin-email">Administrator email</label>
          <input className="form-input" id="existing-admin-email" type="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} required />
          <button className="button button-primary auth-submit" disabled={busy || !!pendingEmail} type="submit">Invite admin</button>
        </form>
        {onCircleView && <button className="button button-quiet" type="button" onClick={onCircleView}>Open my circle</button>}
        <button className="button button-quiet" type="button" onClick={onSignOut}>Sign out</button>
      </section>
    </main>
  );
}
