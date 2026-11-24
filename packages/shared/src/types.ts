import { Role, MenuKey, AccountType, ChequeStatus, ChequeDirection, DocumentType } from './constants';

export interface Business {
  id: string;
  name: string;
  gstin?: string | null;
  stateCode?: string | null;
  address?: string | null;
  currency: string;
  fyStartMonth: number;
  settings: Record<string, any>;
  createdAt: string;
}

export interface UserSession {
  id: string;
  businessId: string;
  businessName: string;
  name: string;
  email: string;
  username: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  permissions: Record<MenuKey, {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canExport: boolean;
  }>;
}

export interface Account {
  id: string;
  businessId: string;
  code: string;
  name: string;
  type: AccountType;
  parentId?: string | null;
  isSystem: boolean;
  isActive: boolean;
}

export interface Party {
  id: string;
  businessId: string;
  kind: 'customer' | 'vendor' | 'both';
  name: string;
  gstin?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  creditDays: number;
  openingBalance: number; // in paise
  currentBalance?: number; // in paise
  isActive: boolean;
}

export interface Item {
  id: string;
  businessId: string;
  name: string;
  hsnSac?: string | null;
  unit: string;
  salePrice: number; // paise
  purchasePrice: number; // paise
  gstRate: number;
  trackStock: boolean;
  stockQty: number;
}

export interface ChequeItem {
  id: string;
  businessId: string;
  direction: ChequeDirection;
  partyId: string;
  partyName?: string;
  chequeNo: string;
  bankName?: string | null;
  branch?: string | null;
  bankAccountId?: string | null;
  amount: number; // paise
  chequeDate: string;
  txnDate: string;
  status: ChequeStatus;
  bounceReason?: string | null;
  bankCharges?: number;
  snoozedUntil?: string | null;
  remarks?: string | null;
  createdAt: string;
}

export interface ChequeAlertsResponse {
  overdue: ChequeItem[];
  dueToday: ChequeItem[];
  upcoming: ChequeItem[];
  totalCount: number;
}
