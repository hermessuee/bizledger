'use client';

import React, { useState } from 'react';
import { ChequeItem, formatPaise } from '@bizledger/shared';
import { api } from '@/lib/api';
import { AlertCircle, Clock, CheckCircle2, X, ChevronRight, BellRing } from 'lucide-react';

interface ChequeAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: {
    overdue: ChequeItem[];
    dueToday: ChequeItem[];
    upcoming: ChequeItem[];
    totalCount: number;
  };
  onRefresh: () => void;
}

export function ChequeAlertsModal({ isOpen, onClose, alerts, onRefresh }: ChequeAlertsModalProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  if (!isOpen || alerts.totalCount === 0) return null;

  const handleStatusChange = async (chequeId: string, status: string) => {
    try {
      setLoadingId(chequeId);
      await api.post(`/api/v1/cheques/${chequeId}/status`, { status });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    } finally {
      setLoadingId(null);
    }
  };

  const handleSnooze = async (chequeId: string, days: number) => {
    try {
      setLoadingId(chequeId);
      await api.post(`/api/v1/cheques/${chequeId}/snooze`, { days });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to snooze alert');
    } finally {
      setLoadingId(null);
    }
  };

  const calculateDaysDiff = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  };

  const renderChequeRow = (
    cheque: ChequeItem,
    type: 'overdue' | 'today' | 'upcoming'
  ) => {
    const daysDiff = calculateDaysDiff(cheque.chequeDate);
    const isOverdue = daysDiff < 0;
    const isDueToday = daysDiff === 0;

    const badgeColors = {
      overdue: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300',
      today: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
      upcoming: 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300',
    };

    return (
      <tr key={cheque.id} className="border-b border-gray-100 dark:border-gray-800 text-sm hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
        <td className="py-3 px-3">
          <span
            className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${
              cheque.direction === 'received'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                : 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
            }`}
          >
            {cheque.direction === 'received' ? 'Receive' : 'Pay'}
          </span>
        </td>
        <td className="py-3 px-3 font-medium text-gray-900 dark:text-gray-100">
          {cheque.partyName || 'Party'}
        </td>
        <td className="py-3 px-3 font-mono text-xs text-gray-600 dark:text-gray-400">
          #{cheque.chequeNo}
        </td>
        <td className="py-3 px-3 text-xs text-gray-600 dark:text-gray-400">
          {cheque.bankName || '-'}
        </td>
        <td className="py-3 px-3 text-right font-semibold text-gray-900 dark:text-gray-100">
          ₹ {formatPaise(cheque.amount)}
        </td>
        <td className="py-3 px-3 text-center">
          <span className={`inline-block px-2 py-0.5 text-xs font-medium border rounded-full ${badgeColors[type]}`}>
            {isOverdue
              ? `${Math.abs(daysDiff)}d overdue`
              : isDueToday
              ? 'Today'
              : `In ${daysDiff}d`}
          </span>
        </td>
        <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
          {cheque.direction === 'received' ? (
            <button
              onClick={() => handleStatusChange(cheque.id, 'cleared')}
              disabled={loadingId === cheque.id}
              className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded transition"
            >
              Mark Cleared
            </button>
          ) : (
            <button
              onClick={() => handleStatusChange(cheque.id, 'cleared')}
              disabled={loadingId === cheque.id}
              className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded transition"
            >
              Mark Presented
            </button>
          )}

          <button
            onClick={() => handleSnooze(cheque.id, 1)}
            disabled={loadingId === cheque.id}
            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded transition"
          >
            Snooze 1d
          </button>
          <button
            onClick={() => handleSnooze(cheque.id, 3)}
            disabled={loadingId === cheque.id}
            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded transition"
          >
            Snooze 3d
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-amber-50/60 dark:bg-amber-950/20">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 rounded-lg">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Cheque Due Alerts ({alerts.totalCount})
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Action required on post-dated and maturing cheques
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Overdue Section */}
          {alerts.overdue.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
                <h3 className="font-semibold text-red-700 dark:text-red-400 text-sm">
                  Overdue Cheques ({alerts.overdue.length})
                </h3>
              </div>
              <div className="border border-red-200 dark:border-red-900/50 rounded-lg overflow-x-auto bg-red-50/20 dark:bg-red-950/10">
                <table className="w-full text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-red-50/50 dark:bg-red-950/30 border-b border-red-100 dark:border-red-900/30">
                    <tr>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Party</th>
                      <th className="py-2.5 px-3">Cheque #</th>
                      <th className="py-2.5 px-3">Bank</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3 text-center">Due State</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>{alerts.overdue.map((chq) => renderChequeRow(chq, 'overdue'))}</tbody>
                </table>
              </div>
            </div>
          )}

          {/* Due Today Section */}
          {alerts.dueToday.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <h3 className="font-semibold text-amber-700 dark:text-amber-400 text-sm">
                  Due Today ({alerts.dueToday.length})
                </h3>
              </div>
              <div className="border border-amber-200 dark:border-amber-900/50 rounded-lg overflow-x-auto bg-amber-50/20 dark:bg-amber-950/10">
                <table className="w-full text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-amber-50/50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900/30">
                    <tr>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Party</th>
                      <th className="py-2.5 px-3">Cheque #</th>
                      <th className="py-2.5 px-3">Bank</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3 text-center">Due State</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>{alerts.dueToday.map((chq) => renderChequeRow(chq, 'today'))}</tbody>
                </table>
              </div>
            </div>
          )}

          {/* Upcoming Section */}
          {alerts.upcoming.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span>
                <h3 className="font-semibold text-yellow-700 dark:text-yellow-400 text-sm">
                  Upcoming Due in 7 Days ({alerts.upcoming.length})
                </h3>
              </div>
              <div className="border border-yellow-200 dark:border-yellow-900/50 rounded-lg overflow-x-auto bg-yellow-50/20 dark:bg-yellow-950/10">
                <table className="w-full text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-yellow-50/50 dark:bg-yellow-950/30 border-b border-yellow-100 dark:border-yellow-900/30">
                    <tr>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Party</th>
                      <th className="py-2.5 px-3">Cheque #</th>
                      <th className="py-2.5 px-3">Bank</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3 text-center">Due State</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>{alerts.upcoming.map((chq) => renderChequeRow(chq, 'upcoming'))}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
          <span className="text-xs text-gray-500">
            Automated alerts check active post-dated cheques every 5 minutes
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm font-medium rounded-lg transition"
          >
            Dismiss for Today
          </button>
        </div>
      </div>
    </div>
  );
}
