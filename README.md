# Pulse

Pulse is a community finance dashboard for savings circles and other member-led groups. This project is an interactive product prototype built around the **Upendo Circle** demo workspace.

## Features

- Member dashboard with savings, contributions, borrowing limits, reserve progress, and recent transactions
- Savings-over-time and circle-reserve charts
- Weekly contribution tracking and payment submission flow
- Rotation payout schedule and open group proposal voting
- Accountant workspace for reviewing and approving financial records
- Chairman workspace for complaint review and governance recommendations
- System admin workspace for container health and platform operations
- Responsive layout with mobile navigation
Members will be sent otp via Email
## Demo behavior

The application currently uses sample data stored in the React components. Actions are simulated locally in the browser and show confirmation messages, but they do not process real payments, persist reco rds, or connect to a backend.

Use the **View as** selector in the top bar to preview the Member, Accountant, Chairman, and System admin experiences.

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
    ├── App.tsx         # Dashboard UI, demo state, and role views
    ├── main.tsx        # React application entry point
    └── styles.css      # Responsive visual design and layout styles
```

## Available scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and build the production bundle |
| `npm run preview` | Serve the production bundle locally |

## Roadmap

Potential next steps for turning the prototype into a production product include:

- Add authentication and role-based access control
- Connect contributions, loans, payouts, and proposals to a persistent API
- Integrate payment verification with a supported payment provider
- Add server-side audit history and notifications
- Add automated tests for financial workflows and permission boundaries
