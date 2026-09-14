import React from 'react';
import { Building2, Phone, Mail, MapPin, ShieldCheck, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-400 text-xs border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Col 1: Branding */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                UW
              </div>
              <span className="text-base font-bold text-white font-display">Umhlaba Wami</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Manage Better. Respond Faster. Know More. The complete commercial property management and vacancy listing platform for the Kingdom of Eswatini.
            </p>
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
              <ShieldCheck className="w-4 h-4" />
              <span>Verified Commercial Network Eswatini</span>
            </div>
          </div>

          {/* Col 2: Marketplace */}
          <div className="space-y-3">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider">
              Vacant Spaces
            </h4>
            <ul className="space-y-2">
              <li><span className="hover:text-white cursor-pointer">The Gables Shopping Centre (Ezulwini)</span></li>
              <li><span className="hover:text-white cursor-pointer">Mbabane Commercial Tower</span></li>
              <li><span className="hover:text-white cursor-pointer">Matsapha Logistics Hub</span></li>
              <li><span className="hover:text-white cursor-pointer">Manzini Mall Retail Units</span></li>
              <li><span className="hover:text-white cursor-pointer">Commercial Offices & Suites</span></li>
            </ul>
          </div>

          {/* Col 3: Operations & Portal */}
          <div className="space-y-3">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider">
              Management Platform
            </h4>
            <ul className="space-y-2">
              <li><span className="hover:text-white cursor-pointer">Tenant Maintenance Desk</span></li>
              <li><span className="hover:text-white cursor-pointer">SLA Response Tower (15-min Emergency)</span></li>
              <li><span className="hover:text-white cursor-pointer">Commercial Leases & Renewals</span></li>
              <li><span className="hover:text-white cursor-pointer">Rent Roll & Sage Export</span></li>
              <li><span className="hover:text-white cursor-pointer">Storefront QR Placard Generator</span></li>
            </ul>
          </div>

          {/* Col 4: Eswatini Contact */}
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

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500 text-[11px]">
          <div>
            © {new Date().getFullYear()} Umhlaba Wami Technologies (Pty) Ltd. All rights reserved. Eswatini Company Reg. #R7/58291.
          </div>
          <div className="flex items-center gap-4">
            <span className="hover:text-slate-400 cursor-pointer">Commercial Terms</span>
            <span className="hover:text-slate-400 cursor-pointer">Privacy Policy</span>
            <span className="hover:text-slate-400 cursor-pointer">SLA Guarantee</span>
            <span className="hover:text-slate-400 cursor-pointer">Eswatini Rent Regulations</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
