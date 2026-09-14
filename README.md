# Umhlaba Wami 2.0

**Commercial Property Management Platform**

Umhlaba Wami is a multi-tenant, multi-role single-page application designed for the day-to-day operations of commercial centres (shopping centres, office parks, mixed-use commercial properties) in Eswatini and similar markets. It provides organisation onboarding, role-based dashboards, maintenance ticketing with full lifecycle support, leasing visibility, tenant portals, finance workflows, vendor coordination, and a public marketplace for vacant commercial units and landlord leads.

> **Product positioning**: Pure commercial property management platform with supporting public marketplace for enquiries and landlord acquisition. Residential listing features have been de-emphasised in favour of commercial operations excellence.

## Key Features (Phase 1 Foundation)

- **Multi-role SPA**: Coherent dashboards and navigation for every stakeholder role (Tenant, Property Manager, Maintenance, Finance, Admin, Super Admin).
- **Organisation onboarding**: Registration → Super Admin approval → login with organisation code + username.
- **Ticket lifecycle**: Create → Assign → Resolve → Confirm (with timeline, attachments, SLA status, ratings).
- **Public marketplace**: Browse available commercial units, submit enquiries, and capture landlord leads.
- **Seed data**: Centres, organisations, units, tenants, leases, tickets across full lifecycle, staff, vendors, announcements.
- **Dark mode**: Fully supported and toggleable.
- **Responsive**: Usable on tablet and modern mobile viewports.
- **Domain model**: Aligned with future Supabase schema (organisations, centres, properties/shops, tenants, leases, tickets, SLAs, vendors, finance transactions, notifications, audit).
- **Role permission helpers**: Centralised role-based access patterns.
- **In-memory / local store**: All major modals and wizards operate against the local `db` service for demonstration and rapid iteration.

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite 6 |
| Styling | Tailwind CSS 4 |
| Icons | Lucide React |
| Animation | Motion |
| Package manager | Bun (lockfile present) |
| Future backend | Supabase (Auth, PostgreSQL + RLS, Storage) — planned Phase 2 |

## Getting Started

### Prerequisites

- Node.js 20+ or Bun
- Git

### Installation

```bash
git clone https://github.com/Brightwell-Dlamini/UmhlabaWami_2.0.git
cd UmhlabaWami_2.0
bun install          # or npm install / pnpm install
bun run dev          # starts Vite on http://0.0.0.0:3000
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Development server (port 3000, host 0.0.0.0) |
| `bun run build` | Production build |
| `bun run preview` | Preview production build |
| `bun run lint` | TypeScript check (`tsc --noEmit`) |
| `bun run clean` | Remove dist and server artefacts |

## Project Structure

```
UmhlabaWami_2.0/
├── index.html                 # Entry HTML + meta / fonts
├── package.json
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── main.tsx               # React root
│   ├── App.tsx                # Top-level routing of views + modal orchestration
│   ├── index.css              # Tailwind + base typography
│   ├── types/
│   │   └── index.ts           # Full domain model (User, Organization, Shop, Ticket, Lease, …)
│   ├── services/
│   │   ├── auth.ts            # Auth state, login, logout, session, role helpers
│   │   └── db.ts              # In-memory store, seed data, CRUD, subscriptions
│   └── components/
│       ├── auth/              # LoginModal, RegisterOrgModal
│       ├── layout/            # Navbar, Sidebar, Footer
│       ├── marketplace/       # Public marketplace, property cards, enquiry & lead modals
│       ├── dashboard/         # Role-specific portals and shared operational views
│       ├── management/        # Units directory, Lease management
│       └── tickets/           # CreateTicketWizard, TicketDetailModal
└── docs/                      # Extended documentation (this release)
    ├── ARCHITECTURE.md
    ├── DATA_MODEL.md
    ├── ROLES_AND_PERMISSIONS.md
    ├── FEATURES.md
    └── ROADMAP.md
```

## Core User Flows (Phase 1)

1. **Public visitor** lands on marketplace → browses units → submits enquiry or landlord lead.
2. **Organisation registration** via modal → creates Pending organisation → Super Admin reviews and approves.
3. **Login** with organisation code + username → lands on role-specific dashboard.
4. **Ticket path**: Tenant or Manager creates ticket → Manager assigns → Technician progresses & resolves → Tenant confirms.
5. **Operational views**: Units directory, leases, tenants list, vendors, staff schedule, announcements, messages, analytics, org settings & users.

## Roles at a Glance

| Role | Primary focus |
|------|----------------|
| `tenant` | Shop overview, raise tickets, view documents, announcements, messages |
| `property_manager` | Centre overview, tickets, units, tenants, leases, staff, vendors, broadcasts |
| `maintenance` | Assigned tickets, schedule, resolution workflow |
| `finance` | Transactions, requests, rent-related visibility |
| `admin` | Organisation users, settings, full operational control within org |
| `super_admin` | Cross-organisation approval, platform-level oversight |

See [docs/ROLES_AND_PERMISSIONS.md](docs/ROLES_AND_PERMISSIONS.md) for detailed permission matrix.

## Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [Domain Data Model](docs/DATA_MODEL.md)
- [Roles & Permissions](docs/ROLES_AND_PERMISSIONS.md)
- [Feature Catalogue](docs/FEATURES.md)
- [Product Roadmap](docs/ROADMAP.md)

## Phase Strategy

This repository is being developed in deliberate phases:

- **Phase 1 (current)**: Core product foundation — multi-role SPA, organisation onboarding, coherent dashboards, ticket lifecycle, marketplace enquiries/leads, seed data, dark mode, responsive shell, core documentation. Local in-memory store only.
- **Phase 2**: True multi-tenant backend (Supabase Auth + PostgreSQL + RLS + Storage), environment configuration, removal of localStorage/mock dependency, organisation isolation, live Vercel deployment.
- **Phase 3**: Operations excellence — Centre Pulse, configurable SLAs & escalation, preventive maintenance, vendor rostering, PWA shell, reliability polish, profile settings.
- **Phase 4**: Commercial engine & marketplace growth — leasing pipeline, rent roll, deposits, board packs, organisation subscription tiers, full accounting (Express-Invoice style), tenant statements with flexible periods.

## Licence & Ownership

Proprietary. All rights reserved by the repository owner (Brightwell Dlamini).  
Contact the repository owner for licensing or collaboration enquiries.

## Contributing / Next Steps

Phase 1 delivers a demonstrable, documented foundation. Subsequent phases will introduce the production backend and operational/commercial depth. Issues and pull requests should reference the relevant phase.

---

*Manage Better. Respond Faster. Know More.*
