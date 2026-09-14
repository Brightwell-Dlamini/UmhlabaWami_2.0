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
} from 'lucide-react';

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
      body: 'Property managers, technicians, finance, tenants and organisation admins each get a focused workspace.',
    },
    {
      icon: BarChart3,
      title: 'Operations visibility',
      body: 'Centre Pulse and reports give live situational awareness across your portfolio.',
    },
  ];

  return (
    <div className="flex-1 bg-slate-50 dark:bg-slate-950">
      <section className="relative overflow-hidden border-b border-slate-200 dark:border-slate-800">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-slate-900/5 dark:from-blue-500/10 pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-16 md:py-24">
          <div className="mb-4">
            <img
              src="/Umhlaba Wami logo p.png"
              alt="Umhlaba Wami"
              className="h-12 w-auto object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/Umhlaba Wami logo.jpg';
              }}
            />
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-3">
            Commercial property management
          </p>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 dark:text-white leading-tight max-w-3xl">
            Run your centres day to day — tickets, tenants, units and operations in one system.
          </h1>
          <p className="mt-5 text-base md:text-lg text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            Umhlaba Wami is built for commercial property owners and management companies.
            Sign in to your organisation workspace. 
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onSignIn}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm shadow-blue-600/20"
            >
              Sign in to your organisation
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onRegisterOrganisation}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-6 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Register your organisation
            </button>
          </div>
          <ul className="mt-8 flex flex-col sm:flex-row flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
            {['Organisation-scoped multi-tenant security', 'Role-based dashboards', 'SLA-backed maintenance workflows'].map(
              (item) => (
                <li key={item} className="inline-flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  {item}
                </li>
              )
            )}
          </ul>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-14 md:py-16">
        <h2 className="font-display text-xl md:text-2xl font-semibold text-slate-900 dark:text-white">
          What your team manages inside the platform
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
          Every capability below is for operators of commercial property — not for browsing listings as a consumer.
        </p>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {capabilities.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.title}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm"
              >
                <div className="inline-flex rounded-lg bg-blue-50 dark:bg-blue-950/50 p-2 text-blue-600 dark:text-blue-400">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">{c.title}</h3>
                <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{c.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              Ready to manage your portfolio?
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Use your organisation code and username to access the operations workspace.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <button
              type="button"
              onClick={onSignIn}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={onRegisterOrganisation}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 dark:border-slate-600 px-5 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Register organisation
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
