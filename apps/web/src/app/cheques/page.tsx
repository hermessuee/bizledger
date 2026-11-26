'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  ChequeItem,
  formatPaise,
  CHEQUE_STATUSES,
  ChequeStatus,
} from '@bizledger/shared';
import { downloadChequeVoucherPdf } from '@/lib/pdf';
import {
  Plus,
  CheckSquare,
  Search,
  Filter,
  FileDown,
  Clock,
  CheckCircle2,
  AlertOctagon,
  Calendar,
  X,
} from 'lucide-react';

export default function ChequesPage() {
  const { business, hasPermission } = useAuth();
  const [cheques, setCheques] = useState<ChequeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [directionFilter, setDirectionFilter] = useState<'all' | 'received' | 'issued'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Add Cheque Modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [parties, setParties] = useState<any[]>([]);
  const [newDirection, setNewDirection] = useState<'received' | 'issued'>('received');
  const [newPartyId, setNewPartyId] = useState('');
  const [newChequeNo, setNewChequeNo] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [newBranch, setNewBranch] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newChequeDate, setNewChequeDate] = useState(new Date().toISOString().split('T')[0]);
  const [newRemarks, setNewRemarks] = useState('');

  // Status change prompt modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedCheque, setSelectedCheque] = useState<ChequeItem | null>(null);
  const [targetStatus, setTargetStatus] = useState<ChequeStatus>('cleared');
  const [bounceReason, setBounceReason] = useState('');
  const [bankCharges, setBankCharges] = useState('0');

  const fetchCheques = async () => {
    try {
      setLoading(true);
      const data = await api.get('/api/v1/cheques');
      setCheques(data.cheques || []);
    } catch {}
    finally {
      setLoading(false);
    }
  };

  const fetchParties = async () => {
    try {
      const data = await api.get('/api/v1/parties');
      setParties(data.parties || []);
    } catch {}
  };

  useEffect(() => {
    fetchCheques();
    fetchParties();
  }, []);

  const handleCreateCheque = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amountPaise = Math.round(parseFloat(newAmount) * 100);
      await api.post('/api/v1/cheques', {
        direction: newDirection,
        partyId: newPartyId,
        chequeNo: newChequeNo,
        bankName: newBankName,
        branch: newBranch,
        amount: amountPaise,
        chequeDate: newChequeDate,
        remarks: newRemarks,
      });
      setIsAddOpen(false);
      // Reset form
      setNewChequeNo('');
      setNewBankName('');
      setNewAmount('');
      setNewRemarks('');
      fetchCheques();
    } catch (err: any) {
      alert(err.message || 'Failed to save cheque');
    }
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCheque) return;

    try {
      await api.post(`/api/v1/cheques/${selectedCheque.id}/status`, {
        status: targetStatus,
        bounceReason: targetStatus === 'bounced' ? bounceReason : undefined,
        bankCharges: targetStatus === 'bounced' ? Math.round(parseFloat(bankCharges || '0') * 100) : 0,
      });
      setStatusModalOpen(false);
      setSelectedCheque(null);
      fetchCheques();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const filteredCheques = cheques.filter((c) => {
    if (directionFilter !== 'all' && c.direction !== directionFilter) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.chequeNo.toLowerCase().includes(q) ||
        (c.partyName && c.partyName.toLowerCase().includes(q)) ||
        (c.bankName && c.bankName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const getStatusBadge = (status: ChequeStatus) => {
    const map: Record<ChequeStatus, string> = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      deposited: 'bg-blue-100 text-blue-800 border-blue-200',
      cleared: 'bg-green-100 text-green-800 border-green-200',
      bounced: 'bg-red-100 text-red-800 border-red-200',
      cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
      stale: 'bg-amber-100 text-amber-900 border-amber-300',
      replaced: 'bg-purple-100 text-purple-800 border-purple-200',
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${map[status] || 'bg-gray-100'}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  return (
    <AppShell currentMenu="cheques">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Cheque & Post-Dated Cheque (PDC) Register
            </h1>
            <p className="text-xs text-slate-500">
              Manage received and issued cheques, clearance workflow, and bounce tracking
            </p>
          </div>

          {hasPermission('cheques', 'create') && (
            <button
              onClick={() => setIsAddOpen(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add New Cheque
            </button>
          )}
        </div>

        {/* Filters Bar */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Direction Tabs */}
            <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium">
              <button
                onClick={() => setDirectionFilter('all')}
                className={`px-3 py-1 rounded-md transition ${directionFilter === 'all' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
              >
                All
              </button>
              <button
                onClick={() => setDirectionFilter('received')}
                className={`px-3 py-1 rounded-md transition ${directionFilter === 'received' ? 'bg-white shadow text-blue-700' : 'text-slate-500'}`}
              >
                Received (PDC)
              </button>
              <button
                onClick={() => setDirectionFilter('issued')}
                className={`px-3 py-1 rounded-md transition ${directionFilter === 'issued' ? 'bg-white shadow text-purple-700' : 'text-slate-500'}`}
              >
                Issued
              </button>
            </div>

            {/* Status Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
            >
              <option value="all">All Statuses</option>
              {CHEQUE_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Search box */}
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search cheque #, party, bank..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        {/* Cheques Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[950px]">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4 whitespace-nowrap">Direction</th>
                  <th className="py-3 px-4 whitespace-nowrap">Cheque Date</th>
                  <th className="py-3 px-4 whitespace-nowrap">Cheque #</th>
                  <th className="py-3 px-4 whitespace-nowrap min-w-[180px]">Party Name</th>
                  <th className="py-3 px-4 whitespace-nowrap">Bank & Branch</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Amount (₹)</th>
                  <th className="py-3 px-4 text-center whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCheques.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No cheques found matching the criteria.
                    </td>
                  </tr>
                ) : (
                  filteredCheques.map((chq) => (
                    <tr key={chq.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 text-[11px] font-bold rounded ${
                            chq.direction === 'received'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                          }`}
                        >
                          {chq.direction === 'received' ? 'Received' : 'Issued'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono">{chq.chequeDate}</td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100">
                        #{chq.chequeNo}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                        {chq.partyName || 'Party'}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {chq.bankName} {chq.branch ? `(${chq.branch})` : ''}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">
                        ₹ {formatPaise(chq.amount)}
                      </td>
                      <td className="py-3 px-4 text-center">{getStatusBadge(chq.status)}</td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {hasPermission('cheques', 'edit') && chq.status !== 'cleared' && chq.status !== 'cancelled' && (
                          <button
                            onClick={() => {
                              setSelectedCheque(chq);
                              setTargetStatus('cleared');
                              setStatusModalOpen(true);
                            }}
                            className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded font-medium text-[11px]"
                          >
                            Update Status
                          </button>
                        )}
                        <button
                          onClick={() => downloadChequeVoucherPdf(chq, business)}
                          title="Print Cheque Voucher"
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded font-medium text-[11px]"
                        >
                          Voucher PDF
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Cheque Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                Record Cheque / PDC
              </h3>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCheque} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Direction
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewDirection('received')}
                    className={`py-2 text-center rounded-lg font-semibold border ${newDirection === 'received' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'border-slate-200 text-slate-600'}`}
                  >
                    Received from Customer (PDC)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewDirection('issued')}
                    className={`py-2 text-center rounded-lg font-semibold border ${newDirection === 'issued' ? 'bg-purple-50 border-purple-600 text-purple-700' : 'border-slate-200 text-slate-600'}`}
                  >
                    Issued to Vendor
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Party (Customer or Vendor) *
                </label>
                <select
                  required
                  value={newPartyId}
                  onChange={(e) => setNewPartyId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                >
                  <option value="">Select party...</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.kind})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Cheque Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 000412"
                    value={newChequeNo}
                    onChange={(e) => setNewChequeNo(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Cheque Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newChequeDate}
                    onChange={(e) => setNewChequeDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC Bank"
                    value={newBankName}
                    onChange={(e) => setNewBankName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Branch
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Andheri East"
                    value={newBranch}
                    onChange={(e) => setNewBranch(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Amount in Rupees (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 50000.00"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg outline-none font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Remarks / Notes
                </label>
                <input
                  type="text"
                  placeholder="Optional notes or invoice link"
                  value={newRemarks}
                  onChange={(e) => setNewRemarks(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 border rounded-lg text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
                >
                  Save Cheque
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Transition Modal */}
      {statusModalOpen && selectedCheque && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Update Status for Cheque #{selectedCheque.chequeNo}
              </h3>
              <button onClick={() => setStatusModalOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleStatusSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Status</label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value as ChequeStatus)}
                  className="w-full px-3 py-2 border rounded-lg outline-none bg-white font-medium"
                >
                  <option value="deposited">Deposited in Bank</option>
                  <option value="cleared">Cleared</option>
                  <option value="bounced">Bounced / Returned</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="replaced">Replaced</option>
                </select>
              </div>

              {targetStatus === 'bounced' && (
                <div className="space-y-3 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200">
                  <p className="text-[11px] font-semibold text-red-700">
                    Bouncing a cheque will reopen the outstanding receivable and post appropriate reversal entries.
                  </p>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Bounce Reason</label>
                    <input
                      type="text"
                      placeholder="e.g. Insufficient Funds / Signature mismatch"
                      value={bounceReason}
                      onChange={(e) => setBounceReason(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Bank Charges (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 590.00"
                      value={bankCharges}
                      onChange={(e) => setBankCharges(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded outline-none font-bold"
                    />
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setStatusModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
                >
                  Confirm Status Change
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
