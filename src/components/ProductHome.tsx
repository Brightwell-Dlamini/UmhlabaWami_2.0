import React from 'react';
import {
  Building2,
  ClipboardList,
  Shield,
  Wrench,
  Users,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Command as CommandIcon,
} from 'lucide-react';
import { Kbd } from './ui/Kbd';

interface Props {
  onSignIn: () => void;
  onRegisterOrganisation: () => void;
}

/**
 * Unauthenticated entry for Umhlaba Wami — Commercial Property Management System.
 * This is NOT a property listing or discovery marketplace.
 * It is the product gateway for commercial property owners and their teams.
 */
export function ProductHome({ onSignIn, onRegisterOrganisation }: Props) {
  const capabilities = [
    {
      icon: ClipboardList,
      title: 'Maintenance & tickets',
      body: 'Raise, assign, resolve and confirm work orders with full timeline and SLA tracking.',
    },
    {
      icon: Building2,
      title: 'Centres, units & tenants',
      body: 'Manage shopping centres, commercial units, occupancy and tenant records in one place.',
    },
    {
      icon: Shield,
      title: 'Configurable SLAs',
      body: 'Set response and resolution targets by priority and keep operations accountable.',
    },
    {
      icon: Wrench,
      title: 'Preventive maintenance',
      body: 'Schedule recurring facility work so centres stay compliant and downtime is reduced.',
    },
    {
      icon: Users,
      title: 'Roles for every stakeholder',
      body: 'Property managers, technicians, finance, tenants and org admins each get a focused workspace.',
    },
    {
      icon: BarChart3,
      title: 'Operations visibility',
      body: 'Centre Pulse and reports give live situational awareness across your portfolio.',
    },
  ];

  return (
    <div className="flex-1 bg-[var(--uw-bg)]">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-[var(--uw-border)]">
        {/* Accent wash — subtle, not garish */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none opacity-[0.55] dark:opacity-[0.7]"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(124,92,255,0.18), transparent 70%)',
          }}
        />
        {/* Hairline grid */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none opacity-[0.4] dark:opacity-[0.25]"
          style={{
            backgroundImage:
              'linear-gradient(to right, var(--uw-border) 1px, transparent 1px), linear-gradient(to bottom, var(--uw-border) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage:
              'radial-gradient(ellipse 70% 60% at 50% 0%, black, transparent 75%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 70% 60% at 50% 0%, black, transparent 75%)',
          }}
        />

        <div className="relative max-w-[1100px] mx-auto px-5 sm:px-6 py-20 md:py-28">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-2.5 h-6 rounded-full border border-accent-500/25 bg-accent-500/8 text-accent-500 text-[11px] font-medium mb-6">
            <Sparkles className="w-3 h-3" strokeWidth={2} />
            <span>Commercial property management</span>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-semibold text-[var(--uw-text)] leading-[1.05] tracking-tighter max-w-4xl">
            Run your centres
            <br />
            like a product team.
          </h1>

          <p className="mt-6 text-base md:text-lg text-[var(--uw-text-muted)] max-w-2xl leading-relaxed">
            Tickets, tenants, units, leases, and finance — one workspace for
            commercial property operations in the Kingdom of Eswatini.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={onSignIn}
              className="inline-flex items-center justify-center gap-2 h-control-lg rounded-lg bg-accent-500 px-5 text-sm font-semibold text-white hover:bg-accent-600 transition-colors duration-fast"
            >
              Sign in to your organisation
              <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={onRegisterOrganisation}
              className="inline-flex items-center justify-center gap-2 h-control-lg rounded-lg border border-[var(--uw-border-soft)] bg-[var(--uw-surface)] px-5 text-sm font-medium text-[var(--uw-text)] hover:bg-[var(--uw-surface-raised)] hover:border-[var(--uw-border-strong)] transition-colors duration-fast"
            >
              Register organisation
            </button>
          </div>

          {/* Command hint */}
          <div className="mt-8 flex items-center gap-2 text-xs text-[var(--uw-text-subtle)]">
            <CommandIcon className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Once signed in, press</span>
            <Kbd>⌘K</Kbd>
            <span>to jump anywhere.</span>
          </div>

          {/* Trust strip */}
          <ul className="mt-10 flex flex-col sm:flex-row flex-wrap gap-x-6 gap-y-2 text-xs text-[var(--uw-text-muted)]">
            {[
              'Organisation-scoped multi-tenant security',
              'Role-based dashboards',
              'SLA-backed maintenance workflows',
            ].map((item) => (
              <li key={item} className="inline-flex items-center gap-2">
                <CheckCircle2
                  className="w-3.5 h-3.5 text-success-500 shrink-0"
                  strokeWidth={2}
                />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CAPABILITIES */}
      <section className="max-w-[1100px] mx-auto px-5 sm:px-6 py-16 md:py-20">
        <div className="max-w-2xl">
          <h2 className="font-display text-2xl md:text-3xl font-semibold text-[var(--uw-text)] tracking-tight">
            What your team manages
          </h2>
          <p className="mt-3 text-sm text-[var(--uw-text-muted)] leading-relaxed">
            Every capability below is for operators of commercial property —
            not for browsing listings as a consumer.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {capabilities.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.title}
                className="group relative rounded-lg border border-[var(--uw-border)] bg-[var(--uw-surface)] p-4 transition-[border-color,background-color] duration-fast hover:border-[var(--uw-border-strong)] hover:bg-[var(--uw-surface-raised)]"
              >
                <div className="inline-flex rounded-md bg-accent-500/10 border border-accent-500/20 p-1.5 text-accent-500">
                  <Icon className="w-4 h-4" strokeWidth={1.75} />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-[var(--uw-text)]">
                  {c.title}
                </h3>
                <p className="mt-1.5 text-xs text-[var(--uw-text-muted)] leading-relaxed">
                  {c.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[var(--uw-border)] bg-[var(--uw-surface)]">
        <div className="max-w-[1100px] mx-auto px-5 sm:px-6 py-14 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h2 className="font-display text-xl font-semibold text-[var(--uw-text)] tracking-tight">
              Ready to manage your portfolio?
            </h2>
            <p className="mt-1.5 text-sm text-[var(--uw-text-muted)]">
              Use your organisation code and username to access the operations
              workspace.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onSignIn}
              className="inline-flex items-center justify-center h-control rounded-lg bg-accent-500 px-4 text-sm font-semibold text-white hover:bg-accent-600 transition-colors duration-fast"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={onRegisterOrganisation}
              className="inline-flex items-center justify-center h-control rounded-lg border border-[var(--uw-border-soft)] bg-transparent px-4 text-sm font-medium text-[var(--uw-text)] hover:bg-[var(--uw-surface-raised)] hover:border-[var(--uw-border-strong)] transition-colors duration-fast"
            >
              Register organisation
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
