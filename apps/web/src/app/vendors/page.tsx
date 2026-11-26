'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatPaise, isValidGSTIN } from '@bizledger/shared';
import { Plus, Building2, Search, X } from 'lucide-react';

export default function VendorsPage() {
  const { hasPermission } = useAuth();
  const [vendors, setVendors] = useState<any[]>([]);
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
    } catch {}
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (gstin && !isValidGSTIN(gstin)) {
      alert('Please enter a valid 15-character Indian GSTIN');
      return;
    }

    try {
      const balancePaise = Math.round(parseFloat(openingBalance || '0') * 100);
      await api.post('/api/v1/parties', {
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
                  <th className="py-3 px-4 whitespace-nowrap">GSTIN</th>
                  <th className="py-3 px-4 whitespace-nowrap">Phone / Email</th>
                  <th className="py-3 px-4 whitespace-nowrap">Payment Terms</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Payable Balance</th>
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
