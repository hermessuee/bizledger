'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatPaise, isValidGSTIN } from '@bizledger/shared';
import { Plus, Building2, Search, X, Trash2 } from 'lucide-react';

export default function VendorsPage() {
  const { user, hasPermission } = useAuth();
  const [vendors, setVendors] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]);
  const [targetBusinessId, setTargetBusinessId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [gstin, setGstin] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [creditDays, setCreditDays] = useState('30');
  const [openingBalance, setOpeningBalance] = useState('0');

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/v1/parties?kind=vendor');
      setVendors(res.parties || []);

      if (user?.role === 'super_admin' || user?.username === 'anoopsue') {
        try {
          const bRes = await api.get('/api/v1/admin/businesses');
          const list = (bRes.businesses || []).filter(
            (b: any) => b.id !== '00000000-0000-0000-0000-000000000000'
          );
          setDistributors(list);
          if (list.length > 0 && !targetBusinessId) {
            setTargetBusinessId(list[0].id);
          }
        } catch {}
      }
    } catch {}
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, [user]);

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (gstin && !isValidGSTIN(gstin)) {
      alert('Please enter a valid 15-character Indian GSTIN');
      return;
    }

    try {
      const balancePaise = Math.round(parseFloat(openingBalance || '0') * 100);
      await api.post('/api/v1/parties', {
        businessId: user?.role === 'super_admin' ? (targetBusinessId || undefined) : undefined,
        kind: 'vendor',
        name,
        gstin: gstin ? gstin.toUpperCase().trim() : null,
        phone,
        email,
        address,
        creditDays: parseInt(creditDays, 10) || 0,
        openingBalance: balancePaise,
        isActive: true,
      });

      setIsAddOpen(false);
      setName('');
      setGstin('');
      setPhone('');
      setEmail('');
      setAddress('');
      fetchVendors();
    } catch (err: any) {
      alert(err.message || 'Failed to create vendor');
    }
  };

  const handleToggleVendorStatus = async (v: any) => {
    const newStatus = v.isActive === false ? true : false;
    try {
      await api.put(`/api/v1/parties/${v.id}`, { isActive: newStatus });
      fetchVendors();
    } catch (err: any) {
      alert(err.message || 'Failed to update vendor status');
    }
  };

  const handleDeleteVendor = async (v: any) => {
    if (!confirm(`Are you sure you want to delete ${v.name}? This will remove it from all distributor records.`)) return;
    try {
      await api.delete(`/api/v1/parties/${v.id}`);
      fetchVendors();
    } catch (err: any) {
      alert(err.message || 'Failed to delete vendor');
    }
  };

  const filtered = vendors.filter((v) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      v.name.toLowerCase().includes(q) ||
      (v.gstin && v.gstin.toLowerCase().includes(q)) ||
      (v.phone && v.phone.includes(q))
    );
  });

  return (
    <AppShell currentMenu="vendors">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Vendor & Supplier Directory
            </h1>
            <p className="text-xs text-slate-500">
              Manage accounts payable, supplier GSTINs, and purchase credit terms
            </p>
          </div>

          {hasPermission('vendors', 'create') && (
            <button
              onClick={() => setIsAddOpen(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Vendor
            </button>
          )}
        </div>

        {/* Search */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border flex items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search vendor name, GSTIN, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">Total Vendors: {filtered.length}</span>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[800px]">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b">
                <tr>
                  <th className="py-3 px-4 whitespace-nowrap min-w-[200px]">Vendor Name</th>
                  {user?.role === 'super_admin' && (
                    <th className="py-3 px-4 whitespace-nowrap text-indigo-600 dark:text-indigo-400">Distributor Firm</th>
                  )}
                  <th className="py-3 px-4 whitespace-nowrap">GSTIN</th>
                  <th className="py-3 px-4 whitespace-nowrap">Phone / Email</th>
                  <th className="py-3 px-4 whitespace-nowrap">Payment Terms</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Payable Balance</th>
                  {user?.role === 'super_admin' && (
                    <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {v.name}
                      {v.address && (
                        <span className="block text-[11px] font-normal text-slate-400 truncate max-w-xs">
                          {v.address}
                        </span>
                      )}
                    </td>
                    {user?.role === 'super_admin' && (
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {v.distributorName || 'Distributor'}
                        </span>
                      </td>
                    )}
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                      {v.gstin || 'Unregistered'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      <div>{v.phone || '-'}</div>
                      <div className="text-[10px] text-slate-400">{v.email || ''}</div>
                    </td>
                    <td className="py-3 px-4">{v.creditDays} days</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      ₹ {formatPaise(v.currentBalance || v.openingBalance || 0)}
                    </td>
                    {user?.role === 'super_admin' && (
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleVendorStatus(v)}
                          className="px-2 py-0.5 text-[10px] font-bold rounded border transition"
                          title="Toggle Active/Disable"
                        >
                          {v.isActive === false ? 'Enable' : 'Disable'}
                        </button>
                        <button
                          onClick={() => handleDeleteVendor(v)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded transition inline-flex items-center"
                          title="Delete vendor"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Vendor Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-base">Add New Vendor</h3>
              <button onClick={() => setIsAddOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreateVendor} className="p-6 space-y-3 text-xs">
              {user?.role === 'super_admin' && (
                <div>
                  <label className="block font-semibold mb-1 text-indigo-700 dark:text-indigo-300">
                    🏢 Target Distributor Firm *
                  </label>
                  <select
                    value={targetBusinessId}
                    onChange={(e) => setTargetBusinessId(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                  >
                    <option value="" disabled>-- Select Distributor Firm --</option>
                    {distributors.map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.gstin ? `(${d.gstin})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold mb-1">Vendor / Firm Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mahalaxmi Logistics"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">GSTIN (15 Digits)</label>
                  <input
                    type="text"
                    maxLength={15}
                    placeholder="e.g. 27AAMFM3322P1Z8"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border rounded-lg font-mono outline-none uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Credit Terms (Days)</label>
                  <input
                    type="number"
                    min="0"
                    value={creditDays}
                    onChange={(e) => setCreditDays(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="e.g. 9821098765"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="e.g. orders@vendor.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Address</label>
                <textarea
                  rows={2}
                  placeholder="Street, City, State, PIN"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Opening Payable (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg outline-none font-bold"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 border rounded-lg text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
                >
                  Save Vendor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
