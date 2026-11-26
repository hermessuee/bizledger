'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatPaise, GST_RATES, ITEM_UNITS } from '@bizledger/shared';
import { Plus, Package, Search, X, Trash2 } from 'lucide-react';

export default function ItemsPage() {
  const { user, hasPermission } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]);
  const [targetBusinessId, setTargetBusinessId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add Item Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [hsnSac, setHsnSac] = useState('');
  const [unit, setUnit] = useState('PCS');
  const [salePrice, setSalePrice] = useState('0');
  const [purchasePrice, setPurchasePrice] = useState('0');
  const [gstRate, setGstRate] = useState(18);
  const [trackStock, setTrackStock] = useState(false);
  const [stockQty, setStockQty] = useState('0');

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/v1/items');
      setItems(res.items || []);

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
    fetchItems();
  }, [user]);

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/v1/items', {
        businessId: user?.role === 'super_admin' ? (targetBusinessId || undefined) : undefined,
        name,
        hsnSac: hsnSac || null,
        unit,
        salePrice: Math.round(parseFloat(salePrice || '0') * 100),
        purchasePrice: Math.round(parseFloat(purchasePrice || '0') * 100),
        gstRate: Number(gstRate),
        trackStock,
        stockQty: Number(stockQty) || 0,
      });

      setIsAddOpen(false);
      setName('');
      setHsnSac('');
      setSalePrice('0');
      setPurchasePrice('0');
      fetchItems();
    } catch (err: any) {
      alert(err.message || 'Failed to create item');
    }
  };

  const handleToggleItemStatus = async (item: any) => {
    const newStatus = item.isActive === false ? true : false;
    try {
      await api.put(`/api/v1/items/${item.id}`, { isActive: newStatus });
      fetchItems();
    } catch (err: any) {
      alert(err.message || 'Failed to update item status');
    }
  };

  const handleDeleteItem = async (item: any) => {
    if (!confirm(`Are you sure you want to delete ${item.name}? This will remove it from all distributor records.`)) return;
    try {
      await api.delete(`/api/v1/items/${item.id}`);
      fetchItems();
    } catch (err: any) {
      alert(err.message || 'Failed to delete item');
    }
  };

  const filtered = items.filter((i) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return i.name.toLowerCase().includes(q) || (i.hsnSac && i.hsnSac.includes(q));
  });

  return (
    <AppShell currentMenu="items">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Items & Services Master
            </h1>
            <p className="text-xs text-slate-500">
              Configure goods (HSN) and services (SAC), tax rates, and standard pricing
            </p>
          </div>

          {hasPermission('items', 'create') && (
            <button
              onClick={() => setIsAddOpen(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Item / Service
            </button>
          )}
        </div>

        {/* Search */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border flex items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search item name, HSN/SAC code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">Total Items: {filtered.length}</span>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[850px]">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b">
                <tr>
                  <th className="py-3 px-4">Item / Service Name</th>
                  {user?.role === 'super_admin' && (
                    <th className="py-3 px-4 text-indigo-600 dark:text-indigo-400">Distributor Firm</th>
                  )}
                  <th className="py-3 px-4">HSN/SAC</th>
                  <th className="py-3 px-4">Unit</th>
                  <th className="py-3 px-4 text-right">Sale Price (₹)</th>
                  <th className="py-3 px-4 text-right">Purchase Price (₹)</th>
                  <th className="py-3 px-4 text-center">GST Rate</th>
                  <th className="py-3 px-4 text-right">Stock Qty</th>
                  {user?.role === 'super_admin' && (
                    <th className="py-3 px-4 text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-semibold text-slate-900">{item.name}</td>
                    {user?.role === 'super_admin' && (
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {item.distributorName || 'Distributor'}
                        </span>
                      </td>
                    )}
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                      {item.hsnSac || '-'}
                    </td>
                    <td className="py-3 px-4">{item.unit}</td>
                    <td className="py-3 px-4 text-right font-medium">
                      ₹ {formatPaise(item.salePrice)}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-500">
                      ₹ {formatPaise(item.purchasePrice)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                        {item.gstRate}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {item.trackStock ? (
                        <span className="font-semibold text-slate-800">{item.stockQty}</span>
                      ) : (
                        <span className="text-slate-400">N/A</span>
                      )}
                    </td>
                    {user?.role === 'super_admin' && (
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleItemStatus(item)}
                          className="px-2 py-0.5 text-[10px] font-bold rounded border transition"
                          title="Toggle Active/Disable"
                        >
                          {item.isActive === false ? 'Enable' : 'Disable'}
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded transition inline-flex items-center"
                          title="Delete item"
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

      {/* Add Item Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-base">Add New Item or Service</h3>
              <button onClick={() => setIsAddOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="p-6 space-y-3 text-xs">
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
                <label className="block font-semibold mb-1">Item / Service Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Accounting Consultation / Dell Monitor"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">HSN or SAC Code</label>
                  <input
                    type="text"
                    placeholder="e.g. 998222 or 8471"
                    value={hsnSac}
                    onChange={(e) => setHsnSac(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Unit of Measurement *</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg outline-none bg-amber-50/50 dark:bg-slate-800 font-bold text-amber-900 dark:text-amber-300"
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
                    step="0.01"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Purchase Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">GST Rate</label>
                  <select
                    value={gstRate}
                    onChange={(e) => setGstRate(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg outline-none bg-white font-medium"
                  >
                    {GST_RATES.map((r) => (
                      <option key={r} value={r}>
                        {r}%
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="trackStock"
                  checked={trackStock}
                  onChange={(e) => setTrackStock(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <label htmlFor="trackStock" className="font-semibold cursor-pointer">
                  Track Inventory Stock Quantity
                </label>
              </div>

              {trackStock && (
                <div>
                  <label className="block font-semibold mb-1">Opening Stock Quantity</label>
                  <input
                    type="number"
                    value={stockQty}
                    onChange={(e) => setStockQty(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg outline-none"
                  />
                </div>
              )}

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
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
