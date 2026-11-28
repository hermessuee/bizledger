'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatPaise, GST_RATES, ITEM_UNITS } from '@bizledger/shared';
import { Plus, Package, Search, X, Trash2, Edit3, Download, Tag, Layers, CheckCircle2, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';

export default function ItemsPage() {
  const { user, hasPermission } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]);
  const [targetBusinessId, setTargetBusinessId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Sorting State
  const [sortField, setSortField] = useState<string>('skuCode');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Add / Edit Item Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Form Fields:
  // company, category, sku_code, sku_name, product_batch, mrp, rlp, upc, hsn_code, expiry_date, ean_code, Unit, GSTRatePercent, OpeningStockQty, discountPercentage
  const [company, setCompany] = useState('');
  const [category, setCategory] = useState('');
  const [skuCode, setSkuCode] = useState('');
  const [skuName, setSkuName] = useState('');
  const [productBatch, setProductBatch] = useState('');
  const [mrp, setMrp] = useState('0');
  const [rlp, setRlp] = useState('0');
  const [upc, setUpc] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [eanCode, setEanCode] = useState('');
  const [unit, setUnit] = useState('KG');
  const [gstRatePercent, setGstRatePercent] = useState(0);
  const [openingStockQty, setOpeningStockQty] = useState('0');
  const [discountPercentage, setDiscountPercentage] = useState('0');

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

  const resetForm = () => {
    setEditingItemId(null);
    setCompany('');
    setCategory('');
    setSkuCode('');
    setSkuName('');
    setProductBatch('');
    setMrp('0');
    setRlp('0');
    setUpc('');
    setHsnCode('');
    setExpiryDate('');
    setEanCode('');
    setUnit('KG');
    setGstRatePercent(0);
    setOpeningStockQty('0');
    setDiscountPercentage('0');
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingItemId(item.id);
    setCompany(item.company || '');
    setCategory(item.category || '');
    setSkuCode(item.skuCode || '');
    setSkuName(item.name || item.skuName || '');
    setProductBatch(item.productBatch || '');
    setMrp(item.mrp ? (item.mrp / 100).toString() : '0');
    setRlp(item.rlp ? (item.rlp / 100).toString() : (item.salePrice ? (item.salePrice / 100).toString() : '0'));
    setUpc(item.upc || '');
    setHsnCode(item.hsnCode || item.hsnSac || '');
    setExpiryDate(item.expiryDate || '');
    setEanCode(item.eanCode || '');
    setUnit(item.unit || 'KG');
    setGstRatePercent(item.gstRate !== undefined ? item.gstRate : 0);
    setOpeningStockQty((item.stockQty || 0).toString());
    setDiscountPercentage(String(item.discountPercentage || 0));
    if (item.businessId) setTargetBusinessId(item.businessId);
    setIsModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        businessId: user?.role === 'super_admin' ? (targetBusinessId || undefined) : undefined,
        company: company.trim() || null,
        category: category.trim() || null,
        sku_code: skuCode.trim() || null,
        sku_name: skuName.trim(),
        name: skuName.trim(),
        product_batch: productBatch.trim() || null,
        mrp: Math.round(parseFloat(mrp || '0') * 100),
        rlp: Math.round(parseFloat(rlp || '0') * 100),
        salePrice: Math.round(parseFloat(rlp || '0') * 100),
        upc: upc.trim() || null,
        hsn_code: hsnCode.trim() || null,
        hsnSac: hsnCode.trim() || null,
        expiry_date: expiryDate.trim() || null,
        ean_code: eanCode.trim() || null,
        Unit: unit.trim().toUpperCase(),
        unit: unit.trim().toUpperCase(),
        GSTRatePercent: Number(gstRatePercent),
        gstRate: Number(gstRatePercent),
        discount_percentage: parseFloat(discountPercentage || '0') || 0,
        OpeningStockQty: Number(openingStockQty) || 0,
        stockQty: Number(openingStockQty) || 0,
      };

      if (editingItemId) {
        await api.put(`/api/v1/items/${editingItemId}`, payload);
      } else {
        await api.post('/api/v1/items', payload);
      }

      setIsModalOpen(false);
      resetForm();
      fetchItems();
    } catch (err: any) {
      alert(err.message || 'Failed to save item');
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

  // Download Sample CSV Template matching screenshot exact columns
  const handleDownloadSampleCsv = () => {
    const headers = [
      'company',
      'category',
      'sku_code',
      'sku_name',
      'product_batch',
      'mrp',
      'rlp',
      'upc',
      'hsn_code',
      'expiry_date',
      'ean_code',
      'Unit',
      'GSTRatePercent',
      'OpeningStockQty',
    ];
    const sampleRows = [
      ['Gold Father', 'Produce', 'SKU-001', 'Mankda Super Gold Produce 250 KG', 'LOT-2026A', '1500', '1200', '890103001', '080280', '2027-10-31', '8901030112233', 'KG', '0', '500'],
      ['Gold Father', 'Produce', 'SKU-002', 'Padi Fine Produce Raw Lot', 'BATCH-002', '19500', '19000', '890103002', '080280', '2027-12-31', '8901030112240', 'KG', '0', '414'],
      ['Gold Father', 'Produce', 'SKU-003', 'Aazhimala Premium Produce Stock', 'BATCH-003', '17000', '16500', '890103003', '080280', '2028-03-31', '8901030112257', 'KG', '0', '343'],
      ['Bristol', 'General', 'SKU-004', 'Item 16917 Commercial Lot', 'LOT-16917', '42000', '40000', '890103004', '080280', '2028-05-31', '8901030112264', 'KG', '0', '16917'],
    ];

    const csvContent = '\uFEFF' + [headers.join(','), ...sampleRows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bizledger_items_sku_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filtered = items.filter((i) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const nameMatch = (i.name || i.skuName || '').toLowerCase().includes(q);
    const codeMatch = (i.skuCode || '').toLowerCase().includes(q);
    const hsnMatch = (i.hsnCode || i.hsnSac || '').toLowerCase().includes(q);
    const compMatch = (i.company || '').toLowerCase().includes(q);
    const catMatch = (i.category || '').toLowerCase().includes(q);
    return nameMatch || codeMatch || hsnMatch || compMatch || catMatch;
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedItems = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'skuName' || sortField === 'name') {
        valA = a.skuName || a.name || '';
        valB = b.skuName || b.name || '';
      } else if (sortField === 'rlp') {
        valA = a.rlp !== undefined && a.rlp !== null ? a.rlp : (a.salePrice || 0);
        valB = b.rlp !== undefined && b.rlp !== null ? b.rlp : (b.salePrice || 0);
      } else if (sortField === 'mrp') {
        valA = a.mrp || 0;
        valB = b.mrp || 0;
      } else if (sortField === 'discount') {
        valA = a.discountPercentage || 0;
        valB = b.discountPercentage || 0;
      } else if (sortField === 'stockQty') {
        valA = a.stockQty || 0;
        valB = b.stockQty || 0;
      }

      if (valA === valB) return 0;
      if (valA === null || valA === undefined || valA === '') return 1;
      if (valB === null || valB === undefined || valB === '') return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      const cmp = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortField, sortOrder]);

  const renderSortHeader = (label: string, field: string, className = '') => (
    <th
      onClick={() => handleSort(field)}
      className={`py-3 px-3 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-800 transition ${className}`}
    >
      <div className={`inline-flex items-center gap-1 ${className.includes('text-right') ? 'justify-end w-full' : className.includes('text-center') ? 'justify-center w-full' : ''}`}>
        <span>{label}</span>
        {sortField === field ? (
          sortOrder === 'asc' ? (
            <ChevronUp className="w-3 h-3 text-blue-600 dark:text-blue-400" />
          ) : (
            <ChevronDown className="w-3 h-3 text-blue-600 dark:text-blue-400" />
          )
        ) : (
          <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-50" />
        )}
      </div>
    </th>
  );

  return (
    <AppShell currentMenu="items">
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Package className="w-6 h-6 text-blue-600" />
              <span>Item Master (SKU Catalog)</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Standardized FMCG SKU catalog: company, category, batch, MRP, wholesale RLP, HSN, barcodes, and units
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadSampleCsv}
              className="inline-flex items-center px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold shadow-xs transition"
              title="Download standardized CSV upload template with exact headers"
            >
              <Download className="w-4 h-4 mr-1.5 text-blue-600" />
              <span>Download Template (CSV)</span>
            </button>

            {hasPermission('items', 'create') && (
              <button
                onClick={handleOpenAdd}
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition transform active:scale-95"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                <span>Add New SKU Item</span>
              </button>
            )}
          </div>
        </div>

        {/* Search & Summary Strip */}
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by SKU code, item name, company, category, HSN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-xl text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
            <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200">
              Total Catalog Items: {filtered.length}
            </span>
          </div>
        </div>

        {/* Master SKU Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[1100px]">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-3 text-center w-12">#</th>
                  {renderSortHeader('SKU Code', 'skuCode', 'w-28 font-mono')}
                  {renderSortHeader('SKU Name / Description', 'skuName', 'min-w-[200px]')}
                  {renderSortHeader('Company', 'company', 'w-28')}
                  {renderSortHeader('Category', 'category', 'w-24')}
                  {renderSortHeader('Batch', 'productBatch', 'w-24 text-center')}
                  {renderSortHeader('RLP (₹)', 'rlp', 'text-right w-24 font-bold text-slate-800 dark:text-slate-200')}
                  {renderSortHeader('MRP (₹)', 'mrp', 'text-right w-24')}
                  {renderSortHeader('Unit', 'unit', 'text-center w-16')}
                  {renderSortHeader('Disc %', 'discount', 'text-right w-20 text-blue-600 dark:text-blue-400')}
                  {renderSortHeader('HSN Code', 'hsnCode', 'text-center w-24')}
                  {renderSortHeader('GST %', 'gstRate', 'text-center w-20')}
                  {renderSortHeader('Stock Qty', 'stockQty', 'text-right w-24')}
                  {user?.role === 'super_admin' && (
                    renderSortHeader('Distributor', 'distributorName', 'text-indigo-600 dark:text-indigo-400')
                  )}
                  {renderSortHeader('Status', 'isActive', 'text-center w-20')}
                  <th className="py-3 px-3 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={16} className="py-12 text-center text-slate-400 font-semibold">
                      Loading SKU catalog...
                    </td>
                  </tr>
                ) : sortedItems.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="py-12 text-center text-slate-400 space-y-2">
                      <Package className="w-8 h-8 mx-auto text-slate-300" />
                      <p className="font-semibold text-slate-600">No SKU items found</p>
                      <p className="text-xs">Add a new SKU item or upload via CSV template.</p>
                    </td>
                  </tr>
                ) : (
                  sortedItems.map((item, idx) => {
                    const rlpPaise = item.rlp !== undefined && item.rlp !== null ? item.rlp : (item.salePrice || 0);
                    const mrpPaise = item.mrp || 0;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3 text-center font-mono text-slate-400 text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-700 dark:text-blue-400 text-[11px]">
                          {item.skuCode || '-'}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          {item.name || item.skuName}
                          {item.expiryDate && (
                            <span className="block text-[10px] text-slate-400 font-normal">
                              Exp: {item.expiryDate}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                          {item.company || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                          {item.category || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-500">
                          {item.productBatch || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-800 dark:text-blue-300">
                          ₹ {formatPaise(rlpPaise)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                          {mrpPaise > 0 ? `₹ ${formatPaise(mrpPaise)}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">
                            {item.unit || 'KG'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                          {item.discountPercentage ? `${item.discountPercentage}%` : '0%'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-600 dark:text-slate-400">
                          {item.hsnCode || item.hsnSac || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300">
                            {item.gstRate ?? 0}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                          {(item.stockQty || 0).toLocaleString('en-IN')}
                        </td>
                        {user?.role === 'super_admin' && (
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200">
                              {item.distributorName || 'Distributor'}
                            </span>
                          </td>
                        )}
                        <td className="py-2.5 px-3 text-center">
                          {item.isActive !== false ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                              Disabled
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right space-x-1 whitespace-nowrap">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1 text-slate-500 hover:text-blue-600 rounded transition inline-flex items-center"
                            title="Edit SKU Details"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleItemStatus(item)}
                            className="px-1.5 py-0.5 text-[10px] font-bold rounded border transition text-slate-600 hover:bg-slate-100"
                            title="Toggle Active/Disable"
                          >
                            {item.isActive === false ? 'Enable' : 'Disable'}
                          </button>
                          {user?.role === 'super_admin' && (
                            <button
                              onClick={() => handleDeleteItem(item)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded transition inline-flex items-center"
                              title="Delete SKU item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add / Edit SKU Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex items-center space-x-2">
                <Package className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  {editingItemId ? 'Edit SKU Item Master' : 'Add New SKU Item (Distribution Format)'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-6 space-y-4 text-xs">
              {user?.role === 'super_admin' && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Target Distributor Firm *
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

              {/* Section 1: Product Identification */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                <h4 className="font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider">
                  1. Brand, Category & SKU Name
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1 text-slate-600">Company / Brand</label>
                    <input
                      type="text"
                      placeholder="e.g. Gold Father, HUL, ITC"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-slate-600">Category</label>
                    <input
                      type="text"
                      placeholder="e.g. Produce, Grocery, Pharma"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold mb-1 text-slate-600">SKU Code</label>
                    <input
                      type="text"
                      placeholder="e.g. SKU-101"
                      value={skuCode}
                      onChange={(e) => setSkuCode(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-semibold mb-1 text-slate-600">SKU Name / Description *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mankda Super Gold 250 KG"
                      value={skuName}
                      onChange={(e) => setSkuName(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Batch & Pricing (RLP / MRP) */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                <h4 className="font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider">
                  2. Batch & Pricing (Wholesale RLP & MRP)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="block font-semibold mb-1 text-slate-600">Product Batch</label>
                    <input
                      type="text"
                      placeholder="e.g. LOT-2026A"
                      value={productBatch}
                      onChange={(e) => setProductBatch(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-slate-600">Batch Expiry Date</label>
                    <input
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1 text-blue-700 dark:text-blue-300">
                      RLP / Rate (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="Retailer Landing Price"
                      value={rlp}
                      onChange={(e) => setRlp(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-blue-400 rounded-xl bg-white dark:bg-slate-800 text-blue-900 dark:text-blue-200 font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-slate-600">MRP (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Maximum Retail Price"
                      value={mrp}
                      onChange={(e) => setMrp(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-emerald-700 dark:text-emerald-400">
                      Default Disc %
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="0.00"
                      value={discountPercentage}
                      onChange={(e) => setDiscountPercentage(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Taxation, Unit & Inventory */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                <h4 className="font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider">
                  3. Taxation, Unit of Measurement & Stock
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-semibold mb-1 text-slate-600">HSN Code</label>
                    <input
                      type="text"
                      placeholder="e.g. 080280"
                      value={hsnCode}
                      onChange={(e) => setHsnCode(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-slate-600">Unit *</label>
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl bg-amber-50/50 dark:bg-slate-800 font-bold text-amber-900 dark:text-amber-300 outline-none"
                    >
                      {ITEM_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-slate-600">GST Rate %</label>
                    <select
                      value={gstRatePercent}
                      onChange={(e) => setGstRatePercent(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold outline-none"
                    >
                      {GST_RATES.map((r) => (
                        <option key={r} value={r}>
                          {r}%
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-slate-600">Opening Stock Qty</label>
                    <input
                      type="number"
                      value={openingStockQty}
                      onChange={(e) => setOpeningStockQty(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block font-semibold mb-1 text-slate-600">UPC Code</label>
                    <input
                      type="text"
                      placeholder="e.g. 890103001"
                      value={upc}
                      onChange={(e) => setUpc(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-slate-600">EAN Code (Barcode)</label>
                    <input
                      type="text"
                      placeholder="e.g. 8901030112233"
                      value={eanCode}
                      onChange={(e) => setEanCode(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none text-[11px]"
                    />
                  </div>
                </div>
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/20"
                >
                  {editingItemId ? 'Update SKU Item' : 'Save SKU Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
