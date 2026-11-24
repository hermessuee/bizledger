'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatPaise, GST_RATES } from '@bizledger/shared';
import { Plus, Package, Search, X } from 'lucide-react';

export default function ItemsPage() {
  const { hasPermission } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add Item Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [hsnSac, setHsnSac] = useState('');
  const [unit, setUnit] = useState('Nos');
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
    } catch {}
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/v1/items', {
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
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b">
                <tr>
                  <th className="py-3 px-4">Item / Service Name</th>
                  <th className="py-3 px-4">HSN/SAC</th>
                  <th className="py-3 px-4">Unit</th>
                  <th className="py-3 px-4 text-right">Sale Price (₹)</th>
                  <th className="py-3 px-4 text-right">Purchase Price (₹)</th>
                  <th className="py-3 px-4 text-center">GST Rate</th>
                  <th className="py-3 px-4 text-right">Stock Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-semibold text-slate-900">{item.name}</td>
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
                  <label className="block font-semibold mb-1">Unit of Measurement</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg outline-none bg-white"
                  >
                    <option value="Nos">Nos (Numbers)</option>
                    <option value="Hours">Hours</option>
                    <option value="Months">Months</option>
                    <option value="Kgs">Kgs (Kilograms)</option>
                    <option value="Meters">Meters</option>
                    <option value="Boxes">Boxes</option>
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
