'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatPaise, isValidGSTIN } from '@bizledger/shared';
import { Plus, Users, Search, X, Phone, Mail, MapPin, Trash2, Edit3, Download, ShieldCheck, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';

const getNextRetailerCode = (list: any[]): string => {
  let maxNum = 0;
  let prefix = 'RET';
  let padLen = 4;

  for (const c of list || []) {
    const code = c.retailerCode || '';
    const match = String(code).match(/^([A-Za-z_-]*)(\d+)$/);
    if (match) {
      const num = parseInt(match[2], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
        if (match[1]) prefix = match[1];
        padLen = Math.max(padLen, match[2].length);
      }
    }
  }

  const nextNum = maxNum + 1;
  return `${prefix}${String(nextNum).padStart(padLen, '0')}`;
};

export default function CustomersPage() {
  const { user, business, hasPermission } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]);
  const [targetBusinessId, setTargetBusinessId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Sorting State
  const [sortField, setSortField] = useState<string>('retailerCode');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);

  // Form Fields:
  // distributor_name, retailer_code, retailer_name, address_1, mobile_number, email, latitude, longitude, gst_no, tin_location_name, pan_no, dl_number, dl_expiry_date
  const [distributorName, setDistributorName] = useState('');
  const [retailerCode, setRetailerCode] = useState('');
  const [retailerName, setRetailerName] = useState('');
  const [address1, setAddress1] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [gstNo, setGstNo] = useState('');
  const [tinLocationName, setTinLocationName] = useState('');
  const [panNo, setPanNo] = useState('');
  const [dlNumber, setDlNumber] = useState('');
  const [dlExpiryDate, setDlExpiryDate] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState('0');
  const [creditDays, setCreditDays] = useState('30');
  const [openingBalance, setOpeningBalance] = useState('0');

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/v1/parties?kind=customer');
      setCustomers(res.parties || []);

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
    fetchCustomers();
  }, [user]);

  const resetForm = () => {
    setEditingCustomerId(null);
    setDistributorName(business?.name || '');
    setRetailerCode(getNextRetailerCode(customers));
    setRetailerName('');
    setAddress1('');
    setMobileNumber('');
    setEmail('');
    setLatitude('');
    setLongitude('');
    setGstNo('');
    setTinLocationName('');
    setPanNo('');
    setDlNumber('');
    setDlExpiryDate('');
    setDiscountPercentage('0');
    setCreditDays('30');
    setOpeningBalance('0');
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: any) => {
    setEditingCustomerId(c.id);
    setDistributorName(c.distributorName || c.distributorCode || business?.name || '');
    setRetailerCode(c.retailerCode || '');
    setRetailerName(c.retailerName || c.name || '');
    setAddress1(c.address1 || c.address || '');
    setMobileNumber(c.mobileNumber || c.phone || '');
    setEmail(c.email || '');
    setLatitude(c.latitude || '');
    setLongitude(c.longitude || '');
    setGstNo(c.gstNo || c.gstin || '');
    setTinLocationName(c.tinLocationName || '');
    setPanNo(c.panNo || '');
    setDlNumber(c.dlNumber || '');
    setDlExpiryDate(c.dlExpiryDate || '');
    setDiscountPercentage(String(c.discountPercentage || 0));
    setCreditDays((c.creditDays || 30).toString());
    setOpeningBalance(c.openingBalance ? (c.openingBalance / 100).toString() : '0');
    if (c.businessId) setTargetBusinessId(c.businessId);
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (gstNo && !isValidGSTIN(gstNo.trim().toUpperCase())) {
      alert('Please enter a valid 15-character Indian GSTIN');
      return;
    }

    try {
      const balancePaise = Math.round(parseFloat(openingBalance || '0') * 100);
      const cleanGst = gstNo ? gstNo.trim().toUpperCase() : null;
      const cleanPan = panNo ? panNo.trim().toUpperCase() : (cleanGst && cleanGst.length >= 12 ? cleanGst.substring(2, 12) : null);

      const payload = {
        businessId: user?.role === 'super_admin' ? (targetBusinessId || undefined) : undefined,
        kind: 'customer',
        distributor_name: distributorName.trim() || business?.name || null,
        distributor_code: distributorName.trim() || null,
        retailer_code: retailerCode.trim() || null,
        retailer_name: retailerName.trim(),
        name: retailerName.trim(),
        address_1: address1.trim() || null,
        mobile_number: mobileNumber.trim() || null,
        email: email.trim() || null,
        latitude: latitude.trim() || null,
        longitude: longitude.trim() || null,
        gst_no: cleanGst,
        gstin: cleanGst,
        tin_location_name: tinLocationName.trim() || null,
        pan_no: cleanPan,
        dl_number: dlNumber.trim() || null,
        dl_expiry_date: dlExpiryDate.trim() || null,
        discount_percentage: parseFloat(discountPercentage || '0') || 0,
        creditDays: parseInt(creditDays || '30', 10),
        openingBalance: balancePaise,
      };

      if (editingCustomerId) {
        await api.put(`/api/v1/parties/${editingCustomerId}`, payload);
      } else {
        await api.post('/api/v1/parties', payload);
      }

      setIsModalOpen(false);
      fetchCustomers();
    } catch (err: any) {
      alert(err.message || 'Failed to save customer');
    }
  };

  const handleToggleActive = async (c: any) => {
    try {
      const nextActive = !c.isActive;
      await api.put(`/api/v1/parties/${c.id}`, { isActive: nextActive });
      setCustomers(customers.map((cust) => (cust.id === c.id ? { ...cust, isActive: nextActive } : cust)));
    } catch (err: any) {
      alert(err.message || 'Failed to update customer status');
    }
  };

  const handleDeleteCustomer = async (c: any) => {
    if (!confirm(`Are you sure you want to delete ${c.name}? This will remove it from all distributor records.`)) return;
    try {
      await api.delete(`/api/v1/parties/${c.id}`);
      setCustomers(customers.filter((cust) => cust.id !== c.id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete customer');
    }
  };

  const handleDownloadSampleCsv = () => {
    const headers = [
      'distributor_name',
      'retailer_code',
      'retailer_name',
      'address_1',
      'mobile_number',
      'email',
      'latitude',
      'longitude',
      'gst_no',
      'tin_location_name',
      'pan_no',
      'dl_number',
      'dl_expiry_date',
    ];
    const sampleRow = [
      business?.name || 'Gold Father',
      getNextRetailerCode(customers),
      'City Medicals & Supermarket',
      'Main Bazaar Road, Near Town Hall',
      '9847012345',
      'citymedicals@example.com',
      '9.9312',
      '76.2673',
      '32AAACB1234C1Z5',
      'Kayamkulam',
      'AAACB1234C',
      'KL-AL-12345',
      '2028-12-31',
    ];

    const csvContent = [headers.join(','), sampleRow.map((v) => `"${v}"`).join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'bizledger_customers_retailers_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      const s = search.toLowerCase();
      return (
        (c.name && c.name.toLowerCase().includes(s)) ||
        (c.retailerName && c.retailerName.toLowerCase().includes(s)) ||
        (c.retailerCode && c.retailerCode.toLowerCase().includes(s)) ||
        (c.mobileNumber && c.mobileNumber.toLowerCase().includes(s)) ||
        (c.phone && c.phone.toLowerCase().includes(s)) ||
        (c.gstNo && c.gstNo.toLowerCase().includes(s)) ||
        (c.gstin && c.gstin.toLowerCase().includes(s)) ||
        (c.tinLocationName && c.tinLocationName.toLowerCase().includes(s)) ||
        (c.panNo && c.panNo.toLowerCase().includes(s)) ||
        (c.dlNumber && c.dlNumber.toLowerCase().includes(s))
      );
    });
  }, [customers, search]);

  const sortedCustomers = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'retailerName' || sortField === 'name') {
        valA = a.retailerName || a.name || '';
        valB = b.retailerName || b.name || '';
      } else if (sortField === 'balancePaise') {
        valA = a.currentBalance ?? a.openingBalance ?? 0;
        valB = b.currentBalance ?? b.openingBalance ?? 0;
      } else if (sortField === 'address') {
        valA = a.address1 || a.address || '';
        valB = b.address1 || b.address || '';
      } else if (sortField === 'mobile') {
        valA = a.mobileNumber || a.phone || '';
        valB = b.mobileNumber || b.phone || '';
      } else if (sortField === 'gst') {
        valA = a.gstNo || a.gstin || '';
        valB = b.gstNo || b.gstin || '';
      } else if (sortField === 'discount') {
        valA = a.discountPercentage || 0;
        valB = b.discountPercentage || 0;
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
      <div className={`inline-flex items-center gap-1 ${className.includes('text-right') ? 'justify-end w-full' : ''}`}>
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

  const handleToggleCustomerStatus = async (c: any) => {
    const newStatus = c.isActive === false ? true : false;
    try {
      await api.put(`/api/v1/parties/${c.id}`, { isActive: newStatus });
      fetchCustomers();
    } catch (err: any) {
      alert(err.message || 'Failed to update customer status');
    }
  };

  return (
    <AppShell currentMenu="customers">
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              <span>Customer Master (Retailer Directory)</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Retailer directory profiles: retailer code, mobile, location, GPS, GSTIN, PAN, and Drug License
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

            {hasPermission('customers', 'create') && (
              <button
                onClick={handleOpenAdd}
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition transform active:scale-95"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                <span>Add Customer / Retailer</span>
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
              placeholder="Search by retailer code, customer name, mobile, GSTIN, PAN, town..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-xl text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
            <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200">
              Total Retailers: {filtered.length}
            </span>
          </div>
        </div>

        {/* Retailers Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[1100px]">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-3 text-center w-12">#</th>
                  {renderSortHeader('Retailer Code', 'retailerCode', 'w-28 font-mono')}
                  {renderSortHeader('Retailer Name', 'retailerName', 'min-w-[200px]')}
                  {renderSortHeader('Location / Area', 'tinLocationName', 'w-32')}
                  {renderSortHeader('Address', 'address', 'min-w-[180px]')}
                  {renderSortHeader('Mobile / Contact', 'mobile', 'w-28')}
                  {renderSortHeader('GST No (GSTIN)', 'gst', 'w-36')}
                  {renderSortHeader('PAN No', 'panNo', 'w-28')}
                  {renderSortHeader('Drug License (DL)', 'dlNumber', 'w-32')}
                  {renderSortHeader('Disc %', 'discount', 'text-right w-20 text-blue-600 dark:text-blue-400')}
                  {renderSortHeader('Balance (₹)', 'balancePaise', 'text-right w-28')}
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
                    <td colSpan={14} className="py-12 text-center text-slate-400 font-semibold">
                      Loading customer directory...
                    </td>
                  </tr>
                ) : sortedCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="py-12 text-center text-slate-400 space-y-2">
                      <Users className="w-8 h-8 mx-auto text-slate-300" />
                      <p className="font-semibold text-slate-600">No retailers found</p>
                      <p className="text-xs">Add a customer or import via CSV template.</p>
                    </td>
                  </tr>
                ) : (
                  sortedCustomers.map((c, idx) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 text-center font-mono text-slate-400 text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-700 dark:text-blue-400 text-[11px]">
                        {c.retailerCode || '-'}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                        {c.retailerName || c.name}
                        {c.email && (
                          <span className="block text-[10px] text-slate-400 font-normal">
                            {c.email}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        {c.tinLocationName || '-'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 truncate max-w-[200px]" title={c.address1 || c.address}>
                        {c.address1 || c.address || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">
                        {c.mobileNumber || c.phone || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                        {c.gstNo || c.gstin ? (
                          <span className="font-bold">{c.gstNo || c.gstin}</span>
                        ) : (
                          <span className="text-slate-400 italic">Unregistered</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {c.panNo || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                        {c.dlNumber ? (
                          <div>
                            <span className="font-semibold">{c.dlNumber}</span>
                            {c.dlExpiryDate && (
                              <span className="block text-[9px] text-slate-400">Exp: {c.dlExpiryDate}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                        {c.discountPercentage ? `${c.discountPercentage}%` : '0%'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        ₹ {formatPaise(c.currentBalance ?? c.openingBalance ?? 0)}
                      </td>
                      {user?.role === 'super_admin' && (
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200">
                            {c.distributorName || 'Distributor'}
                          </span>
                        </td>
                      )}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleToggleActive(c)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition ${
                            c.isActive !== false
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {c.isActive !== false ? 'Active' : 'Disabled'}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="p-1 text-slate-500 hover:text-blue-600 rounded transition inline-flex items-center"
                          title="Edit Customer Details"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {user?.role === 'super_admin' && (
                          <button
                            onClick={() => handleDeleteCustomer(c)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition inline-flex items-center"
                            title="Delete customer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add / Edit Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  {editingCustomerId ? 'Edit Retailer Profile' : 'Add New Retailer / Customer (Distribution Format)'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-6 space-y-4 text-xs">
              {user?.role === 'super_admin' && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Target Distributor Firm *
                  </label>
                  <select
                    value={targetBusinessId}
                    onChange={(e) => {
                      const bId = e.target.value;
                      setTargetBusinessId(bId);
                      const bObj = distributors.find((d: any) => d.id === bId);
                      if (bObj) setDistributorName(bObj.name);
                    }}
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

              {/* Section 1: Codes & Name */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                <h4 className="font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider">
                  1. Retailer Identification & Codes
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold mb-1 text-slate-600">Distributor Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Gold Father"
                      value={distributorName}
                      onChange={(e) => setDistributorName(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl font-medium bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-slate-600">
                      Retailer Code <span className="text-[10px] text-blue-600 font-normal">(Auto-Serial, Editable)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. RET0001"
                      value={retailerCode}
                      onChange={(e) => setRetailerCode(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl font-mono bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 outline-none font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-slate-600">Retailer Name / Firm *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Padi Grocery Store"
                      value={retailerName}
                      onChange={(e) => setRetailerName(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none font-semibold focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Contact, Location & Coordinates */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                <h4 className="font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider">
                  2. Contact Details & Geographical Location
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold mb-1 text-slate-600">Mobile Number</label>
                    <input
                      type="tel"
                      placeholder="e.g. 9847012345"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-slate-600">Email Address</label>
                    <input
                      type="email"
                      placeholder="e.g. store@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-slate-600">Town / Area (tin_location_name)</label>
                    <input
                      type="text"
                      placeholder="e.g. Kayamkulam Town"
                      value={tinLocationName}
                      onChange={(e) => setTinLocationName(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-600">Street Address (address_1)</label>
                  <input
                    type="text"
                    placeholder="e.g. Main Road, Near Private Bus Stand"
                    value={address1}
                    onChange={(e) => setAddress1(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1 text-slate-600">GPS Latitude</label>
                    <input
                      type="text"
                      placeholder="e.g. 9.1726"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-slate-600">GPS Longitude</label>
                    <input
                      type="text"
                      placeholder="e.g. 76.5013"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none text-[11px]"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Statutory & Licensing */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                <h4 className="font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider">
                  3. Statutory Tax & Licensing Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1 text-slate-600">GSTIN / GST No</label>
                    <input
                      type="text"
                      maxLength={15}
                      placeholder="e.g. 32AAPCA1234M1Z5"
                      value={gstNo}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setGstNo(val);
                        if (val.length >= 12 && !panNo) {
                          setPanNo(val.substring(2, 12));
                        }
                      }}
                      className="w-full px-3 py-2 border rounded-xl font-mono uppercase bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-slate-600">PAN No</label>
                    <input
                      type="text"
                      maxLength={10}
                      placeholder="e.g. AAPCA1234M"
                      value={panNo}
                      onChange={(e) => setPanNo(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 border rounded-xl font-mono uppercase bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1 text-slate-600">Drug License (DL Number)</label>
                    <input
                      type="text"
                      placeholder="e.g. KL-ALP-2024-99"
                      value={dlNumber}
                      onChange={(e) => setDlNumber(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-slate-600">DL Expiry Date</label>
                    <input
                      type="date"
                      value={dlExpiryDate}
                      onChange={(e) => setDlExpiryDate(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Discount & Financials */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block font-semibold mb-1 text-slate-600">Default Discount %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="0"
                    value={discountPercentage}
                    onChange={(e) => setDiscountPercentage(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none font-bold text-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-600">Credit Period (Days)</label>
                  <input
                    type="number"
                    value={creditDays}
                    onChange={(e) => setCreditDays(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-600">Opening Balance (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none font-bold"
                  />
                </div>
              </div>

              {/* Action Buttons */}
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
                  {editingCustomerId ? 'Update Retailer' : 'Save Retailer Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
