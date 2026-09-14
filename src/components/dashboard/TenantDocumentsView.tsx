import React, { useState } from 'react';
import {
  FileText,
  Download,
  Upload,
  CheckCircle2,
  FileCheck,
  ShieldAlert,
  Calendar,
  Lock,
} from 'lucide-react';
import { auth } from '../../services/auth';

interface DocumentItem {
  id: string;
  title: string;
  category: string;
  date: string;
  size: string;
  status: 'Verified' | 'Signed' | 'Expiring Soon';
}

export const TenantDocumentsView: React.FC = () => {
  const currentUser = auth.getCurrentUser();
  const [downloadMsg, setDownloadMsg] = useState('');

  const documents: DocumentItem[] = [
    {
      id: 'doc_01',
      title: 'Commercial Lease Agreement — Shop G-14 (Signed Copy)',
      category: 'Legal / Tenancy',
      date: '2026-09-01',
      size: '2.4 MB',
      status: 'Signed',
    },
    {
      id: 'doc_02',
      title: 'Electrical Certificate of Compliance (COC)',
      category: 'Safety & Compliance',
      date: '2026-08-15',
      size: '1.1 MB',
      status: 'Verified',
    },
    {
      id: 'doc_03',
      title: 'Eswatini Fire & Rescue Annual Inspection Certificate',
      category: 'Safety & Compliance',
      date: '2026-07-20',
      size: '890 KB',
      status: 'Verified',
    },
    {
      id: 'doc_04',
      title: 'The Gables Shopping Centre Tenant Handover & Rules',
      category: 'Centre Operations',
      date: '2026-08-01',
      size: '3.6 MB',
      status: 'Verified',
    },
    {
      id: 'doc_05',
      title: 'Public Liability Insurance Policy Certificate (SZL 5M Cover)',
      category: 'Insurance',
      date: '2026-06-10',
      size: '1.5 MB',
      status: 'Verified',
    },
  ];

  const handleDownload = (docTitle: string) => {
    // Generate simulated text document download
    const content = `Umhlaba Wami Commercial Property Management\nDocument: ${docTitle}\nUnit: Shop G-14\nTenant: ${currentUser?.name || 'Swazi Artisan Crafts'}\nStatus: Officially Verified & Digitally Executed\nDate: ${new Date().toISOString()}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${docTitle.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
    link.click();

    setDownloadMsg(`Downloaded "${docTitle}"`);
    setTimeout(() => setDownloadMsg(''), 3000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Compliance & Tenancy Documents Vault
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Official signed leases, electrical COCs, municipal fire permits, and centre operational guidelines
          </p>
        </div>
      </div>

      {downloadMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{downloadMsg}</span>
        </div>
      )}

      {/* Document Cards */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0 mt-0.5">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      {doc.title}
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      {doc.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                    <span>{doc.category}</span>
                    <span>•</span>
                    <span>Size: {doc.size}</span>
                    <span>•</span>
                    <span>Date: {doc.date}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleDownload(doc.title)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-blue-600 hover:text-white text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
