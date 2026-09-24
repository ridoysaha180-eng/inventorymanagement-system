export type User = {
  id: string;
  email: string;
  business_name?: string;
};

export type Supplier = {
  id: string;
  user_id: string;
  sl_number: string;
  name: string;
  company?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  opening_due?: number;
  opening_date?: string;
  created_at: string;
};

export type InventoryItem = {
  id: string;
  user_id: string;
  supplier_id?: string;
  name: string;
  company?: string;
  sku: string;
  item_code?: string;
  category: string;
  sub_category?: string;
  unit?: string;
  decimal?: boolean;
  manage_stock?: boolean;
  quantity: number;
  mrp?: number;
  unit_price: number; // Sale price
  dealer_price?: number;
  cost_price: number;
  min_stock_level: number;
  image_url?: string;
  description?: string;
  notes?: string;
  created_at: string;
};

export type Sale = {
  id: string;
  user_id: string;
  customer_id?: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  cash_received?: number;
  change_amount?: number;
  paid_amount?: number;
  due_amount?: number;
  payment_method: 'cash' | 'due' | 'card' | 'transfer';
  status: 'completed' | 'pending' | 'partial' | 'cancelled';
  created_at: string;
  items: SaleItem[];
};

export type SaleItem = {
  id: string;
  sale_id: string;
  inventory_item_id: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  cost_price?: number;
  supplier_id?: string;
  supplier_name?: string;
  supplier_sl?: string;
  item_name?: string;
};

export type Purchase = {
  id: string;
  user_id: string;
  supplier_id?: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  estimated_sales_amount?: number;
  estimated_profit?: number;
  payment_method: 'cash' | 'due' | 'card' | 'transfer';
  status: 'completed' | 'pending' | 'cancelled';
  created_at: string;
  items: PurchaseItem[];
};

export type PurchaseItem = {
  id: string;
  purchase_id: string;
  inventory_item_id: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  default_sales_price?: number;
  item_name?: string;
};

export type Customer = {
  id: string;
  user_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  opening_due?: number;
  opening_date?: string;
  created_at: string;
};

export type Expense = {
  id: string;
  user_id: string;
  category: string;
  amount: number;
  description: string;
  date: string;
  created_at: string;
  payment_method?: string;
  reference_no?: string;
};

export type DashboardStats = {
  totalSales: number;
  totalExpenses: number;
  totalCustomers: number;
  lowStockItems: number;
  recentSales: Sale[];
  salesByDay: { date: string; amount: number }[];
};

export type BusinessSettings = {
  name: string;
  tagline?: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  tax_rate: number;
  currency: string;
  opening_balance?: number;
  total_investment?: number;
  logo?: string;
  themeColor?: string;
  fontFamily?: string;
  customRgb?: { r: number; g: number; b: number };
  invoice_footer_note?: string;
  invoice_show_logo?: boolean;
  invoice_show_name?: boolean;
  invoice_header_mode?: 'both' | 'logo_only' | 'name_only';
  invoice_show_phone?: boolean;
  invoice_show_tax?: boolean;
};

export type UserProfileSettings = {
  name: string;
  email: string;
  phone?: string;
  role?: string;
  avatar?: string;
  designation?: string;
};

export type NotificationSettings = {
  low_stock_alerts: boolean;
  due_payment_reminders: boolean;
  daily_sales_summary: boolean;
  purchase_updates: boolean;
  sound_effects: boolean;
  email_notifications: boolean;
};

export type Brand = {
  id: string;
  name: string;
  created_at: string;
};

export type Category = {
  id: string;
  name: string;
  created_at: string;
};

export type SubCategory = {
  id: string;
  category_id: string;
  name: string;
  created_at: string;
};

export type LoanRepayment = {
  id: string;
  loan_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_no?: string;
  note?: string;
  created_at: string;
};

export type Loan = {
  id: string;
  user_id?: string;
  title: string;
  provider_type: 'bank' | 'ngo' | 'personal' | 'business' | 'other';
  lender_name: string;
  contact_number?: string;
  principal_amount: number;
  interest_rate?: number;
  total_payable: number;
  total_paid: number;
  remaining_amount: number;
  disbursement_date: string;
  due_date?: string;
  installment_type?: 'monthly' | 'weekly' | 'one_time' | 'daily';
  installment_amount?: number;
  status: 'active' | 'paid' | 'overdue';
  account_or_voucher?: string;
  notes?: string;
  created_at: string;
  repayments?: LoanRepayment[];
};

export type Investment = {
  id: string;
  source: string;
  amount: number;
  date: string;
  type?: string; // e.g., 'equity', 'capital', 'loan'
  notes?: string;
  created_at: string;
};

export type DuePayment = {
  id: string;
  user_id?: string;
  type: 'customer_collection' | 'supplier_payment';
  party_type: 'customer' | 'supplier';
  party_id: string;
  party_name: string;
  party_phone?: string;
  amount: number;
  payment_date: string;
  payment_method: 'cash' | 'bkash' | 'nagad' | 'bank' | 'card' | 'other';
  sale_id?: string;
  purchase_id?: string;
  note?: string;
  receipt_no?: string;
  created_at: string;
};

export type TrashItem = {
  id: string;
  user_id: string;
  item_type: 'product' | 'customer' | 'supplier' | 'expense' | 'loan' | 'investment' | 'sale' | 'purchase' | 'brand' | 'category';
  title: string;
  subtitle?: string;
  original_data: any;
  deleted_at: string;
};

export type ActivityCategory = 
  | 'sales' 
  | 'purchases' 
  | 'inventory' 
  | 'customers' 
  | 'suppliers' 
  | 'dues' 
  | 'expenses' 
  | 'finance' 
  | 'settings' 
  | 'trash' 
  | 'system';

export type ActivityType = 
  | 'sale_created'
  | 'sale_updated'
  | 'sale_deleted'
  | 'sale_restored'
  | 'purchase_created'
  | 'purchase_updated'
  | 'purchase_deleted'
  | 'purchase_restored'
  | 'product_created'
  | 'product_updated'
  | 'product_deleted'
  | 'product_restored'
  | 'customer_created'
  | 'customer_updated'
  | 'customer_deleted'
  | 'customer_restored'
  | 'supplier_created'
  | 'supplier_updated'
  | 'supplier_deleted'
  | 'supplier_restored'
  | 'due_collected'
  | 'due_paid'
  | 'expense_created'
  | 'expense_deleted'
  | 'expense_restored'
  | 'loan_created'
  | 'loan_repayment'
  | 'loan_deleted'
  | 'investment_created'
  | 'investment_deleted'
  | 'settings_updated'
  | 'profile_updated'
  | 'trash_item_deleted'
  | 'trash_emptied'
  | 'bulk_upload';

export type ActivityLog = {
  id: string;
  user_id: string;
  timestamp: string; // ISO string
  date: string; // YYYY-MM-DD for grouping
  time: string; // Formatted time string
  category: ActivityCategory;
  action_type: ActivityType;
  title: string;
  description: string;
  entity_id?: string;
  entity_name?: string;
  amount?: number;
  metadata?: Record<string, any>;
};

