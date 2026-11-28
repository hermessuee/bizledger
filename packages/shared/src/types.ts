import { Role, MenuKey, AccountType, ChequeStatus, ChequeDirection, DocumentType } from './constants';

export interface Business {
  id: string;
  name: string;
  gstin?: string | null;
  stateCode?: string | null;
  address?: string | null;
  currency: string;
  fyStartMonth: number;
  status?: 'active' | 'suspended' | 'trial';
  enabledMenus?: MenuKey[];
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
  name: string; // retailer_name
  distributorCode?: string | null;
  retailerCode?: string | null;
  address1?: string | null; // address_1
  mobileNumber?: string | null; // mobile_number
  phone?: string | null;
  email?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  gstNo?: string | null; // gst_no
  gstin?: string | null;
  tinLocationName?: string | null; // tin_location_name
  panNo?: string | null; // pan_no
  dlNumber?: string | null; // dl_number
  dlExpiryDate?: string | null; // dl_expiry_date
  address?: string | null;
  creditDays: number;
  openingBalance: number; // in paise
  currentBalance?: number; // in paise
  isActive: boolean;
}

export interface Item {
  id: string;
  businessId: string;
  name: string; // sku_name
  company?: string | null; // company
  category?: string | null; // category
  skuCode?: string | null; // sku_code
  skuName?: string | null; // sku_name alias
  productBatch?: string | null; // product_batch
  mrp?: number | null; // mrp in paise
  rlp?: number | null; // rlp (Retailer Landing Price) in paise
  upc?: string | null; // upc
  hsnCode?: string | null; // hsn_code
  hsnSac?: string | null;
  expiryDate?: string | null; // expiry_date (YYYY-MM-DD)
  eanCode?: string | null; // ean_code
  unit: string; // Unit (KG, PCS, BOX, etc.)
  salePrice: number; // paise
  purchasePrice: number; // paise
  gstRate: number; // GSTRatePercent
  trackStock: boolean;
  stockQty: number; // OpeningStockQty
  isActive?: boolean;
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
