import React from 'react';
import { Phone, Mail, MapPin, ShieldCheck } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-400 text-xs border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                UW
              </div>
              <span className="text-base font-bold text-white font-display">Umhlaba Wami</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Commercial property management for the Kingdom of Eswatini. Centres, units, tenants,
              maintenance, and finance in one platform.
            </p>
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
              <ShieldCheck className="w-4 h-4" />
              <span>Property management · Eswatini</span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider">Platform</h4>
            <ul className="space-y-2">
              <li><span>Tenant maintenance desk</span></li>
              <li><span>SLA response tracking</span></li>
              <li><span>Commercial leases and renewals</span></li>
              <li><span>Rent roll and finance export</span></li>
              <li><span>Staff rostering and vendors</span></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider">
              Kingdom of Eswatini HQ
            </h4>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <span>Ezulwini Valley Commercial Park, Block B, Suite 104, Kingdom of Eswatini</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-500 shrink-0" />
                <span>+268 2416 1000 / +268 7602 0001</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-500 shrink-0" />
                <span>contact@umhlabawami.sz</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500 text-[11px]">
          <div>
            © {new Date().getFullYear()} Umhlaba Wami Technologies (Pty) Ltd. All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <span>Commercial Terms</span>
            <span>Privacy Policy</span>
            <span>SLA Guarantee</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
