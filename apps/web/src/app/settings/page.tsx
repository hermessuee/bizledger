'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Settings, Save, BellRing, Building, Shield } from 'lucide-react';

export default function SettingsPage() {
  const { business, hasPermission } = useAuth();
  const [name, setName] = useState('');
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');
  const [alertDaysBefore, setAlertDaysBefore] = useState('7, 3, 1, 0');
  const [invoicePrefix, setInvoicePrefix] = useState('INV');
  const [bankName, setBankName] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [branch, setBranch] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get('/api/v1/settings').then((res) => {
      const b = res.business;
      if (b) {
        setName(b.name || '');
        setGstin(b.gstin || '');
        setAddress(b.address || '');
        if (b.settings?.alertDaysBefore) {
          setAlertDaysBefore(b.settings.alertDaysBefore.join(', '));
        }
        if (b.settings?.invoicePrefix) {
          setInvoicePrefix(b.settings.invoicePrefix);
        }
        if (b.settings?.bankDetails) {
          setBankName(b.settings.bankDetails.bankName || '');
          setAccountNo(b.settings.bankDetails.accountNo || '');
          setIfsc(b.settings.bankDetails.ifsc || '');
          setBranch(b.settings.bankDetails.branch || '');
        }
      }
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const daysArr = alertDaysBefore
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));

      await api.put('/api/v1/settings', {
        name,
        gstin,
        address,
        settings: {
          alertDaysBefore: daysArr,
          invoicePrefix,
          bankDetails: {
            bankName,
            accountNo,
            ifsc,
            branch,
          },
        },
      });
      setMessage('Company settings updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell currentMenu="settings">
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Company & System Settings
          </h1>
          <p className="text-xs text-slate-500">
            Configure business identity, GST credentials, cheque alert thresholds, and bank details
          </p>
        </div>

        {message && (
          <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg font-medium">
            {message}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6 text-xs">
          {/* Business Info */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b pb-2 flex items-center space-x-2">
              <Building className="w-4 h-4 text-blue-600" />
              <span>Business Profile</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-1">Company / Legal Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">GSTIN (15 Digits)</label>
                <input
                  type="text"
                  maxLength={15}
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border rounded-lg font-mono outline-none uppercase"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1">Registered Address</label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg outline-none"
              />
            </div>
          </div>

          {/* Cheque Alert Configuration (Key Requirement) */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b pb-2 flex items-center space-x-2">
              <BellRing className="w-4 h-4 text-amber-600" />
              <span>Cheque & PDC Alert Thresholds</span>
            </h3>

            <div>
              <label className="block font-semibold mb-1">
                Alert Days Before Due Date (Comma separated)
              </label>
              <input
                type="text"
                value={alertDaysBefore}
                onChange={(e) => setAlertDaysBefore(e.target.value)}
                placeholder="7, 3, 1, 0"
                className="w-full px-3 py-2 border rounded-lg outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Pop-up modals and daily email digest will alert for cheques maturing within these intervals.
              </p>
            </div>
          </div>

          {/* Bank Details for Invoices */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b pb-2">
              Bank Details (Printed on Tax Invoices for Client Payments)
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-1">Bank Name</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Account Number</label>
                <input
                  type="text"
                  placeholder="e.g. 50200012345678"
                  value={accountNo}
                  onChange={(e) => setAccountNo(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg outline-none font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-1">IFSC Code</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC0000123"
                  value={ifsc}
                  onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border rounded-lg outline-none font-mono uppercase"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Branch</label>
                <input
                  type="text"
                  placeholder="e.g. Andheri East, Mumbai"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg outline-none"
                />
              </div>
            </div>
          </div>

          {hasPermission('settings', 'edit') && (
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow transition disabled:opacity-60"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          )}
        </form>
      </div>
    </AppShell>
  );
}
