'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatPaise, isValidGSTIN } from '@bizledger/shared';
import { Plus, Users, Search, X, Phone, Mail, MapPin, Trash2, Edit3, Download, ShieldCheck } from 'lucide-react';

export default function CustomersPage() {
  const { user, hasPermission } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]);
  const [targetBusinessId, setTargetBusinessId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);

  // Form Fields matching screenshot:
  // distributor_code, retailer_code, retailer_name, address_1, mobile_number, email, latitude, longitude, gst_no, tin_location_name, pan_no, dl_number, dl_expiry_date
  const [distributorCode, setDistributorCode] = useState('');
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
    setDistributorCode('');
    setRetailerCode('');
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
    setCreditDays('30');
    setOpeningBalance('0');
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: any) => {
    setEditingCustomerId(c.id);
    setDistributorCode(c.distributorCode || '');
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
        distributor_code: distributorCode.trim() || null,
        retailer_code: retailerCode.trim() || null,
        retailer_name: retailerName.trim(),
        name: retailerName.trim(),
        address_1: address1.trim() || null,
        address: address1.trim() || null,
        mobile_number: mobileNumber.trim() || null,
        phone: mobileNumber.trim() || null,
        email: email.trim() || null,
        latitude: latitude.trim() || null,
        longitude: longitude.trim() || null,
        gst_no: cleanGst,
        gstin: cleanGst,
        tin_location_name: tinLocationName.trim() || null,
        pan_no: cleanPan,
        dl_number: dlNumber.trim() || null,
        dl_expiry_date: dlExpiryDate.trim() || null,
        creditDays: parseInt(creditDays, 10) || 0,
        openingBalance: balancePaise,
        isActive: true,
      };

      if (editingCustomerId) {
        await api.put(`/api/v1/parties/${editingCustomerId}`, payload);
      } else {
        await api.post('/api/v1/parties', payload);
      }

      setIsModalOpen(false);
      resetForm();
      fetchCustomers();
    } catch (err: any) {
      alert(err.message || 'Failed to save customer');
    }
  };

  const handleToggleCustomerStatus = async (c: any) => {
    const newStatus = c.isActive === false ? true : false;
    try {
      await api.put(`/api/v1/parties/${c.id}`, { isActive: newStatus });
      fetchCustomers();
    } catch (err: any) {
      alert(err.message || 'Failed to update customer status');
    }
  };

  const handleDeleteCustomer = async (c: any) => {
    if (!confirm(`Are you sure you want to delete ${c.name}? This will remove it from all distributor records.`)) return;
    try {
      await api.delete(`/api/v1/parties/${c.id}`);
      fetchCustomers();
    } catch (err: any) {
      alert(err.message || 'Failed to delete customer');
    }
  };

  // Download Sample CSV Template matching screenshot exact columns
  const handleDownloadSampleCsv = () => {
    const headers = [
      'distributor_code',
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
    const sampleRows = [
      ['DIST01', 'RET101', 'Padi Grocery Store', 'Kayamkulam Junction', '9847123456', 'padi@gmail.com', '9.1726', '76.5013', '32AAPCA1234M1Z5', 'Kayamkulam South', 'AAPCA1234M', 'KL-ALP-2024-99', '2028-12-31'],
      ['DIST01', 'RET102', 'Aazhimala Supermarket', 'Beach Road, Vizhinjam', '9447654321', 'aazhimala@yahoo.com', '8.3683', '76.9936', '32AAXCA9876K1Z2', 'Vizhinjam West', 'AAXCA9876K', 'KL-TVM-2023-88', '2029-06-30'],
      ['DIST01', 'RET103', 'Bristol 5287 Enterprises', 'Town Hall Road', '9895112233', 'bristol5287@gmail.com', '9.5916', '76.5222', '', 'Kottayam Central', 'ABCPD9900L', '', ''],
    ];

    const csvContent = '\uFEFF' + [headers.join(','), ...sampleRows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bizledger_customers_retailers_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filtered = customers.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const nameMatch = (c.name || c.retailerName || '').toLowerCase().includes(q);
    const codeMatch = (c.retailerCode || '').toLowerCase().includes(q);
    const gstMatch = (c.gstin || c.gstNo || '').toLowerCase().includes(q);
    const phoneMatch = (c.phone || c.mobileNumber || '').includes(q);
    const panMatch = (c.panNo || '').toLowerCase().includes(q);
    const locMatch = (c.tinLocationName || c.address || '').toLowerCase().includes(q);
    return nameMatch || codeMatch || gstMatch || phoneMatch || panMatch || locMatch;
  });

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
              FMCG/IvyDMS Retailer profiles: retailer code, mobile, location, GPS, GSTIN, PAN, and Drug License
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
                  <th className="py-3 px-3 w-28">Retailer Code</th>
                  <th className="py-3 px-4 min-w-[200px]">Retailer Name</th>
                  <th className="py-3 px-3 w-32">Location / Area</th>
                  <th className="py-3 px-4 min-w-[180px]">Address</th>
                  <th className="py-3 px-3 w-28">Mobile / Contact</th>
                  <th className="py-3 px-3 w-36">GST No (GSTIN)</th>
                  <th className="py-3 px-3 w-28">PAN No</th>
                  <th className="py-3 px-3 w-32">Drug License (DL)</th>
                  <th className="py-3 px-3 text-right w-28">Balance (₹)</th>
                  {user?.role === 'super_admin' && (
                    <th className="py-3 px-3 text-indigo-600 dark:text-indigo-400">Distributor</th>
                  )}
                  <th className="py-3 px-3 text-center w-20">Status</th>
                  <th className="py-3 px-3 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-slate-400 font-semibold">
                      Loading customer directory...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-slate-400 space-y-2">
                      <Users className="w-8 h-8 mx-auto text-slate-300" />
                      <p className="font-semibold text-slate-600">No retailers found</p>
                      <p className="text-xs">Add a customer or import via CSV template.</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((c, idx) => (
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
                      <td className="py-2.5 px-3 font-mono text-[10px] text-slate-600 dark:text-slate-400">
                        {c.dlNumber ? (
                          <span>
                            {c.dlNumber}
                            {c.dlExpiryDate && <span className="block text-slate-400">Exp: {c.dlExpiryDate}</span>}
                          </span>
                        ) : (
                          '-'
                        )}
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
                        {c.isActive !== false ? (
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
                          onClick={() => handleOpenEdit(c)}
                          className="p-1 text-slate-500 hover:text-blue-600 rounded transition inline-flex items-center"
                          title="Edit Customer Details"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleCustomerStatus(c)}
                          className="px-1.5 py-0.5 text-[10px] font-bold rounded border transition text-slate-600 hover:bg-slate-100"
                          title="Toggle Active/Disable"
                        >
                          {c.isActive === false ? 'Enable' : 'Disable'}
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
                  {editingCustomerId ? 'Edit Retailer Profile' : 'Add New Retailer / Customer (IvyDMS Format)'}
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

              {/* Section 1: Codes & Name */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                <h4 className="font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider">
                  1. Retailer Identification & Codes
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold mb-1 text-slate-600">Distributor Code</label>
                    <input
                      type="text"
                      placeholder="e.g. DIST01"
                      value={distributorCode}
                      onChange={(e) => setDistributorCode(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-slate-600">Retailer Code</label>
                    <input
                      type="text"
                      placeholder="e.g. RET101"
                      value={retailerCode}
                      onChange={(e) => setRetailerCode(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none font-bold"
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

              {/* Section 4: Credit & Financials */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
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
