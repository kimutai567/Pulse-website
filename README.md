# Pulse

Pulse is a community finance workspace for savings circles and other member-led groups. The product is being built around the **Upendo Circle** workspace, with Supabase providing email OTP authentication and the initial database foundation.

## Features

- Member dashboard with savings, contributions, borrowing limits, reserve progress, and recent transactions
- Savings-over-time and circle-reserve charts
- Weekly contribution tracking and payment submission flow
- Rotation payout schedule and open group proposal voting
- Accountant workspace for reviewing and approving financial records
- Chairman workspace showing stored open complaints, proposals, and vote counts (read-only)
- Shared circle chat with saved history for all current circle members
- System admin workspace for container health and platform operations
- Responsive layout with mobile navigation

## Live contribution workflow and remaining sample data

Authentication and circle invitations are connected to Supabase. After applying migration `005_persistent_contributions.sql`, signed-in members can submit contribution records and accountants can verify or reject them. Submission details are restricted to the submitting member and authorized circle finance admins, and submission/review actions are written to the audit log.

This workflow records payments members say they have already made; it does not initiate, receive, or automatically verify M-Pesa payments. Accountants must match the transaction reference manually. Member savings totals and history are calculated only from verified stored contributions. Loan eligibility, circle reserves, rotation payouts, and the member proposal screen are not connected and are shown as unavailable outside the demo preview.

### Upendo reserve and loan rules

The following confirmed rules supersede conflicting reserve and loan terms in the product specification for Upendo Circle:

- The full KES 200 of a KES 1,000 weekly contribution goes to the reserve. For partial payments, 20% goes to the reserve. No part of this allocation goes to the admin pool.
- After completing a full rotation, every member has a starting loan limit of at least KES 1,000. Limits can grow with savings; above the starting limit, the specified self-guaranteed and guarantor-backed savings limits apply.
- The reserve starts at KES 0. Normal loans are funded from the reserve and can begin after a full rotation, before the one-year vote. There is no protected minimum reserve balance for these loans.
- Standard terms are 10% flat interest, repayment within 14 days, a 7-day grace period, and a KES 150 fine when grace ends and every 7 days thereafter while a balance remains. Repayments are allocated to fines, then interest, then principal. All interest and fines go to the admin pool; principal repayments return to the reserve.
- Accountants and system admins will verify opening savings and completed rotations. Disbursements and repayments will be recorded and verified manually; Pulse will not transfer money.

These are intended rules, not connected functionality. Loan eligibility, requests, reserve balances, and repayments are not yet tracked. A cutoff for existing records is still needed before the system can safely determine available loan funds. The existing contribution dashboard does not calculate the reserve allocation.

The Chairman dashboard reads existing complaint, proposal, and vote records for the signed-in user's circle. Its counts include complaints marked open or under investigation and proposals marked open; vote totals count responses to those open proposals, including proposals past their closing date until their status changes. Lists show up to ten records. Complaint handling, recommendations, proposal creation, and voting are not connected in the dashboard. Role preview uses the signed-in account's actual permissions and is read-only.

After migration `006_circle_chat.sql` is applied, all current members can read and send messages in their circle's shared chat. New members can read messages from before they joined; former members lose access. Messages remain stored until manually removed by a database administrator or the circle itself is deleted, and the app does not offer message editing or deletion. The chat is not end-to-end encrypted and is intended for circle-wide discussion, not private messages or secrets. Use Refresh to check for new messages and Load older messages to browse history. Demo mode cannot access real chats; role previews can read with the signed-in account's permissions but cannot send.

After applying migrations `007_admin_account_deletion.sql` and `008_fix_account_deletion_without_platform_admins.sql`, circle System Admins can delete member accounts from the circle administration dashboard. Migration 008 also supports projects that have not installed the optional platform administration migration 004. Deletion removes the user's Supabase Auth account and circle memberships, retains financial and history records under an anonymized profile, and clears stored payment phone numbers. Self-deletion, platform administrator deletion, and deletion of the last System Admin in any affected circle are blocked. The deleted email can be invited again using **Invite member**.

The optional demo preview still uses local sample data and is explicitly labeled as a demo. Use its **View as** selector to preview the Member, Accountant, Chairman, and System admin experiences.

## Supabase email OTP setup

The sign-in screen requests an email OTP through Supabase Auth. For real users, configure email delivery in the Supabase dashboard:

1. Open **Authentication → SMTP Settings** and enable a custom SMTP provider. Supabase's default sender is for testing only; it is limited to project-team email addresses and currently allows 2 messages per hour.
2. Set the sender address and SMTP credentials from your email provider. Keep SMTP credentials in Supabase, never in this frontend project.
3. In **Authentication → URL Configuration**, set the site URL and add the local development origin and deployed app origin to the redirect URL allow list.
4. In the email template used for sign-in, include Supabase's `{{ .Token }}` variable so recipients can enter the six-digit code.

The login form displays the Supabase error when delivery fails and gives specific guidance for SMTP restrictions and rate limits.

## Tech stack

- React
- TypeScript
- Vite
- Recharts
- Lucide React
- CSS

## Getting started

### Prerequisites

- Node.js 18 or newer
- npm

### Install dependencies

```bash
npm install
```

### Start the development server

```bash
npm run dev
```

Vite will print the local URL in the terminal, usually `http://localhost:5173`.

### Create a production build

```bash
npm run build
```

### Preview the production build

```bash
npm run preview
```

## Project structure

```text
.
├── index.html          # HTML entry point and document metadata
├── package.json        # Scripts and dependencies
├── vite.config.ts      # Vite configuration
└── src/
    ├── App.tsx         # Dashboard UI, Supabase auth, demo state, and role views
    ├── main.tsx        # React application entry point
    ├── styles.css      # Responsive visual design and layout styles
    └── lib/supabase.ts # Supabase client configuration
```

## Available scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and build the production bundle |
| `npm run preview` | Serve the production bundle locally |

## Roadmap

Next steps for turning the remaining prototype into a production product include:

- Connect loans, payouts, and proposals to persistent workflows
- Integrate payment verification with a supported payment provider
- Add an audit history screen and notifications
- Add automated tests for financial workflows and permission boundaries

## Supabase setup

1. Copy `.env.example` to `.env.local` and add the Supabase project URL and publishable key.
2. Run `supabase/migrations/001_initial_schema.sql`, `002_invites_and_bootstrap.sql`, `003_accept_circle_invites.sql`, `004_platform_administration.sql` (if using platform administration), `005_persistent_contributions.sql`, `006_circle_chat.sql`, `007_admin_account_deletion.sql`, and `008_fix_account_deletion_without_platform_admins.sql` in the Supabase SQL Editor, in order. On an existing project, run only migrations that have not already been applied.
3. Enable Email authentication. Configure the Magic Link email template to include `{{ .ConfirmationURL }}` as the invitation/sign-in link and `{{ .Token }}` as a code alternative. Add the app origin (for example, `http://localhost:5173`) to Supabase's allowed redirect URLs.
4. The first person to sign in becomes the Upendo Circle System Admin. From the admin dashboard, choose **Invite member**, enter the member's email, and assign Member, Accountant, Chairman, or System Admin. Pulse saves the role before asking Supabase Auth to email the sign-in link; after the invitee signs in, that role is applied automatically. The optional name is used for their profile.

## Platform administration (staged)

Platform administration is separate from circle membership. Migration `004_platform_administration.sql` adds a platform administrator registry and restricted functions to list containers, create a container, and invite its circle administrator. These functions do not grant platform administrators access to circle financial tables. An administrator who is separately assigned a circle role retains the access granted by that role; a platform administrator who appoints an account as circle administrator grants that account the existing circle administrator permissions.

The platform administration screen is not currently connected to the restored dashboard. Before integrating and enabling it, apply migrations 001 through 004 to a separate test Supabase project, verify the permissions and invitation flow there, and configure working Supabase email delivery. Do not rerun already-applied migrations on an existing database. Migration 004 does not automatically grant anyone platform administrator access. An operator with database access must explicitly grant it to an existing account, for example in the Supabase SQL Editor:

```sql
insert into public.platform_admins (user_id)
select id from auth.users
where lower(email) = lower('admin@example.com')
on conflict (user_id) do nothing;
```

Replace the example address with the intended account and check the affected row count. Keep the feature disabled in production until integration and testing succeed.

The container and administrator invitation are saved before Supabase sends the sign-in email. If delivery fails, the platform screen offers a retry; the assignment remains pending. Existing users receive their new circle role when they next sign in and accept pending invitations. The platform administrator is not automatically enrolled in new containers.

The contribution submission and accountant review flow is persistent after migration 005 is applied. The Chairman dashboard reads existing governance records but does not yet support governance actions. Other financial actions remain prototypes. Test the contribution workflow on a separate Supabase project before using it with real group records. Do not treat a submitted record as proof of payment; M-Pesa reconciliation is manual and no funds move through Pulse.