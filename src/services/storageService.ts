import {
  InventoryItem,
  Sale,
  Supplier,
  Customer,
  Expense,
  Purchase,
  BusinessSettings,
  Brand,
  Category,
  SubCategory,
  UserProfileSettings,
  NotificationSettings,
  Loan,
  LoanRepayment,
  Investment,
  DuePayment,
  TrashItem,
  ActivityLog,
  ActivityCategory,
  ActivityType
} from '../types';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = {
  name: 'Grocery Point',
  tagline: 'Fresh Products • Better Life',
  address: 'Mirpur, Dhaka',
  phone: '01318087631',
  email: '',
  website: '',
  tax_rate: 0,
  currency: 'BDT',
  opening_balance: 0,
  total_investment: 0,
  themeColor: 'teal',
  fontFamily: 'plus-jakarta',
  customRgb: { r: 20, g: 184, b: 166 }
};

const DEFAULT_USER_PROFILE: UserProfileSettings = {
  name: 'Store Owner',
  email: '',
  phone: '',
  role: 'Owner & Super Admin',
  designation: 'Business Manager',
  avatar: ''
};

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  low_stock_alerts: true,
  due_payment_reminders: true,
  daily_sales_summary: true,
  purchase_updates: false,
  sound_effects: true,
  email_notifications: true
};

interface MemoryCache {
  inventory: InventoryItem[];
  sales: Sale[];
  purchases: Purchase[];
  suppliers: Supplier[];
  customers: Customer[];
  expenses: Expense[];
  expenseCategories: string[];
  loans: Loan[];
  investments: Investment[];
  brands: Brand[];
  categories: Category[];
  subCategories: SubCategory[];
  businessSettings: BusinessSettings;
  userProfile: UserProfileSettings;
  notifications: NotificationSettings;
  duePayments: DuePayment[];
  trash: TrashItem[];
  activityLogs: ActivityLog[];
  logsClearedAt?: number;
}

let activeUid: string | null = null;
let activeUnsubscribes: Unsubscribe[] = [];
let isInitialized = false;
let initPromise: Promise<void> | null = null;

let memoryCache: MemoryCache = {
  inventory: [],
  sales: [],
  purchases: [],
  suppliers: [],
  customers: [],
  expenses: [],
  expenseCategories: [],
  loans: [],
  investments: [],
  brands: [],
  categories: [],
  subCategories: [],
  businessSettings: { ...DEFAULT_BUSINESS_SETTINGS },
  userProfile: { ...DEFAULT_USER_PROFILE },
  notifications: { ...DEFAULT_NOTIFICATIONS },
  duePayments: [],
  trash: [],
  activityLogs: []
};

const dispatch = (eventName: string, detail?: any) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  }
};

const getUid = (): string => {
  const uid = auth.currentUser?.uid || activeUid;
  if (!uid) {
    throw new Error('User is not authenticated. Cannot perform cloud database operation.');
  }
  return uid;
};

/**
 * Recursively sanitizes any payload destined for Cloud Firestore.
 * Strips all properties containing `undefined` values at any depth.
 * Firestore strictly rejects documents that have undefined fields.
 */
export function cleanForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as any;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (data instanceof Date) {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(item => cleanForFirestore(item)) as any;
  }
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      cleaned[key] = cleanForFirestore(value);
    }
  }
  return cleaned as T;
}

const safeSetDoc = async (docRef: any, data: any) => {
  return setDoc(docRef, cleanForFirestore(data));
};

const safeBatchSet = (batch: any, docRef: any, data: any) => {
  return batch.set(docRef, cleanForFirestore(data));
};

// One-time legacy migration from localStorage or old users_data structure
const runLegacyMigration = async (uid: string) => {
  const migrationKey = `bizflow_firestore_migrated_${uid}`;
  if (localStorage.getItem(migrationKey) === 'true') {
    return;
  }

  try {
    // Check if Firestore already has inventory items for this user
    const invCol = collection(db, 'users', uid, 'inventory');
    const existingSnap = await getDocs(invCol);
    
    // If user already has data in new Firestore structure, mark as migrated
    if (!existingSnap.empty) {
      localStorage.setItem(migrationKey, 'true');
      return;
    }

    // Check legacy localStorage items
    const getLocal = <T>(k: string): T[] => {
      try {
        const raw = localStorage.getItem(k);
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    };

    const localInv = getLocal<InventoryItem>('bizflow_inventory');
    const localSales = getLocal<Sale>('bizflow_sales');
    const localPurchases = getLocal<Purchase>('bizflow_purchases');
    const localSuppliers = getLocal<Supplier>('bizflow_suppliers');
    const localCustomers = getLocal<Customer>('bizflow_customers');
    const localExpenses = getLocal<Expense>('bizflow_expenses');
    const localExpCats = getLocal<string>('bizflow_expense_categories');
    const localLoans = getLocal<Loan>('bizflow_loans');
    const localInvestments = getLocal<Investment>('bizflow_investments');
    const localBrands = getLocal<Brand>('bizflow_brands');
    const localCategories = getLocal<Category>('bizflow_categories');
    const localSubCategories = getLocal<SubCategory>('bizflow_sub_categories');

    let localBizSettings: BusinessSettings | null = null;
    try {
      const s = localStorage.getItem('bizflow_business_settings');
      if (s) localBizSettings = JSON.parse(s);
    } catch {
      // ignore
    }

    let localUserProfile: UserProfileSettings | null = null;
    try {
      const p = localStorage.getItem('bizflow_user_profile');
      if (p) localUserProfile = JSON.parse(p);
    } catch {
      // ignore
    }

    const batch = writeBatch(db);
    let opCount = 0;

    // Helper to commit batches safely if near limit
    const saveList = async <T extends { id: string }>(subcoll: string, list: T[]) => {
      for (const item of list) {
        if (!item || !item.id) continue;
        const itemRef = doc(db, 'users', uid, subcoll, item.id);
        safeBatchSet(batch, itemRef, item);
        opCount++;
        if (opCount >= 450) {
          await batch.commit();
          opCount = 0;
        }
      }
    };

    if (localInv.length > 0) await saveList('inventory', localInv);
    if (localSales.length > 0) await saveList('sales', localSales);
    if (localPurchases.length > 0) await saveList('purchases', localPurchases);
    if (localSuppliers.length > 0) await saveList('suppliers', localSuppliers);
    if (localCustomers.length > 0) await saveList('customers', localCustomers);
    if (localExpenses.length > 0) await saveList('expenses', localExpenses);
    if (localLoans.length > 0) await saveList('loans', localLoans);
    if (localInvestments.length > 0) await saveList('investments', localInvestments);
    if (localBrands.length > 0) await saveList('brands', localBrands);
    if (localCategories.length > 0) await saveList('categories', localCategories);
    if (localSubCategories.length > 0) await saveList('sub_categories', localSubCategories);

    if (localExpCats && localExpCats.length > 0) {
      safeBatchSet(batch, doc(db, 'users', uid, 'settings', 'expense_categories'), { categories: localExpCats });
      opCount++;
    }
    if (localBizSettings) {
      safeBatchSet(batch, doc(db, 'users', uid, 'settings', 'business'), localBizSettings);
      opCount++;
    }
    if (localUserProfile) {
      safeBatchSet(batch, doc(db, 'users', uid, 'settings', 'profile'), localUserProfile);
      opCount++;
    }

    if (opCount > 0) {
      await batch.commit();
    }

    localStorage.setItem(migrationKey, 'true');

    // Clean up legacy localStorage keys to ensure browser storage is no longer used
    const legacyKeys = [
      'bizflow_inventory',
      'bizflow_sales',
      'bizflow_purchases',
      'bizflow_suppliers',
      'bizflow_customers',
      'bizflow_expenses',
      'bizflow_expense_categories',
      'bizflow_loans',
      'bizflow_investments',
      'bizflow_brands',
      'bizflow_categories',
      'bizflow_sub_categories',
      'bizflow_vendors'
    ];
    legacyKeys.forEach(k => localStorage.removeItem(k));
  } catch (error) {
    console.warn('Migration to Firestore encountered an issue:', error);
  }
};

// Initialize listeners for a specific user UID
const setupUserListeners = (uid: string): Promise<void> => {
  // Clear any existing snapshot subscriptions
  activeUnsubscribes.forEach(unsub => unsub());
  activeUnsubscribes = [];
  activeUid = uid;

  return new Promise<void>((resolve) => {
    let resolved = false;
    let pendingInitialSnapshots = 19; // Number of collections and doc listeners

    const checkReady = () => {
      pendingInitialSnapshots--;
      if (pendingInitialSnapshots <= 0 && !resolved) {
        resolved = true;
        isInitialized = true;
        resolve();
      }
    };

    // Safety timeout so UI doesn't hang indefinitely if a subcollection is empty
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        isInitialized = true;
        resolve();
      }
    }, 4000);

    // 1. Inventory
    const unsubInv = onSnapshot(collection(db, 'users', uid, 'inventory'), (snap) => {
      memoryCache.inventory = snap.docs.map(d => ({ ...d.data(), id: d.id } as InventoryItem));
      dispatch('bizflow_inventory_updated');
      checkReady();
    }, (err) => {
      console.warn('Inventory listener error:', err);
      checkReady();
    });
    activeUnsubscribes.push(unsubInv);

    // 2. Sales
    const unsubSales = onSnapshot(collection(db, 'users', uid, 'sales'), (snap) => {
      memoryCache.sales = snap.docs.map(d => ({ ...d.data(), id: d.id } as Sale));
      dispatch('bizflow_sales_updated');
      checkReady();
    }, (err) => {
      console.warn('Sales listener error:', err);
      checkReady();
    });
    activeUnsubscribes.push(unsubSales);

    // 3. Purchases
    const unsubPurchases = onSnapshot(collection(db, 'users', uid, 'purchases'), (snap) => {
      memoryCache.purchases = snap.docs.map(d => ({ ...d.data(), id: d.id } as Purchase));
      dispatch('bizflow_purchases_updated');
      checkReady();
    }, (err) => {
      console.warn('Purchases listener error:', err);
      checkReady();
    });
    activeUnsubscribes.push(unsubPurchases);

    // 4. Suppliers
    const unsubSuppliers = onSnapshot(collection(db, 'users', uid, 'suppliers'), (snap) => {
      memoryCache.suppliers = snap.docs.map(d => ({ ...d.data(), id: d.id } as Supplier));
      dispatch('bizflow_suppliers_updated');
      checkReady();
    }, (err) => {
      console.warn('Suppliers listener error:', err);
      checkReady();
    });
    activeUnsubscribes.push(unsubSuppliers);

    // 5. Customers
    const unsubCustomers = onSnapshot(collection(db, 'users', uid, 'customers'), (snap) => {
      memoryCache.customers = snap.docs.map(d => ({ ...d.data(), id: d.id } as Customer));
      dispatch('bizflow_customers_updated');
      checkReady();
    }, (err) => {
      console.warn('Customers listener error:', err);
      checkReady();
    });
    activeUnsubscribes.push(unsubCustomers);

    // 6. Expenses
    const unsubExpenses = onSnapshot(collection(db, 'users', uid, 'expenses'), (snap) => {
      memoryCache.expenses = snap.docs.map(d => ({ ...d.data(), id: d.id } as Expense));
      dispatch('bizflow_expenses_updated');
      checkReady();
    }, (err) => {
      console.warn('Expenses listener error:', err);
      checkReady();
    });
    activeUnsubscribes.push(unsubExpenses);

    // 7. Loans
    const unsubLoans = onSnapshot(collection(db, 'users', uid, 'loans'), (snap) => {
      memoryCache.loans = snap.docs.map(d => ({ ...d.data(), id: d.id } as Loan));
      dispatch('bizflow_loans_updated');
      checkReady();
    }, (err) => {
      console.warn('Loans listener error:', err);
      checkReady();
    });
    activeUnsubscribes.push(unsubLoans);

    // 8. Investments
    const unsubInvestments = onSnapshot(collection(db, 'users', uid, 'investments'), (snap) => {
      memoryCache.investments = snap.docs.map(d => ({ ...d.data(), id: d.id } as Investment));
      dispatch('bizflow_investments_updated');
      checkReady();
    }, (err) => {
      console.warn('Investments listener error:', err);
      checkReady();
    });
    activeUnsubscribes.push(unsubInvestments);

    // 9. Brands
    const unsubBrands = onSnapshot(collection(db, 'users', uid, 'brands'), (snap) => {
      memoryCache.brands = snap.docs.map(d => ({ ...d.data(), id: d.id } as Brand));
      dispatch('bizflow_brands_updated');
      checkReady();
    }, (err) => {
      console.warn('Brands listener error:', err);
      checkReady();
    });
    activeUnsubscribes.push(unsubBrands);

    // 10. Categories
    const unsubCategories = onSnapshot(collection(db, 'users', uid, 'categories'), (snap) => {
      memoryCache.categories = snap.docs.map(d => ({ ...d.data(), id: d.id } as Category));
      dispatch('bizflow_categories_updated');
      checkReady();
    }, (err) => {
      console.warn('Categories listener error:', err);
      checkReady();
    });
    activeUnsubscribes.push(unsubCategories);

    // 11. SubCategories
    const unsubSubCategories = onSnapshot(collection(db, 'users', uid, 'sub_categories'), (snap) => {
      memoryCache.subCategories = snap.docs.map(d => ({ ...d.data(), id: d.id } as SubCategory));
      dispatch('bizflow_sub_categories_updated');
      checkReady();
    }, (err) => {
      console.warn('SubCategories listener error:', err);
      checkReady();
    });
    activeUnsubscribes.push(unsubSubCategories);

    // 12. Business Settings
    const unsubBusiness = onSnapshot(doc(db, 'users', uid, 'settings', 'business'), (docSnap) => {
      if (docSnap.exists()) {
        memoryCache.businessSettings = { ...DEFAULT_BUSINESS_SETTINGS, ...docSnap.data() as BusinessSettings };
      }
      dispatch('bizflow_business_settings_updated', memoryCache.businessSettings);
      checkReady();
    }, (err) => {
      console.warn('Business settings listener error:', err);
      checkReady();
    });
    activeUnsubscribes.push(unsubBusiness);

    // 13. Profile Settings
    const unsubProfile = onSnapshot(doc(db, 'users', uid, 'settings', 'profile'), (docSnap) => {
      if (docSnap.exists()) {
        memoryCache.userProfile = { ...DEFAULT_USER_PROFILE, ...docSnap.data() as UserProfileSettings };
      }
      dispatch('bizflow_user_profile_updated', memoryCache.userProfile);
      checkReady();
    }, (err) => {
      console.warn('Profile listener error:', err);
      checkReady();
    });
    activeUnsubscribes.push(unsubProfile);

    // 14. Notification Settings
    const unsubNotif = onSnapshot(doc(db, 'users', uid, 'settings', 'notifications'), (docSnap) => {
      if (docSnap.exists()) {
        memoryCache.notifications = { ...DEFAULT_NOTIFICATIONS, ...docSnap.data() as NotificationSettings };
      }
      checkReady();
    }, (err) => {
      console.warn('Notification settings listener error:', err);
      checkReady();
    });
    activeUnsubscribes.push(unsubNotif);

    // 15. Expense Categories
    const unsubExpCats = onSnapshot(doc(db, 'users', uid, 'settings', 'expense_categories'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && Array.isArray(data.categories)) {
          memoryCache.expenseCategories = data.categories;
        }
      }
      dispatch('bizflow_expense_categories_updated');
      checkReady();
    }, (err) => {
      console.warn('Expense categories listener error:', err);
      checkReady();
    });
    activeUnsubscribes.push(unsubExpCats);

    // 16. Due Payments
    const unsubDuePayments = onSnapshot(collection(db, 'users', uid, 'due_payments'), (snap) => {
      memoryCache.duePayments = snap.docs.map(d => ({ ...d.data(), id: d.id } as DuePayment));
      dispatch('bizflow_due_payments_updated');
      checkReady();
    }, (err) => {
      console.warn('Due payments listener error:', err);
      checkReady();
    });
    activeUnsubscribes.push(unsubDuePayments);

    // 17. Trash
    const unsubTrash = onSnapshot(collection(db, 'users', uid, 'trash'), (snap) => {
      memoryCache.trash = snap.docs.map(d => ({ ...d.data(), id: d.id } as TrashItem));
      dispatch('bizflow_trash_updated');
      checkReady();
    }, (err) => {
      console.warn('Trash listener error:', err);
      checkReady();
    });
    activeUnsubscribes.push(unsubTrash);

    // 18. Activity Logs
    const unsubActivities = onSnapshot(collection(db, 'users', uid, 'activity_logs'), (snap) => {
      memoryCache.activityLogs = snap.docs.map(d => ({ ...d.data(), id: d.id } as ActivityLog));
      dispatch('bizflow_activities_updated');
      checkReady();
    }, (err) => {
      console.warn('Activity logs listener error:', err);
      checkReady();
    });
    activeUnsubscribes.push(unsubActivities);

    // 19. Logs Cleared Timestamp Setting
    const unsubLogsCleared = onSnapshot(doc(db, 'users', uid, 'settings', 'logs_cleared'), (docSnap) => {
      if (docSnap.exists()) {
        memoryCache.logsClearedAt = docSnap.data().cleared_at || 0;
      } else {
        const localVal = typeof localStorage !== 'undefined' ? localStorage.getItem(`bizflow_logs_cleared_at_${uid}`) : null;
        memoryCache.logsClearedAt = localVal ? Number(localVal) : 0;
      }
      dispatch('bizflow_activities_updated');
      checkReady();
    }, (err) => {
      console.warn('Logs cleared listener error:', err);
      checkReady();
    });
    activeUnsubscribes.push(unsubLogsCleared);
  });
};

// Automatically listen to auth changes
if (typeof window !== 'undefined') {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      if (activeUid !== user.uid) {
        storageService.initUser(user.uid);
      }
    } else {
      storageService.clearUser();
    }
  });
}

export const storageService = {
  // Initialization & lifecycle
  initUser: async (uid: string): Promise<void> => {
    if (activeUid === uid && isInitialized && initPromise) {
      return initPromise;
    }
    activeUid = uid;
    initPromise = (async () => {
      await runLegacyMigration(uid);
      await setupUserListeners(uid);
    })();
    return initPromise;
  },

  clearUser: () => {
    activeUnsubscribes.forEach(unsub => unsub());
    activeUnsubscribes = [];
    activeUid = null;
    isInitialized = false;
    initPromise = null;
    memoryCache = {
      inventory: [],
      sales: [],
      purchases: [],
      suppliers: [],
      customers: [],
      expenses: [],
      expenseCategories: [],
      loans: [],
      investments: [],
      duePayments: [],
      brands: [],
      categories: [],
      subCategories: [],
      businessSettings: { ...DEFAULT_BUSINESS_SETTINGS },
      userProfile: { ...DEFAULT_USER_PROFILE },
      notifications: { ...DEFAULT_NOTIFICATIONS },
      trash: [],
      activityLogs: []
    };
    dispatch('bizflow_inventory_updated');
    dispatch('bizflow_sales_updated');
    dispatch('bizflow_purchases_updated');
    dispatch('bizflow_suppliers_updated');
    dispatch('bizflow_customers_updated');
    dispatch('bizflow_expenses_updated');
    dispatch('bizflow_loans_updated');
    dispatch('bizflow_investments_updated');
    dispatch('bizflow_due_payments_updated');
    dispatch('bizflow_brands_updated');
    dispatch('bizflow_categories_updated');
    dispatch('bizflow_sub_categories_updated');
    dispatch('bizflow_trash_updated');
    dispatch('bizflow_activities_updated');
    dispatch('bizflow_business_settings_updated', DEFAULT_BUSINESS_SETTINGS);
    dispatch('bizflow_user_profile_updated', DEFAULT_USER_PROFILE);
  },

  isReady: () => isInitialized,

  // Business Settings
  getBusinessSettings: (): BusinessSettings => {
    return memoryCache.businessSettings;
  },
  saveBusinessSettings: async (settings: BusinessSettings): Promise<void> => {
    memoryCache.businessSettings = settings;
    dispatch('bizflow_business_settings_updated', settings);
    const uid = getUid();
    const docRef = doc(db, 'users', uid, 'settings', 'business');
    await safeSetDoc(docRef, settings);
  },

  // Brands
  getBrands: (): Brand[] => {
    return memoryCache.brands;
  },
  addBrand: async (brand: Brand): Promise<void> => {
    const id = brand.id || `brand_${Date.now()}`;
    const newBrand = { ...brand, id };
    memoryCache.brands = [...memoryCache.brands.filter(b => b.id !== id), newBrand];
    dispatch('bizflow_brands_updated');
    const uid = getUid();
    await safeSetDoc(doc(db, 'users', uid, 'brands', id), newBrand);
  },
  updateBrand: async (id: string, updatedBrand: Brand): Promise<void> => {
    memoryCache.brands = memoryCache.brands.map(b => b.id === id ? updatedBrand : b);
    dispatch('bizflow_brands_updated');
    const uid = getUid();
    await safeSetDoc(doc(db, 'users', uid, 'brands', id), updatedBrand);
  },
  deleteBrand: async (id: string): Promise<void> => {
    const brand = memoryCache.brands.find(b => b.id === id);
    if (brand) {
      await storageService.moveToTrash('brand', brand, brand.name, 'Company / Brand');
    }
    memoryCache.brands = memoryCache.brands.filter(b => b.id !== id);
    dispatch('bizflow_brands_updated');
    const uid = getUid();
    await deleteDoc(doc(db, 'users', uid, 'brands', id));
  },

  // Categories
  getCategories: (): Category[] => {
    return memoryCache.categories;
  },
  addCategory: async (category: Category): Promise<void> => {
    const id = category.id || `cat_${Date.now()}`;
    const newCategory = { ...category, id };
    memoryCache.categories = [...memoryCache.categories.filter(c => c.id !== id), newCategory];
    dispatch('bizflow_categories_updated');
    const uid = getUid();
    await safeSetDoc(doc(db, 'users', uid, 'categories', id), newCategory);
  },
  updateCategory: async (id: string, updatedCategory: Category): Promise<void> => {
    memoryCache.categories = memoryCache.categories.map(c => c.id === id ? updatedCategory : c);
    dispatch('bizflow_categories_updated');
    const uid = getUid();
    await safeSetDoc(doc(db, 'users', uid, 'categories', id), updatedCategory);
  },
  deleteCategory: async (id: string): Promise<void> => {
    const cat = memoryCache.categories.find(c => c.id === id);
    if (cat) {
      await storageService.moveToTrash('category', cat, cat.name, 'Product Category');
    }
    memoryCache.categories = memoryCache.categories.filter(c => c.id !== id);
    dispatch('bizflow_categories_updated');
    const uid = getUid();
    await deleteDoc(doc(db, 'users', uid, 'categories', id));
  },

  // SubCategories
  getSubCategories: (): SubCategory[] => {
    return memoryCache.subCategories;
  },
  addSubCategory: async (subCategory: SubCategory): Promise<void> => {
    const id = subCategory.id || `sub_${Date.now()}`;
    const newSub = { ...subCategory, id };
    memoryCache.subCategories = [...memoryCache.subCategories.filter(s => s.id !== id), newSub];
    dispatch('bizflow_sub_categories_updated');
    const uid = getUid();
    await safeSetDoc(doc(db, 'users', uid, 'sub_categories', id), newSub);
  },
  updateSubCategory: async (id: string, updatedSubCategory: SubCategory): Promise<void> => {
    memoryCache.subCategories = memoryCache.subCategories.map(s => s.id === id ? updatedSubCategory : s);
    dispatch('bizflow_sub_categories_updated');
    const uid = getUid();
    await safeSetDoc(doc(db, 'users', uid, 'sub_categories', id), updatedSubCategory);
  },
  deleteSubCategory: async (id: string): Promise<void> => {
    memoryCache.subCategories = memoryCache.subCategories.filter(s => s.id !== id);
    dispatch('bizflow_sub_categories_updated');
    const uid = getUid();
    await deleteDoc(doc(db, 'users', uid, 'sub_categories', id));
  },

  // Inventory
  getInventory: (): InventoryItem[] => {
    return memoryCache.inventory;
  },
  saveInventory: async (items: InventoryItem[]): Promise<void> => {
    memoryCache.inventory = items;
    dispatch('bizflow_inventory_updated');
    const uid = getUid();

    // Chunk in batches of 450
    const chunkSize = 450;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const item of chunk) {
        if (!item.id) continue;
        const ref = doc(db, 'users', uid, 'inventory', item.id);
        safeBatchSet(batch, ref, item);
      }
      await batch.commit();
    }
  },
  addProduct: async (item: InventoryItem): Promise<void> => {
    const uid = getUid();
    const id = item.id || `item_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const fullItem: InventoryItem = {
      ...item,
      id,
      user_id: uid
    };
    memoryCache.inventory = [fullItem, ...memoryCache.inventory.filter(i => i.id !== id)];
    dispatch('bizflow_inventory_updated');
    await safeSetDoc(doc(db, 'users', uid, 'inventory', id), fullItem);
    storageService.logActivity({
      category: 'inventory',
      action_type: 'product_created',
      title: `Added Product: ${fullItem.name}`,
      description: `SKU: ${fullItem.sku || 'N/A'} • Stock: ${fullItem.quantity} • Sale Price: ৳${fullItem.unit_price}`,
      entity_id: id,
      entity_name: fullItem.name,
      amount: fullItem.unit_price
    });
  },
  updateProduct: async (id: string, updatedItem: InventoryItem): Promise<void> => {
    const uid = getUid();
    const itemWithUser = { ...updatedItem, id, user_id: uid };
    memoryCache.inventory = memoryCache.inventory.map(item => item.id === id ? itemWithUser : item);
    dispatch('bizflow_inventory_updated');
    await safeSetDoc(doc(db, 'users', uid, 'inventory', id), itemWithUser);
  },
  updateProductStock: async (id: string, quantityChange: number): Promise<void> => {
    const uid = getUid();
    const target = memoryCache.inventory.find(i => i.id === id);
    if (target) {
      const updated = { ...target, quantity: target.quantity + quantityChange };
      memoryCache.inventory = memoryCache.inventory.map(i => i.id === id ? updated : i);
      dispatch('bizflow_inventory_updated');
      await safeSetDoc(doc(db, 'users', uid, 'inventory', id), updated);
    }
  },
  updateProductStockAndCost: async (id: string, quantityChange: number, newCostPrice: number): Promise<void> => {
    const uid = getUid();
    const target = memoryCache.inventory.find(i => i.id === id);
    if (target) {
      const updated = {
        ...target,
        quantity: target.quantity + quantityChange,
        cost_price: newCostPrice
      };
      memoryCache.inventory = memoryCache.inventory.map(i => i.id === id ? updated : i);
      dispatch('bizflow_inventory_updated');
      await safeSetDoc(doc(db, 'users', uid, 'inventory', id), updated);
    }
  },
  deleteProduct: async (id: string): Promise<void> => {
    const uid = getUid();
    const product = memoryCache.inventory.find(i => i.id === id);
    if (product) {
      await storageService.moveToTrash('product', product, product.name, `SKU: ${product.sku || 'N/A'} • Stock: ${product.quantity}`);
    }
    memoryCache.inventory = memoryCache.inventory.filter(item => item.id !== id);
    dispatch('bizflow_inventory_updated');
    await deleteDoc(doc(db, 'users', uid, 'inventory', id));
  },
  deleteProducts: async (ids: string[]): Promise<void> => {
    if (!ids || ids.length === 0) return;
    const uid = getUid();
    const toDelete = memoryCache.inventory.filter(item => ids.includes(item.id));
    for (const product of toDelete) {
      await storageService.moveToTrash('product', product, product.name, `SKU: ${product.sku || 'N/A'} • Stock: ${product.quantity}`);
    }
    memoryCache.inventory = memoryCache.inventory.filter(item => !ids.includes(item.id));
    dispatch('bizflow_inventory_updated');

    const batch = writeBatch(db);
    ids.forEach(id => {
      batch.delete(doc(db, 'users', uid, 'inventory', id));
    });
    await batch.commit();
  },
  updateProducts: async (ids: string[], updates: Partial<InventoryItem>): Promise<void> => {
    if (!ids || ids.length === 0) return;
    const uid = getUid();
    const updatedList = memoryCache.inventory.map(item =>
      ids.includes(item.id) ? { ...item, ...updates } : item
    );
    memoryCache.inventory = updatedList;
    dispatch('bizflow_inventory_updated');

    const batch = writeBatch(db);
    updatedList.filter(i => ids.includes(i.id)).forEach(item => {
      safeBatchSet(batch, doc(db, 'users', uid, 'inventory', item.id), item);
    });
    await batch.commit();
  },

  // Suppliers
  getSuppliers: (): Supplier[] => {
    return memoryCache.suppliers;
  },
  addSupplier: async (supplier: Supplier): Promise<void> => {
    const uid = getUid();
    const id = supplier.id || `sup_${Date.now()}`;
    const newSup = { ...supplier, id, user_id: uid };
    memoryCache.suppliers = [...memoryCache.suppliers.filter(s => s.id !== id), newSup];
    dispatch('bizflow_suppliers_updated');
    await safeSetDoc(doc(db, 'users', uid, 'suppliers', id), newSup);
    storageService.logActivity({
      category: 'suppliers',
      action_type: 'supplier_created',
      title: `Added Supplier: ${newSup.name}`,
      description: `Company: ${newSup.company || 'N/A'} • Phone: ${newSup.phone || 'N/A'} • SL: ${newSup.sl_number}`,
      entity_id: id,
      entity_name: newSup.name
    });
  },
  updateSupplier: async (id: string, updatedSupplier: Supplier): Promise<void> => {
    const uid = getUid();
    const full = { ...updatedSupplier, id, user_id: uid };
    memoryCache.suppliers = memoryCache.suppliers.map(v => v.id === id ? full : v);
    dispatch('bizflow_suppliers_updated');
    await safeSetDoc(doc(db, 'users', uid, 'suppliers', id), full);
  },
  deleteSupplier: async (id: string): Promise<void> => {
    const uid = getUid();
    const sup = memoryCache.suppliers.find(v => v.id === id);
    if (sup) {
      await storageService.moveToTrash('supplier', sup, sup.name, `Phone: ${sup.phone || 'N/A'} • SL: ${sup.sl_number}`);
    }
    memoryCache.suppliers = memoryCache.suppliers.filter(v => v.id !== id);
    dispatch('bizflow_suppliers_updated');
    await deleteDoc(doc(db, 'users', uid, 'suppliers', id));
  },
  deleteSuppliers: async (ids: string[]): Promise<void> => {
    if (!ids || ids.length === 0) return;
    const uid = getUid();
    const toDelete = memoryCache.suppliers.filter(v => ids.includes(v.id));
    for (const sup of toDelete) {
      await storageService.moveToTrash('supplier', sup, sup.name, `Phone: ${sup.phone || 'N/A'} • SL: ${sup.sl_number}`);
    }
    memoryCache.suppliers = memoryCache.suppliers.filter(v => !ids.includes(v.id));
    dispatch('bizflow_suppliers_updated');

    const batch = writeBatch(db);
    ids.forEach(id => {
      batch.delete(doc(db, 'users', uid, 'suppliers', id));
    });
    await batch.commit();
  },
  deleteAllSuppliers: async (): Promise<void> => {
    const uid = getUid();
    const list = [...memoryCache.suppliers];
    memoryCache.suppliers = [];
    dispatch('bizflow_suppliers_updated');

    const batch = writeBatch(db);
    list.forEach(s => batch.delete(doc(db, 'users', uid, 'suppliers', s.id)));
    await batch.commit();
  },

  // Sales (with atomic stock reduction in Firestore)
  getSales: (): Sale[] => {
    return memoryCache.sales;
  },
  addSale: async (sale: Sale): Promise<void> => {
    const uid = getUid();
    const id = sale.id || `sale_${Date.now()}`;
    const fullSale: Sale = { ...sale, id, user_id: uid };

    const batch = writeBatch(db);

    // Calculate inventory deductions by supplier lot and SL number (FIFO)
    const invItems = [...memoryCache.inventory];
    const modifiedItems: InventoryItem[] = [];

    fullSale.items.forEach(saleItem => {
      // 1. If direct inventory item ID was provided (exact supplier lot match)
      if (saleItem.inventory_item_id) {
        const directItem = invItems.find(i => i.id === saleItem.inventory_item_id);
        if (directItem) {
          directItem.quantity = Math.max(0, (directItem.quantity || 0) - saleItem.quantity);
          if (!modifiedItems.some(m => m.id === directItem.id)) modifiedItems.push(directItem);
          return;
        }
      }

      // 2. Otherwise match by SKU or Name and deduct sequentially by Supplier SL
      const originalItem = invItems.find(i => saleItem.sku && i.sku === saleItem.sku) ||
                           invItems.find(i => saleItem.item_name && i.name && i.name.trim().toLowerCase() === saleItem.item_name.trim().toLowerCase());
      if (originalItem) {
        const matchingItems = invItems.filter(i => 
          (originalItem.sku && i.sku === originalItem.sku) ||
          (originalItem.name && i.name && i.name.trim().toLowerCase() === originalItem.name.trim().toLowerCase())
        );

        // Sort by Supplier SL number (e.g. SL-001 first)
        matchingItems.sort((a, b) => {
          const suppA = memoryCache.suppliers.find(s => s.id === a.supplier_id);
          const suppB = memoryCache.suppliers.find(s => s.id === b.supplier_id);
          const slA = suppA?.sl_number || 'SL-999';
          const slB = suppB?.sl_number || 'SL-999';
          if (slA !== slB) {
            return slA.localeCompare(slB, undefined, { numeric: true });
          }
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        });

        let remainingToDeduct = saleItem.quantity;
        for (const mItem of matchingItems) {
          if (remainingToDeduct <= 0) break;
          if (mItem.quantity > 0) {
            const deduct = Math.min(mItem.quantity, remainingToDeduct);
            mItem.quantity -= deduct;
            remainingToDeduct -= deduct;
            if (!modifiedItems.some(m => m.id === mItem.id)) modifiedItems.push(mItem);
          }
        }

        if (remainingToDeduct > 0 && matchingItems.length > 0) {
          matchingItems[0].quantity -= remainingToDeduct;
          if (!modifiedItems.some(m => m.id === matchingItems[0].id)) modifiedItems.push(matchingItems[0]);
        }
      }
    });

    // Write sale to Firestore
    safeBatchSet(batch, doc(db, 'users', uid, 'sales', id), fullSale);

    // Update modified inventory items in Firestore
    modifiedItems.forEach(item => {
      safeBatchSet(batch, doc(db, 'users', uid, 'inventory', item.id), item);
    });

    // Optimistic local state update
    memoryCache.sales = [fullSale, ...memoryCache.sales.filter(s => s.id !== id)];
    memoryCache.inventory = invItems;
    dispatch('bizflow_sales_updated', fullSale);
    dispatch('bizflow_inventory_updated');

    await batch.commit();

    const customer = memoryCache.customers.find(c => c.id === fullSale.customer_id);
    const custName = customer?.name || (fullSale as any).customer_name || 'Walk-in Customer';
    storageService.logActivity({
      category: 'sales',
      action_type: 'sale_created',
      title: `Created Sales Invoice #${fullSale.id.slice(-6).toUpperCase()}`,
      description: `Customer: ${custName} • Items: ${fullSale.items.length} • Total: ৳${fullSale.total_amount} • Paid: ৳${fullSale.paid_amount}`,
      entity_id: fullSale.id,
      entity_name: `Invoice #${fullSale.id.slice(-6).toUpperCase()}`,
      amount: fullSale.total_amount,
      metadata: {
        paid_amount: fullSale.paid_amount,
        due_amount: fullSale.due_amount,
        payment_method: fullSale.payment_method,
        customer_name: custName
      }
    });
  },
  deleteSale: async (id: string): Promise<void> => {
    const uid = getUid();
    const saleToDelete = memoryCache.sales.find(s => s.id === id);
    if (saleToDelete) {
      const customer = memoryCache.customers.find(c => c.id === saleToDelete.customer_id);
      await storageService.moveToTrash('sale', saleToDelete, `Sale #${saleToDelete.id.slice(-6).toUpperCase()}`, `Total: ৳${saleToDelete.total_amount} • Customer: ${customer?.name || 'Walk-in'}`);
    }

    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', uid, 'sales', id));

    const invItems = [...memoryCache.inventory];
    if (saleToDelete) {
      saleToDelete.items.forEach(saleItem => {
        const originalItem = invItems.find(i => i.id === saleItem.inventory_item_id) ||
                             invItems.find(i => i.sku === saleItem.sku);
        if (originalItem) {
          originalItem.quantity += saleItem.quantity;
          safeBatchSet(batch, doc(db, 'users', uid, 'inventory', originalItem.id), originalItem);
        }
      });
    }

    memoryCache.sales = memoryCache.sales.filter(s => s.id !== id);
    memoryCache.inventory = invItems;
    dispatch('bizflow_sales_updated');
    dispatch('bizflow_inventory_updated');

    await batch.commit();
  },
  updateSale: async (id: string, updatedSale: Sale): Promise<void> => {
    const uid = getUid();
    const oldSale = memoryCache.sales.find(s => s.id === id);
    const fullSale = { ...updatedSale, id, user_id: uid };

    const batch = writeBatch(db);
    safeBatchSet(batch, doc(db, 'users', uid, 'sales', id), fullSale);

    const invItems = [...memoryCache.inventory];

    // Revert old quantities
    if (oldSale && Array.isArray(oldSale.items)) {
      oldSale.items.forEach(item => {
        const target = (item.inventory_item_id ? invItems.find(i => i.id === item.inventory_item_id) : null) ||
                       invItems.find(i => item.sku && i.sku === item.sku);
        if (target) {
          target.quantity += item.quantity;
        }
      });
    }

    // Apply new quantities
    fullSale.items.forEach(item => {
      const target = (item.inventory_item_id ? invItems.find(i => i.id === item.inventory_item_id) : null) ||
                     invItems.find(i => item.sku && i.sku === item.sku);
      if (target) {
        target.quantity -= item.quantity;
      }
    });

    // Commit updated inventory
    invItems.forEach(item => {
      safeBatchSet(batch, doc(db, 'users', uid, 'inventory', item.id), item);
    });

    memoryCache.sales = memoryCache.sales.map(s => s.id === id ? fullSale : s);
    memoryCache.inventory = invItems;
    dispatch('bizflow_sales_updated');
    dispatch('bizflow_inventory_updated');

    await batch.commit();
  },

  // Purchases (with atomic stock addition in Firestore)
  getPurchases: (): Purchase[] => {
    return memoryCache.purchases;
  },
  addPurchase: async (purchase: Purchase): Promise<void> => {
    const uid = getUid();
    const id = purchase.id || `pur_${Date.now()}`;
    const fullPurchase = { ...purchase, id, user_id: uid };

    const batch = writeBatch(db);
    safeBatchSet(batch, doc(db, 'users', uid, 'purchases', id), fullPurchase);

    const invItems = [...memoryCache.inventory];
    const targetSupplierId = purchase.supplier_id || '';

    purchase.items.forEach(purchasedItem => {
      let targetItem = (purchasedItem.inventory_item_id ? invItems.find(i => i.id === purchasedItem.inventory_item_id) : null) ||
                       invItems.find(i => purchasedItem.sku && i.sku === purchasedItem.sku && (i.supplier_id || '') === targetSupplierId) ||
                       invItems.find(i => purchasedItem.sku && i.sku === purchasedItem.sku && (!i.supplier_id || i.supplier_id === ''));

      if (!targetItem && purchasedItem.sku) {
        targetItem = invItems.find(i => i.sku === purchasedItem.sku);
      }

      if (targetItem) {
        if ((!targetItem.supplier_id || targetItem.supplier_id === '') && targetSupplierId) {
          targetItem.supplier_id = targetSupplierId;
        }
        const currentQty = targetItem.quantity || 0;
        const addQty = purchasedItem.quantity || 0;
        const totalQty = currentQty + addQty;
        const newTotalCost = (currentQty * (targetItem.cost_price || 0)) + (addQty * (purchasedItem.unit_price || 0));
        targetItem.quantity = totalQty;
        targetItem.cost_price = totalQty > 0 ? newTotalCost / totalQty : (purchasedItem.unit_price || targetItem.cost_price);
        purchasedItem.inventory_item_id = targetItem.id;
        safeBatchSet(batch, doc(db, 'users', uid, 'inventory', targetItem.id), targetItem);
      } else {
        const newItem: InventoryItem = {
          id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          user_id: uid,
          name: purchasedItem.item_name || 'Product',
          sku: purchasedItem.sku || `SKU-${Date.now().toString().slice(-6)}`,
          supplier_id: targetSupplierId,
          quantity: purchasedItem.quantity || 0,
          cost_price: purchasedItem.unit_price || 0,
          unit_price: purchasedItem.default_sales_price || purchasedItem.unit_price || 0,
          mrp: purchasedItem.default_sales_price || purchasedItem.unit_price || 0,
          category: 'General',
          unit: 'pcs',
          min_stock_level: 5,
          manage_stock: true,
          created_at: new Date().toISOString()
        };
        invItems.push(newItem);
        purchasedItem.inventory_item_id = newItem.id;
        safeBatchSet(batch, doc(db, 'users', uid, 'inventory', newItem.id), newItem);
      }
    });

    memoryCache.purchases = [fullPurchase, ...memoryCache.purchases.filter(p => p.id !== id)];
    memoryCache.inventory = invItems;
    dispatch('bizflow_purchases_updated', fullPurchase);
    dispatch('bizflow_inventory_updated');

    await batch.commit();

    const supplier = memoryCache.suppliers.find(s => s.id === fullPurchase.supplier_id);
    const supName = supplier?.name || (fullPurchase as any).supplier_name || 'Supplier';
    storageService.logActivity({
      category: 'purchases',
      action_type: 'purchase_created',
      title: `Created Purchase Bill #${fullPurchase.id.slice(-6).toUpperCase()}`,
      description: `Supplier: ${supName} • Items: ${fullPurchase.items.length} • Total: ৳${fullPurchase.total_amount}`,
      entity_id: fullPurchase.id,
      entity_name: `Bill #${fullPurchase.id.slice(-6).toUpperCase()}`,
      amount: fullPurchase.total_amount,
      metadata: {
        supplier_name: supName,
        items_count: fullPurchase.items.length
      }
    });
  },
  deletePurchase: async (id: string): Promise<void> => {
    const uid = getUid();
    const purchaseToDelete = memoryCache.purchases.find(p => p.id === id);
    if (purchaseToDelete) {
      const supplier = memoryCache.suppliers.find(s => s.id === purchaseToDelete.supplier_id);
      await storageService.moveToTrash('purchase', purchaseToDelete, `Purchase #${purchaseToDelete.id.slice(-6).toUpperCase()}`, `Total: ৳${purchaseToDelete.total_amount} • Supplier: ${supplier?.name || 'N/A'}`);
    }

    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', uid, 'purchases', id));

    const invItems = [...memoryCache.inventory];
    if (purchaseToDelete && Array.isArray(purchaseToDelete.items)) {
      const oldSupplierId = purchaseToDelete.supplier_id || '';
      purchaseToDelete.items.forEach(item => {
        let target = (item.inventory_item_id ? invItems.find(i => i.id === item.inventory_item_id) : null) ||
                     invItems.find(i => item.sku && i.sku === item.sku && (i.supplier_id || '') === oldSupplierId);

        if (!target || (target.quantity < (item.quantity || 0) && invItems.some(i => i.sku === item.sku && i.quantity >= (item.quantity || 0)))) {
          target = invItems.find(i => item.sku && i.sku === item.sku && i.quantity >= (item.quantity || 0)) ||
                   invItems.find(i => item.sku && i.sku === item.sku) ||
                   target;
        }

        if (target) {
          target.quantity = Math.max(0, (target.quantity || 0) - (item.quantity || 0));
          safeBatchSet(batch, doc(db, 'users', uid, 'inventory', target.id), target);
        }
      });
    }

    memoryCache.purchases = memoryCache.purchases.filter(p => p.id !== id);
    memoryCache.inventory = invItems;
    dispatch('bizflow_purchases_updated');
    dispatch('bizflow_inventory_updated');

    await batch.commit();
  },
  updatePurchase: async (id: string, updatedPurchase: Purchase): Promise<void> => {
    const uid = getUid();
    const oldPurchase = memoryCache.purchases.find(p => p.id === id);
    const fullPurchase = { ...updatedPurchase, id, user_id: uid };

    const batch = writeBatch(db);
    safeBatchSet(batch, doc(db, 'users', uid, 'purchases', id), fullPurchase);

    const invItems = [...memoryCache.inventory];
    const targetSupplierId = updatedPurchase.supplier_id || '';

    // Map item changes by inventory item / SKU / name
    const itemMap = new Map<string, {
      oldQty: number;
      oldPrice: number;
      newQty: number;
      newPrice: number;
      sku: string;
      name: string;
      defaultSalesPrice: number;
      inventoryItemId?: string;
    }>();

    // 1. Collect old purchase quantities
    if (oldPurchase && Array.isArray(oldPurchase.items)) {
      oldPurchase.items.forEach(oldItem => {
        const key = oldItem.inventory_item_id || (oldItem.sku && oldItem.sku.trim()) || oldItem.item_name || 'unknown';
        const existing = itemMap.get(key) || {
          oldQty: 0,
          oldPrice: oldItem.unit_price || 0,
          newQty: 0,
          newPrice: 0,
          sku: oldItem.sku || '',
          name: oldItem.item_name || '',
          defaultSalesPrice: oldItem.default_sales_price || 0,
          inventoryItemId: oldItem.inventory_item_id
        };
        existing.oldQty += (oldItem.quantity || 0);
        existing.oldPrice = oldItem.unit_price || 0;
        if (oldItem.inventory_item_id) existing.inventoryItemId = oldItem.inventory_item_id;
        if (oldItem.sku) existing.sku = oldItem.sku;
        itemMap.set(key, existing);
      });
    }

    // 2. Collect new purchase quantities
    if (Array.isArray(updatedPurchase.items)) {
      updatedPurchase.items.forEach(newItem => {
        const key = newItem.inventory_item_id || (newItem.sku && newItem.sku.trim()) || newItem.item_name || 'unknown';
        const existing = itemMap.get(key) || {
          oldQty: 0,
          oldPrice: 0,
          newQty: 0,
          newPrice: newItem.unit_price || 0,
          sku: newItem.sku || '',
          name: newItem.item_name || '',
          defaultSalesPrice: newItem.default_sales_price || 0,
          inventoryItemId: newItem.inventory_item_id
        };
        existing.newQty += (newItem.quantity || 0);
        existing.newPrice = newItem.unit_price || 0;
        if (newItem.default_sales_price) existing.defaultSalesPrice = newItem.default_sales_price;
        if (newItem.inventory_item_id) existing.inventoryItemId = newItem.inventory_item_id;
        if (newItem.sku) existing.sku = newItem.sku;
        itemMap.set(key, existing);
      });
    }

    // 3. Apply net delta changes cleanly to inventory items
    itemMap.forEach((entry) => {
      const deltaQty = entry.newQty - entry.oldQty;

      let targetItem = (entry.inventoryItemId ? invItems.find(i => i.id === entry.inventoryItemId) : null) ||
                       invItems.find(i => entry.sku && i.sku === entry.sku && (i.supplier_id || '') === targetSupplierId) ||
                       invItems.find(i => entry.sku && i.sku === entry.sku && (!i.supplier_id || i.supplier_id === '')) ||
                       (entry.sku ? invItems.find(i => i.sku === entry.sku) : null) ||
                       (entry.name ? invItems.find(i => i.name && i.name.trim().toLowerCase() === entry.name.trim().toLowerCase()) : null);

      if (targetItem) {
        if ((!targetItem.supplier_id || targetItem.supplier_id === '') && targetSupplierId) {
          targetItem.supplier_id = targetSupplierId;
        }

        const currentQty = targetItem.quantity || 0;
        const newStock = Math.max(0, currentQty + deltaQty);
        targetItem.quantity = newStock;

        // Recalculate cost price if new purchase price is provided
        if (entry.newQty > 0 && entry.newPrice > 0) {
          if (newStock > 0) {
            const currentCost = targetItem.cost_price || entry.newPrice;
            const preExistingQty = Math.max(0, currentQty - entry.oldQty);
            const totalCostValue = (preExistingQty * currentCost) + (entry.newQty * entry.newPrice);
            const totalStock = preExistingQty + entry.newQty;
            targetItem.cost_price = totalStock > 0 ? (totalCostValue / totalStock) : entry.newPrice;
          } else {
            targetItem.cost_price = entry.newPrice;
          }
        }

        // Link back to updated purchase items
        if (Array.isArray(updatedPurchase.items)) {
          updatedPurchase.items.forEach(pi => {
            if ((pi.sku && pi.sku === targetItem?.sku) || (pi.item_name && targetItem?.name && pi.item_name.trim().toLowerCase() === targetItem.name.trim().toLowerCase()) || pi.inventory_item_id === targetItem?.id) {
              pi.inventory_item_id = targetItem.id;
            }
          });
        }
      } else if (entry.newQty > 0) {
        const newItem: InventoryItem = {
          id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          user_id: uid,
          name: entry.name || 'Product',
          sku: entry.sku || `SKU-${Date.now().toString().slice(-6)}`,
          supplier_id: targetSupplierId,
          quantity: entry.newQty,
          cost_price: entry.newPrice || 0,
          unit_price: entry.defaultSalesPrice || entry.newPrice || 0,
          mrp: entry.defaultSalesPrice || entry.newPrice || 0,
          category: 'General',
          unit: 'pcs',
          min_stock_level: 5,
          manage_stock: true,
          created_at: new Date().toISOString()
        };
        invItems.push(newItem);

        if (Array.isArray(updatedPurchase.items)) {
          updatedPurchase.items.forEach(pi => {
            if (pi.sku === newItem.sku || (pi.item_name && pi.item_name.trim().toLowerCase() === newItem.name.trim().toLowerCase())) {
              pi.inventory_item_id = newItem.id;
            }
          });
        }
      }
    });

    invItems.forEach(item => {
      safeBatchSet(batch, doc(db, 'users', uid, 'inventory', item.id), item);
    });

    memoryCache.purchases = memoryCache.purchases.map(p => p.id === id ? fullPurchase : p);
    memoryCache.inventory = invItems;
    dispatch('bizflow_purchases_updated');
    dispatch('bizflow_inventory_updated');

    await batch.commit();
  },
  // Reconcile and audit inventory stock based on Purchase Orders and Sales
  reconcileInventoryStock: async (): Promise<{ reconciledCount: number }> => {
    const uid = getUid();
    const invItems = [...memoryCache.inventory];
    const purchases = memoryCache.purchases || [];
    const sales = memoryCache.sales || [];

    const batch = writeBatch(db);
    let reconciledCount = 0;

    invItems.forEach(item => {
      // Find total purchased for this specific item across all matching PO items
      let totalPurchased = 0;
      let totalPurchaseAmount = 0;
      purchases.forEach(p => {
        if (Array.isArray(p.items)) {
          p.items.forEach(pi => {
            const matches = (pi.inventory_item_id && pi.inventory_item_id === item.id) ||
                            (Boolean(item.sku && pi.sku && pi.sku.trim().toLowerCase() === item.sku.trim().toLowerCase())) ||
                            (Boolean(item.name && pi.item_name && pi.item_name.trim().toLowerCase() === item.name.trim().toLowerCase()));
            if (matches) {
              totalPurchased += (pi.quantity || 0);
              totalPurchaseAmount += ((pi.quantity || 0) * (pi.unit_price || 0));
            }
          });
        }
      });

      // Find total sold for this specific item across all matching Sale items
      let totalSold = 0;
      sales.forEach(s => {
        if (Array.isArray(s.items)) {
          s.items.forEach(si => {
            const matches = (si.inventory_item_id && si.inventory_item_id === item.id) ||
                            (Boolean(item.sku && si.sku && si.sku.trim().toLowerCase() === item.sku.trim().toLowerCase())) ||
                            (Boolean(item.name && si.item_name && si.item_name.trim().toLowerCase() === item.name.trim().toLowerCase()));
            if (matches) {
              totalSold += (si.quantity || 0);
            }
          });
        }
      });

      // If product has purchase orders recorded, reconcile available stock accurately
      if (totalPurchased > 0) {
        const expectedStock = Math.max(0, totalPurchased - totalSold);
        const avgCost = totalPurchaseAmount / totalPurchased;
        let changed = false;

        if (item.quantity !== expectedStock) {
          item.quantity = expectedStock;
          changed = true;
        }
        if (avgCost > 0 && Math.abs((item.cost_price || 0) - avgCost) > 0.001) {
          item.cost_price = avgCost;
          changed = true;
        }

        if (changed) {
          reconciledCount++;
          safeBatchSet(batch, doc(db, 'users', uid, 'inventory', item.id), item);
        }
      }
    });

    if (reconciledCount > 0) {
      memoryCache.inventory = invItems;
      dispatch('bizflow_inventory_updated');
      await batch.commit();
    }

    return { reconciledCount };
  },

  // Customers
  getCustomers: (): Customer[] => {
    return memoryCache.customers;
  },
  addCustomer: async (customer: Customer): Promise<void> => {
    const uid = getUid();
    const id = customer.id || `cust_${Date.now()}`;
    const newCust = { ...customer, id, user_id: uid };
    memoryCache.customers = [...memoryCache.customers.filter(c => c.id !== id), newCust];
    dispatch('bizflow_customers_updated');
    await safeSetDoc(doc(db, 'users', uid, 'customers', id), newCust);
    storageService.logActivity({
      category: 'customers',
      action_type: 'customer_created',
      title: `Added Customer: ${newCust.name}`,
      description: `Phone: ${newCust.phone || 'N/A'}${newCust.opening_due ? ` • Opening Due: ৳${newCust.opening_due}` : ''}`,
      entity_id: id,
      entity_name: newCust.name,
      amount: newCust.opening_due
    });
  },
  updateCustomer: async (id: string, updatedCustomer: Customer): Promise<void> => {
    const uid = getUid();
    const full = { ...updatedCustomer, id, user_id: uid };
    memoryCache.customers = memoryCache.customers.map(c => c.id === id ? full : c);
    dispatch('bizflow_customers_updated');
    await safeSetDoc(doc(db, 'users', uid, 'customers', id), full);
  },
  deleteCustomer: async (id: string): Promise<void> => {
    const uid = getUid();
    const cust = memoryCache.customers.find(c => c.id === id);
    if (cust) {
      await storageService.moveToTrash('customer', cust, cust.name, `Phone: ${cust.phone || 'N/A'} • Email: ${cust.email || 'N/A'}`);
    }
    memoryCache.customers = memoryCache.customers.filter(c => c.id !== id);
    dispatch('bizflow_customers_updated');
    await deleteDoc(doc(db, 'users', uid, 'customers', id));
  },

  // Expenses & Expense Categories
  getExpenseCategories: (): string[] => {
    return memoryCache.expenseCategories;
  },
  saveExpenseCategories: async (categories: string[]): Promise<void> => {
    memoryCache.expenseCategories = categories;
    dispatch('bizflow_expense_categories_updated');
    const uid = getUid();
    await safeSetDoc(doc(db, 'users', uid, 'settings', 'expense_categories'), { categories });
  },
  addExpenseCategory: async (categoryName: string): Promise<void> => {
    const name = categoryName.trim();
    if (!name) return;
    const cats = memoryCache.expenseCategories;
    if (!cats.some(c => c.toLowerCase() === name.toLowerCase())) {
      const updated = [...cats, name];
      await storageService.saveExpenseCategories(updated);
    }
  },
  renameExpenseCategory: async (oldName: string, newName: string): Promise<void> => {
    const trimmedNew = newName.trim();
    if (!trimmedNew) return;
    const cats = memoryCache.expenseCategories;
    const updatedCats = cats.map(c => c === oldName ? trimmedNew : c);
    await storageService.saveExpenseCategories(updatedCats);

    // Update all existing expenses with this category
    const uid = getUid();
    const batch = writeBatch(db);
    let modified = false;
    const updatedExpenses = memoryCache.expenses.map(e => {
      if (e.category === oldName) {
        modified = true;
        const updated = { ...e, category: trimmedNew };
        safeBatchSet(batch, doc(db, 'users', uid, 'expenses', e.id), updated);
        return updated;
      }
      return e;
    });
    if (modified) {
      memoryCache.expenses = updatedExpenses;
      dispatch('bizflow_expenses_updated');
      await batch.commit();
    }
  },
  deleteExpenseCategory: async (categoryName: string): Promise<void> => {
    const cats = memoryCache.expenseCategories;
    const updatedCats = cats.filter(c => c !== categoryName);
    await storageService.saveExpenseCategories(updatedCats);
  },
  getExpenses: (): Expense[] => {
    return memoryCache.expenses.map(e => ({
      ...e,
      category: (e.category || '').replace(/\s*\([\u0980-\u09FF\s]+\)/g, '').replace(/[\u0980-\u09FF]/g, '').trim() || 'Miscellaneous',
      payment_method: (e.payment_method || 'Cash').replace(/\s*\([\u0980-\u09FF\s]+\)/g, '').replace(/[\u0980-\u09FF]/g, '').trim() || 'Cash',
      description: (e.description || '').replace(/\s*\([\u0980-\u09FF\s]+\)/g, '').replace(/[\u0980-\u09FF]/g, '').trim()
    }));
  },
  addExpense: async (expense: Expense): Promise<void> => {
    const uid = getUid();
    const id = expense.id || `exp_${Date.now()}`;
    const full = { ...expense, id, user_id: uid };
    memoryCache.expenses = [full, ...memoryCache.expenses.filter(e => e.id !== id)];
    dispatch('bizflow_expenses_updated', full);
    await safeSetDoc(doc(db, 'users', uid, 'expenses', id), full);
    storageService.logActivity({
      category: 'expenses',
      action_type: 'expense_created',
      title: `Expense: ${full.category}`,
      description: `Amount: ৳${full.amount}${full.description ? ` • ${full.description}` : ''} • Method: ${full.payment_method || 'Cash'}`,
      entity_id: id,
      entity_name: full.category,
      amount: full.amount
    });
  },
  updateExpense: async (id: string, updatedExpense: Expense): Promise<void> => {
    const uid = getUid();
    const full = { ...updatedExpense, id, user_id: uid };
    memoryCache.expenses = memoryCache.expenses.map(e => e.id === id ? full : e);
    dispatch('bizflow_expenses_updated');
    await safeSetDoc(doc(db, 'users', uid, 'expenses', id), full);
  },
  deleteExpense: async (id: string): Promise<void> => {
    const uid = getUid();
    const exp = memoryCache.expenses.find(e => e.id === id);
    if (exp) {
      await storageService.moveToTrash('expense', exp, exp.category, `Amount: ${exp.amount} • Date: ${exp.date}`);
    }
    memoryCache.expenses = memoryCache.expenses.filter(e => e.id !== id);
    dispatch('bizflow_expenses_updated');
    await deleteDoc(doc(db, 'users', uid, 'expenses', id));
  },

  // Loans & Borrowing Management
  getLoans: (): Loan[] => {
    return memoryCache.loans;
  },
  addLoan: async (loan: Loan): Promise<void> => {
    const uid = getUid();
    const id = loan.id || `loan_${Date.now()}`;
    const full = { ...loan, id, user_id: uid };
    memoryCache.loans = [full, ...memoryCache.loans.filter(l => l.id !== id)];
    dispatch('bizflow_loans_updated');
    await safeSetDoc(doc(db, 'users', uid, 'loans', id), full);
  },
  updateLoan: async (id: string, updatedLoan: Loan): Promise<void> => {
    const uid = getUid();
    const full = { ...updatedLoan, id, user_id: uid };
    memoryCache.loans = memoryCache.loans.map(l => l.id === id ? full : l);
    dispatch('bizflow_loans_updated');
    await safeSetDoc(doc(db, 'users', uid, 'loans', id), full);
  },
  deleteLoan: async (id: string): Promise<void> => {
    const uid = getUid();
    const loan = memoryCache.loans.find(l => l.id === id);
    if (loan) {
      await storageService.moveToTrash('loan', loan, loan.title, `Lender: ${loan.lender_name} • Amount: ${loan.principal_amount}`);
    }
    memoryCache.loans = memoryCache.loans.filter(l => l.id !== id);
    dispatch('bizflow_loans_updated');
    await deleteDoc(doc(db, 'users', uid, 'loans', id));
  },
  addLoanRepayment: async (loanId: string, repayment: LoanRepayment): Promise<void> => {
    const uid = getUid();
    const loan = memoryCache.loans.find(l => l.id === loanId);
    if (loan) {
      const existingRepayments = loan.repayments || [];
      const updatedRepayments = [repayment, ...existingRepayments];
      const newTotalPaid = updatedRepayments.reduce((sum, r) => sum + r.amount, 0);
      const newRemaining = Math.max(0, loan.total_payable - newTotalPaid);
      const newStatus = newRemaining <= 0 ? 'paid' : loan.status;

      const updatedLoan: Loan = {
        ...loan,
        repayments: updatedRepayments,
        total_paid: newTotalPaid,
        remaining_amount: newRemaining,
        status: newStatus
      };

      memoryCache.loans = memoryCache.loans.map(l => l.id === loanId ? updatedLoan : l);
      dispatch('bizflow_loans_updated');
      await safeSetDoc(doc(db, 'users', uid, 'loans', loanId), updatedLoan);
    }
  },
  deleteLoanRepayment: async (loanId: string, repaymentId: string): Promise<void> => {
    const uid = getUid();
    const loan = memoryCache.loans.find(l => l.id === loanId);
    if (loan && loan.repayments) {
      const updatedRepayments = loan.repayments.filter(r => r.id !== repaymentId);
      const newTotalPaid = updatedRepayments.reduce((sum, r) => sum + r.amount, 0);
      const newRemaining = Math.max(0, loan.total_payable - newTotalPaid);
      const newStatus = newRemaining <= 0 ? 'paid' : 'active';

      const updatedLoan: Loan = {
        ...loan,
        repayments: updatedRepayments,
        total_paid: newTotalPaid,
        remaining_amount: newRemaining,
        status: newStatus
      };

      memoryCache.loans = memoryCache.loans.map(l => l.id === loanId ? updatedLoan : l);
      dispatch('bizflow_loans_updated');
      await safeSetDoc(doc(db, 'users', uid, 'loans', loanId), updatedLoan);
    }
  },

  // Investments
  getInvestments: (): Investment[] => {
    return memoryCache.investments;
  },
  addInvestment: async (investment: Investment): Promise<void> => {
    const uid = getUid();
    const id = investment.id || `inv_${Date.now()}`;
    const full = { ...investment, id };
    memoryCache.investments = [full, ...memoryCache.investments.filter(i => i.id !== id)];
    dispatch('bizflow_investments_updated');
    await safeSetDoc(doc(db, 'users', uid, 'investments', id), full);
  },
  updateInvestment: async (id: string, updatedInvestment: Investment): Promise<void> => {
    const uid = getUid();
    const full = { ...updatedInvestment, id };
    memoryCache.investments = memoryCache.investments.map(i => i.id === id ? full : i);
    dispatch('bizflow_investments_updated');
    await safeSetDoc(doc(db, 'users', uid, 'investments', id), full);
  },
  deleteInvestment: async (id: string): Promise<void> => {
    const uid = getUid();
    const inv = memoryCache.investments.find(i => i.id === id);
    if (inv) {
      await storageService.moveToTrash('investment', inv, inv.source, `Amount: ${inv.amount} • Date: ${inv.date}`);
    }
    memoryCache.investments = memoryCache.investments.filter(i => i.id !== id);
    dispatch('bizflow_investments_updated');
    await deleteDoc(doc(db, 'users', uid, 'investments', id));
  },

  // User Profile Settings
  getUserProfile: (): UserProfileSettings => {
    return memoryCache.userProfile;
  },
  saveUserProfile: async (profile: UserProfileSettings): Promise<void> => {
    memoryCache.userProfile = profile;
    dispatch('bizflow_user_profile_updated', profile);
    const uid = getUid();
    await safeSetDoc(doc(db, 'users', uid, 'settings', 'profile'), profile);
  },

  // Notification Settings
  getNotificationSettings: (): NotificationSettings => {
    return memoryCache.notifications;
  },
  saveNotificationSettings: async (settings: NotificationSettings): Promise<void> => {
    memoryCache.notifications = settings;
    const uid = getUid();
    await safeSetDoc(doc(db, 'users', uid, 'settings', 'notifications'), settings);
  },

  // Due Payments & Collections
  getDuePayments: (): DuePayment[] => {
    return memoryCache.duePayments;
  },
  addDuePayment: async (payment: DuePayment): Promise<void> => {
    const uid = getUid();
    const id = payment.id || `due_pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullPayment: DuePayment = {
      ...payment,
      id,
      user_id: uid,
      created_at: payment.created_at || new Date().toISOString()
    };

    const batch = writeBatch(db);
    safeBatchSet(batch, doc(db, 'users', uid, 'due_payments', id), fullPayment);

    // If customer collection:
    if (fullPayment.type === 'customer_collection') {
      const sales = [...memoryCache.sales];
      let remainingToAllocate = fullPayment.amount;

      if (fullPayment.sale_id) {
        const saleIndex = sales.findIndex(s => s.id === fullPayment.sale_id);
        if (saleIndex !== -1) {
          const s = sales[saleIndex];
          const curDue = s.due_amount !== undefined ? s.due_amount : (s.payment_method === 'due' ? s.total_amount : 0);
          const deduct = Math.min(curDue, remainingToAllocate);
          const newDue = Math.max(0, curDue - deduct);
          const curPaid = s.paid_amount !== undefined ? s.paid_amount : (s.payment_method === 'cash' ? s.total_amount : 0);
          const newPaid = curPaid + deduct;
          const updatedSale: Sale = {
            ...s,
            due_amount: newDue,
            paid_amount: newPaid,
            cash_received: newPaid,
            status: newDue === 0 ? 'completed' : s.status
          };
          sales[saleIndex] = updatedSale;
          safeBatchSet(batch, doc(db, 'users', uid, 'sales', s.id), updatedSale);
          remainingToAllocate -= deduct;
        }
      }

      // If no specific sale or amount still remains, allocate to this customer's oldest sales with due
      if (remainingToAllocate > 0 && fullPayment.party_id) {
        const custSales = sales
          .filter(s => s.customer_id === fullPayment.party_id)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        for (const s of custSales) {
          if (remainingToAllocate <= 0) break;
          const curDue = s.due_amount !== undefined ? s.due_amount : (s.payment_method === 'due' ? s.total_amount : 0);
          if (curDue > 0) {
            const deduct = Math.min(curDue, remainingToAllocate);
            const newDue = Math.max(0, curDue - deduct);
            const curPaid = s.paid_amount !== undefined ? s.paid_amount : (s.payment_method === 'cash' ? s.total_amount : 0);
            const newPaid = curPaid + deduct;
            const updatedSale: Sale = {
              ...s,
              due_amount: newDue,
              paid_amount: newPaid,
              cash_received: newPaid,
              status: newDue === 0 ? 'completed' : s.status
            };
            const idx = sales.findIndex(item => item.id === s.id);
            if (idx !== -1) sales[idx] = updatedSale;
            safeBatchSet(batch, doc(db, 'users', uid, 'sales', s.id), updatedSale);
            remainingToAllocate -= deduct;
          }
        }
      }

      memoryCache.sales = sales;
      dispatch('bizflow_sales_updated');
    }

    // If supplier payment:
    if (fullPayment.type === 'supplier_payment') {
      const purchases = [...memoryCache.purchases];
      let remainingToAllocate = fullPayment.amount;

      if (fullPayment.purchase_id) {
        const pIndex = purchases.findIndex(p => p.id === fullPayment.purchase_id);
        if (pIndex !== -1) {
          const p = purchases[pIndex];
          const updatedPurchase: Purchase = {
            ...p,
            payment_method: 'cash',
            status: 'completed'
          };
          purchases[pIndex] = updatedPurchase;
          safeBatchSet(batch, doc(db, 'users', uid, 'purchases', p.id), updatedPurchase);
        }
      } else if (fullPayment.party_id) {
        const suppPurchases = purchases
          .filter(p => p.supplier_id === fullPayment.party_id && (p.payment_method === 'due' || p.status === 'pending'))
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        for (const p of suppPurchases) {
          if (remainingToAllocate <= 0) break;
          const updatedPurchase: Purchase = {
            ...p,
            payment_method: 'cash',
            status: 'completed'
          };
          const idx = purchases.findIndex(item => item.id === p.id);
          if (idx !== -1) purchases[idx] = updatedPurchase;
          safeBatchSet(batch, doc(db, 'users', uid, 'purchases', p.id), updatedPurchase);
          remainingToAllocate -= p.total_amount;
        }
      }

      memoryCache.purchases = purchases;
      dispatch('bizflow_purchases_updated');
    }

    memoryCache.duePayments = [fullPayment, ...memoryCache.duePayments.filter(p => p.id !== id)];
    dispatch('bizflow_due_payments_updated', fullPayment);

    await batch.commit();

    const isCust = fullPayment.type === 'customer_collection';
    storageService.logActivity({
      category: 'dues',
      action_type: isCust ? 'due_collected' : 'due_paid',
      title: isCust ? `Due Collection: ${fullPayment.party_name}` : `Due Paid: ${fullPayment.party_name}`,
      description: `Amount: ৳${fullPayment.amount} • Method: ${(fullPayment.payment_method || 'Cash').toUpperCase()}${fullPayment.note ? ` • Note: ${fullPayment.note}` : ''}`,
      entity_id: fullPayment.id,
      entity_name: fullPayment.party_name,
      amount: fullPayment.amount,
      metadata: {
        party_name: fullPayment.party_name,
        party_type: fullPayment.party_type,
        payment_method: fullPayment.payment_method,
        note: fullPayment.note
      }
    });
  },

  deleteDuePayment: async (id: string): Promise<void> => {
    const uid = getUid();
    const payment = memoryCache.duePayments.find(p => p.id === id);
    const batch = writeBatch(db);

    if (payment) {
      if (payment.type === 'customer_collection') {
        const sales = [...memoryCache.sales];
        let remainingToRestore = payment.amount;

        // If specific sale_id was linked
        if (payment.sale_id) {
          const sIdx = sales.findIndex(s => s.id === payment.sale_id);
          if (sIdx !== -1) {
            const s = sales[sIdx];
            const toAdd = Math.min(s.paid_amount || 0, remainingToRestore);
            const updatedSale: Sale = {
              ...s,
              due_amount: (s.due_amount || 0) + toAdd,
              paid_amount: Math.max(0, (s.paid_amount || 0) - toAdd),
              cash_received: Math.max(0, (s.paid_amount || 0) - toAdd),
              status: ((s.due_amount || 0) + toAdd) > 0 ? 'pending' : s.status
            };
            sales[sIdx] = updatedSale;
            safeBatchSet(batch, doc(db, 'users', uid, 'sales', s.id), updatedSale);
            remainingToRestore -= toAdd;
          }
        } else if (payment.party_id && remainingToRestore > 0) {
          // Restore to customer's newest sales first
          const custSales = sales
            .filter(s => s.customer_id === payment.party_id)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

          for (const s of custSales) {
            if (remainingToRestore <= 0) break;
            const paid = s.paid_amount || 0;
            if (paid > 0) {
              const toAdd = Math.min(paid, remainingToRestore);
              const updatedSale: Sale = {
                ...s,
                due_amount: (s.due_amount || 0) + toAdd,
                paid_amount: Math.max(0, paid - toAdd),
                cash_received: Math.max(0, paid - toAdd),
                status: 'pending'
              };
              const idx = sales.findIndex(item => item.id === s.id);
              if (idx !== -1) sales[idx] = updatedSale;
              safeBatchSet(batch, doc(db, 'users', uid, 'sales', s.id), updatedSale);
              remainingToRestore -= toAdd;
            }
          }
        }

        memoryCache.sales = sales;
        dispatch('bizflow_sales_updated');
      } else if (payment.type === 'supplier_payment') {
        const purchases = [...memoryCache.purchases];
        if (payment.purchase_id) {
          const pIdx = purchases.findIndex(p => p.id === payment.purchase_id);
          if (pIdx !== -1) {
            const p = purchases[pIdx];
            const updatedPurchase: Purchase = {
              ...p,
              payment_method: 'due',
              status: 'pending'
            };
            purchases[pIdx] = updatedPurchase;
            safeBatchSet(batch, doc(db, 'users', uid, 'purchases', p.id), updatedPurchase);
          }
        }
        memoryCache.purchases = purchases;
        dispatch('bizflow_purchases_updated');
      }
    }

    memoryCache.duePayments = memoryCache.duePayments.filter(p => p.id !== id);
    dispatch('bizflow_due_payments_updated');

    try {
      batch.delete(doc(db, 'users', uid, 'due_payments', id));
      await batch.commit();
    } catch (err) {
      console.warn('Batch commit failed during deleteDuePayment, falling back to deleteDoc:', err);
      try {
        await deleteDoc(doc(db, 'users', uid, 'due_payments', id));
      } catch (e) {
        console.error('deleteDoc error for due payment:', e);
      }
    }
  },

  // Full Database Backup & Restore
  exportAllData: () => {
    return {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      inventory: memoryCache.inventory,
      sales: memoryCache.sales,
      purchases: memoryCache.purchases,
      suppliers: memoryCache.suppliers,
      customers: memoryCache.customers,
      expenses: memoryCache.expenses,
      expenseCategories: memoryCache.expenseCategories,
      loans: memoryCache.loans,
      investments: memoryCache.investments,
      brands: memoryCache.brands,
      categories: memoryCache.categories,
      subCategories: memoryCache.subCategories,
      businessSettings: memoryCache.businessSettings,
      userProfile: memoryCache.userProfile,
      notifications: memoryCache.notifications,
      duePayments: memoryCache.duePayments
    };
  },

  importAllData: async (data: any): Promise<void> => {
    if (!data) throw new Error('Invalid backup data');
    const uid = getUid();

    if (Array.isArray(data.inventory)) await storageService.saveInventory(data.inventory);
    if (Array.isArray(data.brands)) {
      for (const b of data.brands) await storageService.addBrand(b);
    }
    if (Array.isArray(data.categories)) {
      for (const c of data.categories) await storageService.addCategory(c);
    }
    if (Array.isArray(data.subCategories)) {
      for (const s of data.subCategories) await storageService.addSubCategory(s);
    }
    if (Array.isArray(data.suppliers)) {
      for (const s of data.suppliers) await storageService.addSupplier(s);
    }
    if (Array.isArray(data.customers)) {
      for (const c of data.customers) await storageService.addCustomer(c);
    }
    if (Array.isArray(data.sales)) {
      for (const s of data.sales) await safeSetDoc(doc(db, 'users', uid, 'sales', s.id), s);
    }
    if (Array.isArray(data.purchases)) {
      for (const p of data.purchases) await safeSetDoc(doc(db, 'users', uid, 'purchases', p.id), p);
    }
    if (Array.isArray(data.expenses)) {
      for (const e of data.expenses) await storageService.addExpense(e);
    }
    if (Array.isArray(data.duePayments)) {
      for (const dp of data.duePayments) await safeSetDoc(doc(db, 'users', uid, 'due_payments', dp.id), dp);
    }
    if (Array.isArray(data.expenseCategories)) {
      await storageService.saveExpenseCategories(data.expenseCategories);
    }
    if (Array.isArray(data.loans)) {
      for (const l of data.loans) await storageService.addLoan(l);
    }
    if (Array.isArray(data.investments)) {
      for (const i of data.investments) await storageService.addInvestment(i);
    }
    if (data.businessSettings) {
      await storageService.saveBusinessSettings(data.businessSettings);
    }
    if (data.userProfile) {
      await storageService.saveUserProfile(data.userProfile);
    }
    if (data.notifications) {
      await storageService.saveNotificationSettings(data.notifications);
    }
  },

  resetAllData: async (): Promise<void> => {
    const uid = getUid();
    const batch = writeBatch(db);

    memoryCache.inventory.forEach(i => batch.delete(doc(db, 'users', uid, 'inventory', i.id)));
    memoryCache.sales.forEach(s => batch.delete(doc(db, 'users', uid, 'sales', s.id)));
    memoryCache.purchases.forEach(p => batch.delete(doc(db, 'users', uid, 'purchases', p.id)));
    memoryCache.suppliers.forEach(s => batch.delete(doc(db, 'users', uid, 'suppliers', s.id)));
    memoryCache.customers.forEach(c => batch.delete(doc(db, 'users', uid, 'customers', c.id)));
    memoryCache.expenses.forEach(e => batch.delete(doc(db, 'users', uid, 'expenses', e.id)));
    memoryCache.loans.forEach(l => batch.delete(doc(db, 'users', uid, 'loans', l.id)));
    memoryCache.investments.forEach(i => batch.delete(doc(db, 'users', uid, 'investments', i.id)));
    memoryCache.brands.forEach(b => batch.delete(doc(db, 'users', uid, 'brands', b.id)));
    memoryCache.categories.forEach(c => batch.delete(doc(db, 'users', uid, 'categories', c.id)));
    memoryCache.subCategories.forEach(s => batch.delete(doc(db, 'users', uid, 'sub_categories', s.id)));

    memoryCache.inventory = [];
    memoryCache.sales = [];
    memoryCache.purchases = [];
    memoryCache.suppliers = [];
    memoryCache.customers = [];
    memoryCache.expenses = [];
    memoryCache.loans = [];
    memoryCache.investments = [];
    memoryCache.brands = [];
    memoryCache.categories = [];
    memoryCache.subCategories = [];

    dispatch('bizflow_inventory_updated');
    dispatch('bizflow_sales_updated');
    dispatch('bizflow_purchases_updated');
    dispatch('bizflow_suppliers_updated');
    dispatch('bizflow_customers_updated');
    dispatch('bizflow_expenses_updated');
    dispatch('bizflow_loans_updated');
    dispatch('bizflow_investments_updated');
    dispatch('bizflow_brands_updated');
    dispatch('bizflow_categories_updated');
    dispatch('bizflow_sub_categories_updated');

    await batch.commit();
  },

  // Trash / Recycle Bin
  getTrashItems: (): TrashItem[] => {
    return memoryCache.trash || [];
  },
  moveToTrash: async (itemType: TrashItem['item_type'], originalData: any, title: string, subtitle?: string): Promise<void> => {
    const uid = getUid();
    const id = `trash_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const trashItem: TrashItem = {
      id,
      user_id: uid,
      item_type: itemType,
      title,
      subtitle,
      original_data: originalData,
      deleted_at: new Date().toISOString()
    };
    memoryCache.trash = [trashItem, ...(memoryCache.trash || [])];
    dispatch('bizflow_trash_updated');
    await safeSetDoc(doc(db, 'users', uid, 'trash', id), cleanForFirestore(trashItem));
    storageService.logActivity({
      category: 'trash',
      action_type: 'trash_item_deleted',
      title: `Moved to Recycle Bin: ${title}`,
      description: `Item Type: ${itemType.toUpperCase()}${subtitle ? ` • ${subtitle}` : ''}`,
      entity_id: id,
      entity_name: title
    });
  },
  restoreTrashItem: async (id: string): Promise<void> => {
    const uid = getUid();
    const item = (memoryCache.trash || []).find(t => t.id === id);
    if (!item) return;

    if (item.item_type === 'product') {
      await storageService.addProduct(item.original_data);
    } else if (item.item_type === 'customer') {
      await storageService.addCustomer(item.original_data);
    } else if (item.item_type === 'supplier') {
      await storageService.addSupplier(item.original_data);
    } else if (item.item_type === 'expense') {
      await storageService.addExpense(item.original_data);
    } else if (item.item_type === 'loan') {
      await storageService.addLoan(item.original_data);
    } else if (item.item_type === 'investment') {
      await storageService.addInvestment(item.original_data);
    } else if (item.item_type === 'sale') {
      await storageService.addSale(item.original_data);
    } else if (item.item_type === 'purchase') {
      await storageService.addPurchase(item.original_data);
    } else if (item.item_type === 'brand') {
      await storageService.addBrand(item.original_data);
    } else if (item.item_type === 'category') {
      await storageService.addCategory(item.original_data);
    }

    memoryCache.trash = (memoryCache.trash || []).filter(t => t.id !== id);
    dispatch('bizflow_trash_updated');
    try {
      await deleteDoc(doc(db, 'users', uid, 'trash', id));
      storageService.logActivity({
        category: 'trash',
        action_type: `${item.item_type}_restored` as any,
        title: `Restored ${item.item_type}: ${item.title}`,
        description: `Restored item from Recycle Bin back to active records`,
        entity_id: item.id,
        entity_name: item.title
      });
    } catch (err) {
      console.warn('Failed to delete restored item from trash collection in Firestore:', err);
    }
  },
  deleteTrashItemPermanently: async (id: string): Promise<void> => {
    const uid = getUid();
    memoryCache.trash = (memoryCache.trash || []).filter(t => t.id !== id);
    dispatch('bizflow_trash_updated');
    try {
      await deleteDoc(doc(db, 'users', uid, 'trash', id));
    } catch (err) {
      console.warn('Failed to delete trash item doc from Firestore:', err);
    }
  },
  emptyTrash: async (): Promise<void> => {
    const uid = getUid();
    const list = [...(memoryCache.trash || [])];
    memoryCache.trash = [];
    dispatch('bizflow_trash_updated');
    try {
      for (let i = 0; i < list.length; i += 400) {
        const batch = writeBatch(db);
        const chunk = list.slice(i, i + 400);
        chunk.forEach(t => {
          batch.delete(doc(db, 'users', uid, 'trash', t.id));
        });
        await batch.commit();
      }
    } catch (err) {
      console.warn('Failed to batch-delete all trash items from Firestore:', err);
    }
  },

  // Activity Logs
  getActivityLogs: (): ActivityLog[] => {
    return memoryCache.activityLogs || [];
  },

  getAllActivities: (): ActivityLog[] => {
    const uid = activeUid || auth.currentUser?.uid || 'user';
    const clearedAt = memoryCache.logsClearedAt || (typeof localStorage !== 'undefined' ? Number(localStorage.getItem(`bizflow_logs_cleared_at_${uid}`)) || 0 : 0);

    // 1. Gather all logged activities
    const logged = [...(memoryCache.activityLogs || [])].filter(l => {
      const t = new Date(l.timestamp || l.date).getTime() || 0;
      return t > clearedAt;
    });
    const loggedEntityIds = new Set(logged.map(l => l.entity_id).filter(Boolean));

    // 2. Synthesize historical records if not already in logged activities
    const synthetic: ActivityLog[] = [];

    // A. Sales
    (memoryCache.sales || []).forEach(sale => {
      const d = new Date(sale.created_at || (sale as any).date || Date.now());
      if (d.getTime() > clearedAt && !loggedEntityIds.has(sale.id)) {
        const customer = (memoryCache.customers || []).find(c => c.id === sale.customer_id);
        const custName = customer?.name || (sale as any).customer_name || 'Walk-in Customer';
        synthetic.push({
          id: `synth_sale_${sale.id}`,
          user_id: uid,
          timestamp: sale.created_at || d.toISOString(),
          date: (sale.created_at || d.toISOString()).split('T')[0],
          time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          category: 'sales',
          action_type: 'sale_created',
          title: `Sales Invoice #${sale.id.slice(-6).toUpperCase()}`,
          description: `Customer: ${custName} • Items: ${sale.items?.length || 0} • Paid: ৳${sale.paid_amount || 0} (Total: ৳${sale.total_amount})`,
          entity_id: sale.id,
          entity_name: `Invoice #${sale.id.slice(-6).toUpperCase()}`,
          amount: sale.total_amount,
          metadata: {
            customer_name: custName,
            items_count: sale.items?.length || 0,
            paid_amount: sale.paid_amount,
            due_amount: sale.due_amount,
            payment_method: sale.payment_method
          }
        });
      }
    });

    // B. Purchases
    (memoryCache.purchases || []).forEach(purchase => {
      const d = new Date(purchase.created_at || (purchase as any).date || Date.now());
      if (d.getTime() > clearedAt && !loggedEntityIds.has(purchase.id)) {
        const supplier = (memoryCache.suppliers || []).find(s => s.id === purchase.supplier_id);
        const supName = supplier?.name || (purchase as any).supplier_name || 'Supplier';
        synthetic.push({
          id: `synth_pur_${purchase.id}`,
          user_id: uid,
          timestamp: purchase.created_at || d.toISOString(),
          date: (purchase.created_at || d.toISOString()).split('T')[0],
          time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          category: 'purchases',
          action_type: 'purchase_created',
          title: `Purchase Bill #${purchase.id.slice(-6).toUpperCase()}`,
          description: `Supplier: ${supName} • Items: ${purchase.items?.length || 0} • Total: ৳${purchase.total_amount}`,
          entity_id: purchase.id,
          entity_name: `Bill #${purchase.id.slice(-6).toUpperCase()}`,
          amount: purchase.total_amount,
          metadata: {
            supplier_name: supName,
            items_count: purchase.items?.length || 0
          }
        });
      }
    });

    // C. Expenses
    (memoryCache.expenses || []).forEach(expense => {
      const d = new Date(expense.date || expense.created_at || Date.now());
      if (d.getTime() > clearedAt && !loggedEntityIds.has(expense.id)) {
        synthetic.push({
          id: `synth_exp_${expense.id}`,
          user_id: uid,
          timestamp: expense.created_at || d.toISOString(),
          date: (expense.date || d.toISOString()).split('T')[0],
          time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          category: 'expenses',
          action_type: 'expense_created',
          title: `Expense: ${expense.category}`,
          description: `Amount: ৳${expense.amount}${expense.description ? ` • ${expense.description}` : ''}`,
          entity_id: expense.id,
          entity_name: expense.category,
          amount: expense.amount,
          metadata: {
            category: expense.category,
            payment_method: expense.payment_method
          }
        });
      }
    });

    // D. Due Payments
    (memoryCache.duePayments || []).forEach(due => {
      const d = new Date(due.payment_date || due.created_at || Date.now());
      if (d.getTime() > clearedAt && !loggedEntityIds.has(due.id)) {
        const isCust = due.type === 'customer_collection';
        synthetic.push({
          id: `synth_due_${due.id}`,
          user_id: uid,
          timestamp: due.created_at || d.toISOString(),
          date: (due.payment_date || d.toISOString()).split('T')[0],
          time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          category: 'dues',
          action_type: isCust ? 'due_collected' : 'due_paid',
          title: isCust ? `Due Collection: ${due.party_name}` : `Due Paid: ${due.party_name}`,
          description: `Amount: ৳${due.amount} • Method: ${(due.payment_method || 'Cash').toUpperCase()}`,
          entity_id: due.id,
          entity_name: due.party_name,
          amount: due.amount,
          metadata: {
            party_name: due.party_name,
            party_type: due.party_type,
            payment_method: due.payment_method,
            note: due.note
          }
        });
      }
    });

    // E. Customers
    (memoryCache.customers || []).forEach(cust => {
      if (cust.created_at) {
        const d = new Date(cust.created_at);
        if (d.getTime() > clearedAt && !loggedEntityIds.has(cust.id)) {
          synthetic.push({
            id: `synth_cust_${cust.id}`,
            user_id: uid,
            timestamp: cust.created_at,
            date: cust.created_at.split('T')[0],
            time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            category: 'customers',
            action_type: 'customer_created',
            title: `Added Customer: ${cust.name}`,
            description: `Phone: ${cust.phone || 'N/A'}${cust.opening_due ? ` • Opening Due: ৳${cust.opening_due}` : ''}`,
            entity_id: cust.id,
            entity_name: cust.name,
            amount: cust.opening_due
          });
        }
      }
    });

    // F. Suppliers
    (memoryCache.suppliers || []).forEach(sup => {
      if (sup.created_at) {
        const d = new Date(sup.created_at);
        if (d.getTime() > clearedAt && !loggedEntityIds.has(sup.id)) {
          synthetic.push({
            id: `synth_sup_${sup.id}`,
            user_id: uid,
            timestamp: sup.created_at,
            date: sup.created_at.split('T')[0],
            time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            category: 'suppliers',
            action_type: 'supplier_created',
            title: `Added Supplier: ${sup.name}`,
            description: `Company: ${sup.company || 'N/A'} • Phone: ${sup.phone || 'N/A'}`,
            entity_id: sup.id,
            entity_name: sup.name
          });
        }
      }
    });

    // G. Products
    (memoryCache.inventory || []).forEach(item => {
      if (item.created_at) {
        const d = new Date(item.created_at);
        if (d.getTime() > clearedAt && !loggedEntityIds.has(item.id)) {
          synthetic.push({
            id: `synth_item_${item.id}`,
            user_id: uid,
            timestamp: item.created_at,
            date: item.created_at.split('T')[0],
            time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            category: 'inventory',
            action_type: 'product_created',
            title: `Added Product: ${item.name}`,
            description: `SKU: ${item.sku || 'N/A'} • Stock: ${item.quantity} • Price: ৳${item.unit_price}`,
            entity_id: item.id,
            entity_name: item.name,
            amount: item.unit_price
          });
        }
      }
    });

    // H. Trash Items
    (memoryCache.trash || []).forEach(t => {
      if (t.deleted_at) {
        const d = new Date(t.deleted_at);
        if (d.getTime() > clearedAt && !loggedEntityIds.has(t.id)) {
          synthetic.push({
            id: `synth_trash_${t.id}`,
            user_id: uid,
            timestamp: t.deleted_at,
            date: t.deleted_at.split('T')[0],
            time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            category: 'trash',
            action_type: 'trash_item_deleted',
            title: `Moved to Recycle Bin: ${t.title}`,
            description: `Type: ${t.item_type.toUpperCase()}${t.subtitle ? ` • ${t.subtitle}` : ''}`,
            entity_id: t.id,
            entity_name: t.title
          });
        }
      }
    });

    // Combine and sort descending by timestamp
    const combined = [...logged, ...synthetic].filter(a => {
      const timeA = new Date(a.timestamp || a.date).getTime() || 0;
      return timeA > clearedAt;
    });
    return combined.sort((a, b) => {
      const timeA = new Date(a.timestamp || a.date).getTime() || 0;
      const timeB = new Date(b.timestamp || b.date).getTime() || 0;
      return timeB - timeA;
    });
  },

  logActivity: async (log: Omit<ActivityLog, 'id' | 'user_id' | 'timestamp' | 'date' | 'time'> & { timestamp?: string }): Promise<void> => {
    try {
      const uid = auth.currentUser?.uid || activeUid;
      if (!uid) return;
      const now = log.timestamp ? new Date(log.timestamp) : new Date();
      const iso = now.toISOString();
      const date = iso.split('T')[0];
      const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const id = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      
      const newEntry: ActivityLog = {
        id,
        user_id: uid,
        timestamp: iso,
        date,
        time,
        category: log.category,
        action_type: log.action_type,
        title: log.title,
        description: log.description,
        entity_id: log.entity_id,
        entity_name: log.entity_name,
        amount: log.amount,
        metadata: log.metadata
      };

      memoryCache.activityLogs = [newEntry, ...(memoryCache.activityLogs || [])];
      dispatch('bizflow_activities_updated');

      const docRef = doc(db, 'users', uid, 'activity_logs', id);
      await safeSetDoc(docRef, cleanForFirestore(newEntry));
    } catch (err) {
      console.warn('Failed to record activity log in Firestore:', err);
    }
  },

  deleteActivityLog: async (id: string): Promise<void> => {
    const uid = getUid();
    memoryCache.activityLogs = (memoryCache.activityLogs || []).filter(a => a.id !== id);
    dispatch('bizflow_activities_updated');
    try {
      await deleteDoc(doc(db, 'users', uid, 'activity_logs', id));
    } catch (err) {
      console.warn('Failed to delete activity log doc from Firestore:', err);
    }
  },

  clearAllActivityLogs: async (): Promise<void> => {
    const uid = activeUid || auth.currentUser?.uid || 'user';
    const now = Date.now();
    memoryCache.logsClearedAt = now;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`bizflow_logs_cleared_at_${uid}`, now.toString());
    }
    const list = [...(memoryCache.activityLogs || [])];
    memoryCache.activityLogs = [];
    dispatch('bizflow_activities_updated');

    const targetUid = auth.currentUser?.uid || activeUid;
    if (targetUid) {
      try {
        const settingsRef = doc(db, 'users', targetUid, 'settings', 'logs_cleared');
        await safeSetDoc(settingsRef, { cleared_at: now });
      } catch (err) {
        console.warn('Failed to save logs_cleared timestamp in Firestore:', err);
      }

      try {
        for (let i = 0; i < list.length; i += 400) {
          const batch = writeBatch(db);
          const chunk = list.slice(i, i + 400);
          chunk.forEach(a => {
            batch.delete(doc(db, 'users', targetUid, 'activity_logs', a.id));
          });
          await batch.commit();
        }
      } catch (err) {
        console.warn('Failed to batch delete activity logs from Firestore:', err);
      }
    }
  },

  // Legacy sync compatibility wrapper
  syncFromFirebase: async (): Promise<boolean> => {
    const user = auth.currentUser;
    if (!user) return false;
    await storageService.initUser(user.uid);
    return true;
  }
};
