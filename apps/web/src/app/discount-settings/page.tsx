'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { 
  Percent, 
  Package, 
  Users, 
  Search, 
  Save, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

export default function DiscountSettingsPage() {
  const { business, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'items' | 'retailers'>('items');

  // Items State
  const [items, setItems] = useState<any[]>([]);
  const [itemDiscounts, setItemDiscounts] = useState<Record<string, number>>({});
  const [itemSearch, setItemSearch] = useState('');
  const [bulkItemPercent, setBulkItemPercent] = useState<string>('');
  const [loadingItems, setLoadingItems] = useState(false);
  const [savingItems, setSavingItems] = useState(false);
  const [itemSortField, setItemSortField] = useState<string>('sku_name');
  const [itemSortOrder, setItemSortOrder] = useState<'asc' | 'desc'>('asc');

  // Retailers State
  const [retailers, setRetailers] = useState<any[]>([]);
  const [retailerDiscounts, setRetailerDiscounts] = useState<Record<string, number>>({});
  const [retailerSearch, setRetailerSearch] = useState('');
  const [bulkRetailerPercent, setBulkRetailerPercent] = useState<string>('');
  const [loadingRetailers, setLoadingRetailers] = useState(false);
  const [savingRetailers, setSavingRetailers] = useState(false);
  const [retailerSortField, setRetailerSortField] = useState<string>('retailer_name');
  const [retailerSortOrder, setRetailerSortOrder] = useState<'asc' | 'desc'>('asc');

  // Status message
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchItems();
    fetchRetailers();
  }, []);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchItems = async () => {
    try {
      setLoadingItems(true);
      const res = await api.get('/api/v1/items');
      const fetchedItems = res.items || [];
      setItems(fetchedItems);
      
      const discountMap: Record<string, number> = {};
      fetchedItems.forEach((i: any) => {
        discountMap[i.id] = Number(i.discountPercentage || 0);
      });
      setItemDiscounts(discountMap);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to fetch items');
    } finally {
      setLoadingItems(false);
    }
  };

  const fetchRetailers = async () => {
    try {
      setLoadingRetailers(true);
      const res = await api.get('/api/v1/parties?kind=customer');
      const fetchedParties = res.parties || [];
      setRetailers(fetchedParties);

      const discountMap: Record<string, number> = {};
      fetchedParties.forEach((p: any) => {
        discountMap[p.id] = Number(p.discountPercentage || 0);
      });
      setRetailerDiscounts(discountMap);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to fetch retailers');
    } finally {
      setLoadingRetailers(false);
    }
  };

  // Bulk Apply handlers
  const handleApplyBulkItemDiscount = () => {
    const val = parseFloat(bulkItemPercent);
    if (isNaN(val) || val < 0 || val > 100) {
      alert('Please enter a valid discount percentage between 0 and 100.');
      return;
    }
    const updated = { ...itemDiscounts };
    filteredItems.forEach((i) => {
      updated[i.id] = val;
    });
    setItemDiscounts(updated);
    showNotification('success', `Applied ${val}% discount to ${filteredItems.length} filtered items. Click "Save Item Discounts" to confirm.`);
  };

  const handleApplyBulkRetailerDiscount = () => {
    const val = parseFloat(bulkRetailerPercent);
    if (isNaN(val) || val < 0 || val > 100) {
      alert('Please enter a valid discount percentage between 0 and 100.');
      return;
    }
    const updated = { ...retailerDiscounts };
    filteredRetailers.forEach((r) => {
      updated[r.id] = val;
    });
    setRetailerDiscounts(updated);
    showNotification('success', `Applied ${val}% discount to ${filteredRetailers.length} filtered retailers. Click "Save Retailer Discounts" to confirm.`);
  };

  // Save Handlers
  const handleSaveItemDiscounts = async () => {
    try {
      setSavingItems(true);
      const discountsPayload = Object.entries(itemDiscounts).map(([id, discount_percentage]) => ({
        id,
        discount_percentage: Number(discount_percentage) || 0,
      }));

      await api.post('/api/v1/items/batch/discounts', { discounts: discountsPayload });
      showNotification('success', 'Item level discounts successfully saved and updated across billing!');
      await fetchItems();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to save item discounts');
    } finally {
      setSavingItems(false);
    }
  };

  const handleSaveRetailerDiscounts = async () => {
    try {
      setSavingRetailers(true);
      const discountsPayload = Object.entries(retailerDiscounts).map(([id, discount_percentage]) => ({
        id,
        discount_percentage: Number(discount_percentage) || 0,
      }));

      await api.post('/api/v1/parties/batch/discounts', { discounts: discountsPayload });
      showNotification('success', 'Retailer level discounts successfully saved and updated across billing!');
      await fetchRetailers();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to save retailer discounts');
    } finally {
      setSavingRetailers(false);
    }
  };

  // Filtering & Sorting Items
  const filteredItems = useMemo(() => {
    let list = items.filter((i) => {
      const q = itemSearch.toLowerCase();
      const name = (i.sku_name || i.name || '').toLowerCase();
      const code = (i.sku_code || '').toLowerCase();
      const comp = (i.company || '').toLowerCase();
      const cat = (i.category || '').toLowerCase();
      return name.includes(q) || code.includes(q) || comp.includes(q) || cat.includes(q);
    });

    list.sort((a, b) => {
      let aVal = a[itemSortField];
      let bVal = b[itemSortField];
      if (itemSortField === 'discount') {
        aVal = itemDiscounts[a.id] || 0;
        bVal = itemDiscounts[b.id] || 0;
      }
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (typeof aVal === 'string') {
        return itemSortOrder === 'asc' ? aVal.localeCompare(String(bVal)) : String(bVal).localeCompare(aVal);
      }
      return itemSortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return list;
  }, [items, itemSearch, itemDiscounts, itemSortField, itemSortOrder]);

  // Filtering & Sorting Retailers
  const filteredRetailers = useMemo(() => {
    let list = retailers.filter((r) => {
      const q = retailerSearch.toLowerCase();
      const name = (r.retailer_name || r.name || '').toLowerCase();
      const code = (r.retailer_code || '').toLowerCase();
      const phone = (r.mobile_number || r.phone || '').toLowerCase();
      const town = (r.tin_location_name || r.address_1 || '').toLowerCase();
      const gstin = (r.gst_no || r.gstin || '').toLowerCase();
      return name.includes(q) || code.includes(q) || phone.includes(q) || town.includes(q) || gstin.includes(q);
    });

    list.sort((a, b) => {
      let aVal = a[retailerSortField];
      let bVal = b[retailerSortField];
      if (retailerSortField === 'discount') {
        aVal = retailerDiscounts[a.id] || 0;
        bVal = retailerDiscounts[b.id] || 0;
      }
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (typeof aVal === 'string') {
        return retailerSortOrder === 'asc' ? aVal.localeCompare(String(bVal)) : String(bVal).localeCompare(aVal);
      }
      return retailerSortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return list;
  }, [retailers, retailerSearch, retailerDiscounts, retailerSortField, retailerSortOrder]);

  // Table Sort Header Renderer
  const renderItemHeader = (label: string, fieldKey: string, align: 'left' | 'center' | 'right' = 'left') => {
    const isSorted = itemSortField === fieldKey;
    return (
      <th
        onClick={() => {
          if (isSorted) {
            setItemSortOrder(itemSortOrder === 'asc' ? 'desc' : 'asc');
          } else {
            setItemSortField(fieldKey);
            setItemSortOrder('asc');
          }
        }}
        className={`px-3 py-3 text-${align} font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors`}
      >
        <div className={`inline-flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
          <span>{label}</span>
          {isSorted ? (
            itemSortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-blue-600" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
          ) : (
            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
          )}
        </div>
      </th>
    );
  };

  const renderRetailerHeader = (label: string, fieldKey: string, align: 'left' | 'center' | 'right' = 'left') => {
    const isSorted = retailerSortField === fieldKey;
    return (
      <th
        onClick={() => {
          if (isSorted) {
            setRetailerSortOrder(retailerSortOrder === 'asc' ? 'desc' : 'asc');
          } else {
            setRetailerSortField(fieldKey);
            setRetailerSortOrder('asc');
          }
        }}
        className={`px-3 py-3 text-${align} font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors`}
      >
        <div className={`inline-flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
          <span>{label}</span>
          {isSorted ? (
            retailerSortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-blue-600" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
          ) : (
            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl">
              <Percent className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Discount Settings & Governance
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure default wholesale trade discount percentages by SKU item or by customer retailer. Default discounts auto-populate on sales invoice billing.
          </p>
        </div>

        {business?.name && (
          <div className="px-3.5 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-200 dark:border-blue-800 text-xs font-semibold text-blue-800 dark:text-blue-300">
            Distributor: {business.name}
          </div>
        )}
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          )}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 space-x-2">
        <button
          onClick={() => setActiveTab('items')}
          className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm rounded-t-xl transition-all border-b-2 -mb-px ${
            activeTab === 'items'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 shadow-sm'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Item Level Discounts</span>
          <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold">
            {items.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('retailers')}
          className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm rounded-t-xl transition-all border-b-2 -mb-px ${
            activeTab === 'retailers'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 shadow-sm'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Retailer Level Discounts</span>
          <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold">
            {retailers.length}
          </span>
        </button>
      </div>

      {/* TAB 1: ITEM LEVEL DISCOUNTS */}
      {activeTab === 'items' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-700/60">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search SKU code, product name, brand..."
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-xl text-sm bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Quick Bulk Update */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700/60 p-1.5 rounded-xl border border-slate-200 dark:border-slate-600">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 ml-1">Bulk Set:</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="%"
                  value={bulkItemPercent}
                  onChange={(e) => setBulkItemPercent(e.target.value)}
                  className="w-20 px-2.5 py-1 text-sm border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold text-center outline-none"
                />
                <button
                  onClick={handleApplyBulkItemDiscount}
                  className="px-3 py-1 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-800 dark:text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  Apply to Filtered
                </button>
              </div>

              {/* Action Buttons */}
              <button
                onClick={fetchItems}
                disabled={loadingItems || savingItems}
                title="Reset to database values"
                className="p-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={handleSaveItemDiscounts}
                disabled={savingItems || loadingItems}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{savingItems ? 'Saving...' : 'Save Item Discounts'}</span>
              </button>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 dark:bg-slate-700/40 border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-3 py-3 w-12 text-center font-semibold text-slate-600 dark:text-slate-300">#</th>
                  {renderItemHeader('SKU Code', 'sku_code')}
                  {renderItemHeader('Product / SKU Name', 'sku_name')}
                  {renderItemHeader('Company / Brand', 'company')}
                  {renderItemHeader('Category', 'category')}
                  {renderItemHeader('Unit', 'unit', 'center')}
                  {renderItemHeader('RLP / Rate (₹)', 'salePrice', 'right')}
                  {renderItemHeader('MRP (₹)', 'mrp', 'right')}
                  {renderItemHeader('GST %', 'gstRate', 'center')}
                  {renderItemHeader('Discount %', 'discount', 'center')}
                  <th className="px-3 py-3 text-center font-semibold text-slate-600 dark:text-slate-300">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400">
                      {loadingItems ? 'Loading product master items...' : 'No items found matching search filter.'}
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => {
                    const currentDisc = itemDiscounts[item.id] !== undefined ? itemDiscounts[item.id] : 0;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-3 py-2 text-center text-slate-400">{idx + 1}</td>
                        <td className="px-3 py-2 font-mono font-bold text-slate-700 dark:text-slate-300">
                          {item.sku_code || '—'}
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-900 dark:text-slate-100">
                          {item.sku_name || item.name}
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                          {item.company || '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                          {item.category || '—'}
                        </td>
                        <td className="px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-400">
                          {item.unit || item.Unit || 'PCS'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-blue-700 dark:text-blue-400">
                          ₹{((item.salePrice || item.rlp || 0) / 100).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-500">
                          ₹{((item.mrp || 0) / 100).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-300">
                          {item.gstRate || 0}%
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={currentDisc}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setItemDiscounts((prev) => ({ ...prev, [item.id]: val }));
                              }}
                              className="w-20 px-2 py-1 border-2 border-emerald-400 dark:border-emerald-600 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 font-bold text-center outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            <span className="text-emerald-700 dark:text-emerald-400 font-bold">%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              item.isActive !== false
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                            }`}
                          >
                            {item.isActive !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: RETAILER LEVEL DISCOUNTS */}
      {activeTab === 'retailers' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-700/60">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search retailer code, name, phone, town..."
                value={retailerSearch}
                onChange={(e) => setRetailerSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-xl text-sm bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Quick Bulk Update */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700/60 p-1.5 rounded-xl border border-slate-200 dark:border-slate-600">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 ml-1">Bulk Set:</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="%"
                  value={bulkRetailerPercent}
                  onChange={(e) => setBulkRetailerPercent(e.target.value)}
                  className="w-20 px-2.5 py-1 text-sm border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold text-center outline-none"
                />
                <button
                  onClick={handleApplyBulkRetailerDiscount}
                  className="px-3 py-1 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-800 dark:text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  Apply to Filtered
                </button>
              </div>

              {/* Action Buttons */}
              <button
                onClick={fetchRetailers}
                disabled={loadingRetailers || savingRetailers}
                title="Reset to database values"
                className="p-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={handleSaveRetailerDiscounts}
                disabled={savingRetailers || loadingRetailers}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{savingRetailers ? 'Saving...' : 'Save Retailer Discounts'}</span>
              </button>
            </div>
          </div>

          {/* Retailers Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 dark:bg-slate-700/40 border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-3 py-3 w-12 text-center font-semibold text-slate-600 dark:text-slate-300">#</th>
                  {renderRetailerHeader('Retailer Code', 'retailer_code')}
                  {renderRetailerHeader('Retailer / Customer Name', 'retailer_name')}
                  {renderRetailerHeader('Town / Location', 'tin_location_name')}
                  {renderRetailerHeader('Mobile Number', 'mobile_number')}
                  {renderRetailerHeader('GSTIN', 'gst_no')}
                  {renderRetailerHeader('Discount %', 'discount', 'center')}
                  <th className="px-3 py-3 text-center font-semibold text-slate-600 dark:text-slate-300">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {filteredRetailers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      {loadingRetailers ? 'Loading customer retailers...' : 'No retailers found matching search filter.'}
                    </td>
                  </tr>
                ) : (
                  filteredRetailers.map((ret, idx) => {
                    const currentDisc = retailerDiscounts[ret.id] !== undefined ? retailerDiscounts[ret.id] : 0;
                    return (
                      <tr key={ret.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-3 py-2 text-center text-slate-400">{idx + 1}</td>
                        <td className="px-3 py-2 font-mono font-bold text-slate-700 dark:text-slate-300">
                          {ret.retailer_code || ret.code || '—'}
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-900 dark:text-slate-100">
                          {ret.retailer_name || ret.name}
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                          {ret.tin_location_name || ret.address_1 || ret.address || '—'}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">
                          {ret.mobile_number || ret.phone || '—'}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">
                          {ret.gst_no || ret.gstin || 'Unregistered'}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={currentDisc}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setRetailerDiscounts((prev) => ({ ...prev, [ret.id]: val }));
                              }}
                              className="w-20 px-2 py-1 border-2 border-emerald-400 dark:border-emerald-600 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 font-bold text-center outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            <span className="text-emerald-700 dark:text-emerald-400 font-bold">%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              ret.isActive !== false
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                            }`}
                          >
                            {ret.isActive !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
