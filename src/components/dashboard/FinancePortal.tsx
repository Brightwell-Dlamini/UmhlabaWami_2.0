import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Receipt,
  Download,
  CheckCircle2,
  AlertTriangle,
  Clock,
  PlusCircle,
  Building,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  FileSpreadsheet,
  Edit3,
  Trash2,
  X,
  Printer,
  FileText,
} from 'lucide-react';
import { db } from '../../services/db';
import { FinanceTransaction, Tenant, Shop } from '../../types';

interface FinancePortalProps {
  initialTab?: string;
}

export const FinancePortal: React.FC<FinancePortalProps> = ({ initialTab }) => {
  const [activeTab, setActiveTab] = useState<'rent_roll' | 'expenses' | 'requests'>('rent_roll');
  const [exportNotice, setExportNotice] = useState('');
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([
    ...db.financeTransactions,
  ]);
  const [feedback, setFeedback] = useState('');

  // Modals
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showRequisitionModal, setShowRequisitionModal] = useState(false);
  const [selectedInvoiceTenant, setSelectedInvoiceTenant] = useState<{
    tenant: Tenant;
    shop?: Shop;
    isPaid: boolean;
    ref: string;
  } | null>(null);

  // Expense form
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<
    FinanceTransaction['category']
  >('Maintenance');
  const [expenseAmount, setExpenseAmount] = useState(650);
  const [expenseCenterId, setExpenseCenterId] = useState(
    db.shoppingCenters[0]?.id || ''
  );
  const [expenseMaterials, setExpenseMaterials] = useState('');
  const [expenseStatus, setExpenseStatus] = useState<
    FinanceTransaction['status']
  >('Approved');

  // Requisitions local state
  const [requisitions, setRequisitions] = useState<
    Array<{
      id: string;
      technician: string;
      item: string;
      supplier: string;
      amount: number;
      date: string;
      status: 'Pending' | 'Approved' | 'Disbursed';
    }>
  >([
    {
      id: 'REQ-01',
      technician: 'Sipho Dlamini (Senior Electrician)',
      item: '10x 16A Schneider Circuit Breakers & Conduit',
      supplier: 'Builders Warehouse Matsapha',
      amount: 1450,
      date: '2026-09-07',
      status: 'Pending',
    },
    {
      id: 'REQ-02',
      technician: 'Mandla Vilakati (Plumbing Lead)',
      item: 'Submersible Sump Pump Float Switch',
      supplier: 'Build It Ezulwini',
      amount: 820,
      date: '2026-09-05',
      status: 'Approved',
    },
  ]);

  const [reqTechnician, setReqTechnician] = useState('Sipho Dlamini (Senior Electrician)');
  const [reqItem, setReqItem] = useState('');
  const [reqSupplier, setReqSupplier] = useState('Build It Ezulwini');
  const [reqAmount, setReqAmount] = useState(450);

  useEffect(() => {
    const unsub = db.subscribe(() => {
      setTransactions([...db.financeTransactions]);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (initialTab === 'expenses_ledger' || initialTab === 'expenses') {
      setActiveTab('expenses');
    } else if (initialTab === 'financial_requests' || initialTab === 'requests') {
      setActiveTab('requests');
    } else if (initialTab === 'rent_roll') {
      setActiveTab('rent_roll');
    }
  }, [initialTab]);

  // Rent roll calculation
  const shops = db.shops;
  const totalMonthlyBilled = shops.reduce((acc, s) => acc + s.rental_amount, 0);
  const collectedAmount = Math.round(totalMonthlyBilled * 0.88);
  const arrearsAmount = totalMonthlyBilled - collectedAmount;
  const expenseTransactions = transactions.filter((t) => t.type === 'expense');
  const maintenanceSpend = expenseTransactions.reduce((acc, t) => acc + t.amount, 0);
  const netIncome = collectedAmount - maintenanceSpend;

  const handleExportSage = () => {
    const headers = 'Tenant,Unit,Rental_E,Status,Reference,Date\n';
    const rows = db.tenants
      .map((t) => {
        const s = db.shops.find((shp) => shp.id === t.shop_id);
        return `"${t.business_name}","${s?.shop_number || 'G-14'}",${
          s?.rental_amount || 15000
        },"Paid","EFT-${Date.now().toString().slice(-6)}","2026-09-01"`;
      })
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Umhlaba_Wami_Rent_Roll_Sage_Export_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setExportNotice('Sage Pastel & QuickBooks CSV export generated successfully!');
    setTimeout(() => setExportNotice(''), 3000);
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseDescription.trim()) return;

    db.addFinanceTransaction({
      organization_id: 'org_gables_lifestyle',
      property_id: expenseCenterId,
      type: 'Maintenance Expense',
      direction: 'expense',
      category: expenseCategory,
      amount: Number(expenseAmount),
      description: expenseMaterials
        ? `${expenseDescription.trim()} (Materials: ${expenseMaterials.trim()})`
        : expenseDescription.trim(),
      date: new Date().toISOString().slice(0, 10),
      status: expenseStatus,
      reference: `EXP-${Date.now().toString().slice(-6)}`,
      reconciled: false,
    });

    setFeedback('Maintenance expense successfully posted to general ledger!');
    setTimeout(() => setFeedback(''), 3500);
    setShowExpenseModal(false);
    setExpenseDescription('');
    setExpenseMaterials('');
  };

  const handleDeleteExpense = (id: string) => {
    if (window.confirm('Delete this expense transaction from the ledger?')) {
      const idx = db.financeTransactions.findIndex((t) => t.id === id);
      if (idx !== -1) {
        db.financeTransactions.splice(idx, 1);
        db.saveToStorage();
        setFeedback('Expense transaction removed.');
        setTimeout(() => setFeedback(''), 3500);
      }
    }
  };

  const handleAddRequisition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqItem.trim()) return;

    const newReq = {
      id: `REQ-0${requisitions.length + 1}`,
      technician: reqTechnician,
      item: reqItem.trim(),
      supplier: reqSupplier,
      amount: Number(reqAmount),
      date: new Date().toISOString().slice(0, 10),
      status: 'Pending' as const,
    };

    setRequisitions([newReq, ...requisitions]);
    setFeedback(`Requisition order ${newReq.id} submitted for approval.`);
    setTimeout(() => setFeedback(''), 3500);
    setShowRequisitionModal(false);
    setReqItem('');
  };

  const handleUpdateReqStatus = (
    id: string,
    newStatus: 'Pending' | 'Approved' | 'Disbursed'
  ) => {
    setRequisitions(
      requisitions.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
    );
    setFeedback(`Requisition ${id} marked as ${newStatus}.`);
    setTimeout(() => setFeedback(''), 3500);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-800 to-teal-900 text-white shadow-xl shadow-emerald-900/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-white/20 text-emerald-100">
              Commercial Finance Desk
            </span>
            <span className="text-xs text-emerald-100">Ezulwini Valley Holdings</span>
          </div>
          <h1 className="text-2xl font-bold font-display">
            Portfolio Rent Roll & Financial Ledger
          </h1>
          <p className="text-xs text-emerald-100">
            Automated invoice reconciliation, tenant arrears management and maintenance expense tracking
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportSage}
            className="px-4 py-2.5 bg-white hover:bg-emerald-50 text-emerald-900 font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Export to Sage / QuickBooks</span>
          </button>
        </div>
      </div>

      {exportNotice && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{exportNotice}</span>
        </div>
      )}

      {feedback && (
        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-300 text-blue-800 dark:text-blue-200 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-blue-600" />
          <span>{feedback}</span>
        </div>
      )}

      {/* KPI Financial Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs text-slate-500 mb-1">Total Monthly Rent Roll</div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-display">
            E{totalMonthlyBilled.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Billed for current cycle</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs text-slate-500 mb-1">Collected Revenue</div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-600 font-display">
            E{collectedAmount.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-600 font-medium mt-1">88% Collection Rate</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs text-slate-500 mb-1">Outstanding Arrears</div>
          <div className="text-xl sm:text-2xl font-bold text-red-600 font-display">
            E{arrearsAmount.toLocaleString()}
          </div>
          <div className="text-[10px] text-red-600 font-medium mt-1">Automated reminders sent</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs text-slate-500 mb-1">Maintenance Expense</div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-display">
            E{maintenanceSpend.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">{expenseTransactions.length} recorded repairs</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm col-span-2 sm:col-span-1">
          <div className="text-xs text-slate-500 mb-1">Net Operating Income</div>
          <div className="text-xl sm:text-2xl font-bold text-blue-600 font-display">
            E{netIncome.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Net commercial cashflow</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('rent_roll')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'rent_roll'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Active Rent Roll Ledger
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'expenses'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Maintenance Expenses & Material Costs ({expenseTransactions.length})
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'requests'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Petty Cash & Purchase Authorizations ({requisitions.length})
        </button>
      </div>

      {/* RENT ROLL TAB */}
      {activeTab === 'rent_roll' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Tenant Invoices & Rent Roll Tracking
            </h3>
            <span className="text-xs text-slate-500">Rent due 1st of each calendar month</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3">Tenant Business</th>
                  <th className="px-4 py-3">Unit / Center</th>
                  <th className="px-4 py-3">Monthly Rent</th>
                  <th className="px-4 py-3">Payment Status</th>
                  <th className="px-4 py-3">Bank Reference</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3 text-right">Invoice Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {db.tenants.map((t, idx) => {
                  const shop = db.shops.find((s) => s.id === t.shop_id);
                  const isPaid = idx % 2 === 0;
                  const ref = `FNB-EFT-${992010 + idx}`;

                  return (
                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 dark:text-white">{t.business_name}</div>
                        <div className="text-[10px] text-slate-500">
                          {t.contact_person} • {t.phone}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-white">
                          Unit {shop?.shop_number || 'G-14'}
                        </div>
                        <div className="text-[10px] text-slate-500">{shop?.floor || 'Ground'}</div>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                        E{(shop?.rental_amount || 18500).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isPaid
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {isPaid ? 'Paid' : 'Pending EFT'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        {isPaid ? ref : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        2026-09-01
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedInvoiceTenant({ tenant: t, shop, isPaid, ref })}
                          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 ml-auto"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>View Invoice</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EXPENSES TAB */}
      {activeTab === 'expenses' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Ticket Maintenance Expenses Ledger
              </h3>
              <p className="text-xs text-slate-500">Materials, subcontractor fees & labor costs</p>
            </div>
            <button
              onClick={() => setShowExpenseModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Record Expense</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 uppercase tracking-wider text-[10px] border-y border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Ref ID</th>
                  <th className="px-3 py-2.5">Category & Description</th>
                  <th className="px-3 py-2.5">Shopping Center</th>
                  <th className="px-3 py-2.5">Cost (E)</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {expenseTransactions.map((tx) => {
                  const center = db.shoppingCenters.find(
                    (c) => c.id === tx.shopping_center_id
                  );
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition">
                      <td className="px-3 py-3 text-slate-500">{tx.date}</td>
                      <td className="px-3 py-3 font-mono font-bold text-blue-600">
                        {tx.reference || tx.id.slice(0, 10)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {tx.description}
                        </div>
                        <div className="text-[10px] text-slate-500">Category: {tx.category}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                        {center?.name || 'General Portfolio'}
                      </td>
                      <td className="px-3 py-3 font-bold text-slate-900 dark:text-white">
                        E{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            tx.status === 'Reconciled'
                              ? 'bg-blue-100 text-blue-800'
                              : tx.status === 'Approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => handleDeleteExpense(tx.id)}
                          className="p-1 text-slate-400 hover:text-red-500 transition"
                          title="Delete expense entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REQUESTS TAB */}
      {activeTab === 'requests' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Petty Cash & Purchase Authorizations
              </h3>
              <p className="text-xs text-slate-500">
                Maintenance technicians submit material requisition orders here for finance sign-off
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 rounded-lg">
                Float: E5,000.00
              </span>
              <button
                onClick={() => setShowRequisitionModal(true)}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              >
                <PlusCircle className="w-4 h-4" />
                <span>New Requisition</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 uppercase tracking-wider text-[10px] border-y border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-3 py-2.5">Req #</th>
                  <th className="px-3 py-2.5">Technician</th>
                  <th className="px-3 py-2.5">Required Materials</th>
                  <th className="px-3 py-2.5">Supplier Store</th>
                  <th className="px-3 py-2.5">Amount (E)</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">Approval Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {requisitions.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition">
                    <td className="px-3 py-3 font-mono font-bold text-blue-600">{req.id}</td>
                    <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">
                      {req.technician}
                    </td>
                    <td className="px-3 py-3 text-slate-700 dark:text-slate-300">{req.item}</td>
                    <td className="px-3 py-3 text-slate-500">{req.supplier}</td>
                    <td className="px-3 py-3 font-bold text-slate-900 dark:text-white">
                      E{req.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          req.status === 'Disbursed'
                            ? 'bg-blue-100 text-blue-800'
                            : req.status === 'Approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {req.status === 'Pending' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleUpdateReqStatus(req.id, 'Approved')}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition"
                          >
                            Approve
                          </button>
                        </div>
                      ) : req.status === 'Approved' ? (
                        <button
                          onClick={() => handleUpdateReqStatus(req.id, 'Disbursed')}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold transition"
                        >
                          Disburse Cash
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-semibold">Cleared</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RECORD EXPENSE MODAL */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Record Maintenance Expense
                </h3>
              </div>
              <button
                onClick={() => setShowExpenseModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Expense Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 3-Phase isolator switch replacement"
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={expenseCategory}
                    onChange={(e) =>
                      setExpenseCategory(e.target.value as FinanceTransaction['category'])
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="Maintenance">Maintenance & Repairs</option>
                    <option value="Utilities">Utilities (Water/Power)</option>
                    <option value="Security">Security Services</option>
                    <option value="Other">Other Operating Cost</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Shopping Center
                  </label>
                  <select
                    value={expenseCenterId}
                    onChange={(e) => setExpenseCenterId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    {db.shoppingCenters.map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        {sc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Amount (SZL) *
                  </label>
                  <input
                    type="number"
                    required
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={expenseStatus}
                    onChange={(e) =>
                      setExpenseStatus(e.target.value as FinanceTransaction['status'])
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="Approved">Approved</option>
                    <option value="Pending">Pending Audit</option>
                    <option value="Reconciled">Reconciled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Materials / Invoice Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Copper elbows, solder, Build-It Inv #9921"
                  value={expenseMaterials}
                  onChange={(e) => setExpenseMaterials(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-sm"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW REQUISITION MODAL */}
      {showRequisitionModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Material Requisition / Petty Cash
                </h3>
              </div>
              <button
                onClick={() => setShowRequisitionModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddRequisition} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Requesting Technician *
                </label>
                <input
                  type="text"
                  required
                  value={reqTechnician}
                  onChange={(e) => setReqTechnician(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Items / Hardware Parts Required *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. 5x 32A MCB, 20m 2.5mm conduit wiring"
                  value={reqItem}
                  onChange={(e) => setReqItem(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Store / Supplier
                  </label>
                  <input
                    type="text"
                    required
                    value={reqSupplier}
                    onChange={(e) => setReqSupplier(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Estimated Cost (E) *
                  </label>
                  <input
                    type="number"
                    required
                    value={reqAmount}
                    onChange={(e) => setReqAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowRequisitionModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-sm"
                >
                  Submit Requisition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW TAX INVOICE MODAL */}
      {selectedInvoiceTenant && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Official Commercial Tax Invoice
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                  title="Print Invoice"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedInvoiceTenant(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700 dark:text-slate-300">
              <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <h2 className="font-bold text-base text-slate-900 dark:text-white">
                    Ezulwini Commercial Holdings
                  </h2>
                  <p className="text-[11px] text-slate-500">The Gables Lifestyle Centre, Ezulwini, Eswatini</p>
                  <p className="text-[10px] text-slate-400 font-mono">TIN: SWZ-889021-99 • VAT # 1002934</p>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                    INV-2026-09-{selectedInvoiceTenant.tenant.id.slice(-3)}
                  </div>
                  <div className="text-[11px] text-slate-500">Date: 2026-09-01</div>
                  <span
                    className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                      selectedInvoiceTenant.isPaid
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {selectedInvoiceTenant.isPaid ? 'PAID IN FULL' : 'PAYMENT DUE'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Billed To</span>
                <div className="font-bold text-slate-900 dark:text-white">
                  {selectedInvoiceTenant.tenant.business_name}
                </div>
                <div className="text-slate-500">
                  Unit {selectedInvoiceTenant.shop?.shop_number || 'G-14'} •{' '}
                  {selectedInvoiceTenant.tenant.contact_person}
                </div>
                <div className="text-slate-500">{selectedInvoiceTenant.tenant.phone}</div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-[10px] uppercase">
                    <tr>
                      <th className="p-2.5">Description</th>
                      <th className="p-2.5 text-right">Amount (SZL)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr>
                      <td className="p-2.5">
                        Monthly Commercial Rental (September 2026)
                        <span className="block text-[10px] text-slate-400">
                          Demised space: {selectedInvoiceTenant.shop?.size_sqm || 75} m²
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-semibold">
                        E{(selectedInvoiceTenant.shop?.rental_amount || 18500).toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5">Commercial Center Operational Levy / Service Charge</td>
                      <td className="p-2.5 text-right font-semibold">E1,250.00</td>
                    </tr>
                    <tr className="bg-slate-50 dark:bg-slate-800/40 font-bold">
                      <td className="p-2.5">Total Amount Payable</td>
                      <td className="p-2.5 text-right text-blue-600 dark:text-blue-400">
                        E{((selectedInvoiceTenant.shop?.rental_amount || 18500) + 1250).toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] space-y-1">
                <span className="font-bold text-slate-900 dark:text-white block">Banking Details for EFT:</span>
                <div>Bank: First National Bank Eswatini (FNB)</div>
                <div>Account Name: Ezulwini Commercial Holdings</div>
                <div>Account #: 62890123456 • Branch: 280164</div>
                <div className="text-slate-400">Reference: {selectedInvoiceTenant.ref}</div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-800/40">
              <button
                onClick={() => setSelectedInvoiceTenant(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs"
              >
                Close Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
