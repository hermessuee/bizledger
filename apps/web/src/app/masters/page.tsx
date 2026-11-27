'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  formatPaise,
  INDIAN_STATES,
  ITEM_UNITS,
  GST_RATES,
} from '@bizledger/shared';
import {
  SlidersHorizontal,
  Users,
  Building2,
  Package,
  FileText,
  FileCheck,
  Plus,
  Search,
  Edit3,
  Trash2,
  Lock,
  CheckCircle,
  Ban,
  X,
  AlertCircle,
  AlertTriangle,
  Save,
  Check,
  Power,
  RotateCcw,
} from 'lucide-react';

type MasterTab = 'customers' | 'vendors' | 'items' | 'invoices' | 'bills';

export default function MasterGovernancePage() {
  const { business, user, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<MasterTab>('customers');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Data states
  const [customers, setCustomers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);

  // Multi-distributor state for Super-Admin governance
  const [distributors, setDistributors] = useState<any[]>([]);
  const [targetBusinessId, setTargetBusinessId] = useState<string>('');

  // Party Modal state (Customer / Vendor)
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [editingPartyId, setEditingPartyId] = useState<string | null>(null);
  const [partyKind, setPartyKind] = useState<'customer' | 'vendor'>('customer');
  const [partyName, setPartyName] = useState('');
  const [partyGstin, setPartyGstin] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [partyEmail, setPartyEmail] = useState('');
  const [partyAddress, setPartyAddress] = useState('');
  const [partyCreditDays, setPartyCreditDays] = useState(30);
  const [partyOpeningBalance, setPartyOpeningBalance] = useState(0);
  const [partyIsActive, setPartyIsActive] = useState(true);

  // Item Modal state
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemHsnSac, setItemHsnSac] = useState('');
  const [itemUnit, setItemUnit] = useState('PCS');
  const [itemSalePrice, setItemSalePrice] = useState(0);
  const [itemPurchasePrice, setItemPurchasePrice] = useState(0);
  const [itemGstRate, setItemGstRate] = useState(18);
  const [itemStockQty, setItemStockQty] = useState(0);
  const [itemIsActive, setItemIsActive] = useState(true);

  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [cRes, vRes, iRes, invRes, billRes] = await Promise.all([
        api.get('/api/v1/parties?kind=customer').catch(() => ({ parties: [] })),
        api.get('/api/v1/parties?kind=vendor').catch(() => ({ parties: [] })),
        api.get('/api/v1/items').catch(() => ({ items: [] })),
        api.get('/api/v1/documents?type=sales_invoice').catch(() => ({ documents: [] })),
        api.get('/api/v1/documents?type=purchase_bill').catch(() => ({ documents: [] })),
      ]);
      setCustomers(cRes.parties || []);
      setVendors(vRes.parties || []);
      setItems(iRes.items || []);
      setInvoices(invRes.documents || []);
      setBills(billRes.documents || []);

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [user]);

  // Customer / Vendor Handlers
  const handleOpenAddParty = (kind: 'customer' | 'vendor') => {
    setEditingPartyId(null);
    setPartyKind(kind);
    setPartyName('');
    setPartyGstin('');
    setPartyPhone('');
    setPartyEmail('');
    setPartyAddress('');
    setPartyCreditDays(30);
    setPartyOpeningBalance(0);
    setPartyIsActive(true);
    if (distributors.length > 0) {
      setTargetBusinessId(distributors[0].id);
    }
    setModalError(null);
    setIsPartyModalOpen(true);
  };

  const handleOpenEditParty = (p: any) => {
    setEditingPartyId(p.id);
    setPartyKind(p.kind === 'vendor' ? 'vendor' : 'customer');
    setPartyName(p.name || '');
    setPartyGstin(p.gstin || '');
    setPartyPhone(p.phone || '');
    setPartyEmail(p.email || '');
    setPartyAddress(p.address || '');
    setPartyCreditDays(p.creditDays || 30);
    setPartyOpeningBalance((p.openingBalance || 0) / 100);
    setPartyIsActive(p.isActive !== false);
    setTargetBusinessId(p.businessId || '');
    setModalError(null);
    setIsPartyModalOpen(true);
  };

  const handleSaveParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyName.trim()) {
      setModalError('Name is required.');
      return;
    }
    try {
      setModalSubmitting(true);
      setModalError(null);

      if (editingPartyId) {
        await api.put(`/api/v1/parties/${editingPartyId}`, {
          name: partyName.trim(),
          gstin: partyGstin.trim().toUpperCase() || null,
          phone: partyPhone.trim() || null,
          email: partyEmail.trim() || null,
          address: partyAddress.trim() || null,
          creditDays: Number(partyCreditDays) || 30,
          isActive: partyIsActive,
        });
      } else {
        await api.post('/api/v1/parties', {
          businessId: user?.role === 'super_admin' ? (targetBusinessId || undefined) : undefined,
          name: partyName.trim(),
          kind: partyKind,
          gstin: partyGstin.trim().toUpperCase() || undefined,
          phone: partyPhone.trim() || undefined,
          email: partyEmail.trim() || undefined,
          address: partyAddress.trim() || undefined,
          creditDays: Number(partyCreditDays) || 30,
          openingBalance: Math.round(Number(partyOpeningBalance) * 100),
          stateCode: partyGstin && partyGstin.length >= 2 ? partyGstin.substring(0, 2) : business?.stateCode || '32',
        });
      }
      setIsPartyModalOpen(false);
      await fetchAllData();
    } catch (err: any) {
      setModalError(err.message || 'Failed to save party details.');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleTogglePartyStatus = async (party: any) => {
    const newStatus = party.isActive === false ? true : false;
    try {
      await api.put(`/api/v1/parties/${party.id}`, { isActive: newStatus });
      await fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to update party status');
    }
  };

  const handleDeleteParty = async (party: any) => {
    if (!confirm(`Are you sure you want to delete ${party.name}? This will remove the record from master listings.`)) return;
    try {
      await api.delete(`/api/v1/parties/${party.id}`);
      await fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete party');
    }
  };

  // Item Handlers
  const handleOpenAddItem = () => {
    setEditingItemId(null);
    setItemName('');
    setItemHsnSac('');
    setItemUnit('PCS');
    setItemSalePrice(0);
    setItemPurchasePrice(0);
    setItemGstRate(18);
    setItemStockQty(0);
    setItemIsActive(true);
    if (distributors.length > 0) {
      setTargetBusinessId(distributors[0].id);
    }
    setModalError(null);
    setIsItemModalOpen(true);
  };

  const handleOpenEditItem = (item: any) => {
    setEditingItemId(item.id);
    setItemName(item.name || '');
    setItemHsnSac(item.hsnSac || '');
    setItemUnit(item.unit || 'PCS');
    setItemSalePrice((item.salePrice || 0) / 100);
    setItemPurchasePrice((item.purchasePrice || 0) / 100);
    setItemGstRate(item.gstRate || 18);
    setItemStockQty(item.stockQty || 0);
    setItemIsActive(item.isActive !== false);
    setTargetBusinessId(item.businessId || '');
    setModalError(null);
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      setModalError('Item name is required.');
      return;
    }
    try {
      setModalSubmitting(true);
      setModalError(null);

      const salePaise = Math.round(Number(itemSalePrice) * 100);
      const purchasePaise = Math.round(Number(itemPurchasePrice) * 100);

      if (editingItemId) {
        await api.put(`/api/v1/items/${editingItemId}`, {
          name: itemName.trim(),
          hsnSac: itemHsnSac.trim() || null,
          unit: itemUnit.trim().toUpperCase() || 'PCS',
          salePrice: salePaise,
          purchasePrice: purchasePaise,
          gstRate: Number(itemGstRate),
          stockQty: Number(itemStockQty),
          isActive: itemIsActive,
        });
      } else {
        await api.post('/api/v1/items', {
          businessId: user?.role === 'super_admin' ? (targetBusinessId || undefined) : undefined,
          name: itemName.trim(),
          hsnSac: itemHsnSac.trim() || undefined,
          unit: itemUnit.trim().toUpperCase() || 'PCS',
          salePrice: salePaise,
          purchasePrice: purchasePaise,
          gstRate: Number(itemGstRate),
          stockQty: Number(itemStockQty),
        });
      }
      setIsItemModalOpen(false);
      await fetchAllData();
    } catch (err: any) {
      setModalError(err.message || 'Failed to save item.');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleToggleItemStatus = async (item: any) => {
    const newStatus = item.isActive === false ? true : false;
    try {
      await api.put(`/api/v1/items/${item.id}`, { isActive: newStatus });
      await fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to update item status');
    }
  };

  const handleDeleteItem = async (item: any) => {
    if (!confirm(`Are you sure you want to delete ${item.name}? This will remove it from master catalog.`)) return;
    try {
      await api.delete(`/api/v1/items/${item.id}`);
      await fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete item');
    }
  };

  // Document Lock / Post & Void Handlers
  const handlePostDocument = async (doc: any) => {
    const confirmed = confirm(
      `⚠️ Warning: Once Saved & Finalized, entry #${doc.docNo} is permanently posted to accounting ledgers and CANNOT be edited. Are you sure you want to finalize and lock this entry?`
    );
    if (!confirmed) return;
    try {
      await api.post(`/api/v1/documents/${doc.id}/post`);
      await fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to post document');
    }
  };

  const handleDeleteDraftDocument = async (doc: any) => {
    if (!confirm(`Permanently delete draft document #${doc.docNo}?`)) return;
    try {
      await api.delete(`/api/v1/documents/${doc.id}`);
      await fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete draft document');
    }
  };

  const handleSuperAdminDeleteDoc = async (doc: any) => {
    if (!confirm(`⚠️ Super-Admin Master Override:\nPermanently delete document #${doc.docNo}? This will delete the entry across all distributor accounting ledgers.`)) return;
    try {
      await api.delete(`/api/v1/documents/${doc.id}`);
      await fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete document');
    }
  };

  const handleVoidDocument = async (doc: any) => {
    if (!confirm(`Void entry #${doc.docNo}? This will reverse posted ledger balances.`)) return;
    try {
      await api.post(`/api/v1/documents/${doc.id}/void`);
      await fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to void document');
    }
  };

  return (
    <AppShell currentMenu="master_governance">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <SlidersHorizontal className="w-6 h-6 text-amber-500" />
              <span>Master Hub & Governance</span>
            </h1>
            <p className="text-xs text-slate-500">
              Centralized master governance: Add, edit, remove, and disable customers, vendors, items, and control Draft vs Locked entries across all modules
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchAllData}
              className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition"
              title="Refresh master data"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
          {[
            { id: 'customers', label: 'Customers', count: customers.length, icon: Users },
            { id: 'vendors', label: 'Vendors', count: vendors.length, icon: Building2 },
            { id: 'items', label: 'Items & Services', count: items.length, icon: Package },
            { id: 'invoices', label: 'Sales Invoices', count: invoices.length, icon: FileText },
            { id: 'bills', label: 'Purchase Bills', count: bills.length, icon: FileCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as MasterTab);
                  setSearch('');
                }}
                className={`flex items-center space-x-2 px-4 py-3 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                  isActive
                    ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50/30 dark:bg-amber-950/20'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive
                      ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Global Filter & Quick Action Bar */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={`Search in ${activeTab}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            {activeTab === 'customers' && (
              <button
                onClick={() => handleOpenAddParty('customer')}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add Customer</span>
              </button>
            )}
            {activeTab === 'vendors' && (
              <button
                onClick={() => handleOpenAddParty('vendor')}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add Vendor</span>
              </button>
            )}
            {activeTab === 'items' && (
              <button
                onClick={handleOpenAddItem}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add Item / Service</span>
              </button>
            )}
            {(activeTab === 'invoices' || activeTab === 'bills') && (
              <div className="text-[11px] text-slate-500 italic">
                Entries marked <span className="text-emerald-600 font-bold">LOCKED</span> cannot be edited to preserve accounting ledgers.
              </div>
            )}
          </div>
        </div>

        {/* =========================================================================
            TAB 1: CUSTOMERS
        ========================================================================= */}
        {activeTab === 'customers' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Customer Name</th>
                    {user?.role === 'super_admin' && (
                      <th className="py-3 px-4 text-indigo-600 dark:text-indigo-400">Distributor Firm</th>
                    )}
                    <th className="py-3 px-4">GSTIN</th>
                    <th className="py-3 px-4">Phone / Contact</th>
                    <th className="py-3 px-4 text-right">Balance</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {customers
                    .filter(
                      (c) =>
                        c.name?.toLowerCase().includes(search.toLowerCase()) ||
                        c.gstin?.toLowerCase().includes(search.toLowerCase()) ||
                        c.phone?.toLowerCase().includes(search.toLowerCase())
                    )
                    .map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          {c.name}
                        </td>
                        {user?.role === 'super_admin' && (
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              {c.distributorName || 'Distributor'}
                            </span>
                          </td>
                        )}
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                          {c.gstin || '-'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          {c.phone || c.email || '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium">
                          ₹ {formatPaise(c.currentBalance || 0)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {c.isActive === false ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
                              DISABLED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ACTIVE
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => handleTogglePartyStatus(c)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition inline-flex items-center space-x-1 ${
                              c.isActive === false
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                            }`}
                            title={c.isActive === false ? 'Enable Customer' : 'Disable Customer'}
                          >
                            <Power className="w-3 h-3" />
                            <span>{c.isActive === false ? 'Enable' : 'Disable'}</span>
                          </button>
                          <button
                            onClick={() => handleOpenEditParty(c)}
                            className="px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 rounded-lg text-[10px] font-bold transition inline-flex items-center space-x-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteParty(c)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition inline-flex items-center"
                            title="Delete Customer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: VENDORS
        ========================================================================= */}
        {activeTab === 'vendors' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Vendor / Supplier Name</th>
                    {user?.role === 'super_admin' && (
                      <th className="py-3 px-4 text-indigo-600 dark:text-indigo-400">Distributor Firm</th>
                    )}
                    <th className="py-3 px-4">GSTIN</th>
                    <th className="py-3 px-4">Phone / Contact</th>
                    <th className="py-3 px-4 text-right">Balance</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {vendors
                    .filter(
                      (v) =>
                        v.name?.toLowerCase().includes(search.toLowerCase()) ||
                        v.gstin?.toLowerCase().includes(search.toLowerCase()) ||
                        v.phone?.toLowerCase().includes(search.toLowerCase())
                    )
                    .map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          {v.name}
                        </td>
                        {user?.role === 'super_admin' && (
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              {v.distributorName || 'Distributor'}
                            </span>
                          </td>
                        )}
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                          {v.gstin || '-'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          {v.phone || v.email || '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium">
                          ₹ {formatPaise(v.currentBalance || 0)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {v.isActive === false ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
                              DISABLED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ACTIVE
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => handleTogglePartyStatus(v)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition inline-flex items-center space-x-1 ${
                              v.isActive === false
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                            }`}
                            title={v.isActive === false ? 'Enable Vendor' : 'Disable Vendor'}
                          >
                            <Power className="w-3 h-3" />
                            <span>{v.isActive === false ? 'Enable' : 'Disable'}</span>
                          </button>
                          <button
                            onClick={() => handleOpenEditParty(v)}
                            className="px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 rounded-lg text-[10px] font-bold transition inline-flex items-center space-x-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteParty(v)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition inline-flex items-center"
                            title="Delete Vendor"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: ITEMS & SERVICES (WITH UNIT MEASURES)
        ========================================================================= */}
        {activeTab === 'items' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Item Name</th>
                    {user?.role === 'super_admin' && (
                      <th className="py-3 px-4 text-indigo-600 dark:text-indigo-400">Distributor Firm</th>
                    )}
                    <th className="py-3 px-4">HSN / SAC</th>
                    <th className="py-3 px-4 text-center">Unit of Measure</th>
                    <th className="py-3 px-4 text-right">Sale Price</th>
                    <th className="py-3 px-4 text-right">Purchase Price</th>
                    <th className="py-3 px-4 text-center">GST %</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items
                    .filter(
                      (i) =>
                        i.name?.toLowerCase().includes(search.toLowerCase()) ||
                        i.hsnSac?.toLowerCase().includes(search.toLowerCase()) ||
                        i.unit?.toLowerCase().includes(search.toLowerCase())
                    )
                    .map((i) => (
                      <tr key={i.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          {i.name}
                        </td>
                        {user?.role === 'super_admin' && (
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              {i.distributorName || 'Distributor'}
                            </span>
                          </td>
                        )}
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                          {i.hsnSac || '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2.5 py-0.5 rounded-md font-mono text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            {i.unit || 'PCS'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium">
                          ₹ {formatPaise(i.salePrice || 0)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-slate-500">
                          ₹ {formatPaise(i.purchasePrice || 0)}
                        </td>
                        <td className="py-3 px-4 text-center font-semibold">
                          {i.gstRate || 0}%
                        </td>
                        <td className="py-3 px-4 text-center">
                          {i.isActive === false ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
                              DISABLED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ACTIVE
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => handleToggleItemStatus(i)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition inline-flex items-center space-x-1 ${
                              i.isActive === false
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                            }`}
                            title={i.isActive === false ? 'Enable Item' : 'Disable Item'}
                          >
                            <Power className="w-3 h-3" />
                            <span>{i.isActive === false ? 'Enable' : 'Disable'}</span>
                          </button>
                          <button
                            onClick={() => handleOpenEditItem(i)}
                            className="px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 rounded-lg text-[10px] font-bold transition inline-flex items-center space-x-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteItem(i)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition inline-flex items-center"
                            title="Delete Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: SALES INVOICES (DRAFT VS LOCKED POSTED)
        ========================================================================= */}
        {activeTab === 'invoices' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    {user?.role === 'super_admin' && (
                      <th className="py-3 px-4 text-indigo-600 dark:text-indigo-400">Distributor Firm</th>
                    )}
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4 text-right">Total (₹)</th>
                    <th className="py-3 px-4 text-center">Status & Lock</th>
                    <th className="py-3 px-4 text-right">Governance Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {invoices
                    .filter(
                      (inv) =>
                        inv.docNo?.toLowerCase().includes(search.toLowerCase()) ||
                        inv.partyName?.toLowerCase().includes(search.toLowerCase())
                    )
                    .map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {inv.docNo}
                        </td>
                        {user?.role === 'super_admin' && (
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              {inv.distributorName || 'Distributor'}
                            </span>
                          </td>
                        )}
                        <td className="py-3 px-4 font-mono">{inv.docDate}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          {inv.partyName}
                        </td>
                        <td className="py-3 px-4 text-right font-bold">
                          ₹ {formatPaise(inv.total)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {inv.status === 'posted' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <Lock className="w-2.5 h-2.5" />
                              <span>LOCKED (POSTED)</span>
                            </span>
                          ) : inv.status === 'void' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                              <Ban className="w-2.5 h-2.5" />
                              <span>VOIDED</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <FileText className="w-2.5 h-2.5" />
                              <span>DRAFT (EDITABLE)</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          {inv.status === 'draft' ? (
                            <>
                              <button
                                onClick={() => handlePostDocument(inv)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition inline-flex items-center space-x-1"
                              >
                                <Lock className="w-3 h-3" />
                                <span>Save & Lock</span>
                              </button>
                              <button
                                onClick={() => handleDeleteDraftDocument(inv)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded transition inline-flex items-center"
                                title="Delete draft invoice"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : inv.status === 'posted' ? (
                            <>
                              <button
                                onClick={() => handleVoidDocument(inv)}
                                className="px-2 py-0.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-[10px] font-semibold transition inline-flex items-center"
                              >
                                <Ban className="w-2.5 h-2.5 mr-0.5" />
                                <span>Void</span>
                              </button>
                              {user?.role === 'super_admin' && (
                                <button
                                  onClick={() => handleSuperAdminDeleteDoc(inv)}
                                  className="p-1 text-red-500 hover:text-red-700 rounded transition inline-flex items-center ml-1"
                                  title="Super-Admin Master Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="text-slate-400 italic text-[11px]">No actions</span>
                              {user?.role === 'super_admin' && (
                                <button
                                  onClick={() => handleSuperAdminDeleteDoc(inv)}
                                  className="p-1 text-red-500 hover:text-red-700 rounded transition inline-flex items-center ml-1"
                                  title="Super-Admin Master Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 5: PURCHASE BILLS (DRAFT VS LOCKED POSTED)
        ========================================================================= */}
        {activeTab === 'bills' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Bill #</th>
                    {user?.role === 'super_admin' && (
                      <th className="py-3 px-4 text-indigo-600 dark:text-indigo-400">Distributor Firm</th>
                    )}
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Vendor / Supplier</th>
                    <th className="py-3 px-4 text-right">Total (₹)</th>
                    <th className="py-3 px-4 text-center">Status & Lock</th>
                    <th className="py-3 px-4 text-right">Governance Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {bills
                    .filter(
                      (b) =>
                        b.docNo?.toLowerCase().includes(search.toLowerCase()) ||
                        b.partyName?.toLowerCase().includes(search.toLowerCase())
                    )
                    .map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-mono font-bold text-amber-600 dark:text-amber-400">
                          {b.docNo}
                        </td>
                        {user?.role === 'super_admin' && (
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              {b.distributorName || 'Distributor'}
                            </span>
                          </td>
                        )}
                        <td className="py-3 px-4 font-mono">{b.docDate}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          {b.partyName}
                        </td>
                        <td className="py-3 px-4 text-right font-bold">
                          ₹ {formatPaise(b.total)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {b.status === 'posted' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <Lock className="w-2.5 h-2.5" />
                              <span>LOCKED (POSTED)</span>
                            </span>
                          ) : b.status === 'void' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                              <Ban className="w-2.5 h-2.5" />
                              <span>VOIDED</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <FileCheck className="w-2.5 h-2.5" />
                              <span>DRAFT (EDITABLE)</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          {b.status === 'draft' ? (
                            <>
                              <button
                                onClick={() => handlePostDocument(b)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition inline-flex items-center space-x-1"
                              >
                                <Lock className="w-3 h-3" />
                                <span>Save & Lock</span>
                              </button>
                              <button
                                onClick={() => handleDeleteDraftDocument(b)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded transition inline-flex items-center"
                                title="Delete draft bill"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : b.status === 'posted' ? (
                            <>
                              <button
                                onClick={() => handleVoidDocument(b)}
                                className="px-2 py-0.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-[10px] font-semibold transition inline-flex items-center"
                              >
                                <Ban className="w-2.5 h-2.5 mr-0.5" />
                                <span>Void</span>
                              </button>
                              {user?.role === 'super_admin' && (
                                <button
                                  onClick={() => handleSuperAdminDeleteDoc(b)}
                                  className="p-1 text-red-500 hover:text-red-700 rounded transition inline-flex items-center ml-1"
                                  title="Super-Admin Master Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="text-slate-400 italic text-[11px]">No actions</span>
                              {user?.role === 'super_admin' && (
                                <button
                                  onClick={() => handleSuperAdminDeleteDoc(b)}
                                  className="p-1 text-red-500 hover:text-red-700 rounded transition inline-flex items-center ml-1"
                                  title="Super-Admin Master Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          PARTY MODAL (ADD / EDIT CUSTOMER OR VENDOR)
      ========================================================================= */}
      {isPartyModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
          style={{ zIndex: 100, pointerEvents: 'auto' }}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-800 relative z-[101]"
            style={{ zIndex: 101 }}
          >
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/40">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                {editingPartyId ? `Edit ${partyKind === 'vendor' ? 'Vendor' : 'Customer'}` : `Add New ${partyKind === 'vendor' ? 'Vendor' : 'Customer'}`}
              </h3>
              <button
                onClick={() => setIsPartyModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveParty} className="p-6 space-y-4 text-xs">
              {modalError && (
                <div className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs">
                  {modalError}
                </div>
              )}

              {user?.role === 'super_admin' && !editingPartyId && (
                <div>
                  <label className="block font-semibold mb-1 text-indigo-700 dark:text-indigo-300">
                    🏢 Target Distributor Firm *
                  </label>
                  <select
                    value={targetBusinessId}
                    onChange={(e) => setTargetBusinessId(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
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
                <label className="block font-semibold mb-1">Business Name *</label>
                <input
                  type="text"
                  required
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  placeholder="e.g. Acme Supplies Pvt Ltd"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">GSTIN</label>
                  <input
                    type="text"
                    maxLength={15}
                    value={partyGstin}
                    onChange={(e) => setPartyGstin(e.target.value.toUpperCase())}
                    placeholder="15-digit GSTIN"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Phone</label>
                  <input
                    type="text"
                    value={partyPhone}
                    onChange={(e) => setPartyPhone(e.target.value)}
                    placeholder="10-digit mobile"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Email</label>
                <input
                  type="email"
                  value={partyEmail}
                  onChange={(e) => setPartyEmail(e.target.value)}
                  placeholder="billing@party.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Billing Address</label>
                <textarea
                  rows={2}
                  value={partyAddress}
                  onChange={(e) => setPartyAddress(e.target.value)}
                  placeholder="Street, City, State, Pincode"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              {editingPartyId && (
                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="checkbox"
                    id="partyActive"
                    checked={partyIsActive}
                    onChange={(e) => setPartyIsActive(e.target.checked)}
                    className="rounded text-amber-500 focus:ring-amber-400"
                  />
                  <label htmlFor="partyActive" className="font-semibold text-slate-700 dark:text-slate-300">
                    Account Active (Uncheck to disable without deleting history)
                  </label>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsPartyModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-4 py-2 font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl transition"
                >
                  {modalSubmitting ? 'Saving...' : 'Save Party'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          ITEM MODAL (ADD / EDIT ITEM & SERVICE WITH UNIT MEASURES)
      ========================================================================= */}
      {isItemModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
          style={{ zIndex: 100, pointerEvents: 'auto' }}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-800 relative z-[101]"
            style={{ zIndex: 101 }}
          >
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/40">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                {editingItemId ? 'Edit Item / Service' : 'Add New Item / Service'}
              </h3>
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-6 space-y-4 text-xs">
              {modalError && (
                <div className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs">
                  {modalError}
                </div>
              )}

              {user?.role === 'super_admin' && !editingItemId && (
                <div>
                  <label className="block font-semibold mb-1 text-indigo-700 dark:text-indigo-300">
                    🏢 Target Distributor Firm *
                  </label>
                  <select
                    value={targetBusinessId}
                    onChange={(e) => setTargetBusinessId(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
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
                <label className="block font-semibold mb-1">Item / Product Name *</label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Premium Basmati Rice 25kg"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">HSN / SAC Code</label>
                  <input
                    type="text"
                    value={itemHsnSac}
                    onChange={(e) => setItemHsnSac(e.target.value)}
                    placeholder="e.g. 100630"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Unit of Measure *</label>
                  <select
                    value={itemUnit}
                    onChange={(e) => setItemUnit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-amber-50/60 dark:bg-slate-800 font-bold text-amber-900 dark:text-amber-300"
                  >
                    {ITEM_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u} (Unit)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Sale Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={itemSalePrice}
                    onChange={(e) => setItemSalePrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-right"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Purchase Rate (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={itemPurchasePrice}
                    onChange={(e) => setItemPurchasePrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-right"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">GST Rate %</label>
                  <select
                    value={itemGstRate}
                    onChange={(e) => setItemGstRate(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-center"
                  >
                    {GST_RATES.map((r) => (
                      <option key={r} value={r}>
                        {r}%
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {editingItemId && (
                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="checkbox"
                    id="itemActive"
                    checked={itemIsActive}
                    onChange={(e) => setItemIsActive(e.target.checked)}
                    className="rounded text-amber-500 focus:ring-amber-400"
                  />
                  <label htmlFor="itemActive" className="font-semibold text-slate-700 dark:text-slate-300">
                    Item Active (Uncheck to disable in billing selection)
                  </label>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-4 py-2 font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl transition"
                >
                  {modalSubmitting ? 'Saving...' : 'Save Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
