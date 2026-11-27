'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Business, MenuKey, MENU_LABELS, MENU_KEYS, INDIAN_STATES } from '@bizledger/shared';
import {
  ShieldAlert,
  Building2,
  Users,
  Settings2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sliders,
  Search,
  Check,
  X,
  FileSpreadsheet,
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Plus,
  Receipt,
  FileText,
  FileCheck,
  CreditCard,
  CheckSquare,
  BookOpen,
  Edit3,
  Trash2,
  RefreshCw,
  ExternalLink,
  Layers,
  Filter,
  Key,
  Copy,
  ShieldCheck,
  KeyRound,
  RotateCcw,
} from 'lucide-react';

interface FirmUser {
  id: string;
  businessId: string;
  name: string;
  email: string;
  username: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

interface DistributorWithStats extends Business {
  stats: {
    users: number;
    customers: number;
    vendors: number;
    invoices: number;
    cheques: number;
  };
}

interface MasterTransaction {
  id: string;
  businessId: string;
  businessName: string;
  type: 'sales_invoice' | 'purchase_bill' | 'receipt' | 'payment' | 'cheque' | 'journal' | string;
  refNo: string;
  date: string;
  partyId?: string | null;
  partyName: string;
  amount: number;
  status: string;
  narration: string;
  createdBy?: string;
  raw?: any;
}

export default function SuperAdminPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const { user, login, loading: authLoading, switchBusiness } = useAuth();
  const router = useRouter();

  // Active top-level tab: 'distributors' | 'transactions'
  const [activeTab, setActiveTab] = useState<'distributors' | 'transactions'>('distributors');

  // Distributors State
  const [businesses, setBusinesses] = useState<DistributorWithStats[]>([]);
  const [availableMenus, setAvailableMenus] = useState<MenuKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Admin inline login state if unauthenticated
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminLoggingIn, setAdminLoggingIn] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);

  // Selected business for Module Management Modal
  const [selectedBusiness, setSelectedBusiness] = useState<DistributorWithStats | null>(null);
  const [activeMenus, setActiveMenus] = useState<MenuKey[]>([]);
  const [savingModules, setSavingModules] = useState(false);

  // Registration Modal State
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [regBusinessName, setRegBusinessName] = useState('');
  const [regGstin, setRegGstin] = useState('');
  const [regStateCode, setRegStateCode] = useState('32');
  const [regAddress, setRegAddress] = useState('');
  const [regOwnerName, setRegOwnerName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // Master Transactions State
  const [transactions, setTransactions] = useState<MasterTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txFilterBusiness, setTxFilterBusiness] = useState<string>('all');
  const [txFilterType, setTxFilterType] = useState<string>('all');
  const [txSearch, setTxSearch] = useState<string>('');

  // Transaction View Modal
  const [viewTx, setViewTx] = useState<MasterTransaction | null>(null);

  // Transaction Edit Modal
  const [editTx, setEditTx] = useState<MasterTransaction | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editDate, setEditDate] = useState<string>('');
  const [editPartyName, setEditPartyName] = useState<string>('');
  const [editStatus, setEditStatus] = useState<string>('');
  const [editNarration, setEditNarration] = useState<string>('');
  const [editRefNo, setEditRefNo] = useState<string>('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Transaction Delete Modal
  const [deleteTx, setDeleteTx] = useState<MasterTransaction | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Create Transaction Modal
  const [createTxOpen, setCreateTxOpen] = useState(false);
  const [newTxBusinessId, setNewTxBusinessId] = useState('');
  const [newTxType, setNewTxType] = useState<'sales_invoice' | 'purchase_bill' | 'receipt' | 'payment' | 'cheque' | 'journal'>('sales_invoice');
  const [newTxRefNo, setNewTxRefNo] = useState('');
  const [newTxDate, setNewTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTxPartyName, setNewTxPartyName] = useState('');
  const [newTxAmount, setNewTxAmount] = useState<string>('');
  const [newTxStatus, setNewTxStatus] = useState('unpaid');
  const [newTxNarration, setNewTxNarration] = useState('');
  const [createTxSubmitting, setCreateTxSubmitting] = useState(false);
  const [createTxError, setCreateTxError] = useState<string | null>(null);

  // 1. Edit Firm State
  const [editingFirm, setEditingFirm] = useState<DistributorWithStats | null>(null);
  const [editFirmName, setEditFirmName] = useState('');
  const [editFirmGstin, setEditFirmGstin] = useState('');
  const [editFirmStateCode, setEditFirmStateCode] = useState('32');
  const [editFirmAddress, setEditFirmAddress] = useState('');
  const [editFirmStatus, setEditFirmStatus] = useState<'active' | 'suspended' | 'trial'>('active');
  const [editFirmSubmitting, setEditFirmSubmitting] = useState(false);

  // 2. Delete Firm State
  const [deletingFirm, setDeletingFirm] = useState<DistributorWithStats | null>(null);
  const [deleteFirmSubmitting, setDeleteFirmSubmitting] = useState(false);

  // 3. Firm Users Governance State
  const [usersModalFirm, setUsersModalFirm] = useState<DistributorWithStats | null>(null);
  const [firmUsers, setFirmUsers] = useState<FirmUser[]>([]);
  const [firmUsersLoading, setFirmUsersLoading] = useState(false);
  const [firmUserSearch, setFirmUserSearch] = useState('');

  // Add User to Firm
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('staff');
  const [addUserSubmitting, setAddUserSubmitting] = useState(false);
  const [addUserError, setAddUserError] = useState<string | null>(null);

  // Edit User in Firm
  const [editingFirmUser, setEditingFirmUser] = useState<FirmUser | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserUsername, setEditUserUsername] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserRole, setEditUserRole] = useState('staff');
  const [editUserIsActive, setEditUserIsActive] = useState(true);
  const [editUserSubmitting, setEditUserSubmitting] = useState(false);
  const [editUserError, setEditUserError] = useState<string | null>(null);

  // Reset User Password
  const [resetPwUser, setResetPwUser] = useState<FirmUser | null>(null);
  const [resetPwValue, setResetPwValue] = useState('');
  const [resetPwSubmitting, setResetPwSubmitting] = useState(false);
  const [resetPwCopied, setResetPwCopied] = useState(false);
  const [resetPwSuccess, setResetPwSuccess] = useState<string | null>(null);
  const [resetPwError, setResetPwError] = useState<string | null>(null);

  // Delete User from Firm
  const [deleteUserTarget, setDeleteUserTarget] = useState<FirmUser | null>(null);
  const [deleteUserSubmitting, setDeleteUserSubmitting] = useState(false);
  const [deleteUserError, setDeleteUserError] = useState<string | null>(null);

  const fetchDistributors = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/api/v1/admin/businesses');
      const list = (res.businesses || []).filter(
        (b: any) => b.id !== '00000000-0000-0000-0000-000000000000'
      );
      setBusinesses(list);
      setAvailableMenus(res.availableMenus || []);
      if (!newTxBusinessId && list.length > 0) {
        setNewTxBusinessId(list[0].id);
      }
    } catch (err: any) {
      if (err?.status !== 401 && !err?.message?.includes('Authorization')) {
        setError(err.message || 'Failed to fetch distributors');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      setTxLoading(true);
      setError(null);
      const queryParams = new URLSearchParams();
      if (txFilterBusiness && txFilterBusiness !== 'all') {
        queryParams.set('businessId', txFilterBusiness);
      }
      if (txFilterType && txFilterType !== 'all') {
        queryParams.set('type', txFilterType);
      }
      if (txSearch) {
        queryParams.set('search', txSearch);
      }

      const queryString = queryParams.toString();
      const endpoint = `/api/v1/admin/transactions${queryString ? `?${queryString}` : ''}`;
      const res = await api.get(endpoint);
      setTransactions(res.transactions || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch master transactions');
    } finally {
      setTxLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user && (user.role === 'super_admin' || user.username === 'anoopsue')) {
      fetchDistributors();
      fetchTransactions();
    }
  }, [user, authLoading]);

  // Refetch transactions whenever tab or filter changes
  useEffect(() => {
    if (activeTab === 'transactions' && user && (user.role === 'super_admin' || user.username === 'anoopsue')) {
      fetchTransactions();
    }
  }, [activeTab, txFilterBusiness, txFilterType]);

  const handleGstinChange = (val: string) => {
    const upper = val.toUpperCase().slice(0, 15);
    setRegGstin(upper);
    if (upper.length >= 2 && INDIAN_STATES[upper.slice(0, 2)]) {
      setRegStateCode(upper.slice(0, 2));
    }
  };

  const handleCreateDistributor = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    if (regPassword !== regConfirmPassword) {
      setRegError('Passwords do not match');
      return;
    }
    if (regPassword.length < 8) {
      setRegError('Password must be at least 8 characters long');
      return;
    }

    try {
      setRegSubmitting(true);
      await api.post('/api/v1/admin/businesses', {
        businessName: regBusinessName,
        gstin: regGstin || undefined,
        stateCode: regStateCode,
        address: regAddress || undefined,
        ownerName: regOwnerName,
        email: regEmail,
        username: regUsername,
        password: regPassword,
      });

      setSuccessMessage(`Distributor "${regBusinessName}" registered successfully!`);
      setRegisterModalOpen(false);
      setRegBusinessName('');
      setRegGstin('');
      setRegAddress('');
      setRegOwnerName('');
      setRegEmail('');
      setRegUsername('');
      setRegPassword('');
      setRegConfirmPassword('');
      fetchDistributors();
    } catch (err: any) {
      setRegError(err.message || 'Failed to register distributor');
    } finally {
      setRegSubmitting(false);
    }
  };

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoginError(null);
    setAdminLoggingIn(true);
    try {
      await login(adminUsername, adminPassword);
    } catch (err: any) {
      setAdminLoginError(err.message || 'Invalid administrator credentials');
    } finally {
      setAdminLoggingIn(false);
    }
  };

  const handleOpenModuleModal = (b: DistributorWithStats) => {
    setSelectedBusiness(b);
    setActiveMenus(b.enabledMenus && b.enabledMenus.length > 0 ? b.enabledMenus : [...MENU_KEYS]);
  };

  const handleToggleMenu = (menuKey: MenuKey) => {
    if (activeMenus.includes(menuKey)) {
      setActiveMenus(activeMenus.filter((k) => k !== menuKey));
    } else {
      setActiveMenus([...activeMenus, menuKey]);
    }
  };

  const handleSaveModules = async () => {
    if (!selectedBusiness) return;
    try {
      setSavingModules(true);
      await api.put(`/api/v1/admin/businesses/${selectedBusiness.id}/modules`, {
        enabledMenus: activeMenus,
      });
      setSelectedBusiness(null);
      setSuccessMessage(`Module permissions updated for ${selectedBusiness.name}`);
      fetchDistributors();
    } catch (err: any) {
      setError(err.message || 'Failed to update modules');
    } finally {
      setSavingModules(false);
    }
  };

  const handleStatusChange = async (businessId: string, status: 'active' | 'suspended' | 'trial') => {
    try {
      await api.put(`/api/v1/admin/businesses/${businessId}/status`, { status });
      setSuccessMessage('Distributor business status updated');
      fetchDistributors();
    } catch (err: any) {
      setError(err.message || 'Failed to update distributor status');
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (tx: MasterTransaction) => {
    setEditTx(tx);
    setEditAmount(tx.amount);
    setEditDate(tx.date);
    setEditPartyName(tx.partyName);
    setEditStatus(tx.status);
    setEditNarration(tx.narration || '');
    setEditRefNo(tx.refNo);
  };

  // Submit Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTx) return;
    try {
      setEditSubmitting(true);
      await api.put(`/api/v1/admin/transactions/${editTx.type}/${editTx.id}`, {
        amount: Number(editAmount),
        date: editDate,
        partyName: editPartyName,
        status: editStatus,
        narration: editNarration,
        refNo: editRefNo,
      });
      setSuccessMessage(`Transaction ${editTx.refNo} updated successfully`);
      setEditTx(null);
      fetchTransactions();
      fetchDistributors();
    } catch (err: any) {
      setError(err.message || 'Failed to update transaction');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Submit Delete
  const handleConfirmDelete = async () => {
    if (!deleteTx) return;
    try {
      setDeleteSubmitting(true);
      await api.delete(`/api/v1/admin/transactions/${deleteTx.type}/${deleteTx.id}`);
      setSuccessMessage(`Transaction ${deleteTx.refNo} permanently deleted`);
      setDeleteTx(null);
      fetchTransactions();
      fetchDistributors();
    } catch (err: any) {
      setError(err.message || 'Failed to delete transaction');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Submit Create Transaction
  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateTxError(null);
    if (!newTxBusinessId) {
      setCreateTxError('Please select a distributor firm');
      return;
    }
    const numAmount = parseFloat(newTxAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setCreateTxError('Please enter a valid amount greater than 0');
      return;
    }
    if (!newTxPartyName.trim()) {
      setCreateTxError('Please enter the party name or description');
      return;
    }

    try {
      setCreateTxSubmitting(true);
      await api.post('/api/v1/admin/transactions', {
        businessId: newTxBusinessId,
        type: newTxType,
        refNo: newTxRefNo.trim() || undefined,
        date: newTxDate,
        partyName: newTxPartyName.trim(),
        amount: numAmount,
        status: newTxStatus,
        narration: newTxNarration.trim(),
      });

      setSuccessMessage(`Transaction created successfully for selected firm!`);
      setCreateTxOpen(false);
      setNewTxRefNo('');
      setNewTxPartyName('');
      setNewTxAmount('');
      setNewTxNarration('');
      fetchTransactions();
      fetchDistributors();
    } catch (err: any) {
      setCreateTxError(err.message || 'Failed to create transaction');
    } finally {
      setCreateTxSubmitting(false);
    }
  };

  // Open Edit Firm Modal
  const handleOpenEditFirmModal = (b: DistributorWithStats) => {
    setEditingFirm(b);
    setEditFirmName(b.name);
    setEditFirmGstin(b.gstin || '');
    setEditFirmStateCode(b.stateCode || '32');
    setEditFirmAddress(b.address || '');
    setEditFirmStatus((b.status as any) || 'active');
  };

  // Save Edit Firm
  const handleSaveEditFirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFirm) return;
    try {
      setEditFirmSubmitting(true);
      await api.put(`/api/v1/admin/businesses/${editingFirm.id}`, {
        name: editFirmName.trim(),
        gstin: editFirmGstin.trim(),
        stateCode: editFirmStateCode.trim(),
        address: editFirmAddress.trim(),
        status: editFirmStatus,
      });
      setSuccessMessage(`Distributor firm "${editFirmName}" updated successfully`);
      setEditingFirm(null);
      fetchDistributors();
    } catch (err: any) {
      setError(err.message || 'Failed to update distributor firm');
    } finally {
      setEditFirmSubmitting(false);
    }
  };

  // Open Delete Firm Modal
  const handleOpenDeleteFirmModal = (b: DistributorWithStats) => {
    setDeletingFirm(b);
  };

  // Confirm Delete Firm
  const handleConfirmDeleteFirm = async () => {
    if (!deletingFirm) return;
    try {
      setDeleteFirmSubmitting(true);
      await api.delete(`/api/v1/admin/businesses/${deletingFirm.id}`);
      setSuccessMessage(`Distributor firm "${deletingFirm.name}" and all associated data permanently deleted`);
      setDeletingFirm(null);
      fetchDistributors();
    } catch (err: any) {
      setError(err.message || 'Failed to delete distributor firm');
    } finally {
      setDeleteFirmSubmitting(false);
    }
  };

  // Open Users Modal for Firm
  const fetchFirmUsers = async (businessId: string) => {
    try {
      setFirmUsersLoading(true);
      const res = await api.get(`/api/v1/admin/businesses/${businessId}/users`);
      setFirmUsers(res.users || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users for this firm');
    } finally {
      setFirmUsersLoading(false);
    }
  };

  const handleOpenUsersModal = (b: DistributorWithStats) => {
    setUsersModalFirm(b);
    setFirmUserSearch('');
    fetchFirmUsers(b.id);
  };

  // Create User Under Firm
  const handleCreateFirmUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usersModalFirm) return;
    setAddUserError(null);
    try {
      setAddUserSubmitting(true);
      await api.post(`/api/v1/admin/businesses/${usersModalFirm.id}/users`, {
        name: newUserName.trim(),
        username: newUserUsername.trim(),
        email: newUserEmail.trim(),
        password: newUserPassword,
        role: newUserRole,
      });
      setSuccessMessage(`User "${newUserUsername}" created successfully for ${usersModalFirm.name}`);
      setAddUserOpen(false);
      setNewUserName('');
      setNewUserUsername('');
      setNewUserEmail('');
      setNewUserPassword('');
      fetchFirmUsers(usersModalFirm.id);
      fetchDistributors();
    } catch (err: any) {
      setAddUserError(err.message || 'Failed to create user');
    } finally {
      setAddUserSubmitting(false);
    }
  };

  // Open Edit User
  const handleOpenEditFirmUser = (u: FirmUser) => {
    setEditingFirmUser(u);
    setEditUserName(u.name);
    setEditUserUsername(u.username);
    setEditUserEmail(u.email);
    setEditUserRole(u.role);
    setEditUserIsActive(u.isActive);
    setEditUserError(null);
  };

  // Save Edit User
  const handleSaveEditFirmUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usersModalFirm || !editingFirmUser) return;
    setEditUserError(null);
    try {
      setEditUserSubmitting(true);
      await api.put(`/api/v1/admin/businesses/${usersModalFirm.id}/users/${editingFirmUser.id}`, {
        name: editUserName.trim(),
        username: editUserUsername.trim(),
        email: editUserEmail.trim(),
        role: editUserRole,
        isActive: editUserIsActive,
      });
      setSuccessMessage(`User "${editUserUsername}" updated successfully`);
      setEditingFirmUser(null);
      fetchFirmUsers(usersModalFirm.id);
    } catch (err: any) {
      setEditUserError(err.message || 'Failed to update user');
    } finally {
      setEditUserSubmitting(false);
    }
  };

  // Helper: Generate Secure Password
  const generateStrongPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
    let pw = 'H';
    for (let i = 0; i < 9; i++) {
      pw += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pw;
  };

  // Open Reset Password
  const handleOpenResetPassword = (u: FirmUser) => {
    setResetPwUser(u);
    setResetPwValue(generateStrongPassword());
    setResetPwCopied(false);
    setResetPwSuccess(null);
    setResetPwError(null);
  };

  // Save Reset Password
  const handleSaveResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usersModalFirm || !resetPwUser) return;
    setResetPwError(null);
    try {
      setResetPwSubmitting(true);
      await api.post(`/api/v1/admin/businesses/${usersModalFirm.id}/users/${resetPwUser.id}/password`, {
        newPassword: resetPwValue,
      });
      setResetPwSuccess(`Password for "${resetPwUser.username}" successfully updated to: ${resetPwValue}`);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(resetPwValue);
        setResetPwCopied(true);
      }
    } catch (err: any) {
      setResetPwError(err.message || 'Failed to reset user password');
    } finally {
      setResetPwSubmitting(false);
    }
  };

  // Delete User from Firm
  const handleConfirmDeleteFirmUser = async () => {
    if (!usersModalFirm || !deleteUserTarget) return;
    setDeleteUserError(null);
    try {
      setDeleteUserSubmitting(true);
      await api.delete(`/api/v1/admin/businesses/${usersModalFirm.id}/users/${deleteUserTarget.id}`);
      setSuccessMessage(`User "${deleteUserTarget.username}" permanently deleted`);
      setDeleteUserTarget(null);
      fetchFirmUsers(usersModalFirm.id);
      fetchDistributors();
    } catch (err: any) {
      setDeleteUserError(err.message || 'Failed to delete user');
    } finally {
      setDeleteUserSubmitting(false);
    }
  };

  const filteredBusinesses = businesses.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      (b.gstin && b.gstin.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredTransactions = transactions.filter((tx) => {
    if (txFilterBusiness !== 'all' && tx.businessId !== txFilterBusiness) return false;
    if (txFilterType !== 'all' && tx.type !== txFilterType) return false;
    if (txSearch) {
      const q = txSearch.toLowerCase();
      const match =
        tx.refNo.toLowerCase().includes(q) ||
        tx.partyName.toLowerCase().includes(q) ||
        tx.businessName.toLowerCase().includes(q) ||
        tx.narration.toLowerCase().includes(q) ||
        String(tx.amount).includes(q);
      if (!match) return false;
    }
    return true;
  });

  const totalPlatformVolume = filteredTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

  // Type badge styling helper
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'sales_invoice':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <FileText className="w-3 h-3 mr-1" /> Sales Invoice
          </span>
        );
      case 'purchase_bill':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <FileCheck className="w-3 h-3 mr-1" /> Purchase Bill
          </span>
        );
      case 'receipt':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Receipt className="w-3 h-3 mr-1" /> Receipt
          </span>
        );
      case 'payment':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <CreditCard className="w-3 h-3 mr-1" /> Payment
          </span>
        );
      case 'cheque':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <CheckSquare className="w-3 h-3 mr-1" /> Cheque / PDC
          </span>
        );
      case 'journal':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200">
            <BookOpen className="w-3 h-3 mr-1" /> Journal Entry
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {type}
          </span>
        );
    }
  };

  // Status badge styling helper
  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'paid' || s === 'cleared' || s === 'active') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
          {status}
        </span>
      );
    }
    if (s === 'unpaid' || s === 'pending' || s === 'received' || s === 'issued') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
          {status}
        </span>
      );
    }
    if (s === 'bounced' || s === 'cancelled' || s === 'suspended') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800">
          {status}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
        {status}
      </span>
    );
  };

  // Instant render: only show loading spinner if a token exists and auth is actively resolving
  const token = typeof window !== 'undefined' ? localStorage.getItem('bizledger_access_token') : null;
  const showLoading = authLoading && Boolean(token);

  if (showLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-800">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-600 font-medium">Loading Hermes Admin Portal...</p>
        </div>
      </div>
    );
  }

  // Unauthenticated Admin Login Screen
  if (!user || (user.role !== 'super_admin' && user.username !== 'anoopsue')) {
    return (
      <div className="h-screen max-h-screen w-full flex flex-col justify-between bg-slate-900 text-slate-100 relative overflow-hidden select-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] max-w-full h-[500px] bg-gradient-to-b from-amber-500/10 via-blue-900/15 to-transparent blur-3xl pointer-events-none -z-0" />
        <main className="relative z-10 flex-1 flex flex-col justify-center items-center px-4 py-2 sm:py-3 w-full overflow-hidden">
          <div className="w-full max-w-sm sm:max-w-md mx-auto my-auto">
            <div className="text-center mb-3 sm:mb-4">
              <div className="inline-block p-1.5 sm:p-2 rounded-2xl bg-white shadow-2xl shadow-amber-500/10 border-2 border-amber-500/30 mb-2 hover:scale-105 transition-transform duration-300">
                <img
                  src={`${basePath}/hermes-logo.jpg`}
                  alt="Hermes Logo"
                  className="w-14 h-14 sm:w-16 sm:h-16 object-contain"
                />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Admin <span className="text-amber-400">Portal</span>
              </h1>
              <p className="mt-0.5 text-[11px] sm:text-xs text-slate-400 tracking-wide font-normal px-2">
                Master Platform Multi-Distributor Governance
              </p>
            </div>

            <div className="glass-card py-5 px-5 sm:py-6 sm:px-7 rounded-2xl shadow-2xl animate-glass-in">
              <form className="space-y-3.5" onSubmit={handleAdminSignIn}>
                {adminLoginError && (
                  <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start space-x-2.5 animate-glass-in">
                    <span className="font-medium">{adminLoginError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-amber-300/90 uppercase tracking-wider mb-1">
                    Admin Username
                  </label>
                  <div className="relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <User className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      required
                      autoComplete="off"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      placeholder=""
                      className="block w-full pl-10 pr-3 py-2 glass-input rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-amber-300/90 uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <div className="relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type={showAdminPassword ? 'text' : 'password'}
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="••••••••"
                      className="block w-full pl-10 pr-10 py-2 glass-input rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-amber-300 transition"
                    >
                      {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={adminLoggingIn}
                  className="w-full mt-2 flex justify-center items-center py-2.5 px-4 rounded-lg shadow-lg shadow-amber-500/20 text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:via-yellow-300 hover:to-amber-400 transition-all duration-200 transform active:scale-[0.98] disabled:opacity-60"
                >
                  {adminLoggingIn ? (
                    <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Enter Admin Portal</span>
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-4 pt-3.5 border-t border-slate-800/80 text-xs text-center">
                <Link
                  href="/login"
                  className="text-amber-400 hover:text-amber-300 hover:underline transition"
                >
                  ← Return to Distributor Sign In
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Authenticated Super Admin Portal - Crisp, Clean LIGHT THEME
  return (
    <AppShell currentMenu="admin_portal">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Error and Success Notifications */}
        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between shadow-sm">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-sm">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="font-semibold">{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Top Header & Tab Navigation */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-amber-500/10 text-amber-600 border border-amber-500/30 rounded-2xl shadow-sm">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  Hermes Super-Admin Portal
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-200">
                  Global Power User
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Multi-distributor governance, master ledger explorer, and unrestricted CRUD authority across all firms.
              </p>
            </div>
          </div>

          {/* Tab Selector Buttons */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 self-start md:self-auto">
            <button
              onClick={() => setActiveTab('distributors')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'distributors'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>Distributor Businesses</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700 font-semibold">
                {businesses.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('transactions')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'transactions'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Receipt className="w-4 h-4 text-amber-600" />
              <span>Master Ledger & All Transactions</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-semibold">
                {transactions.length}
              </span>
            </button>
          </div>
        </div>

        {/* =========================================================================
            TAB 1: DISTRIBUTOR BUSINESSES & GOVERNANCE
        ========================================================================= */}
        {activeTab === 'distributors' && (
          <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search distributor name or GSTIN..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400 w-64 sm:w-80 shadow-sm"
                />
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={fetchDistributors}
                  className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm transition"
                  title="Refresh Distributors"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setRegisterModalOpen(true);
                    setRegError(null);
                  }}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-sm shadow-amber-500/20 transition-all duration-200 transform active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Distributor</span>
                </button>
              </div>
            </div>

            {/* Stats Cards - Clean White Light Theme */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Distributors</p>
                  <Building2 className="w-4 h-4 text-slate-400" />
                </div>
                <p className="text-3xl font-extrabold text-slate-900 mt-2">{businesses.length}</p>
                <p className="text-[11px] text-slate-400 mt-1 font-medium">Registered business firms</p>
              </div>

              <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Businesses</p>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <p className="text-3xl font-extrabold text-emerald-600 mt-2">
                  {businesses.filter((b) => b.status === 'active' || !b.status).length}
                </p>
                <p className="text-[11px] text-emerald-700/80 mt-1 font-medium">Operating with active licenses</p>
              </div>

              <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Users</p>
                  <Users className="w-4 h-4 text-blue-500" />
                </div>
                <p className="text-3xl font-extrabold text-blue-600 mt-2">
                  {businesses.reduce((sum, b) => sum + (b.stats?.users || 0), 0)}
                </p>
                <p className="text-[11px] text-blue-700/80 mt-1 font-medium">Distributor staff & accountants</p>
              </div>

              <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Platform Invoices</p>
                  <FileText className="w-4 h-4 text-amber-500" />
                </div>
                <p className="text-3xl font-extrabold text-amber-600 mt-2">
                  {businesses.reduce((sum, b) => sum + (b.stats?.invoices || 0), 0)}
                </p>
                <p className="text-[11px] text-amber-700/80 mt-1 font-medium">Invoices generated across platform</p>
              </div>
            </div>

            {/* Distributor Table - Clean Crisp White Light Theme */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200/80 bg-slate-50/70 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Registered Distributor Businesses</h2>
                  <p className="text-xs text-slate-500">Configure enabled modules, review license status, and switch context.</p>
                </div>
                <span className="text-xs font-bold text-slate-500 bg-slate-200/60 px-2.5 py-1 rounded-full">
                  {filteredBusinesses.length} firm(s)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[1200px]">
                  <thead className="bg-slate-50/90 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="py-3.5 px-5 min-w-[260px] whitespace-nowrap">Distributor / Business Name</th>
                      <th className="py-3.5 px-4 min-w-[160px] whitespace-nowrap">GSTIN & State</th>
                      <th className="py-3.5 px-4 min-w-[120px] text-center whitespace-nowrap">Status</th>
                      <th className="py-3.5 px-4 min-w-[70px] text-center whitespace-nowrap">Users</th>
                      <th className="py-3.5 px-4 min-w-[80px] text-center whitespace-nowrap">Customers</th>
                      <th className="py-3.5 px-4 min-w-[80px] text-center whitespace-nowrap">Invoices</th>
                      <th className="py-3.5 px-4 min-w-[80px] text-center whitespace-nowrap">Cheques</th>
                      <th className="py-3.5 px-4 min-w-[160px] text-center whitespace-nowrap">Modules Enabled</th>
                      <th className="py-3.5 px-5 min-w-[420px] text-right whitespace-nowrap">Actions & Governance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {filteredBusinesses.map((b) => {
                      const enabledCount = b.enabledMenus ? b.enabledMenus.length : availableMenus.length;
                      return (
                        <tr key={b.id} className="hover:bg-slate-50/75 transition">
                          <td className="py-3.5 px-5 font-semibold text-slate-900 min-w-[260px]">
                            <div className="flex items-center space-x-3">
                              <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex-shrink-0">
                                <Building2 className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 hover:text-blue-600 transition whitespace-nowrap">{b.name}</p>
                                <p className="text-[10px] text-slate-400 font-mono">ID: {b.id.slice(0, 18)}...</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap min-w-[160px]">
                            <p className="font-mono font-semibold text-slate-800">{b.gstin || 'Unregistered'}</p>
                            <p className="text-[10px] text-slate-500">State: {b.stateCode || '32'}</p>
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap min-w-[120px]">
                            <select
                              value={b.status || 'active'}
                              onChange={(e) => handleStatusChange(b.id, e.target.value as any)}
                              className={`text-xs font-bold px-2.5 py-1 rounded-full border focus:outline-none cursor-pointer shadow-sm ${
                                b.status === 'suspended'
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : b.status === 'trial'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              <option value="active">Active</option>
                              <option value="trial">Trial</option>
                              <option value="suspended">Suspended</option>
                            </select>
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-slate-700 whitespace-nowrap">{b.stats?.users || 0}</td>
                          <td className="py-3.5 px-4 text-center text-slate-600 whitespace-nowrap">{b.stats?.customers || 0}</td>
                          <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-800 whitespace-nowrap">{b.stats?.invoices || 0}</td>
                          <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-800 whitespace-nowrap">{b.stats?.cheques || 0}</td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap min-w-[160px]">
                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200 text-[11px] whitespace-nowrap shadow-xs">
                              {enabledCount} / {availableMenus.length} Modules
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-right whitespace-nowrap min-w-[420px]">
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                onClick={() => handleOpenUsersModal(b)}
                                className="px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition inline-flex items-center space-x-1"
                                title="Manage distributor users, usernames, and passwords"
                              >
                                <Users className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Users & Logins</span>
                              </button>
                              <button
                                onClick={() => handleOpenEditFirmModal(b)}
                                className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition inline-flex items-center space-x-1"
                                title="Edit distributor firm name, GSTIN, and details"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                                <span>Edit Firm</span>
                              </button>
                              <button
                                onClick={() => handleOpenModuleModal(b)}
                                className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition inline-flex items-center space-x-1"
                                title="Configure module access for this firm"
                              >
                                <Sliders className="w-3.5 h-3.5 text-blue-600" />
                                <span>Modules</span>
                              </button>
                              <button
                                onClick={async () => {
                                  await switchBusiness(b.id);
                                  router.push('/invoices');
                                }}
                                className="px-2.5 py-1.5 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg border border-amber-300 transition inline-flex items-center space-x-1"
                                title="Switch workspace context into this firm"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-amber-700" />
                                <span>Enter</span>
                              </button>
                              <button
                                onClick={() => handleOpenDeleteFirmModal(b)}
                                className="p-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition inline-flex items-center"
                                title="Permanently delete distributor firm and data"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: MASTER LEDGER & ALL TRANSACTIONS (POWER USER)
        ========================================================================= */}
        {activeTab === 'transactions' && (
          <div className="space-y-6">
            {/* Super Admin Power User Banner */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-amber-500/20 text-amber-800 rounded-xl">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-900">
                    Master Transaction Control & Global Governance
                  </p>
                  <p className="text-[11px] text-amber-800">
                    As Super Administrator, you have 100% unrestricted authority to view, create, edit, and delete any transaction across all distributor firms.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2.5">
                <button
                  onClick={fetchTransactions}
                  className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm transition"
                  title="Refresh Transactions"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setCreateTxOpen(true);
                    setCreateTxError(null);
                  }}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-sm shadow-amber-500/20 transition-all duration-200 transform active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Create Entry for Any Firm</span>
                </button>
              </div>
            </div>

            {/* Transaction Filter Controls */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                {/* Firm Filter Dropdown */}
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Firm:</span>
                  <select
                    value={txFilterBusiness}
                    onChange={(e) => setTxFilterBusiness(e.target.value)}
                    className="text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-sm"
                  >
                    <option value="all">🏢 All Distributor Firms ({businesses.length})</option>
                    {businesses.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Type Filter Dropdown */}
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Type:</span>
                  <select
                    value={txFilterType}
                    onChange={(e) => setTxFilterType(e.target.value)}
                    className="text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-sm"
                  >
                    <option value="all">⚡ All Transaction Types</option>
                    <option value="sales_invoice">📄 Sales Invoices</option>
                    <option value="purchase_bill">📋 Purchase Bills</option>
                    <option value="receipt">💵 Customer Receipts</option>
                    <option value="payment">💳 Vendor Payments</option>
                    <option value="cheque">🏦 Cheques & PDCs</option>
                    <option value="journal">📖 Journal Entries</option>
                  </select>
                </div>
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search Ref #, Party, Narration, Amount..."
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  className="pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400 w-full sm:w-72 shadow-sm"
                />
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Filtered Transactions</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">{filteredTransactions.length}</p>
                <p className="text-[11px] text-slate-400">Total {transactions.length} records across system</p>
              </div>

              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Transaction Value</p>
                <p className="text-2xl font-extrabold text-emerald-600 mt-1">
                  ₹{totalPlatformVolume.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-emerald-700/80">Sum of filtered entries</p>
              </div>

              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Operating Context</p>
                <p className="text-lg font-bold text-blue-600 mt-1 truncate">
                  {txFilterBusiness === 'all'
                    ? '🌐 All Platform Firms'
                    : businesses.find((b) => b.id === txFilterBusiness)?.name || 'Selected Firm'}
                </p>
                <p className="text-[11px] text-slate-400">Context applied to table</p>
              </div>
            </div>

            {/* Master Transactions Table - Crisp Light Theme */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200/80 bg-slate-50/70 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Unified Platform Transactions</h2>
                  <p className="text-xs text-slate-500">
                    Live aggregate of all Sales Invoices, Purchase Bills, Receipts, Payments, Cheques, and Journals.
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-600 bg-slate-200/60 px-2.5 py-1 rounded-full">
                  {filteredTransactions.length} transaction(s)
                </span>
              </div>

              {txLoading ? (
                <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center space-y-2">
                  <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs">Fetching transactions across all distributor databases...</p>
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
                  <Receipt className="w-10 h-10 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-700">No transactions match the selected criteria</p>
                  <p className="text-xs text-slate-500">Try changing the firm or transaction type filter above, or create a new entry.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[1100px]">
                    <thead className="bg-slate-50/90 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                      <tr>
                        <th className="py-3.5 px-4 whitespace-nowrap">Date</th>
                        <th className="py-3.5 px-4 whitespace-nowrap min-w-[180px]">Distributor Firm</th>
                        <th className="py-3.5 px-4 whitespace-nowrap">Type</th>
                        <th className="py-3.5 px-4 whitespace-nowrap">Ref / Doc #</th>
                        <th className="py-3.5 px-4 whitespace-nowrap min-w-[160px]">Party Name</th>
                        <th className="py-3.5 px-4 text-right whitespace-nowrap">Amount (₹)</th>
                        <th className="py-3.5 px-4 text-center whitespace-nowrap">Status</th>
                        <th className="py-3.5 px-4 whitespace-nowrap min-w-[160px]">Narration</th>
                        <th className="py-3.5 px-5 text-right whitespace-nowrap">Power Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {filteredTransactions.map((tx) => (
                        <tr key={`${tx.type}-${tx.id}`} className="hover:bg-slate-50/75 transition">
                          <td className="py-3.5 px-4 font-mono font-medium text-slate-600 whitespace-nowrap">
                            {tx.date}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-[180px] truncate" title={tx.businessName}>
                            <span className="font-bold text-slate-800 hover:text-blue-600">{tx.businessName}</span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {getTypeBadge(tx.type)}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                            {tx.refNo}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-800 max-w-[180px] truncate" title={tx.partyName}>
                            {tx.partyName}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            ₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {getStatusBadge(tx.status)}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 max-w-[160px] truncate" title={tx.narration}>
                            {tx.narration || '-'}
                          </td>
                          <td className="py-3.5 px-5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end space-x-1.5">
                              {/* View Details */}
                              <button
                                onClick={() => setViewTx(tx)}
                                className="p-1.5 text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded-lg border border-slate-200 transition"
                                title="View Complete Transaction Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* Super Admin Edit */}
                              <button
                                onClick={() => handleOpenEdit(tx)}
                                className="p-1.5 text-slate-600 hover:text-amber-700 bg-slate-100 hover:bg-amber-50 rounded-lg border border-slate-200 transition"
                                title="Super Admin Edit: Modify this entry"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {/* Super Admin Delete */}
                              <button
                                onClick={() => setDeleteTx(tx)}
                                className="p-1.5 text-slate-600 hover:text-red-700 bg-slate-100 hover:bg-red-50 rounded-lg border border-slate-200 transition"
                                title="Super Admin Delete: Remove this entry permanently"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            MODAL 1: MODULE ACCESS MANAGEMENT (LIGHT THEME)
        ========================================================================= */}
        {selectedBusiness && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Module Access & Permissions: {selectedBusiness.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Enable or disable specific business modules for this distributor firm.
                  </p>
                </div>
                <button
                  onClick={() => setSelectedBusiness(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Available Business Modules</span>
                  <div className="space-x-3">
                    <button
                      onClick={() => setActiveMenus([...MENU_KEYS].filter((k) => k !== 'admin_portal'))}
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      Enable All Modules
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={() => setActiveMenus(['dashboard'])}
                      className="text-xs font-bold text-red-600 hover:underline"
                    >
                      Reset to Dashboard Only
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {Object.entries(MENU_LABELS).map(([key, label]) => {
                    const menuKey = key as MenuKey;
                    if (menuKey === 'admin_portal') return null; // never assign super-admin module to tenant
                    const isEnabled = activeMenus.includes(menuKey);

                    return (
                      <div
                        key={menuKey}
                        onClick={() => handleToggleMenu(menuKey)}
                        className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition select-none ${
                          isEnabled
                            ? 'bg-blue-50/80 border-blue-200 text-slate-900 font-semibold shadow-sm'
                            : 'bg-slate-50/60 border-slate-200 text-slate-400 hover:bg-slate-100'
                        }`}
                      >
                        <span>{label}</span>
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${
                            isEnabled
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isEnabled && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end space-x-3">
                <button
                  onClick={() => setSelectedBusiness(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveModules}
                  disabled={savingModules}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-md shadow-blue-500/20 disabled:opacity-50"
                >
                  {savingModules ? 'Saving Module Settings...' : 'Save Module Permissions'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            MODAL 2: REGISTER NEW DISTRIBUTOR (LIGHT THEME)
        ========================================================================= */}
        {registerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-amber-500/10 text-amber-600 border border-amber-500/30 rounded-xl">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Register New Distributor Business</h3>
                    <p className="text-[11px] text-slate-500">
                      Onboard an isolated distributor tenant with dedicated accounts and credentials.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setRegisterModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateDistributor} className="flex-1 overflow-y-auto p-6 space-y-4">
                {regError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <span>{regError}</span>
                  </div>
                )}

                {/* Section 1: Firm Profile */}
                <div>
                  <h4 className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-2.5">
                    1. Distributor Business Details
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Distributor Firm Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={regBusinessName}
                        onChange={(e) => setRegBusinessName(e.target.value)}
                        placeholder="e.g. Metro Pharma & Healthcare Distributors"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        GSTIN (15 Digits)
                      </label>
                      <input
                        type="text"
                        maxLength={15}
                        value={regGstin}
                        onChange={(e) => handleGstinChange(e.target.value)}
                        placeholder="27ABCDE1234F1Z5"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 uppercase font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        State & Code *
                      </label>
                      <select
                        value={regStateCode}
                        onChange={(e) => setRegStateCode(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      >
                        {Object.entries(INDIAN_STATES).map(([code, name]) => (
                          <option key={code} value={code}>
                            {code} - {name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Registered Address
                      </label>
                      <input
                        type="text"
                        value={regAddress}
                        onChange={(e) => setRegAddress(e.target.value)}
                        placeholder="e.g. Gala 12, APMC Market, Vashi, Navi Mumbai"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Owner / Admin Account */}
                <div className="pt-3 border-t border-slate-200">
                  <h4 className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-2.5">
                    2. Primary Administrator Account
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Proprietor / Owner Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={regOwnerName}
                        onChange={(e) => setRegOwnerName(e.target.value)}
                        placeholder="e.g. Ramesh Shah"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Business Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="accounts@metropharma.in"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Distributor Username *
                      </label>
                      <input
                        type="text"
                        required
                        autoComplete="off"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        placeholder="e.g. metropharma"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Password (Min 8 chars) *
                      </label>
                      <input
                        type="password"
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Confirm Password *
                      </label>
                      <input
                        type="password"
                        required
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setRegisterModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={regSubmitting}
                    className="px-5 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-xl shadow-md shadow-amber-500/20 transition-all duration-200 disabled:opacity-50"
                  >
                    {regSubmitting ? 'Registering Distributor...' : 'Register & Onboard Distributor'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================================
            MODAL 3: VIEW TRANSACTION DETAILS (POWER USER)
        ========================================================================= */}
        {viewTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-200">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Transaction #{viewTx.refNo}
                    </h3>
                    <p className="text-xs text-slate-500">{viewTx.businessName}</p>
                  </div>
                </div>
                <button
                  onClick={() => setViewTx(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Transaction Type</span>
                    <div className="mt-1">{getTypeBadge(viewTx.type)}</div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</span>
                    <div className="mt-1">{getStatusBadge(viewTx.status)}</div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Transaction Date</span>
                    <p className="text-sm font-mono font-bold text-slate-900 mt-1">{viewTx.date}</p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Amount</span>
                    <p className="text-base font-mono font-extrabold text-emerald-600 mt-0.5">
                      ₹{viewTx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Party / Counterparty</span>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">{viewTx.partyName}</p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Narration / Notes</span>
                    <p className="text-xs text-slate-700 mt-0.5">{viewTx.narration || 'No notes provided'}</p>
                  </div>

                  {viewTx.createdBy && (
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Created By User</span>
                      <p className="text-xs font-mono text-slate-700 mt-0.5">{viewTx.createdBy}</p>
                    </div>
                  )}
                </div>

                {/* Raw Record Dump if present */}
                {viewTx.raw?.items && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-2 bg-slate-100 font-bold text-[11px] text-slate-700">
                      Line Items ({viewTx.raw.items.length})
                    </div>
                    <div className="divide-y divide-slate-100 text-xs">
                      {viewTx.raw.items.map((it: any, idx: number) => (
                        <div key={idx} className="p-3 flex justify-between items-center hover:bg-slate-50">
                          <div>
                            <p className="font-semibold text-slate-800">{it.itemName || it.description || `Item #${idx + 1}`}</p>
                            <p className="text-[10px] text-slate-500">Qty: {it.qty} × ₹{it.rate} | GST: {it.gstRate}%</p>
                          </div>
                          <span className="font-mono font-bold text-slate-900">₹{(it.totalAmount || (it.qty * it.rate)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end space-x-2">
                <button
                  onClick={() => {
                    const toEdit = viewTx;
                    setViewTx(null);
                    handleOpenEdit(toEdit);
                  }}
                  className="px-4 py-2 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-xl transition"
                >
                  Edit Entry
                </button>
                <button
                  onClick={() => setViewTx(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded-xl transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            MODAL 4: SUPER ADMIN EDIT TRANSACTION (POWER USER)
        ========================================================================= */}
        {editTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-amber-50">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-amber-500/20 text-amber-800 rounded-xl">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Super-Admin Master Edit
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Modifying {editTx.refNo} ({editTx.businessName})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEditTx(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="p-6 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Reference / Doc #
                    </label>
                    <input
                      type="text"
                      required
                      value={editRefNo}
                      onChange={(e) => setEditRefNo(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Transaction Date
                    </label>
                    <input
                      type="date"
                      required
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Party Name / Account
                  </label>
                  <input
                    type="text"
                    required
                    value={editPartyName}
                    onChange={(e) => setEditPartyName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Amount (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editAmount}
                      onChange={(e) => setEditAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Status
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="paid">paid</option>
                      <option value="unpaid">unpaid</option>
                      <option value="pending">pending</option>
                      <option value="cleared">cleared</option>
                      <option value="bounced">bounced</option>
                      <option value="cancelled">cancelled</option>
                      <option value="draft">draft</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Narration / Audit Notes
                  </label>
                  <textarea
                    rows={3}
                    value={editNarration}
                    onChange={(e) => setEditNarration(e.target.value)}
                    placeholder="Enter reason or narration for edit..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setEditTx(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editSubmitting}
                    className="px-5 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-xl shadow-md shadow-amber-500/20 transition-all duration-200 disabled:opacity-50"
                  >
                    {editSubmitting ? 'Saving...' : 'Apply Super-Admin Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================================
            MODAL 5: DELETE TRANSACTION CONFIRMATION (POWER USER)
        ========================================================================= */}
        {deleteTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-red-50">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-red-100 text-red-600 rounded-xl">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Delete Transaction Permanently
                    </h3>
                    <p className="text-[11px] text-red-700">Super-Admin Ledger Reversal</p>
                  </div>
                </div>
                <button
                  onClick={() => setDeleteTx(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-3">
                <p className="text-xs text-slate-700">
                  Are you sure you want to permanently delete transaction{' '}
                  <strong className="text-slate-900 font-mono font-bold">#{deleteTx.refNo}</strong> (
                  {deleteTx.businessName}) of amount{' '}
                  <strong className="text-emerald-700 font-mono font-bold">
                    ₹{deleteTx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </strong>
                  ?
                </p>
                <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-[11px] text-red-800">
                  ⚠️ This action will remove the entry from the distributor's ledgers, reverse any linked journal entries, and create an audit log entry.
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end space-x-3">
                <button
                  onClick={() => setDeleteTx(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleteSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition shadow-md shadow-red-500/20 disabled:opacity-50"
                >
                  {deleteSubmitting ? 'Deleting...' : 'Confirm & Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            MODAL 6: CREATE TRANSACTION ON BEHALF OF ANY FIRM (POWER USER)
        ========================================================================= */}
        {createTxOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-amber-50">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-amber-500/20 text-amber-800 rounded-xl">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Create Transaction (Super-Admin)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Directly record an entry into any distributor firm's ledger.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setCreateTxOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateTransaction} className="p-6 space-y-4 overflow-y-auto">
                {createTxError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <span>{createTxError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Target Distributor Firm *
                  </label>
                  <select
                    required
                    value={newTxBusinessId}
                    onChange={(e) => setNewTxBusinessId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    {businesses.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.gstin || 'No GSTIN'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Transaction Type *
                    </label>
                    <select
                      value={newTxType}
                      onChange={(e) => setNewTxType(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="sales_invoice">Sales Invoice</option>
                      <option value="purchase_bill">Purchase Bill</option>
                      <option value="receipt">Customer Receipt</option>
                      <option value="payment">Vendor Payment</option>
                      <option value="cheque">Cheque / PDC</option>
                      <option value="journal">Journal Entry</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Reference / Doc # (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Auto-generated if empty"
                      value={newTxRefNo}
                      onChange={(e) => setNewTxRefNo(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Transaction Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={newTxDate}
                      onChange={(e) => setNewTxDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Amount (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={newTxAmount}
                      onChange={(e) => setNewTxAmount(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Party Name / Account / Payee *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apollo Pharmacy, Sun Pharma, HDFC Bank"
                    value={newTxPartyName}
                    onChange={(e) => setNewTxPartyName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={newTxStatus}
                    onChange={(e) => setNewTxStatus(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="unpaid">unpaid</option>
                    <option value="paid">paid</option>
                    <option value="pending">pending</option>
                    <option value="cleared">cleared</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Narration / Notes
                  </label>
                  <textarea
                    rows={2}
                    value={newTxNarration}
                    onChange={(e) => setNewTxNarration(e.target.value)}
                    placeholder="Entry details or notes..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setCreateTxOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createTxSubmitting}
                    className="px-5 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-xl shadow-md shadow-amber-500/20 transition-all duration-200 disabled:opacity-50"
                  >
                    {createTxSubmitting ? 'Creating Entry...' : 'Create Entry'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================================
            MODAL 7: EDIT DISTRIBUTOR FIRM (POWER USER)
        ========================================================================= */}
        {editingFirm && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
            style={{ zIndex: 100 }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col relative"
              style={{ zIndex: 101 }}
            >
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Edit Distributor Business
                    </h3>
                    <p className="text-[11px] text-slate-500">Global Governance Authority</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingFirm(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEditFirm} className="p-6 space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Distributor / Firm Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editFirmName}
                    onChange={(e) => setEditFirmName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      GSTIN
                    </label>
                    <input
                      type="text"
                      maxLength={15}
                      value={editFirmGstin}
                      onChange={(e) => setEditFirmGstin(e.target.value.toUpperCase())}
                      placeholder="e.g. 32AAPCA1234M1Z5"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      State *
                    </label>
                    <select
                      value={editFirmStateCode}
                      onChange={(e) => setEditFirmStateCode(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      {Object.entries(INDIAN_STATES).map(([code, name]) => (
                        <option key={code} value={code}>
                          {code} - {name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Registered Business Address
                  </label>
                  <textarea
                    rows={2}
                    value={editFirmAddress}
                    onChange={(e) => setEditFirmAddress(e.target.value)}
                    placeholder="Enter full office/warehouse address..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Operating License Status *
                  </label>
                  <select
                    value={editFirmStatus}
                    onChange={(e) => setEditFirmStatus(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="active">Active (Fully operational)</option>
                    <option value="trial">Trial (Evaluation period)</option>
                    <option value="suspended">Suspended (Access blocked)</option>
                  </select>
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setEditingFirm(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editFirmSubmitting}
                    className="px-5 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-xl shadow-md shadow-amber-500/20 transition-all duration-200 disabled:opacity-50"
                  >
                    {editFirmSubmitting ? 'Saving...' : 'Save Firm Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================================
            MODAL 8: DELETE DISTRIBUTOR FIRM CONFIRMATION (POWER USER)
        ========================================================================= */}
        {deletingFirm && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
            style={{ zIndex: 100 }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden flex flex-col relative"
              style={{ zIndex: 101 }}
            >
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-red-50">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-red-100 text-red-600 rounded-xl">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Delete Distributor Firm Permanently
                    </h3>
                    <p className="text-[11px] text-red-700">Irreversible Platform Operation</p>
                  </div>
                </div>
                <button
                  onClick={() => setDeletingFirm(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-xs text-slate-700 leading-relaxed">
                  Are you sure you want to permanently delete distributor{' '}
                  <strong className="text-slate-900 font-bold">{deletingFirm.name}</strong>?
                </p>
                <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-[11px] text-red-800 space-y-1">
                  <p className="font-bold flex items-center">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1 text-red-600" />
                    Warning: Total Data Wipe
                  </p>
                  <p>
                    All users, customer records, vendor payables, sales invoices, cheques, and journal entries created under this firm will be permanently wiped.
                  </p>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end space-x-3">
                <button
                  onClick={() => setDeletingFirm(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDeleteFirm}
                  disabled={deleteFirmSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition shadow-md shadow-red-500/20 disabled:opacity-50"
                >
                  {deleteFirmSubmitting ? 'Deleting...' : 'Confirm & Delete Firm'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            MODAL 9: FIRM USERS & CREDENTIALS GOVERNANCE (POWER USER)
        ========================================================================= */}
        {usersModalFirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            style={{
              zIndex: 50,
              pointerEvents: (addUserOpen || editingFirmUser || resetPwUser || deleteUserTarget || editingFirm || deletingFirm) ? 'none' : 'auto',
            }}
          >
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 via-indigo-50/30 to-slate-50">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-bold text-slate-900">
                        {usersModalFirm.name} — Users & Credentials
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                        {firmUsers.length} user(s)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      View, edit usernames, reset passwords, change roles, or remove accounts for this firm
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setAddUserOpen(true);
                      setAddUserError(null);
                    }}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-xs transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add User</span>
                  </button>
                  <button
                    onClick={() => handleOpenEditFirmModal(usersModalFirm)}
                    className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition"
                    title="Edit Distributor Firm Details"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                    <span>Edit Firm</span>
                  </button>
                  <button
                    onClick={() => handleOpenDeleteFirmModal(usersModalFirm)}
                    className="p-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl border border-red-200 transition inline-flex items-center"
                    title="Delete Distributor Firm"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  </button>
                  <button
                    onClick={() => setUsersModalFirm(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Users Search Bar */}
              <div className="px-6 py-3 border-b border-slate-100 bg-white flex items-center justify-between">
                <div className="relative w-72">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={firmUserSearch}
                    onChange={(e) => setFirmUserSearch(e.target.value)}
                    placeholder="Search name, username, or email..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <button
                  onClick={() => fetchFirmUsers(usersModalFirm.id)}
                  className="p-1.5 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
                  title="Reload Users"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${firmUsersLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Users Table */}
              <div className="overflow-y-auto p-6 flex-1">
                {firmUsersLoading ? (
                  <div className="py-12 text-center text-slate-400 text-xs">Loading distributor users...</div>
                ) : firmUsers.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">No users found for this distributor firm.</div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs min-w-[700px]">
                      <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-4 whitespace-nowrap">User</th>
                          <th className="py-2.5 px-4 whitespace-nowrap">Username (Login ID)</th>
                          <th className="py-2.5 px-4 whitespace-nowrap">Email</th>
                          <th className="py-2.5 px-3 text-center whitespace-nowrap">Role</th>
                          <th className="py-2.5 px-3 text-center whitespace-nowrap">Status</th>
                          <th className="py-2.5 px-4 text-right whitespace-nowrap">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {firmUsers
                          .filter(
                            (u) =>
                              u.name.toLowerCase().includes(firmUserSearch.toLowerCase()) ||
                              u.username.toLowerCase().includes(firmUserSearch.toLowerCase()) ||
                              u.email.toLowerCase().includes(firmUserSearch.toLowerCase())
                          )
                          .map((u) => (
                            <tr key={u.id} className="hover:bg-slate-50/70 transition">
                              <td className="py-3 px-4 font-semibold text-slate-900">
                                <div className="flex items-center space-x-2">
                                  <div className="w-7 h-7 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                                    {u.name.charAt(0)}
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-900">{u.name}</p>
                                    <p className="text-[10px] text-slate-400">
                                      Created: {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 font-mono font-bold text-indigo-600 whitespace-nowrap">
                                @{u.username}
                              </td>
                              <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{u.email}</td>
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                                  {u.role}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    u.isActive
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {u.isActive ? 'Active' : 'Disabled'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end space-x-1.5">
                                  <button
                                    onClick={() => handleOpenResetPassword(u)}
                                    className="px-2 py-1 text-[11px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg border border-amber-300 transition inline-flex items-center space-x-1"
                                    title="Set or reset password for this user"
                                  >
                                    <KeyRound className="w-3 h-3 text-amber-700" />
                                    <span>Reset Password</span>
                                  </button>
                                  <button
                                    onClick={() => handleOpenEditFirmUser(u)}
                                    className="p-1 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition"
                                    title="Edit user details"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setDeleteUserTarget(u);
                                      setDeleteUserError(null);
                                    }}
                                    className="p-1 text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition"
                                    title="Delete user permanently"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 mr-1.5" />
                  Super Admin Root Authority: Passwords and accounts update instantly in live memory and database.
                </span>
                <button
                  onClick={() => setUsersModalFirm(null)}
                  className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SUBMODAL: ADD USER UNDER FIRM */}
        {addUserOpen && usersModalFirm && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
            style={{ zIndex: 100, pointerEvents: 'auto' }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden flex flex-col relative z-[101]"
              style={{ zIndex: 101 }}
            >
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <h3 className="text-sm font-bold text-slate-900">
                  Add User to {usersModalFirm.name}
                </h3>
                <button
                  onClick={() => setAddUserOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateFirmUser} className="p-6 space-y-3">
                {addUserError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                    {addUserError}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="e.g. Ramesh Patel"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Username (Login ID) *</label>
                  <input
                    type="text"
                    required
                    value={newUserUsername}
                    onChange={(e) => setNewUserUsername(e.target.value)}
                    placeholder="e.g. ramesh_apex"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="e.g. ramesh@example.com"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Initial Password *</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="Minimum 4 characters"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => setNewUserPassword(generateStrongPassword())}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md border"
                    >
                      Generate
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Role *</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="owner">Firm Owner</option>
                    <option value="manager">Manager</option>
                    <option value="accountant">Accountant</option>
                    <option value="staff">Staff</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setAddUserOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addUserSubmitting}
                    className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-xs transition disabled:opacity-50"
                  >
                    {addUserSubmitting ? 'Adding User...' : 'Add User Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SUBMODAL: EDIT USER IN FIRM */}
        {editingFirmUser && usersModalFirm && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
            style={{ zIndex: 100, pointerEvents: 'auto' }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden flex flex-col relative z-[101]"
              style={{ zIndex: 101 }}
            >
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <h3 className="text-sm font-bold text-slate-900">
                  Edit User: @{editingFirmUser.username}
                </h3>
                <button
                  onClick={() => setEditingFirmUser(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEditFirmUser} className="p-6 space-y-3">
                {editUserError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                    {editUserError}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editUserName}
                    onChange={(e) => setEditUserName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Username (Login ID) *</label>
                  <input
                    type="text"
                    required
                    value={editUserUsername}
                    onChange={(e) => setEditUserUsername(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={editUserEmail}
                    onChange={(e) => setEditUserEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Role *</label>
                    <select
                      value={editUserRole}
                      onChange={(e) => setEditUserRole(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="owner">Firm Owner</option>
                      <option value="manager">Manager</option>
                      <option value="accountant">Accountant</option>
                      <option value="staff">Staff</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Account Status</label>
                    <select
                      value={editUserIsActive ? 'active' : 'disabled'}
                      onChange={(e) => setEditUserIsActive(e.target.value === 'active')}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="active">Active</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setEditingFirmUser(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editUserSubmitting}
                    className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-xs transition disabled:opacity-50"
                  >
                    {editUserSubmitting ? 'Saving...' : 'Save User Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SUBMODAL: RESET USER PASSWORD */}
        {resetPwUser && usersModalFirm && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
            style={{ zIndex: 100, pointerEvents: 'auto' }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden flex flex-col relative z-[101]"
              style={{ zIndex: 101 }}
            >
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-amber-50">
                <div className="flex items-center space-x-2">
                  <KeyRound className="w-5 h-5 text-amber-700" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Reset Password for @{resetPwUser.username}
                    </h3>
                    <p className="text-[11px] text-amber-800">{resetPwUser.name} ({usersModalFirm.name})</p>
                  </div>
                </div>
                <button
                  onClick={() => setResetPwUser(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveResetPassword} className="p-6 space-y-4">
                {resetPwSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1">
                    <p className="font-bold">✓ Password Reset Successfully!</p>
                    <p className="font-mono bg-white p-2 rounded border border-emerald-200 select-all">
                      {resetPwValue}
                    </p>
                    <p className="text-[11px] text-emerald-700">
                      {resetPwCopied ? 'Copied to clipboard!' : 'Password updated.'}
                    </p>
                  </div>
                )}

                {resetPwError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                    {resetPwError}
                  </div>
                )}

                {!resetPwSuccess && (
                  <>
                    <p className="text-xs text-slate-600">
                      Enter a new password or use the auto-generated secure password below. Once set, the user can immediately log in with this password.
                    </p>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={resetPwValue}
                          onChange={(e) => setResetPwValue(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 pr-24"
                        />
                        <button
                          type="button"
                          onClick={() => setResetPwValue(generateStrongPassword())}
                          className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border flex items-center space-x-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Generate</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}

                <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setResetPwUser(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                  >
                    {resetPwSuccess ? 'Done' : 'Cancel'}
                  </button>
                  {!resetPwSuccess && (
                    <button
                      type="submit"
                      disabled={resetPwSubmitting}
                      className="px-5 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-xl shadow-md shadow-amber-500/20 transition-all duration-200 disabled:opacity-50"
                    >
                      {resetPwSubmitting ? 'Updating...' : 'Set & Copy Password'}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SUBMODAL: DELETE USER CONFIRMATION */}
        {deleteUserTarget && usersModalFirm && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
            style={{ zIndex: 100, pointerEvents: 'auto' }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 overflow-hidden flex flex-col relative z-[101]"
              style={{ zIndex: 101 }}
            >
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-red-50">
                <h3 className="text-sm font-bold text-slate-900">
                  Delete User Account
                </h3>
                <button
                  onClick={() => setDeleteUserTarget(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-3">
                {deleteUserError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                    {deleteUserError}
                  </div>
                )}
                <p className="text-xs text-slate-700">
                  Are you sure you want to delete user <strong className="font-mono text-slate-900">@{deleteUserTarget.username}</strong> ({deleteUserTarget.name}) from {usersModalFirm.name}?
                </p>
                <p className="text-[11px] text-red-600">
                  This user will no longer be able to log in.
                </p>
              </div>

              <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setDeleteUserTarget(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteFirmUser}
                  disabled={deleteUserSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  {deleteUserSubmitting ? 'Deleting...' : 'Delete User'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
