import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';

const configNames = [
  'PULSE_TEST_SUPABASE_URL',
  'PULSE_TEST_SUPABASE_ANON_KEY',
  'PULSE_TEST_SUPABASE_SERVICE_ROLE_KEY',
  'PULSE_TEST_SUPABASE_PROJECT_REF',
  'PULSE_TEST_SUPABASE_ALLOW_MUTATIONS',
] as const;
const configuredValues = configNames.map((name) => process.env[name]);
const integrationConfigured = configuredValues.some(Boolean);

function getIntegrationConfig() {
  const url = process.env.PULSE_TEST_SUPABASE_URL;
  const anonKey = process.env.PULSE_TEST_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.PULSE_TEST_SUPABASE_SERVICE_ROLE_KEY;
  const projectRef = process.env.PULSE_TEST_SUPABASE_PROJECT_REF;
  const allowMutations = process.env.PULSE_TEST_SUPABASE_ALLOW_MUTATIONS;
  if (!url || !anonKey || !serviceRoleKey || !projectRef || !allowMutations) {
    const missingNames = configNames.filter((name) => !process.env[name]);
    throw new Error(`Missing integration test configuration: ${missingNames.join(', ')}`);
  }

  const parsedUrl = new URL(url);
  if (
    parsedUrl.protocol !== 'https:'
    || parsedUrl.hostname !== `${projectRef}.supabase.co`
    || allowMutations !== 'yes'
  ) {
    throw new Error(
      'Integration tests require the matching Supabase project URL and PULSE_TEST_SUPABASE_ALLOW_MUTATIONS=yes.',
    );
  }

  return { url, anonKey, serviceRoleKey };
}

test('contribution submission and review enforce roles and write audit records', {
  skip: integrationConfigured ? false : 'Configure a disposable Supabase test project to run integration tests.',
}, async (t) => {
  const { url, anonKey, serviceRoleKey } = getIntegrationConfig();
  const service = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const createdUsers: string[] = [];
  let circleId: string | undefined;

  t.after(async () => {
    const cleanupErrors: string[] = [];
    if (circleId) {
      const { error: auditCleanupError } = await service.from('audit_logs').delete().eq('circle_id', circleId);
      if (auditCleanupError) cleanupErrors.push(`test audit records: ${auditCleanupError.message}`);
      const { error } = await service.from('circles').delete().eq('id', circleId);
      if (error) cleanupErrors.push(`test circle: ${error.message}`);
    }

    for (const userId of createdUsers) {
      const { error } = await service.auth.admin.deleteUser(userId);
      if (error) cleanupErrors.push(`test user ${userId}: ${error.message}`);
    }
    if (cleanupErrors.length > 0) throw new Error(`Could not clean up ${cleanupErrors.join('; ')}`);
  });

  async function createUser(label: string) {
    const email = `pulse-${label}-${randomUUID()}@example.com`;
    const password = `${randomUUID()}-${randomUUID()}`;
    const { data, error } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `Pulse integration ${label}` },
    });
    if (error) throw new Error(`Could not create test user: ${error.message}`);
    createdUsers.push(data.user.id);
    return { id: data.user.id, email, password };
  }

  const owner = await createUser('owner');
  const member = await createUser('member');
  const accountant = await createUser('accountant');
  const outsider = await createUser('outsider');

  const { data: circle, error: circleError } = await service
    .from('circles')
    .insert({ name: `Pulse integration ${randomUUID()}`, created_by: owner.id })
    .select('id')
    .single();
  if (circleError) throw new Error(`Could not create test circle: ${circleError.message}`);
  circleId = circle.id;
  const testCircleId = circle.id;

  const { error: membershipError } = await service.from('circle_members').insert([
    { circle_id: testCircleId, user_id: owner.id, role: 'SYSTEM_ADMIN' },
    { circle_id: testCircleId, user_id: member.id, role: 'MEMBER' },
    { circle_id: testCircleId, user_id: accountant.id, role: 'ACCOUNTANT' },
  ]);
  if (membershipError) throw new Error(`Could not create test memberships: ${membershipError.message}`);

  async function signIn(user: { email: string; password: string }) {
    const client = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await client.auth.signInWithPassword(user);
    if (error) throw new Error(`Could not sign in test user: ${error.message}`);
    return client;
  }

  const memberClient = await signIn(member);
  const accountantClient = await signIn(accountant);
  const outsiderClient = await signIn(outsider);

  async function submitContribution(client: Awaited<ReturnType<typeof signIn>>, reference: string) {
    const { data, error } = await client.rpc('submit_contribution', {
      target_circle: testCircleId,
      contribution_amount: 1000,
      transaction_reference: reference,
      sender_phone: '+254712345678',
    });
    return { data, error };
  }

  const firstSubmission = await submitContribution(memberClient, `PULSE${randomUUID().replaceAll('-', '').slice(0, 20)}`);
  assert.ifError(firstSubmission.error);
  assert.ok(firstSubmission.data);
  const verifiedContributionId = firstSubmission.data;

  const { data: submittedRecord, error: submittedRecordError } = await service
    .from('contributions')
    .select('member_id, status')
    .eq('id', verifiedContributionId)
    .single();
  assert.ifError(submittedRecordError);
  assert.equal(submittedRecord.member_id, member.id);
  assert.equal(submittedRecord.status, 'PENDING');

  const outsiderSubmission = await submitContribution(
    outsiderClient,
    `PULSE${randomUUID().replaceAll('-', '').slice(0, 20)}`,
  );
  assert.ok(outsiderSubmission.error);

  const memberReview = await memberClient.rpc('review_contribution', {
    target_contribution: verifiedContributionId,
    review_status: 'VERIFIED',
  });
  assert.ok(memberReview.error);

  const { error: verifiedReviewError } = await accountantClient.rpc('review_contribution', {
    target_contribution: verifiedContributionId,
    review_status: 'VERIFIED',
  });
  assert.ifError(verifiedReviewError);

  const duplicateReview = await accountantClient.rpc('review_contribution', {
    target_contribution: verifiedContributionId,
    review_status: 'REJECTED',
    decision_reason: 'This contribution has already been reviewed.',
  });
  assert.ok(duplicateReview.error);

  const secondSubmission = await submitContribution(memberClient, `PULSE${randomUUID().replaceAll('-', '').slice(0, 20)}`);
  assert.ifError(secondSubmission.error);
  assert.ok(secondSubmission.data);
  const rejectedContributionId = secondSubmission.data;

  const { error: rejectedReviewError } = await accountantClient.rpc('review_contribution', {
    target_contribution: rejectedContributionId,
    review_status: 'REJECTED',
    decision_reason: 'Reference did not match the statement.',
  });
  assert.ifError(rejectedReviewError);

  const { data: auditRecords, error: auditError } = await service
    .from('audit_logs')
    .select('action, actor_id, entity_id')
    .in('entity_id', [verifiedContributionId, rejectedContributionId]);
  assert.ifError(auditError);
  assert.deepEqual(
    auditRecords.map((record) => `${record.entity_id}:${record.action}:${record.actor_id}`).sort(),
    [
      `${verifiedContributionId}:CONTRIBUTION_SUBMITTED:${member.id}`,
      `${verifiedContributionId}:CONTRIBUTION_VERIFIED:${accountant.id}`,
      `${rejectedContributionId}:CONTRIBUTION_SUBMITTED:${member.id}`,
      `${rejectedContributionId}:CONTRIBUTION_REJECTED:${accountant.id}`,
    ].sort(),
  );

  const { data: reviewedRecords, error: reviewedRecordsError } = await service
    .from('contributions')
    .select('id, status')
    .in('id', [verifiedContributionId, rejectedContributionId]);
  assert.ifError(reviewedRecordsError);
  assert.deepEqual(
    reviewedRecords.map((record) => `${record.id}:${record.status}`).sort(),
    [
      `${verifiedContributionId}:VERIFIED`,
      `${rejectedContributionId}:REJECTED`,
    ].sort(),
  );

  const { data: rejectedPayment, error: rejectedPaymentError } = await service
    .from('contribution_payment_details')
    .select('rejection_reason')
    .eq('contribution_id', rejectedContributionId)
    .single();
  assert.ifError(rejectedPaymentError);
  assert.equal(rejectedPayment.rejection_reason, 'Reference did not match the statement.');
});
