import { useEffect, useState } from 'react';
import { MessageSquareText, RotateCcw, Send } from 'lucide-react';
import { supabase } from './lib/supabase';

type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender_name: string;
};

const pageSize = 50;

async function getMessages(circleId: string, before?: Message) {
  if (!supabase) throw new Error('Supabase is not configured.');
  let query = supabase.from('circle_messages')
    .select('id, sender_id, body, created_at')
    .eq('circle_id', circleId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(pageSize + 1);
  if (before) {
    query = query.or(`created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const page = rows.slice(0, pageSize);
  const senderIds = [...new Set(page.map((message) => message.sender_id))];
  const names = new Map<string, string>();
  if (senderIds.length) {
    const { data: profiles, error: profileError } = await supabase.from('profiles')
      .select('id, full_name').in('id', senderIds);
    if (profileError) throw new Error(profileError.message);
    for (const profile of profiles ?? []) names.set(profile.id, profile.full_name);
  }
  const messages: Message[] = page.map((message) => ({
    ...message,
    sender_name: names.get(message.sender_id) || 'Circle member',
  }));
  return { messages, hasMore: rows.length > pageSize };
}

export default function CircleChat({ circleId, userId, readOnly }: {
  circleId: string;
  userId: string;
  readOnly: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sendError, setSendError] = useState('');
  const [body, setBody] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void getMessages(circleId).then((result) => {
      if (!active) return;
      setMessages(result.messages);
      setHasMore(result.hasMore);
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load messages.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [circleId, refresh]);

  async function loadOlder() {
    const oldest = messages[messages.length - 1];
    if (!oldest || loadingOlder || loading) return;
    setLoadingOlder(true);
    setError('');
    try {
      const result = await getMessages(circleId, oldest);
      setMessages((current) => [...current, ...result.messages]);
      setHasMore(result.hasMore);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load older messages.');
    } finally {
      setLoadingOlder(false);
    }
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly || sending || loading || loadingOlder) return;
    const text = body.trim();
    if (!text || text.length > 2000) {
      setSendError('Enter a message of up to 2,000 characters.');
      return;
    }
    if (!supabase) {
      setSendError('Supabase is not configured.');
      return;
    }
    setSending(true);
    setSendError('');
    try {
      const { error: insertError } = await supabase.from('circle_messages').insert({
        circle_id: circleId,
        sender_id: userId,
        body: text,
      });
      if (insertError) throw new Error(insertError.message);
      setBody('');
      setRefresh((value) => value + 1);
    } catch (insertError) {
      setSendError(`Message could not be confirmed as sent: ${insertError instanceof Error ? insertError.message : 'Unexpected error'}. Refresh before retrying to avoid duplicates.`);
    } finally {
      setSending(false);
    }
  }

  return <section className="panel chat-panel">
    <div className="panel-heading">
      <div><div className="section-kicker">CIRCLE CONVERSATION</div><h2>Shared chat</h2></div>
      <button className="button button-quiet" onClick={() => setRefresh((value) => value + 1)} disabled={loading || loadingOlder || sending}>
        <RotateCcw size={14} /> Refresh
      </button>
    </div>
    <p className="chat-help">All current circle members can see the full history, including messages sent before they joined. Messages are saved; deletion is not available in the app. This is not a private or end-to-end encrypted chat, so do not share passwords or verification codes. Refresh to see new messages.</p>
    {readOnly && <p className="chat-help">Role preview is read-only. Return to your own dashboard to send a message.</p>}
    {error && <p className="chat-error" role="alert">Could not load messages: {error}</p>}
    {loading ? <p className="chat-help">Loading messages...</p> : <>
      {hasMore && <button className="button button-quiet chat-older" onClick={() => void loadOlder()} disabled={loadingOlder}>{loadingOlder ? 'Loading...' : 'Load older messages'}</button>}
      {messages.length === 0 && !error ? <p className="chat-help">No messages yet. Start the conversation.</p> :
        <div className="chat-messages" aria-label="Circle messages">
          {[...messages].reverse().map((message) => <article className={`chat-message ${message.sender_id === userId ? 'chat-message-own' : ''}`} key={message.id}>
            <div className="chat-message-meta"><strong>{message.sender_name}</strong><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', dateStyle: 'medium', timeStyle: 'short' })}</time></div>
            <p>{message.body}</p>
          </article>)}
        </div>}
    </>}
    <form className="chat-form" onSubmit={(event) => void sendMessage(event)}>
      <label htmlFor="chat-message">Your message</label>
      <textarea id="chat-message" value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} rows={3} disabled={readOnly || sending} placeholder="Write a message to your circle..." />
      {sendError && <p className="chat-error" role="alert">{sendError}</p>}
      <button className="button button-primary" type="submit" disabled={readOnly || sending || loading || loadingOlder || !body.trim()}><Send size={14} /> {sending ? 'Sending...' : 'Send message'}</button>
    </form>
    <div className="privacy-foot"><MessageSquareText size={14} /> Visible to all current members of this circle.</div>
  </section>;
}
