import React from 'react';
import { Phone, Mail, MapPin } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[var(--uw-surface)] border-t border-[var(--uw-border)]">
      <div className="max-w-[1100px] mx-auto px-5 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-accent-500 flex items-center justify-center text-white font-bold text-[11px]">
                UW
              </div>
              <span className="text-sm font-semibold text-[var(--uw-text)]">
                Umhlaba Wami
              </span>
            </div>
            <p className="text-xs text-[var(--uw-text-muted)] leading-relaxed max-w-xs">
              Commercial property management for the Kingdom of Eswatini.
              Centres, units, tenants, maintenance, and finance in one
              platform.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-semibold text-[var(--uw-text-subtle)] uppercase tracking-wider">
              Platform
            </h4>
            <ul className="space-y-2 text-xs text-[var(--uw-text-muted)]">
              <li>Tenant maintenance desk</li>
              <li>SLA response tracking</li>
              <li>Commercial leases and renewals</li>
              <li>Rent roll and finance export</li>
              <li>Staff rostering and vendors</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-semibold text-[var(--uw-text-subtle)] uppercase tracking-wider">
              Kingdom of Eswatini HQ
            </h4>
            <div className="space-y-2 text-xs text-[var(--uw-text-muted)]">
              <div className="flex items-start gap-2">
                <MapPin
                  className="w-3.5 h-3.5 text-accent-500 shrink-0 mt-0.5"
                  strokeWidth={1.75}
                />
                <span>
                  Ezulwini Valley Commercial Park, Block B, Suite 104
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Phone
                  className="w-3.5 h-3.5 text-accent-500 shrink-0"
                  strokeWidth={1.75}
                />
                <span className="font-mono">+268 2416 1000</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail
                  className="w-3.5 h-3.5 text-accent-500 shrink-0"
                  strokeWidth={1.75}
                />
                <span>contact@umhlabawami.sz</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-[var(--uw-border)] flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[var(--uw-text-subtle)]">
          <div>
            © {new Date().getFullYear()} Umhlaba Wami Technologies (Pty) Ltd.
          </div>
          <div className="flex items-center gap-4">
            <span>Terms</span>
            <span>Privacy</span>
            <span>SLA</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
