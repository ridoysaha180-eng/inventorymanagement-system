import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, Search, Filter, MoreVertical, Edit2, Trash2, AlertCircle, 
  Package, X, Upload, FileSpreadsheet, Download, ScanLine, 
  PackagePlus, Building2, FolderTree, Sparkles, Check, TrendingUp, TrendingDown,
  Table as TableIcon, Layers, Eye, Phone, MapPin, ExternalLink, Boxes, ArrowRight,
  DollarSign, RefreshCw
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { formatCurrency, cn } from '../utils';
import { storageService } from '../services/storageService';
import { InventoryItem, Supplier, Sale, Purchase, Brand, Category, SubCategory } from '../types';
import { BarcodeScanner } from '../components/common/BarcodeScanner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useSearchParams } from 'react-router-dom';

export const Inventory: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name_az' | 'company_az' | 'category_az'>('name_az');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkChangeModalOpen, setIsBulkChangeModalOpen] = useState(false);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; type: 'single' | 'bulk'; id?: string }>({ isOpen: false, type: 'single' });
  
  // View mode state: Table view or Product & Supplier Stock view
  const [viewMode, setViewMode] = useState<'table' | 'supplier_stock'>('table');
  const [selectedProductForSupplierStock, setSelectedProductForSupplierStock] = useState<InventoryItem | null>(null);
  const [isSupplierStockModalOpen, setIsSupplierStockModalOpen] = useState(false);
  const [supplierStockSearch, setSupplierStockSearch] = useState('');
  
  // 0 Stock Filter ON/OFF toggle states
  const [hideZeroStockTable, setHideZeroStockTable] = useState(false);
  const [hideZeroStockSupplierView, setHideZeroStockSupplierView] = useState(true);
  const [hideZeroStockModal, setHideZeroStockModal] = useState(true);
  
  // Scanner state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<'search' | 'sku' | 'item_code' | null>(null);
  const [bulkChangeData, setBulkChangeData] = useState({
    category: '',
    company: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    item_code: '',
    company: '',
    category: '',
    sub_category: '',
    supplier_id: '',
    unit: 'pcs',
    quantity: 0,
    cost_price: 0,
    unit_price: 0,
    mrp: 0,
    dealer_price: 0,
    manage_stock: true,
    min_stock_level: 5
  });

  // Supplier-wise stock editing state
  const [supplierStocks, setSupplierStocks] = useState<Array<{ id?: string; supplier_id: string; quantity: number | string }>>([]);

  // Brands, Categories, Subcategories from database
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);

  // Quick Add UI states
  const [isAddingBrand, setIsAddingBrand] = useState(false);
  const [newBrandInput, setNewBrandInput] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [isAddingSubCategory, setIsAddingSubCategory] = useState(false);
  const [newSubCategoryInput, setNewSubCategoryInput] = useState('');
  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [newUnitInput, setNewUnitInput] = useState('');

  const [isSyncingStock, setIsSyncingStock] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    // Auto-reconcile stock quietly on load
    storageService.reconcileInventoryStock().then(res => {
      if (res.reconciledCount > 0) {
        loadData();
      }
    });
  }, []);

  const handleSyncStock = async () => {
    setIsSyncingStock(true);
    try {
      const res = await storageService.reconcileInventoryStock();
      loadData();
      if (res.reconciledCount > 0) {
        setSyncMessage(`Reconciled ${res.reconciledCount} product stock level(s) successfully!`);
      } else {
        setSyncMessage('All product stock levels are perfectly accurate and synchronized!');
      }
      setTimeout(() => setSyncMessage(null), 4000);
    } catch (err) {
      console.error('Failed to sync stock:', err);
      setSyncMessage('Stock sync completed.');
      setTimeout(() => setSyncMessage(null), 3000);
    } finally {
      setIsSyncingStock(false);
    }
  };

  useEffect(() => {
    const q = searchParams.get('search');
    if (q !== null) {
      setSearchTerm(q);
    }
  }, [searchParams]);

  const loadData = () => {
    setInventory(storageService.getInventory());
    setSuppliers(storageService.getSuppliers());
    setSales(storageService.getSales() || []);
    setPurchases(storageService.getPurchases() || []);
    setBrands(storageService.getBrands() || []);
    setCategories(storageService.getCategories() || []);
    setSubCategories(storageService.getSubCategories() || []);
  };

  const handleSaveQuickBrand = () => {
    const trimmed = newBrandInput.trim();
    if (!trimmed) return;
    const existing = brands.find(b => b.name.toLowerCase() === trimmed.toLowerCase());
    if (!existing) {
      const brandObj: Brand = {
        id: Math.random().toString(36).substr(2, 9),
        name: trimmed,
        created_at: new Date().toISOString()
      };
      storageService.addBrand(brandObj);
      setBrands(prev => [...prev, brandObj]);
    }
    setFormData(prev => ({ ...prev, company: trimmed }));
    setIsAddingBrand(false);
    setNewBrandInput('');
  };

  const handleSaveQuickCategory = () => {
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;
    const existing = categories.find(c => c.name.toLowerCase() === trimmed.toLowerCase());
    if (!existing) {
      const catObj: Category = {
        id: Math.random().toString(36).substr(2, 9),
        name: trimmed,
        created_at: new Date().toISOString()
      };
      storageService.addCategory(catObj);
      setCategories(prev => [...prev, catObj]);
    }
    setFormData(prev => ({ ...prev, category: trimmed }));
    setIsAddingCategory(false);
    setNewCategoryInput('');
  };

  const handleSaveQuickSubCategory = () => {
    const trimmed = newSubCategoryInput.trim();
    if (!trimmed || !formData.category) return;
    const matchedCat = categories.find(c => c.name.toLowerCase() === formData.category.toLowerCase());
    const catId = matchedCat?.id || 'gen';
    const subObj: SubCategory = {
      id: Math.random().toString(36).substr(2, 9),
      category_id: catId,
      name: trimmed,
      created_at: new Date().toISOString()
    };
    storageService.addSubCategory(subObj);
    setSubCategories(prev => [...prev, subObj]);
    setFormData(prev => ({ ...prev, sub_category: trimmed }));
    setIsAddingSubCategory(false);
    setNewSubCategoryInput('');
  };

  const handleSaveQuickUnit = () => {
    const trimmed = newUnitInput.trim();
    if (!trimmed) return;
    setFormData(prev => ({ ...prev, unit: trimmed }));
    setIsAddingUnit(false);
    setNewUnitInput('');
  };

  const generateAutoSKU = () => {
    const rand = Math.floor(100000 + Math.random() * 900000);
    const prefix = formData.company ? formData.company.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X') : 'PRD';
    setFormData(prev => ({ ...prev, sku: `${prefix}-${rand}` }));
  };

  // Helper to get detailed breakdown of current stock pcs per supplier for a given product
  const getProductSupplierBreakdown = (product: InventoryItem) => {
    // 1. All raw inventory records matching SKU or ID or Name
    const matchingInv = inventory.filter(inv => 
      (product.sku && inv.sku === product.sku) || 
      inv.id === product.id ||
      (product.name && inv.name && inv.name.trim().toLowerCase() === product.name.trim().toLowerCase())
    );
    const matchingInvIds = matchingInv.map(i => i.id);

    // 2. Find total actual sales and collect individual sale items for this product
    let totalSoldQty = 0;
    const matchingSaleItems: { quantity: number; unitPrice: number; supplierId: string }[] = [];
    sales.forEach(sale => {
      (sale.items || []).forEach(si => {
        const matches = (si.inventory_item_id && matchingInvIds.includes(si.inventory_item_id)) ||
                        (si.sku && product.sku && si.sku === product.sku) ||
                        (si.item_name && product.name && si.item_name.trim().toLowerCase() === product.name.trim().toLowerCase());
        if (matches) {
          const qty = si.quantity || 0;
          totalSoldQty += qty;
          matchingSaleItems.push({
            quantity: qty,
            unitPrice: (typeof si.unit_price === 'number' && si.unit_price > 0) ? si.unit_price : (product.unit_price || product.mrp || 0),
            supplierId: si.supplier_id || ''
          });
        }
      });
    });

    // 3. Find all purchase records for this product
    const poEntries: {
      supplierId: string;
      quantity: number;
      unitPrice: number;
      createdAt: string;
    }[] = [];

    purchases.forEach(p => {
      const pSuppId = p.supplier_id || '';
      (p.items || []).forEach(pi => {
        const matches = (pi.inventory_item_id && matchingInvIds.includes(pi.inventory_item_id)) ||
                        (pi.sku && product.sku && pi.sku === product.sku) ||
                        (pi.item_name && product.name && pi.item_name.trim().toLowerCase() === product.name.trim().toLowerCase());
        if (matches) {
          poEntries.push({
            supplierId: pSuppId,
            quantity: pi.quantity || 0,
            unitPrice: pi.unit_price || 0,
            createdAt: p.created_at || ''
          });
        }
      });
    });

    const totalPurchasedFromPOs = poEntries.reduce((sum, p) => sum + p.quantity, 0);
    const rawInvStock = matchingInv.reduce((sum, i) => sum + (i.quantity || 0), 0);

    // Initial opening stock (units in stock not accounted for by existing purchase bills)
    const initialOpeningStock = Math.max(0, (rawInvStock + totalSoldQty) - totalPurchasedFromPOs);

    // Determine initial supplier from inventory record if specified
    const initialInvWithSupplier = matchingInv.find(i => i.supplier_id && i.supplier_id !== 'multiple' && i.supplier_id !== '');
    const initialSupplierId = initialInvWithSupplier?.supplier_id || (product.supplier_id && product.supplier_id !== 'multiple' ? product.supplier_id : '');

    // Chronological batches (initial stock first, then POs by creation date)
    type StockBatch = {
      supplierId: string;
      quantity: number;
      unitPrice: number;
      date: string;
    };

    const batches: StockBatch[] = [];

    // Check individual inventory records for multiple supplier opening stocks
    if (matchingInv.length > 1) {
      matchingInv.forEach(invItem => {
        const invSuppId = invItem.supplier_id && invItem.supplier_id !== 'multiple' ? invItem.supplier_id : initialSupplierId;
        const invPoQty = poEntries.filter(p => p.supplierId === invSuppId).reduce((s, p) => s + p.quantity, 0);
        const invQty = Math.max(0, invItem.quantity || 0);
        const invOpening = Math.max(0, invQty - invPoQty);
        if (invOpening > 0) {
          batches.push({
            supplierId: invSuppId,
            quantity: invOpening,
            unitPrice: invItem.cost_price || product.cost_price || 0,
            date: invItem.created_at || '1970-01-01'
          });
        }
      });
    }

    if (batches.length === 0 && initialOpeningStock > 0) {
      batches.push({
        supplierId: initialSupplierId,
        quantity: initialOpeningStock,
        unitPrice: product.cost_price || 0,
        date: matchingInv[0]?.created_at || '1970-01-01'
      });
    }

    // Sort POs chronologically (oldest to newest)
    const sortedPOs = [...poEntries].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    sortedPOs.forEach(po => {
      batches.push({
        supplierId: po.supplierId,
        quantity: po.quantity,
        unitPrice: po.unitPrice,
        date: po.createdAt
      });
    });

    // Sort batches by Supplier SL number (e.g. SL-001 before SL-002) and date
    batches.sort((a, b) => {
      const suppA = suppliers.find(s => s.id === a.supplierId);
      const suppB = suppliers.find(s => s.id === b.supplierId);
      const slA = suppA?.sl_number || 'SL-999';
      const slB = suppB?.sl_number || 'SL-999';
      const slCmp = slA.localeCompare(slB, undefined, { numeric: true });
      if (slCmp !== 0) return slCmp;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    // Deduct sales from stock batches and calculate actual historical sales revenue per supplier
    const supplierSalesMap = new Map<string, number>();
    const supplierRevenueMap = new Map<string, number>();

    const tempBatches = batches.map(b => ({ ...b, available: b.quantity, soldQty: 0, remainingQty: b.quantity }));

    matchingSaleItems.forEach(sItem => {
      let remaining = sItem.quantity;
      const price = sItem.unitPrice;

      // First priority: if item explicitly specifies supplierId
      if (sItem.supplierId) {
        for (const b of tempBatches) {
          if (remaining <= 0) break;
          if (b.supplierId === sItem.supplierId && b.available > 0) {
            const deduct = Math.min(b.available, remaining);
            b.available -= deduct;
            b.soldQty += deduct;
            b.remainingQty = b.available;
            remaining -= deduct;
            supplierSalesMap.set(b.supplierId, (supplierSalesMap.get(b.supplierId) || 0) + deduct);
            supplierRevenueMap.set(b.supplierId, (supplierRevenueMap.get(b.supplierId) || 0) + (deduct * price));
          }
        }
      }

      // Second priority: deduct remaining from available batches in FIFO sequence
      if (remaining > 0) {
        for (const b of tempBatches) {
          if (remaining <= 0) break;
          if (b.available > 0) {
            const deduct = Math.min(b.available, remaining);
            b.available -= deduct;
            b.soldQty += deduct;
            b.remainingQty = b.available;
            remaining -= deduct;
            supplierSalesMap.set(b.supplierId, (supplierSalesMap.get(b.supplierId) || 0) + deduct);
            supplierRevenueMap.set(b.supplierId, (supplierRevenueMap.get(b.supplierId) || 0) + (deduct * price));
          }
        }
      }

      // Third priority: if stock batches run out, assign remaining sales & revenue to target supplier
      if (remaining > 0) {
        const targetSuppId = sItem.supplierId || initialSupplierId || (batches[0]?.supplierId || '');
        supplierSalesMap.set(targetSuppId, (supplierSalesMap.get(targetSuppId) || 0) + remaining);
        supplierRevenueMap.set(targetSuppId, (supplierRevenueMap.get(targetSuppId) || 0) + (remaining * price));
      }
    });

    // Aggregate supplier stats
    const supplierMap = new Map<string, {
      supplierId: string;
      supplierName: string;
      contactPerson?: string;
      phone?: string;
      email?: string;
      address?: string;
      currentStock: number;
      costPrice: number;
      totalPurchasedQty: number;
      totalPurchasedAmount: number;
      soldQty: number;
      lastPurchaseDate?: string;
    }>();

    const getOrInitSupplier = (sId: string) => {
      if (!supplierMap.has(sId)) {
        const suppObj = suppliers.find(s => s.id === sId);
        const sName = suppObj ? suppObj.name : (sId ? 'Unknown Supplier' : 'Direct / Store Stock');
        supplierMap.set(sId, {
          supplierId: sId,
          supplierName: sName,
          contactPerson: suppObj?.contact_person,
          phone: suppObj?.phone,
          email: suppObj?.email,
          address: suppObj?.address,
          currentStock: 0,
          costPrice: product.cost_price || 0,
          totalPurchasedQty: 0,
          totalPurchasedAmount: 0,
          soldQty: 0,
          lastPurchaseDate: undefined
        });
      }
      return supplierMap.get(sId)!;
    };

    // Aggregate purchase totals
    batches.forEach(b => {
      const entry = getOrInitSupplier(b.supplierId);
      entry.totalPurchasedQty += b.quantity;
      entry.totalPurchasedAmount += (b.quantity * b.unitPrice);
      if (b.unitPrice > 0) entry.costPrice = b.unitPrice;
      if (b.date && (!entry.lastPurchaseDate || new Date(b.date) > new Date(entry.lastPurchaseDate))) {
        entry.lastPurchaseDate = b.date;
      }
    });

    // Aggregate remaining available stock
    tempBatches.forEach(b => {
      const entry = getOrInitSupplier(b.supplierId);
      entry.currentStock += b.remainingQty;
    });

    // Record accurate soldQty
    supplierSalesMap.forEach((sold, sId) => {
      const entry = getOrInitSupplier(sId);
      entry.soldQty = sold;
    });

    if (supplierMap.size === 0) {
      const entry = getOrInitSupplier(initialSupplierId);
      entry.currentStock = Math.max(0, product.quantity || 0);
      entry.totalPurchasedQty = Math.max(0, product.quantity || 0);
      entry.totalPurchasedAmount = (Math.max(0, product.quantity || 0)) * (product.cost_price || 0);
      entry.soldQty = 0;
    }

    const entries = Array.from(supplierMap.values());
    const totalCurrentStockSum = entries.reduce((sum, e) => sum + e.currentStock, 0);

    return entries.map(entry => {
      const suppObj = suppliers.find(s => s.id === entry.supplierId);
      const avgRate = entry.totalPurchasedQty > 0
        ? entry.totalPurchasedAmount / entry.totalPurchasedQty
        : entry.costPrice;
      const salePrice = product.unit_price || product.mrp || 0;
      const purchasePrice = avgRate > 0 ? avgRate : (entry.costPrice || product.cost_price || 0);
      const purchaseQty = entry.totalPurchasedQty;
      const purchaseAmount = entry.totalPurchasedAmount;
      const saleQty = entry.soldQty;
      const salesAmount = supplierRevenueMap.get(entry.supplierId) || (saleQty * salePrice);
      const availableStock = entry.currentStock;
      const stockValue = availableStock * purchasePrice;
      const expectedProfit = (salePrice - purchasePrice) * availableStock;
      const cogs = saleQty * purchasePrice;
      const profitLoss = salesAmount - cogs;
      const profit = profitLoss > 0 ? profitLoss : 0;
      const loss = profitLoss < 0 ? Math.abs(profitLoss) : 0;

      return {
        ...entry,
        supplier_sl: suppObj?.sl_number || '-',
        avgRate,
        purchasePrice,
        purchaseQty,
        purchaseAmount,
        saleQty,
        salesAmount,
        availableStock,
        stockValue,
        expectedProfit,
        profit,
        loss,
        percentage: totalCurrentStockSum > 0 ? (entry.currentStock / totalCurrentStockSum) * 100 : 0
      };
    }).sort((a, b) => {
      const slA = a.supplier_sl || 'SL-999';
      const slB = b.supplier_sl || 'SL-999';
      return slA.localeCompare(slB, undefined, { numeric: true });
    });
  };

  const getItemStats = (item: InventoryItem) => {
    const breakdown = getProductSupplierBreakdown(item);

    // If a specific supplier is filtered, extract stats strictly for that supplier
    if (supplierFilter !== 'all') {
      const suppEntry = breakdown.find(b => b.supplierId === supplierFilter);
      if (!suppEntry) {
        return {
          purchaseQty: 0,
          purchaseAmount: 0,
          saleQty: 0,
          salesAmount: 0,
          availableStock: 0,
          stockValue: 0,
          cogs: 0,
          profitLoss: 0,
          profitMargin: 0,
          expectedProfit: 0,
          profit: 0,
          loss: 0,
          earn: 0,
          avgPurchasePrice: item.cost_price || 0
        };
      }

      return {
        purchaseQty: suppEntry.purchaseQty,
        purchaseAmount: suppEntry.purchaseAmount,
        saleQty: suppEntry.saleQty,
        salesAmount: suppEntry.salesAmount,
        availableStock: suppEntry.availableStock,
        stockValue: suppEntry.stockValue,
        cogs: suppEntry.saleQty * suppEntry.purchasePrice,
        profitLoss: suppEntry.profit - suppEntry.loss,
        profitMargin: suppEntry.salesAmount > 0 ? ((suppEntry.profit - suppEntry.loss) / suppEntry.salesAmount) * 100 : 0,
        expectedProfit: suppEntry.expectedProfit,
        profit: suppEntry.profit,
        loss: suppEntry.loss,
        earn: suppEntry.profit,
        avgPurchasePrice: suppEntry.purchasePrice
      };
    }

    // Default / All Suppliers Mode:
    // Aggregate by summing every individual supplier's metrics (e.g. PRAN data + DARAZ data)
    if (breakdown.length === 0) {
      const rawStock = Math.max(0, item.quantity || 0);
      const unitCost = item.cost_price || 0;
      const salePrice = item.unit_price || item.mrp || 0;
      return {
        purchaseQty: rawStock,
        purchaseAmount: rawStock * unitCost,
        saleQty: 0,
        salesAmount: 0,
        availableStock: rawStock,
        stockValue: rawStock * unitCost,
        cogs: 0,
        profitLoss: 0,
        profitMargin: 0,
        expectedProfit: (salePrice - unitCost) * rawStock,
        profit: 0,
        loss: 0,
        earn: 0,
        avgPurchasePrice: unitCost
      };
    }

    const purchaseQty = breakdown.reduce((sum, e) => sum + e.purchaseQty, 0);
    const purchaseAmount = breakdown.reduce((sum, e) => sum + e.purchaseAmount, 0);
    const saleQty = breakdown.reduce((sum, e) => sum + e.saleQty, 0);
    const salesAmount = breakdown.reduce((sum, e) => sum + e.salesAmount, 0);
    const availableStock = breakdown.reduce((sum, e) => sum + e.availableStock, 0);
    const stockValue = breakdown.reduce((sum, e) => sum + e.stockValue, 0);
    const expectedProfit = breakdown.reduce((sum, e) => sum + e.expectedProfit, 0);
    const profit = breakdown.reduce((sum, e) => sum + e.profit, 0);
    const loss = breakdown.reduce((sum, e) => sum + e.loss, 0);
    const cogs = breakdown.reduce((sum, e) => sum + (e.saleQty * e.purchasePrice), 0);
    const profitLoss = profit - loss;
    const profitMargin = salesAmount > 0 ? (profitLoss / salesAmount) * 100 : 0;
    const avgPurchasePrice = purchaseQty > 0 ? (purchaseAmount / purchaseQty) : (item.cost_price || 0);

    return {
      purchaseQty,
      purchaseAmount,
      saleQty,
      salesAmount,
      availableStock,
      stockValue,
      cogs,
      profitLoss,
      profitMargin,
      expectedProfit,
      profit,
      loss,
      earn: profit,
      avgPurchasePrice
    };
  };

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingItem) {
      const currentInv = storageService.getInventory();
      // Remove existing records for this SKU
      const otherItems = currentInv.filter(inv => inv.sku !== editingItem.sku);

      const validSupplierStocks = supplierStocks.length > 0
        ? supplierStocks
        : [{ supplier_id: '', quantity: 0 }];

      const updatedMinStock = Number(formData.min_stock_level) >= 0 ? Number(formData.min_stock_level) : 5;
      const costPrice = Number(formData.cost_price) >= 0 ? Number(formData.cost_price) : 0;
      const unitPrice = Number(formData.unit_price) >= 0 ? Number(formData.unit_price) : 0;
      const mrp = Number(formData.mrp) >= 0 ? Number(formData.mrp) : costPrice;
      const dealerPrice = Number(formData.dealer_price) >= 0 ? Number(formData.dealer_price) : 0;

      const existingMatching = currentInv.filter(inv => inv.sku === editingItem.sku);

      const newItemsForSku: InventoryItem[] = validSupplierStocks.map((row, idx) => {
        const qty = Number(row.quantity) >= 0 ? Number(row.quantity) : 0;
        const existingId = row.id || existingMatching[idx]?.id || `${editingItem.id}_supp_${Date.now()}_${idx}`;

        return {
          ...editingItem,
          id: existingId,
          supplier_id: row.supplier_id || '',
          quantity: qty,
          cost_price: costPrice,
          unit_price: unitPrice,
          mrp: mrp,
          dealer_price: dealerPrice,
          min_stock_level: updatedMinStock,
          manage_stock: true,
        };
      });

      storageService.saveInventory([...otherItems, ...newItemsForSku]);
      closeModal();
      loadData();
      return;
    }

    // Creating new product
    if (!formData.name.trim()) {
      alert('Please enter a product name');
      return;
    }

    const sku = formData.sku.trim() || `SKU-${Date.now().toString().slice(-6)}`;
    const qty = Number(formData.quantity) >= 0 ? Number(formData.quantity) : 0;
    const costPrice = Number(formData.cost_price) || Number(formData.mrp) || 0;
    const unitPrice = Number(formData.unit_price) || 0;
    const mrp = Number(formData.mrp) || costPrice || 0;
    const dealerPrice = Number(formData.dealer_price) || 0;

    const newItem: InventoryItem = {
      id: Math.random().toString(36).substr(2, 9),
      user_id: '123', // Mock user id
      name: formData.name.trim(),
      sku,
      item_code: formData.item_code.trim(),
      company: formData.company.trim(),
      category: formData.category.trim() || 'General',
      sub_category: formData.sub_category.trim(),
      supplier_id: formData.supplier_id || '',
      unit: formData.unit || 'pcs',
      manage_stock: formData.manage_stock,
      min_stock_level: Number(formData.min_stock_level) || 0,
      quantity: qty,
      cost_price: costPrice,
      unit_price: unitPrice,
      mrp: mrp,
      dealer_price: dealerPrice,
      decimal: false,
      created_at: new Date().toISOString()
    };
    storageService.addProduct(newItem);
    
    closeModal();
    loadData();
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      sku: item.sku,
      item_code: item.item_code || '',
      company: item.company || '',
      category: item.category,
      sub_category: item.sub_category || '',
      supplier_id: item.supplier_id || '',
      unit: item.unit || 'pcs',
      quantity: item.quantity || 0,
      cost_price: item.cost_price || 0,
      unit_price: item.unit_price || 0,
      mrp: item.mrp || item.cost_price || 0,
      dealer_price: item.dealer_price || 0,
      manage_stock: item.manage_stock ?? true,
      min_stock_level: item.min_stock_level ?? 5,
    });

    // Find all matching inventory items for this SKU
    const matching = inventory.filter(inv => inv.sku === item.sku);
    let initialSupplierStocks: { id?: string; supplier_id: string; quantity: number | string }[] = [];

    if (matching.length > 0) {
      initialSupplierStocks = matching.map(m => ({
        id: m.id,
        supplier_id: m.supplier_id && m.supplier_id !== 'multiple' ? m.supplier_id : '',
        quantity: m.quantity || 0,
      }));
    } else {
      initialSupplierStocks = [{
        supplier_id: item.supplier_id && item.supplier_id !== 'multiple' ? item.supplier_id : '',
        quantity: item.quantity || 0,
      }];
    }

    if (initialSupplierStocks.length === 0) {
      initialSupplierStocks = [{ supplier_id: '', quantity: 0 }];
    }

    setSupplierStocks(initialSupplierStocks);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setSupplierStocks([]);
    setFormData({
      name: '',
      sku: '',
      item_code: '',
      company: '',
      category: '',
      sub_category: '',
      supplier_id: '',
      unit: 'pcs',
      quantity: 0,
      cost_price: 0,
      unit_price: 0,
      mrp: 0,
      dealer_price: 0,
      manage_stock: true,
      min_stock_level: 5,
    });
    setIsAddingBrand(false);
    setNewBrandInput('');
    setIsAddingCategory(false);
    setNewCategoryInput('');
    setIsAddingSubCategory(false);
    setNewSubCategoryInput('');
    setIsAddingUnit(false);
    setNewUnitInput('');
  };

  const getFilteredAndGroupedInventory = () => {
    // Build unique product groups by SKU/ID first
    const rawGrouped = inventory.reduce((acc, item) => {
      const groupKey = item.sku || item.id;
      if (!acc[groupKey]) {
        acc[groupKey] = { ...item };
      } else {
        const existing = acc[groupKey];
        const totalQuantity = existing.quantity + item.quantity;
        const totalCost = (existing.quantity * existing.cost_price) + (item.quantity * item.cost_price);
        const avgCost = totalQuantity > 0 ? totalCost / totalQuantity : 0;
        acc[groupKey] = {
          ...existing,
          quantity: totalQuantity,
          cost_price: avgCost,
          mrp: Math.max(existing.mrp || 0, item.mrp || 0),
          unit_price: Math.max(existing.unit_price, item.unit_price),
        };
      }
      return acc;
    }, {} as Record<string, InventoryItem>);

    const allProducts: InventoryItem[] = Object.values(rawGrouped);

    const filtered = allProducts.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (item.item_code || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCompany = companyFilter === 'all' || item.company === companyFilter;
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      
      if (!matchesSearch || !matchesCompany || !matchesCategory) {
        return false;
      }

      if (supplierFilter !== 'all') {
        const breakdown = getProductSupplierBreakdown(item);
        const suppEntry = breakdown.find(b => b.supplierId === supplierFilter);
        if (!suppEntry || (suppEntry.totalPurchasedQty <= 0 && suppEntry.currentStock <= 0)) {
          return false;
        }
        if (hideZeroStockTable && suppEntry.currentStock <= 0) {
          return false;
        }
        return true;
      }

      const matchesZeroStock = !hideZeroStockTable || item.quantity > 0;
      return matchesZeroStock;
    });

    // If specific supplier is filtered, map the product quantities and rates to that supplier
    return filtered.map(item => {
      const breakdown = getProductSupplierBreakdown(item);
      if (supplierFilter !== 'all') {
        const suppEntry = breakdown.find(b => b.supplierId === supplierFilter);
        return {
          ...item,
          quantity: suppEntry ? suppEntry.currentStock : 0,
          cost_price: suppEntry ? (suppEntry.avgRate || suppEntry.costPrice) : item.cost_price,
          supplier_id: supplierFilter
        };
      } else {
        const resolvedSupplierId = breakdown.length > 1 ? 'multiple' : (breakdown[0]?.supplierId || item.supplier_id || '');
        return {
          ...item,
          supplier_id: resolvedSupplierId
        };
      }
    });
  };

  const filteredInventory = getFilteredAndGroupedInventory().sort((a, b) => {
    if (sortBy === 'company_az') {
      return (a.company || '').localeCompare(b.company || '', undefined, { sensitivity: 'base', numeric: true });
    } else if (sortBy === 'category_az') {
      return (a.category || '').localeCompare(b.category || '', undefined, { sensitivity: 'base', numeric: true });
    } else {
      return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true });
    }
  });

  const inventoryWithStats = filteredInventory.map(item => ({
    ...item,
    stats: getItemStats(item)
  }));

  const totalAvailableStock = inventoryWithStats.reduce((sum, item) => sum + item.stats.availableStock, 0);
  const totalStockValue = inventoryWithStats.reduce((sum, item) => sum + item.stats.stockValue, 0);
  const totalPurchaseQty = inventoryWithStats.reduce((sum, item) => sum + item.stats.purchaseQty, 0);
  const totalPurchaseAmount = inventoryWithStats.reduce((sum, item) => sum + item.stats.purchaseAmount, 0);
  const totalSaleQty = inventoryWithStats.reduce((sum, item) => sum + item.stats.saleQty, 0);
  const totalSalesAmount = inventoryWithStats.reduce((sum, item) => sum + item.stats.salesAmount, 0);
  const totalProfitLoss = inventoryWithStats.reduce((sum, item) => sum + item.stats.profitLoss, 0);
  const totalExpectedProfit = inventoryWithStats.reduce((sum, item) => sum + item.stats.expectedProfit, 0);
  const totalProfit = inventoryWithStats.reduce((sum, item) => sum + item.stats.profit, 0);
  const totalLoss = inventoryWithStats.reduce((sum, item) => sum + item.stats.loss, 0);

  // Product-wise Supplier Stock View with complete Purchase, Sales, Stock & Profit/Loss metrics
  // Rule: Controlled by hideZeroStockSupplierView toggle
  const supplierStockList = useMemo(() => {
    const list: {
      id: string;
      productId: string;
      productName: string;
      sku: string;
      unit: string;
      unit_price: number;
      supplierId: string;
      supplierName: string;
      supplierSL: string;
      purchasePrice: number;
      purchaseQty: number;
      purchaseAmount: number;
      saleQty: number;
      salesAmount: number;
      availableStock: number;
      stockValue: number;
      expectedProfit: number;
      profit: number;
      loss: number;
    }[] = [];

    // Sort product-wise
    const sortedProducts = [...inventoryWithStats].sort((a, b) => 
      a.name.localeCompare(b.name)
    );

    sortedProducts.forEach(item => {
      const breakdown = getProductSupplierBreakdown(item);
      breakdown.forEach((entry, idx) => {
        // If supplier filter is active, only show the matching supplier!
        if (supplierFilter !== 'all' && entry.supplierId !== supplierFilter) return;

        // Only exclude if hideZeroStockSupplierView is ON
        if (!hideZeroStockSupplierView || entry.availableStock > 0) {
          list.push({
            id: `${item.id}-${entry.supplierId || idx}`,
            productId: item.id,
            productName: item.name,
            sku: item.sku || '',
            unit: item.unit || 'pcs',
            unit_price: item.unit_price || 0,
            supplierId: entry.supplierId,
            supplierName: entry.supplierName,
            supplierSL: entry.supplier_sl || '-',
            purchasePrice: entry.purchasePrice,
            purchaseQty: entry.purchaseQty,
            purchaseAmount: entry.purchaseAmount,
            saleQty: entry.saleQty,
            salesAmount: entry.salesAmount,
            availableStock: entry.availableStock,
            stockValue: entry.stockValue,
            expectedProfit: entry.expectedProfit,
            profit: entry.profit,
            loss: entry.loss,
          });
        }
      });
    });

    return list;
  }, [inventoryWithStats, inventory, purchases, suppliers, hideZeroStockSupplierView, supplierFilter]);

  const filteredSupplierStockList = useMemo(() => {
    if (!supplierStockSearch.trim()) return supplierStockList;
    const q = supplierStockSearch.toLowerCase();
    return supplierStockList.filter(row =>
      row.productName.toLowerCase().includes(q) ||
      row.supplierName.toLowerCase().includes(q)
    );
  }, [supplierStockList, supplierStockSearch]);

  const handleExportPDF = () => {
    downloadPDF();
  };

  const handleExportExcel = () => {
    const data = inventoryWithStats.map(item => ({
      Product: item.name,
      SKU: item.sku,
      Company: item.company || 'N/A',
      Supplier: supplierFilter !== 'all' 
        ? (suppliers.find(s => s.id === supplierFilter)?.name || 'Direct / Store')
        : (item.supplier_id === 'multiple' ? 'Multiple' : (suppliers.find(s => s.id === item.supplier_id)?.name || 'N/A')),
      Category: item.category,
      'Sale Price': item.unit_price,
      'Purchase Price': item.stats.avgPurchasePrice,
      'Purchase Qty': item.stats.purchaseQty,
      'Purchase Amount': item.stats.purchaseAmount,
      'Sale Qty': item.stats.saleQty,
      'Sales Amount': item.stats.salesAmount,
      'Available Stock': item.stats.availableStock,
      'Stock Value': item.stats.stockValue,
      'Expected Profit': item.stats.expectedProfit,
      'Profit': item.stats.profit,
      'Loss': item.stats.loss,
      'Profit and Loss': item.stats.profitLoss,
      'Margin (%)': Number(item.stats.profitMargin.toFixed(2))
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    const bSettings = storageService.getBusinessSettings();
    const safeShop = (bSettings?.name || 'Inventory').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'Inventory';
    XLSX.writeFile(wb, `${safeShop}_Inventory_Report.xlsx`);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredInventory.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredInventory.map(item => item.id));
    }
  };

  const toggleSelectItem = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setDeleteConfirm({ isOpen: true, type: 'bulk' });
  };

  const handleDelete = (id: string) => {
    setDeleteConfirm({ isOpen: true, type: 'single', id });
  };

  const confirmDelete = async () => {
    if (deleteConfirm.type === 'bulk') {
      try {
        await storageService.deleteProducts(selectedIds);
        setSelectedIds([]);
        loadData();
      } catch (error) {
        console.error('Bulk delete error:', error);
      }
    } else if (deleteConfirm.type === 'single' && deleteConfirm.id) {
      try {
        await storageService.deleteProduct(deleteConfirm.id);
        loadData();
      } catch (error) {
        console.error('Delete error:', error);
      }
    }
    setDeleteConfirm({ isOpen: false, type: 'single' });
  };

  const handleBulkChange = (e: React.FormEvent) => {
    e.preventDefault();
    const updates: Partial<InventoryItem> = {};
    if (bulkChangeData.category) updates.category = bulkChangeData.category;
    if (bulkChangeData.company) updates.company = bulkChangeData.company;

    if (Object.keys(updates).length > 0) {
      storageService.updateProducts(selectedIds, updates);
      setIsBulkChangeModalOpen(false);
      setSelectedIds([]);
      setBulkChangeData({ category: '', company: '' });
      loadData();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const getVal = (row: any, keys: string[]) => {
          const rowKeys = Object.keys(row);
          for (const key of keys) {
            const foundKey = rowKeys.find(k => k.toLowerCase().replace(/\s/g, '') === key.toLowerCase().replace(/\s/g, ''));
            if (foundKey !== undefined) return row[foundKey];
          }
          return '';
        };

        const newItems: InventoryItem[] = data
          .filter(row => {
            const name = getVal(row, ['Product', 'Name', 'ProductName', 'Title']).toString().trim();
            const sku = getVal(row, ['SKU', 'Code', 'ID', 'ProductCode']).toString().trim();
            return name !== '' && sku !== '';
          })
          .map(row => {
            const quantity = parseInt(getVal(row, ['StockQty', 'Quantity', 'Stock', 'Qty', 'Amount']) || 0);
            const stockValue = parseFloat(getVal(row, ['StockValue', 'TotalPurchase', 'TotalCost']) || 0);
            const costPrice = parseFloat(getVal(row, ['CostPrice', 'Cost', 'PurchasePrice']) || 0);
            
            const finalCostPrice = stockValue > 0 && quantity > 0 ? stockValue / quantity : costPrice;

            return {
              id: Math.random().toString(36).substr(2, 9),
              user_id: '123',
              name: getVal(row, ['Product', 'Name', 'ProductName', 'Title']).toString(),
              sku: getVal(row, ['SKU', 'Barcode', 'ProductCode']).toString(),
              item_code: getVal(row, ['ItemCode', 'CustomCode', 'Code', 'ID']).toString(),
              company: getVal(row, ['Company', 'Supplier', 'Supplier', 'Brand']).toString(),
              category: getVal(row, ['Category', 'Type', 'Group']).toString() || 'General',
              quantity,
              unit_price: parseFloat(getVal(row, ['SalePrice', 'UnitPrice', 'Price', 'Rate']) || 0),
              cost_price: finalCostPrice,
              mrp: parseFloat(getVal(row, ['MRP', 'MaxRetailPrice', 'RetailPrice']) || 0),
              min_stock_level: parseInt(getVal(row, ['MinStock', 'AlertLevel', 'LowStock']) || 5),
              created_at: new Date().toISOString()
            };
          });

        if (newItems.length === 0) {
          alert('No valid data found in the file. Please ensure Product and SKU columns are present and filled.');
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        const currentInventory = storageService.getInventory();
        storageService.saveInventory([...currentInventory, ...newItems]);
        loadData();
        alert(`Successfully imported ${newItems.length} products!`);
        setIsBulkUploadModalOpen(false);
      } catch (error) {
        console.error('Bulk upload error:', error);
        alert('Failed to process the file. Please make sure it is a valid Excel or CSV file.');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        Product: 'Example Product',
        SKU: 'SKU-001',
        'Item Code': 'ITM-001',
        Company: 'Acme Corp',
        Category: 'General',
        MRP: 60.00,
        'Sale Price': 50.00,
        'Stock Qty': 100,
        'Stock Value': 3000.00
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "bizflow_inventory_template.xlsx");
  };

  const downloadPDF = () => {
    const doc = new jsPDF('landscape');
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    // Brand Colors
    const primaryColor: [number, number, number] = [15, 23, 42]; // slate-900
    const secondaryColor: [number, number, number] = [71, 85, 105]; // slate-600
    const accentColor: [number, number, number] = [14, 165, 233]; // sky-500
    const emeraldColor: [number, number, number] = [16, 185, 129]; // emerald-500
    const lightBg: [number, number, number] = [248, 250, 252]; // slate-50
    const borderColor: [number, number, number] = [226, 232, 240]; // slate-200

    // Top Accent Strip
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.rect(0, 0, pageWidth, 3, 'F');

    // Fetch current business settings (Shop Name, phone, address)
    const businessSettings = storageService.getBusinessSettings();
    const shopName = (businessSettings?.name || '').trim() || 'BIZFLOW';
    const reportTitle = `${shopName.toUpperCase()} - INVENTORY REPORT`;

    // Helper to render text supporting both ASCII and Unicode (Bangla, etc.)
    const renderHeaderTitle = (text: string, x: number, y: number) => {
      const isAscii = /^[\u0020-\u007E]*$/.test(text);
      if (isAscii) {
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(17);
        doc.setFont('helvetica', 'bold');
        doc.text(text, x, y);
      } else {
        try {
          const scale = 3;
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(17);
            doc.text(text, x, y);
            return;
          }
          const fontPx = 22 * scale;
          ctx.font = `bold ${fontPx}px "Segoe UI", Roboto, "Kalpurush", "SolaimanLipi", sans-serif`;
          const metrics = ctx.measureText(text);
          canvas.width = Math.ceil(metrics.width + 20 * scale);
          canvas.height = Math.ceil(34 * scale);
          ctx.font = `bold ${fontPx}px "Segoe UI", Roboto, "Kalpurush", "SolaimanLipi", sans-serif`;
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(text, 4 * scale, canvas.height / 2);
          const imgData = canvas.toDataURL('image/png');
          const mmWidth = (canvas.width / scale) * 0.264583;
          const mmHeight = (canvas.height / scale) * 0.264583;
          doc.addImage(imgData, 'PNG', x, y - 6, mmWidth, mmHeight);
        } catch {
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(17);
          doc.setFont('helvetica', 'bold');
          doc.text(text, x, y);
        }
      }
    };

    // Header Background
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 3, pageWidth, 34, 'F');

    // Title (Dynamic Shop Name)
    renderHeaderTitle(reportTitle, 14, 18);

    // Subtitle & Status
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // slate-400
    const activeSupplierText = supplierFilter === 'all' 
      ? 'Supplier: All Suppliers (Grouped View)' 
      : `Supplier: ${suppliers.find(s => s.id === supplierFilter)?.name || 'Filtered'}`;
    const activeCompanyText = companyFilter === 'all' ? '' : ` • Brand: ${companyFilter}`;
    const shopMeta = [businessSettings.address, businessSettings.phone].filter(Boolean).join(' • ');
    const subtitlePrefix = shopMeta ? `${shopMeta}  |  ` : '';
    doc.text(`${subtitlePrefix}${activeSupplierText}${activeCompanyText}`, 14, 26);

    // Date & Time (Right aligned)
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, pageWidth - 14, 18, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Total Records: ${inventoryWithStats.length} items`, pageWidth - 14, 26, { align: 'right' });

    // Calculate total values
    const totalItems = inventoryWithStats.length;

    // Executive Summary Cards (5 Cards cleanly balanced across landscape width)
    const cardY = 41;
    const cardWidth = 50.4;
    const cardHeight = 17;
    const cardGap = 4;
    const startX = 14;

    const expectedProfitColor: [number, number, number] = totalExpectedProfit < 0 ? [225, 29, 72] : [37, 99, 235];
    const cards = [
      { title: 'TOTAL PRODUCTS', value: `${totalItems} items (${totalAvailableStock} pcs)`, color: primaryColor },
      { title: 'STOCK VALUE', value: formatCurrency(totalStockValue), color: primaryColor },
      { 
        title: 'EXPECTED PROFIT', 
        value: totalExpectedProfit < 0 ? `-${formatCurrency(Math.abs(totalExpectedProfit))}` : formatCurrency(totalExpectedProfit), 
        color: expectedProfitColor 
      },
      { title: 'TOTAL PROFIT', value: `+${formatCurrency(totalProfit)}`, color: emeraldColor },
      { title: 'TOTAL LOSS', value: `-${formatCurrency(totalLoss)}`, color: [225, 29, 72] },
    ];

    cards.forEach((card, idx) => {
      const x = startX + idx * (cardWidth + cardGap);
      
      // Card Box
      doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
      doc.roundedRect(x, cardY, cardWidth, cardHeight, 2, 2, 'FD');

      // Top label
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(card.title, x + 3.5, cardY + 5.5);

      // Card Value
      doc.setTextColor(card.color[0], card.color[1], card.color[2]);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.text(card.value, x + 3.5, cardY + 13);
    });

    // Table Columns - Centered & Clean
    const tableColumn = [
      "Product", 
      "Supplier", 
      "Sale Price", 
      "Pur. Price", 
      "Pur. Qty", 
      "Sale Qty", 
      "Stock", 
      "Stock Value", 
      "Exp. Profit",
      "Profit",
      "Loss"
    ];

    const tableRows = inventoryWithStats.map(item => {
      const supplierDisplay = supplierFilter !== 'all'
        ? (suppliers.find(v => v.id === supplierFilter)?.name || 'Direct / Store')
        : (item.supplier_id === 'multiple' ? 'Multiple' : (suppliers.find(v => v.id === item.supplier_id)?.name || 'N/A'));

      const profitText = item.stats.profit > 0 ? `+${formatCurrency(item.stats.profit)}` : '0';
      const lossText = item.stats.loss > 0 ? `-${formatCurrency(item.stats.loss)}` : '0';
      const expectedProfitText = item.stats.expectedProfit < 0
        ? `-${formatCurrency(Math.abs(item.stats.expectedProfit))}`
        : formatCurrency(item.stats.expectedProfit);

      return [
        item.name,
        supplierDisplay,
        formatCurrency(item.unit_price),
        formatCurrency(item.stats.avgPurchasePrice),
        item.stats.purchaseQty.toString(),
        item.stats.saleQty.toString(),
        item.stats.availableStock.toString(),
        formatCurrency(item.stats.stockValue),
        expectedProfitText,
        profitText,
        lossText
      ];
    });

    const totalExpectedProfitText = totalExpectedProfit < 0
      ? `-${formatCurrency(Math.abs(totalExpectedProfit))}`
      : formatCurrency(totalExpectedProfit);

    const tableFooter = [
      `Total (${totalItems})`,
      '-',
      '-',
      '-',
      totalPurchaseQty.toString(),
      totalSaleQty.toString(),
      totalAvailableStock.toString(),
      formatCurrency(totalStockValue),
      totalExpectedProfitText,
      `+${formatCurrency(totalProfit)}`,
      `-${formatCurrency(totalLoss)}`
    ];

    // Generate AutoTable
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      foot: [tableFooter],
      startY: 62,
      margin: { left: 14, right: 14, bottom: 12 },
      theme: 'grid',
      styles: { 
        fontSize: 7.5, 
        cellPadding: 2.2,
        font: 'helvetica',
        textColor: [51, 65, 85], // slate-700
        lineColor: borderColor,
        lineWidth: 0.1,
        valign: 'middle'
      },
      headStyles: { 
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 7.5,
        cellPadding: 3
      },
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: primaryColor,
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 7.5,
        cellPadding: 2.5
      },
      alternateRowStyles: {
        fillColor: lightBg // slate-50
      },
      columnStyles: {
        0: { cellWidth: 50, halign: 'left', fontStyle: 'bold' }, // Product Name
        1: { cellWidth: 26, halign: 'center' }, // Supplier
        2: { cellWidth: 21, halign: 'center' }, // Sale Price
        3: { cellWidth: 21, halign: 'center' }, // Pur Price
        4: { cellWidth: 16, halign: 'center' }, // Pur Qty
        5: { cellWidth: 24, halign: 'center' }, // Pur Amount
        6: { cellWidth: 16, halign: 'center' }, // Sale Qty
        7: { cellWidth: 24, halign: 'center' }, // Sales Amount
        8: { cellWidth: 18, halign: 'center', fontStyle: 'bold' }, // Stock
        9: { cellWidth: 25, halign: 'center' }, // Stock Value
        10: { cellWidth: 28, halign: 'center', fontStyle: 'bold' } // Profit & Loss
      },
      didDrawPage: function (data) {
        // Bottom Footer
        const currentPage = (doc.internal as any).getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.text(
          `${shopName} • Inventory Management System`,
          data.settings.margin.left,
          pageHeight - 6
        );
        doc.text(
          `Page ${currentPage}`,
          pageWidth - data.settings.margin.right,
          pageHeight - 6,
          { align: 'right' }
        );
      }
    });

    // Save PDF directly with shop name
    const safeShopFileName = shopName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'Inventory';
    doc.save(`${safeShopFileName}_Report_${new Date().toISOString().slice(0, 10)}.pdf`);

    // Also attempt opening preview tab smoothly
    try {
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      window.open(blobUrl, '_blank');
    } catch {
      // Ignored if browser policy restricts popup
    }
  };

  const allBrands = Array.from(
    new Set([
      ...brands.map(b => b.name),
      ...inventory.map(item => item.company),
      ...(formData.company ? [formData.company] : [])
    ].filter(Boolean) as string[])
  ).sort((a, b) => a.localeCompare(b));

  const allCategories = Array.from(
    new Set([
      ...categories.map(c => c.name),
      ...inventory.map(item => item.category),
      ...(formData.category ? [formData.category] : [])
    ].filter(Boolean) as string[])
  ).sort((a, b) => a.localeCompare(b));

  const matchedCat = categories.find(c => c.name.toLowerCase() === (formData.category || '').toLowerCase());
  const allSubCategories = Array.from(
    new Set([
      ...(matchedCat ? subCategories.filter(s => s.category_id === matchedCat.id).map(s => s.name) : []),
      ...inventory.filter(i => i.category === formData.category).map(i => i.sub_category),
      ...(formData.sub_category ? [formData.sub_category] : [])
    ].filter(Boolean) as string[])
  ).sort((a, b) => a.localeCompare(b));

  const standardUnits = ['pcs', 'kg', 'gm', 'box', 'ltr', 'ml', 'packet', 'dozen', 'meter', 'roll', 'set', 'can'];
  const allUnits = Array.from(
    new Set([
      ...standardUnits,
      ...inventory.map(i => i.unit),
      ...(formData.unit ? [formData.unit] : [])
    ].filter(Boolean) as string[])
  );

  return (
    <div className="space-y-6">
      <div className="relative py-6 px-6 bg-gradient-to-b from-slate-50/90 via-white to-slate-50/40 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center text-center overflow-hidden">
        {/* Subtle Top Gradient Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary-500 via-sky-500 to-emerald-500" />

        {/* Dynamic Big Title in Uppercase with Stylish Display Font */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-wider uppercase font-['Outfit',sans-serif]">
          INVENTORY
        </h1>

        {/* Dynamic Subtitle */}
        <p className="text-sm sm:text-base font-medium text-slate-500 mt-2 max-w-lg leading-relaxed">
          Manage your products and stock levels.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Products</p>
          <p className="text-2xl font-bold text-slate-900">{inventoryWithStats.length}</p>
          <p className="text-xs text-slate-400 mt-1">{totalAvailableStock} items in stock</p>
        </Card>
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Stock Value</p>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalStockValue)}</p>
          <p className="text-xs text-slate-400 mt-1">Available inventory cost</p>
        </Card>
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Sales</p>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalSalesAmount)}</p>
          <p className="text-xs text-slate-400 mt-1">{totalSaleQty} items sold</p>
        </Card>
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Profit & Loss</p>
            <span className="text-xs font-medium text-slate-500">
              Expected: <span className={cn(
                "font-semibold",
                totalExpectedProfit < 0 ? "text-rose-600" : "text-blue-600"
              )}>
                {totalExpectedProfit < 0 ? `-${formatCurrency(Math.abs(totalExpectedProfit))}` : formatCurrency(totalExpectedProfit)}
              </span>
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalProfit - totalLoss)}</p>
            <span className="text-xs font-semibold text-emerald-600">+{formatCurrency(totalProfit)}</span>
            {totalLoss > 0 && <span className="text-xs font-semibold text-rose-600">-{formatCurrency(totalLoss)}</span>}
          </div>
          <p className="text-xs text-slate-400 mt-1">Net Realized Profit</p>
        </Card>
      </div>

      <Card className="p-0">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search products, SKU..." 
              className="w-full pl-10 pr-12 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button 
              onClick={() => { setScannerTarget('search'); setIsScannerOpen(true); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
              title="Scan Barcode"
            >
              <ScanLine className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select 
              className="bg-slate-50 border border-slate-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
            >
              <option value="all">All Companies</option>
              {allBrands.map(company => (
                <option key={company} value={company}>{company}</option>
              ))}
            </select>
            <select 
              className="bg-slate-50 border border-slate-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              {allCategories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <select 
              className="bg-slate-50 border border-slate-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
            >
              <option value="all">All Suppliers</option>
              {suppliers.map(supplier => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
            <select 
              className="bg-slate-50 border border-slate-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium text-slate-700"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="name_az">Sort: Name (A-Z)</option>
              <option value="company_az">Sort: Company Name (A-Z)</option>
              <option value="category_az">Sort: Categories (A-Z)</option>
            </select>
            {/* 0 Stock Filter ON/OFF Toggle Button */}
            <button
              type="button"
              onClick={() => setHideZeroStockTable(!hideZeroStockTable)}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer h-9",
                hideZeroStockTable 
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-xs" 
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              )}
              title="Toggle filter to hide or show 0 stock products"
            >
              <span>0 Stock Filter:</span>
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
                hideZeroStockTable ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
              )}>
                {hideZeroStockTable ? "ON" : "OFF"}
              </span>
            </button>
            <Button 
              variant="outline"
              size="sm"
              onClick={handleSyncStock}
              disabled={isSyncingStock}
              className="text-xs font-semibold h-9 text-slate-700 bg-white hover:bg-slate-50 border-slate-200"
              title="Audit & sync stock counts based on purchases and sales history"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5 text-primary-600", isSyncingStock && "animate-spin")} />
              {isSyncingStock ? 'Syncing...' : 'Sync Stock'}
            </Button>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => {
                setViewMode(viewMode === 'table' ? 'supplier_stock' : 'table');
              }}
              className={cn(
                "text-xs font-semibold h-9",
                viewMode === 'supplier_stock' ? "bg-primary-50 text-primary-700 border-primary-300" : "text-slate-700"
              )}
            >
              <Building2 className="w-4 h-4 mr-1.5" />
              {viewMode === 'supplier_stock' ? 'Show Table View' : 'Supplier Stock View'}
            </Button>
            <button 
              type="button"
              onClick={downloadPDF} 
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 hover:border-primary-300 shadow-2xs transition-all duration-150 cursor-pointer h-9 active:scale-[0.98]"
              title="Download Inventory PDF Report"
            >
              <Download className="w-4 h-4 text-primary-600" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {syncMessage && (
          <div className="mx-6 mb-3 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-800 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syncMessage}</span>
          </div>
        )}

        {viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 font-semibold text-slate-600 uppercase tracking-wider text-left whitespace-nowrap">Product Name</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 uppercase tracking-wider text-left whitespace-nowrap">Supplier</th>
                  <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Sale Price</th>
                  <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Purchase Price</th>
                  <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Purchase Qty</th>
                  <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Purchase Amount</th>
                  <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Sale Qty</th>
                  <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Sales Amount</th>
                  <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Available Stock</th>
                  <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Stock Value</th>
                  <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Expected Profit</th>
                  <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Profit</th>
                  <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Loss</th>
                  <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventoryWithStats.length > 0 ? inventoryWithStats.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Product Name: left-aligned, full text */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-left font-semibold text-slate-900 select-text">
                      <div className="flex flex-col">
                        <span className="text-sm">{item.name}</span>
                        {item.sku && <span className="text-[11px] text-slate-400 font-mono">{item.sku}</span>}
                      </div>
                    </td>
                    {/* Supplier: left-aligned, with view button to open supplier stock modal for this item */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-left text-slate-700">
                      {(() => {
                        const breakdown = getProductSupplierBreakdown(item);
                        const label = supplierFilter !== 'all'
                          ? (suppliers.find(s => s.id === supplierFilter)?.name || 'Filtered Supplier')
                          : (breakdown.length > 1 
                              ? `Multiple Suppliers (${breakdown.length})` 
                              : (breakdown[0]?.supplierName || (item.supplier_id && suppliers.find(s => s.id === item.supplier_id)?.name) || 'Direct / Store'));
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProductForSupplierStock(item);
                              setIsSupplierStockModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 font-medium text-slate-700 hover:text-primary-600 transition-colors cursor-pointer group"
                            title={`Click to view supplier stock breakdown for ${item.name}`}
                          >
                            <span>{label}</span>
                            <Eye className="w-3.5 h-3.5 text-slate-400 group-hover:text-primary-600 transition-colors" />
                          </button>
                        );
                      })()}
                    </td>
                    {/* Sale Price: centered */}
                    <td className="px-3 py-3.5 whitespace-nowrap text-center text-xs font-semibold text-slate-900">
                      {formatCurrency(item.unit_price)}
                    </td>
                    {/* Purchase Price: centered */}
                    <td className="px-3 py-3.5 whitespace-nowrap text-center text-xs text-slate-600">
                      {formatCurrency(item.stats.avgPurchasePrice)}
                    </td>
                    {/* Purchase Qty: centered */}
                    <td className="px-3 py-3.5 whitespace-nowrap text-center text-xs text-slate-700 font-medium">
                      {item.stats.purchaseQty}
                    </td>
                    {/* Purchase Amount: centered */}
                    <td className="px-3 py-3.5 whitespace-nowrap text-center text-xs text-slate-600">
                      {formatCurrency(item.stats.purchaseAmount)}
                    </td>
                    {/* Sale Qty: centered */}
                    <td className="px-3 py-3.5 whitespace-nowrap text-center text-xs text-slate-700 font-medium">
                      {item.stats.saleQty}
                    </td>
                    {/* Sales Amount: centered */}
                    <td className="px-3 py-3.5 whitespace-nowrap text-center text-xs text-slate-600">
                      {formatCurrency(item.stats.salesAmount)}
                    </td>
                    {/* Available Stock: centered */}
                    <td className="px-3 py-3.5 whitespace-nowrap text-center">
                      <span className={cn(
                        "text-xs font-bold px-2 py-0.5 rounded",
                        item.stats.availableStock <= 0 
                          ? "bg-rose-50 text-rose-700 border border-rose-200" 
                          : (item.min_stock_level > 0 && item.stats.availableStock <= item.min_stock_level)
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "text-slate-900"
                      )}>
                        {item.stats.availableStock}
                      </span>
                    </td>
                    {/* Stock Value: centered */}
                    <td className="px-3 py-3.5 whitespace-nowrap text-center text-xs text-slate-900 font-medium">
                      {formatCurrency(item.stats.stockValue)}
                    </td>
                    {/* Expected Profit: centered */}
                    <td className={cn(
                      "px-3 py-3.5 whitespace-nowrap text-center text-xs font-semibold",
                      item.stats.expectedProfit < 0 
                        ? "text-rose-600 font-bold" 
                        : item.stats.expectedProfit > 0 
                          ? "text-blue-600" 
                          : "text-slate-500"
                    )}>
                      {item.stats.expectedProfit < 0 
                        ? `-${formatCurrency(Math.abs(item.stats.expectedProfit))}` 
                        : formatCurrency(item.stats.expectedProfit)}
                    </td>
                    {/* Profit: centered */}
                    <td className="px-3 py-3.5 whitespace-nowrap text-center text-xs font-semibold text-emerald-600">
                      {item.stats.profit > 0 ? `+${formatCurrency(item.stats.profit)}` : '0.00'}
                    </td>
                    {/* Loss: centered */}
                    <td className="px-3 py-3.5 whitespace-nowrap text-center text-xs font-semibold text-rose-600">
                      {item.stats.loss > 0 ? `-${formatCurrency(item.stats.loss)}` : '0.00'}
                    </td>
                    {/* Action: Edit & Delete */}
                    <td className="px-3 py-3.5 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEdit(item)}
                          className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Product & Stock"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm({ isOpen: true, type: 'single', id: item.id })}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Product"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={14} className="px-6 py-12 text-center text-slate-400 text-sm">
                      No products found in inventory.
                    </td>
                  </tr>
                )}
              </tbody>
              {inventoryWithStats.length > 0 && (
                <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                  <tr>
                    <td className="px-4 py-3 text-xs text-slate-800 uppercase tracking-wider text-left">
                      Total ({inventoryWithStats.length} items)
                    </td>
                    <td className="px-4 py-3 text-left text-xs text-slate-400">-</td>
                    <td className="px-3 py-3 text-center text-xs text-slate-400">-</td>
                    <td className="px-3 py-3 text-center text-xs text-slate-400">-</td>
                    <td className="px-3 py-3 text-center text-xs text-slate-900">{totalPurchaseQty}</td>
                    <td className="px-3 py-3 text-center text-xs text-slate-900">{formatCurrency(totalPurchaseAmount)}</td>
                    <td className="px-3 py-3 text-center text-xs text-slate-900">{totalSaleQty}</td>
                    <td className="px-3 py-3 text-center text-xs text-slate-900">{formatCurrency(totalSalesAmount)}</td>
                    <td className="px-3 py-3 text-center text-xs text-slate-900 font-extrabold">{totalAvailableStock}</td>
                    <td className="px-3 py-3 text-center text-xs text-slate-900 font-extrabold">{formatCurrency(totalStockValue)}</td>
                    <td className={cn(
                      "px-3 py-3 text-center text-xs font-extrabold",
                      totalExpectedProfit < 0 ? "text-rose-700" : "text-blue-700"
                    )}>
                      {totalExpectedProfit < 0 ? `-${formatCurrency(Math.abs(totalExpectedProfit))}` : formatCurrency(totalExpectedProfit)}
                    </td>
                    <td className="px-3 py-3 text-center text-xs text-emerald-700 font-extrabold">+{formatCurrency(totalProfit)}</td>
                    <td className="px-3 py-3 text-center text-xs text-rose-700 font-extrabold">-{formatCurrency(totalLoss)}</td>
                    <td className="px-3 py-3 text-center text-xs text-slate-400">-</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        ) : (
          /* Simple List System: Product Name | Supplier Name | Stock */
          <div className="p-0">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by product name or supplier..."
                  value={supplierStockSearch}
                  onChange={(e) => setSupplierStockSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="flex items-center gap-2">
                {/* 0 Stock Filter ON/OFF Toggle Button */}
                <button
                  type="button"
                  onClick={() => setHideZeroStockSupplierView(!hideZeroStockSupplierView)}
                  className={cn(
                    "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer",
                    hideZeroStockSupplierView 
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-xs" 
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                  title="Toggle filter to hide or show 0 stock entries"
                >
                  <span>0 Stock Filter:</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
                    hideZeroStockSupplierView ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
                  )}>
                    {hideZeroStockSupplierView ? "ON" : "OFF"}
                  </span>
                </button>
                <span className="text-xs font-semibold text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs">
                  {hideZeroStockSupplierView ? 'In-Stock Items:' : 'Total Items:'} <span className="text-primary-700 font-bold">{filteredSupplierStockList.length}</span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className="text-xs font-semibold h-8"
                >
                  <TableIcon className="w-3.5 h-3.5 mr-1.5" />
                  Show Table View
                </Button>
                <button 
                  type="button"
                  onClick={downloadPDF} 
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 hover:border-primary-300 shadow-2xs transition-all duration-150 cursor-pointer h-8 active:scale-[0.98]"
                  title="Download Inventory PDF Report"
                >
                  <Download className="w-3.5 h-3.5 text-primary-600" />
                  <span>Export PDF</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 font-semibold text-slate-600 uppercase tracking-wider text-left whitespace-nowrap">Product Name</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 uppercase tracking-wider text-left whitespace-nowrap">Supplier</th>
                    <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Purchase Price</th>
                    <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Purchase Qty</th>
                    <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Purchase Amount</th>
                    <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Sale Qty</th>
                    <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Sales Amount</th>
                    <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Available Stock</th>
                    <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Stock Value</th>
                    <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Expected Profit</th>
                    <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Profit</th>
                    <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Loss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSupplierStockList.length > 0 ? (
                    filteredSupplierStockList.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5 whitespace-nowrap text-left font-semibold text-slate-900 select-text">
                          <div className="flex flex-col">
                            <span className="text-sm">{row.productName}</span>
                            {row.sku && <span className="text-[11px] text-slate-400 font-mono">{row.sku}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-left select-text">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-800">{row.supplierName}</span>
                            {row.supplierSL && row.supplierSL !== '-' && (
                              <span className="text-[10px] w-fit px-1.5 py-0.2 rounded bg-primary-50 text-primary-700 font-mono font-semibold mt-0.5">
                                {row.supplierSL}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap text-center text-slate-600">
                          {formatCurrency(row.purchasePrice)}
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap text-center text-slate-700 font-medium">
                          {row.purchaseQty}
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap text-center text-slate-600">
                          {formatCurrency(row.purchaseAmount)}
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap text-center text-slate-700 font-medium">
                          {row.saleQty}
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap text-center text-slate-600">
                          {formatCurrency(row.salesAmount)}
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap text-center">
                          <span className={cn(
                            "text-xs font-bold px-2 py-0.5 rounded",
                            row.availableStock <= 0
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "text-slate-900"
                          )}>
                            {row.availableStock}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap text-center text-slate-900 font-medium">
                          {formatCurrency(row.stockValue)}
                        </td>
                        <td className={cn(
                          "px-3 py-3.5 whitespace-nowrap text-center font-semibold",
                          row.expectedProfit < 0 ? "text-rose-600 font-bold" : (row.expectedProfit > 0 ? "text-blue-600" : "text-slate-500")
                        )}>
                          {row.expectedProfit < 0 ? `-${formatCurrency(Math.abs(row.expectedProfit))}` : formatCurrency(row.expectedProfit)}
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap text-center font-semibold text-emerald-600">
                          {row.profit > 0 ? `+${formatCurrency(row.profit)}` : '0.00'}
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap text-center font-semibold text-rose-600">
                          {row.loss > 0 ? `-${formatCurrency(row.loss)}` : '0.00'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={12} className="px-6 py-12 text-center text-slate-400 text-sm">
                        No supplier stock records found.
                      </td>
                    </tr>
                  )}
                </tbody>
                {filteredSupplierStockList.length > 0 && (() => {
                  const supTotalPurQty = filteredSupplierStockList.reduce((sum, r) => sum + r.purchaseQty, 0);
                  const supTotalPurAmt = filteredSupplierStockList.reduce((sum, r) => sum + r.purchaseAmount, 0);
                  const supTotalSaleQty = filteredSupplierStockList.reduce((sum, r) => sum + r.saleQty, 0);
                  const supTotalSaleAmt = filteredSupplierStockList.reduce((sum, r) => sum + r.salesAmount, 0);
                  const supTotalAvailStock = filteredSupplierStockList.reduce((sum, r) => sum + r.availableStock, 0);
                  const supTotalStockVal = filteredSupplierStockList.reduce((sum, r) => sum + r.stockValue, 0);
                  const supTotalExpProfit = filteredSupplierStockList.reduce((sum, r) => sum + r.expectedProfit, 0);
                  const supTotalProfit = filteredSupplierStockList.reduce((sum, r) => sum + r.profit, 0);
                  const supTotalLoss = filteredSupplierStockList.reduce((sum, r) => sum + r.loss, 0);

                  return (
                    <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                      <tr>
                        <td className="px-4 py-3 text-xs text-slate-800 uppercase tracking-wider text-left">
                          Total ({filteredSupplierStockList.length} Items)
                        </td>
                        <td className="px-4 py-3 text-left text-xs text-slate-400">-</td>
                        <td className="px-3 py-3 text-center text-xs text-slate-400">-</td>
                        <td className="px-3 py-3 text-center text-xs text-slate-900 font-extrabold">{supTotalPurQty}</td>
                        <td className="px-3 py-3 text-center text-xs text-slate-900 font-extrabold">{formatCurrency(supTotalPurAmt)}</td>
                        <td className="px-3 py-3 text-center text-xs text-slate-900 font-extrabold">{supTotalSaleQty}</td>
                        <td className="px-3 py-3 text-center text-xs text-slate-900 font-extrabold">{formatCurrency(supTotalSaleAmt)}</td>
                        <td className="px-3 py-3 text-center text-xs text-slate-900 font-extrabold">{supTotalAvailStock}</td>
                        <td className="px-3 py-3 text-center text-xs text-slate-900 font-extrabold">{formatCurrency(supTotalStockVal)}</td>
                        <td className={cn(
                          "px-3 py-3 text-center text-xs font-extrabold",
                          supTotalExpProfit < 0 ? "text-rose-700" : "text-blue-700"
                        )}>
                          {supTotalExpProfit < 0 ? `-${formatCurrency(Math.abs(supTotalExpProfit))}` : formatCurrency(supTotalExpProfit)}
                        </td>
                        <td className="px-3 py-3 text-center text-xs text-emerald-700 font-extrabold">+{formatCurrency(supTotalProfit)}</td>
                        <td className="px-3 py-3 text-center text-xs text-rose-700 font-extrabold">-{formatCurrency(supTotalLoss)}</td>
                      </tr>
                    </tfoot>
                  );
                })()}
              </table>
            </div>
          </div>
        )}
      </Card>

      {/* Add/Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="w-full max-w-3xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden relative my-8">
            {/* Top gradient accent line */}
            <div className="h-1.5 bg-gradient-to-r from-primary-600 via-sky-500 to-emerald-500 w-full" />

            <div className="p-6 md:p-8">
              {/* Header */}
              <div className="flex items-start justify-between pb-5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-600 shadow-xs">
                    <PackagePlus className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {editingItem ? "Edit Product Stock & Pricing" : "Add New Product"}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {editingItem 
                        ? "Update product pricing amounts, supplier-wise stock quantities, and low stock alert limit."
                        : "Enter product identity, brand classification, and stock alert preferences."}
                    </p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={closeModal} 
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddProduct} className="space-y-6 pt-5">
                {editingItem ? (
                  /* SIMPLIFIED EDIT FORM: PRICING AMOUNTS, SUPPLIER-WISE STOCK & ALERT SETTING */
                  <div className="space-y-5">
                    {/* Read-only Product Identity Banner */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Selected Product</span>
                          <h3 className="text-base font-bold text-slate-900">{editingItem.name}</h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          {editingItem.sku && (
                            <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-600 font-mono font-medium">
                              SKU: {editingItem.sku}
                            </span>
                          )}
                          {editingItem.company && (
                            <span className="px-2.5 py-1 bg-primary-50 border border-primary-200 rounded-lg text-primary-700 font-semibold">
                              {editingItem.company}
                            </span>
                          )}
                          {editingItem.category && (
                            <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-medium">
                              {editingItem.category}
                            </span>
                          )}
                          <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 font-semibold uppercase">
                            Unit: {editingItem.unit || 'pcs'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 1. Pricing & Amount Update Section */}
                    <div className="bg-slate-50/80 rounded-xl p-5 border border-slate-200 space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                          <DollarSign className="w-4 h-4 text-emerald-600" />
                          <span>Pricing & Amounts</span>
                        </div>
                        {/* Live Profit Margin Badge */}
                        {(Number(formData.unit_price) > 0 || Number(formData.cost_price) > 0) && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-slate-500 font-medium">Estimated Margin:</span>
                            <span className={cn(
                              "font-bold px-2 py-0.5 rounded text-[11px]",
                              Number(formData.unit_price) >= Number(formData.cost_price)
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            )}>
                              {formatCurrency(Number(formData.unit_price) - Number(formData.cost_price))}
                              {Number(formData.cost_price) > 0 && ` (${(((Number(formData.unit_price) - Number(formData.cost_price)) / Number(formData.cost_price)) * 100).toFixed(1)}%)`}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                        {/* Purchase / Cost Price */}
                        <div>
                          <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                            Purchase / Cost Price (৳)
                          </label>
                          <div className="relative">
                            <input 
                              type="number" 
                              min="0"
                              step="any"
                              placeholder="0.00"
                              value={formData.cost_price === 0 ? '' : formData.cost_price}
                              onChange={e => setFormData({...formData, cost_price: parseFloat(e.target.value) || 0})}
                              className="w-full h-10 pl-3.5 pr-8 bg-white rounded-lg border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-xs"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">৳</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">Unit purchase cost</p>
                        </div>

                        {/* Retail Sale Price */}
                        <div>
                          <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                            Sale Price (৳) <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input 
                              type="number" 
                              min="0"
                              step="any"
                              required
                              placeholder="0.00"
                              value={formData.unit_price === 0 ? '' : formData.unit_price}
                              onChange={e => setFormData({...formData, unit_price: parseFloat(e.target.value) || 0})}
                              className="w-full h-10 pl-3.5 pr-8 bg-white rounded-lg border border-slate-300 text-sm font-bold text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-xs"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">৳</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">Retail selling price</p>
                        </div>

                        {/* MRP Price */}
                        <div>
                          <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                            MRP Price (৳)
                          </label>
                          <div className="relative">
                            <input 
                              type="number" 
                              min="0"
                              step="any"
                              placeholder="0.00"
                              value={formData.mrp === 0 ? '' : formData.mrp}
                              onChange={e => setFormData({...formData, mrp: parseFloat(e.target.value) || 0})}
                              className="w-full h-10 pl-3.5 pr-8 bg-white rounded-lg border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-xs"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">৳</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">Maximum retail price</p>
                        </div>

                        {/* Dealer Price */}
                        <div>
                          <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                            Dealer / Wholesale (৳)
                          </label>
                          <div className="relative">
                            <input 
                              type="number" 
                              min="0"
                              step="any"
                              placeholder="0.00"
                              value={formData.dealer_price === 0 ? '' : formData.dealer_price}
                              onChange={e => setFormData({...formData, dealer_price: parseFloat(e.target.value) || 0})}
                              className="w-full h-10 pl-3.5 pr-8 bg-white rounded-lg border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-xs"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">৳</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">Wholesale dealer price</p>
                        </div>
                      </div>
                    </div>

                    {/* 2. Low Stock Alert Setting */}
                    <div className="bg-amber-50/60 rounded-xl p-5 border border-amber-200/80 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span>Low Stock Alert Setting</span>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                          Alert Quantity <span className="text-red-500">*</span>
                        </label>
                        <div className="relative max-w-xs">
                          <input 
                            type="number" 
                            min="0"
                            required
                            placeholder="5"
                            value={formData.min_stock_level}
                            onChange={e => setFormData({...formData, min_stock_level: parseInt(e.target.value) || 0})}
                            className="w-full h-11 px-3.5 pr-14 bg-white rounded-lg border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-xs"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase">
                            {editingItem.unit || 'pcs'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1.5">
                          Shows a low stock alert when total quantity falls below this threshold.
                        </p>
                      </div>
                    </div>

                    {/* 3. Supplier-Wise Stock Allocation */}
                    <div className="bg-slate-50/80 rounded-xl p-5 border border-slate-200 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                          <Building2 className="w-4 h-4 text-primary-600" />
                          <span>Supplier-Wise Stock Allocation</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const firstAvailableSupp = suppliers.find(s => !supplierStocks.some(row => row.supplier_id === s.id));
                            setSupplierStocks(prev => [
                              ...prev,
                              { supplier_id: firstAvailableSupp ? firstAvailableSupp.id : (suppliers[0]?.id || ''), quantity: 0 }
                            ]);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 text-primary-600" />
                          <span>Add Supplier Stock</span>
                        </button>
                      </div>

                      {/* Supplier Stock Rows Table / List */}
                      <div className="space-y-3">
                        {supplierStocks.map((row, index) => (
                          <div key={index} className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            {/* Supplier Selector */}
                            <div className="flex-1">
                              <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Supplier</label>
                              <select
                                value={row.supplier_id}
                                onChange={e => {
                                  const val = e.target.value;
                                  setSupplierStocks(prev => prev.map((item, i) => i === index ? { ...item, supplier_id: val } : item));
                                }}
                                className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                              >
                                <option value="">Direct / Store Inventory</option>
                                {suppliers.map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                            </div>

                            {/* Stock Quantity Input */}
                            <div className="w-full sm:w-44">
                              <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Stock Quantity</label>
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={row.quantity}
                                  onChange={e => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setSupplierStocks(prev => prev.map((item, i) => i === index ? { ...item, quantity: val } : item));
                                  }}
                                  className="w-full h-10 px-3 pr-12 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                  placeholder="0"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase">
                                  {editingItem.unit || 'pcs'}
                                </span>
                              </div>
                            </div>

                            {/* Remove Row Button */}
                            {supplierStocks.length > 1 && (
                              <div className="sm:pt-5 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => setSupplierStocks(prev => prev.filter((_, i) => i !== index))}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Remove this supplier stock entry"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Summary calculation card */}
                      <div className="p-3.5 bg-primary-50/70 border border-primary-200 rounded-xl flex items-center justify-between">
                        <span className="text-xs font-bold text-primary-900">Total Product Stock:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-extrabold text-primary-700">
                            {supplierStocks.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)} {editingItem.unit || 'pcs'}
                          </span>
                          {supplierStocks.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0) <= formData.min_stock_level ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                              Low Stock Alert
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                              Optimal Stock
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* FULL ADD PRODUCT FORM FOR CREATING A NEW PRODUCT */
                  <>
                    {/* 1. Identification Section */}
                    <div className="bg-slate-50/70 rounded-xl p-4 md:p-5 border border-slate-200/80 space-y-4">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        <Package className="w-4 h-4 text-primary-600" />
                        Product Identity
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                          Product Name <span className="text-red-500">*</span>
                        </label>
                        <input 
                          type="text"
                          placeholder="e.g. Basmati Rice 5kg, Premium Cotton Shirt, Wireless Mouse..." 
                          required 
                          value={formData.name}
                          onChange={e => setFormData({...formData, name: e.target.value})}
                          className="w-full h-11 px-3.5 bg-white rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all shadow-xs"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-slate-700">
                              Barcode / SKU
                            </label>
                            <button
                              type="button"
                              onClick={generateAutoSKU}
                              className="text-xs text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1 hover:underline"
                            >
                              <Sparkles className="w-3 h-3" />
                              Auto Generate
                            </button>
                          </div>
                          <div className="relative flex items-center">
                            <input 
                              type="text"
                              placeholder="e.g. SKU-128490 or scan barcode"
                              value={formData.sku}
                              onChange={e => setFormData({...formData, sku: e.target.value})}
                              className="w-full h-10 pl-3.5 pr-10 bg-white rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all font-mono"
                            />
                            <button 
                              type="button"
                              onClick={() => { setScannerTarget('sku'); setIsScannerOpen(true); }}
                              className="absolute right-2 p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
                              title="Scan Barcode with Camera"
                            >
                              <ScanLine className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                            Item Code / Model No <span className="text-slate-400 font-normal">(Optional)</span>
                          </label>
                          <input 
                            type="text"
                            placeholder="e.g. ITM-042, MOD-2024"
                            value={formData.item_code}
                            onChange={e => setFormData({...formData, item_code: e.target.value})}
                            className="w-full h-10 px-3.5 bg-white rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 2. Brand & Categorization Section */}
                    <div className="bg-slate-50/70 rounded-xl p-4 md:p-5 border border-slate-200/80 space-y-4">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        <FolderTree className="w-4 h-4 text-primary-600" />
                        Classification & Brand
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Brand / Company */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-slate-400" />
                              Brand / Company
                            </label>
                            {!isAddingBrand && (
                              <button
                                type="button"
                                onClick={() => { setIsAddingBrand(true); setNewBrandInput(''); }}
                                className="text-xs text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1 hover:underline"
                              >
                                <Plus className="w-3 h-3" />
                                New Brand
                              </button>
                            )}
                          </div>

                          {isAddingBrand ? (
                            <div className="p-2.5 bg-white rounded-lg border border-primary-200 shadow-xs space-y-2">
                              <input
                                type="text"
                                autoFocus
                                placeholder="Enter new brand name..."
                                value={newBrandInput}
                                onChange={e => setNewBrandInput(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveQuickBrand();
                                  } else if (e.key === 'Escape') {
                                    setIsAddingBrand(false);
                                  }
                                }}
                                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-md text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setIsAddingBrand(false)}
                                  className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 rounded"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={handleSaveQuickBrand}
                                  className="px-3 py-1 bg-primary-600 text-white rounded text-xs font-medium hover:bg-primary-700 transition-colors inline-flex items-center gap-1"
                                >
                                  <Check className="w-3 h-3" />
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <select 
                              className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-xs"
                              value={formData.company}
                              onChange={e => setFormData({...formData, company: e.target.value})}
                            >
                              <option value="">Select Brand / Company</option>
                              {allBrands.map(company => (
                                <option key={company} value={company}>{company}</option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* Product Category */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                              <FolderTree className="w-3.5 h-3.5 text-slate-400" />
                              Product Category <span className="text-red-500">*</span>
                            </label>
                            {!isAddingCategory && (
                              <button
                                type="button"
                                onClick={() => { setIsAddingCategory(true); setNewCategoryInput(''); }}
                                className="text-xs text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1 hover:underline"
                              >
                                <Plus className="w-3 h-3" />
                                New Category
                              </button>
                            )}
                          </div>

                          {isAddingCategory ? (
                            <div className="p-2.5 bg-white rounded-lg border border-primary-200 shadow-xs space-y-2">
                              <input
                                type="text"
                                autoFocus
                                placeholder="Enter new category name..."
                                value={newCategoryInput}
                                onChange={e => setNewCategoryInput(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveQuickCategory();
                                  } else if (e.key === 'Escape') {
                                    setIsAddingCategory(false);
                                  }
                                }}
                                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-md text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setIsAddingCategory(false)}
                                  className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 rounded"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={handleSaveQuickCategory}
                                  className="px-3 py-1 bg-primary-600 text-white rounded text-xs font-medium hover:bg-primary-700 transition-colors inline-flex items-center gap-1"
                                >
                                  <Check className="w-3 h-3" />
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <select 
                              className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-xs"
                              required
                              value={formData.category}
                              onChange={e => setFormData({...formData, category: e.target.value, sub_category: ''})}
                            >
                              <option value="">Select Category</option>
                              {allCategories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>

                      {/* SubCategory row */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                            Sub-Category
                            <span className="text-slate-400 font-normal">
                              {formData.category ? "(Optional)" : "(Select category first)"}
                            </span>
                          </label>
                          {formData.category && !isAddingSubCategory && (
                            <button
                              type="button"
                              onClick={() => { setIsAddingSubCategory(true); setNewSubCategoryInput(''); }}
                              className="text-xs text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1 hover:underline"
                            >
                              <Plus className="w-3 h-3" />
                              New Sub-Category
                            </button>
                          )}
                        </div>

                        {isAddingSubCategory ? (
                          <div className="p-2.5 bg-white rounded-lg border border-primary-200 shadow-xs space-y-2">
                            <input
                              type="text"
                              autoFocus
                              placeholder={`Enter sub-category for "${formData.category}"...`}
                              value={newSubCategoryInput}
                              onChange={e => setNewSubCategoryInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveQuickSubCategory();
                                } else if (e.key === 'Escape') {
                                  setIsAddingSubCategory(false);
                                }
                              }}
                              className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-md text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setIsAddingSubCategory(false)}
                                className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 rounded"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveQuickSubCategory}
                                className="px-3 py-1 bg-primary-600 text-white rounded text-xs font-medium hover:bg-primary-700 transition-colors inline-flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" />
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <select 
                            className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed shadow-xs"
                            value={formData.sub_category}
                            onChange={e => setFormData({...formData, sub_category: e.target.value})}
                            disabled={!formData.category}
                          >
                            <option value="">
                              {formData.category ? "Select Sub-Category (Optional)" : "Select a category first"}
                            </option>
                            {allSubCategories.map(sub => (
                              <option key={sub} value={sub}>{sub}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>

                    {/* 3. Measurement, Supplier & Stock Rules */}
                    <div className="bg-slate-50/70 rounded-xl p-4 md:p-5 border border-slate-200/80 space-y-4">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        <AlertCircle className="w-4 h-4 text-primary-600" />
                        Unit & Stock Settings
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Unit */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-slate-700">
                              Unit <span className="text-red-500">*</span>
                            </label>
                            {!isAddingUnit && (
                              <button
                                type="button"
                                onClick={() => { setIsAddingUnit(true); setNewUnitInput(''); }}
                                className="text-xs text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1 hover:underline"
                              >
                                <Plus className="w-3 h-3" />
                                Custom Unit
                              </button>
                            )}
                          </div>

                          {isAddingUnit ? (
                            <div className="p-2 bg-white rounded-lg border border-primary-200 shadow-xs space-y-1.5">
                              <input
                                type="text"
                                autoFocus
                                placeholder="e.g. bundle, roll..."
                                value={newUnitInput}
                                onChange={e => setNewUnitInput(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveQuickUnit();
                                  } else if (e.key === 'Escape') {
                                    setIsAddingUnit(false);
                                  }
                                }}
                                className="w-full h-8 px-2.5 bg-slate-50 border border-slate-200 rounded text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => setIsAddingUnit(false)}
                                  className="px-2 py-0.5 text-xs text-slate-500 hover:text-slate-700"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={handleSaveQuickUnit}
                                  className="px-2.5 py-0.5 bg-primary-600 text-white rounded text-xs font-medium hover:bg-primary-700"
                                >
                                  Add
                                </button>
                              </div>
                            </div>
                          ) : (
                            <select 
                              className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-xs"
                              value={formData.unit}
                              onChange={e => setFormData({...formData, unit: e.target.value})}
                            >
                              {allUnits.map(unit => (
                                <option key={unit} value={unit}>{unit.toUpperCase()}</option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* Alert Quantity */}
                        <div>
                          <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                            Alert Quantity
                          </label>
                          <input 
                            type="number"
                            min="0"
                            placeholder="e.g. 5"
                            value={formData.min_stock_level}
                            onChange={e => setFormData({...formData, min_stock_level: parseInt(e.target.value) || 0})}
                            className="w-full h-10 px-3.5 bg-white rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-xs"
                          />
                          <p className="text-[11px] text-slate-400 mt-1">Warns when stock dips below this level</p>
                        </div>

                        {/* Preferred Supplier */}
                        <div>
                          <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                            Default Supplier <span className="text-slate-400 font-normal">(Optional)</span>
                          </label>
                          <select 
                            className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-xs"
                            value={formData.supplier_id}
                            onChange={e => setFormData({...formData, supplier_id: e.target.value})}
                          >
                            <option value="">No Default Supplier</option>
                            {suppliers.map(sup => (
                              <option key={sup.id} value={sup.id}>{sup.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Stock Management switch */}
                      <div className="flex items-center justify-between p-3.5 bg-white rounded-lg border border-slate-200 mt-2">
                        <div>
                          <div className="text-sm font-semibold text-slate-800">Track Inventory Stock</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Automatically update stock quantities during purchases and sales transactions
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData({...formData, manage_stock: !formData.manage_stock})}
                          className={cn(
                            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2",
                            formData.manage_stock ? "bg-emerald-500" : "bg-slate-300"
                          )}
                        >
                          <span
                            className={cn(
                              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                              formData.manage_stock ? "translate-x-5" : "translate-x-0"
                            )}
                          />
                        </button>
                      </div>
                    </div>

                    {/* 4. Pricing & Initial / Current Stock Quantity */}
                    <div className="bg-slate-50/70 rounded-xl p-4 md:p-5 border border-slate-200/80 space-y-4">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        <Package className="w-4 h-4 text-primary-600" />
                        Stock Quantity & Pricing
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        {/* Stock Quantity */}
                        <div>
                          <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                            Stock Quantity <span className="text-red-500">*</span>
                          </label>
                          <input 
                            type="number" 
                            min="0"
                            step="any"
                            placeholder="0"
                            value={formData.quantity}
                            onChange={e => setFormData({...formData, quantity: parseFloat(e.target.value) || 0})}
                            className="w-full h-10 px-3.5 bg-white rounded-lg border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-xs"
                          />
                          <p className="text-[11px] text-slate-400 mt-1">Available quantity in stock</p>
                        </div>

                        {/* Purchase Price / Cost */}
                        <div>
                          <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                            Purchase / Cost Price (৳)
                          </label>
                          <input 
                            type="number" 
                            min="0"
                            step="any"
                            placeholder="0.00"
                            value={formData.cost_price || ''}
                            onChange={e => setFormData({...formData, cost_price: parseFloat(e.target.value) || 0})}
                            className="w-full h-10 px-3.5 bg-white rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-xs"
                          />
                          <p className="text-[11px] text-slate-400 mt-1">Unit purchase price</p>
                        </div>

                        {/* Retail Sale Price */}
                        <div>
                          <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                            Sale Price (৳)
                          </label>
                          <input 
                            type="number" 
                            min="0"
                            step="any"
                            placeholder="0.00"
                            value={formData.unit_price || ''}
                            onChange={e => setFormData({...formData, unit_price: parseFloat(e.target.value) || 0})}
                            className="w-full h-10 px-3.5 bg-white rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-xs"
                          />
                          <p className="text-[11px] text-slate-400 mt-1">Retail selling price</p>
                        </div>

                        {/* MRP Price */}
                        <div>
                          <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                            MRP Price (৳)
                          </label>
                          <input 
                            type="number" 
                            min="0"
                            step="any"
                            placeholder="0.00"
                            value={formData.mrp || ''}
                            onChange={e => setFormData({...formData, mrp: parseFloat(e.target.value) || 0})}
                            className="w-full h-10 px-3.5 bg-white rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-xs"
                          />
                          <p className="text-[11px] text-slate-400 mt-1">Maximum retail price</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Actions Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div className="text-xs text-slate-400">
                    Fields marked with <span className="text-red-500 font-bold">*</span> are required
                  </div>
                  <div className="flex items-center gap-3">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={closeModal} 
                      className="h-10 px-5 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      className="h-10 px-6 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium shadow-sm"
                    >
                      {editingItem ? "Save Changes" : "Create Product"}
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Change Modal */}
      {isBulkChangeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-2xl" title={`Bulk Change (${selectedIds.length} items)`}>
            <form onSubmit={handleBulkChange} className="space-y-4">
              <p className="text-sm text-slate-500 mb-4">Select the fields you want to update for all selected items. Leave blank to keep current values.</p>
              
              <Input 
                label="New Category" 
                placeholder="e.g. Beverages"
                value={bulkChangeData.category}
                onChange={e => setBulkChangeData({...bulkChangeData, category: e.target.value})}
              />

              <Input 
                label="New Company" 
                placeholder="e.g. Acme Corp"
                value={bulkChangeData.company}
                onChange={e => setBulkChangeData({...bulkChangeData, company: e.target.value})}
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsBulkChangeModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={!bulkChangeData.category && !bulkChangeData.company}>Apply Changes</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {isBulkUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-2xl" title="Bulk Upload Products">
            <div className="space-y-6">
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                <p className="text-sm text-blue-800 leading-relaxed">
                  <strong>Instructions:</strong><br />
                  1. Download the template first.<br />
                  2. Fill in the product details (Product and SKU are required).<br />
                  3. Upload your file.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <Button 
                  className="w-full py-6 border-2 border-dashed border-slate-200 hover:border-primary-400 hover:bg-primary-50 transition-all group"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center">
                    <Upload className="w-6 h-6 mb-2 text-slate-400 group-hover:text-primary-500" />
                    <span className="text-sm font-medium text-slate-600 group-hover:text-primary-700">Click to Select Excel/CSV File</span>
                  </div>
                </Button>
                <Button variant="outline" onClick={() => setIsBulkUploadModalOpen(false)}>Cancel</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <Card className="w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4 text-red-600">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-lg font-bold">Confirm Deletion</h3>
            </div>
            <p className="text-slate-600 mb-6">
              {deleteConfirm.type === 'bulk' 
                ? `Are you sure you want to delete ${selectedIds.length} selected items? They will be moved to the Recycle Bin and can be restored anytime.` 
                : 'Are you sure you want to delete this product? It will be moved to the Recycle Bin and can be restored anytime.'}
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteConfirm({ isOpen: false, type: 'single' })}>
                Cancel
              </Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={confirmDelete}>
                Delete
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Supplier Stock Breakdown Modal */}
      {isSupplierStockModalOpen && selectedProductForSupplierStock && (() => {
        const breakdown = getProductSupplierBreakdown(selectedProductForSupplierStock);
        // Toggle 0 stock filter based on hideZeroStockModal
        const activeBreakdown = hideZeroStockModal 
          ? breakdown.filter(entry => entry.availableStock > 0)
          : breakdown;
        
        const modalTotalPurchaseQty = activeBreakdown.reduce((sum, e) => sum + e.purchaseQty, 0);
        const modalTotalPurchaseAmount = activeBreakdown.reduce((sum, e) => sum + e.purchaseAmount, 0);
        const modalTotalSaleQty = activeBreakdown.reduce((sum, e) => sum + e.saleQty, 0);
        const modalTotalSalesAmount = activeBreakdown.reduce((sum, e) => sum + e.salesAmount, 0);
        const modalTotalAvailableStock = activeBreakdown.reduce((sum, e) => sum + e.availableStock, 0);
        const modalTotalStockValue = activeBreakdown.reduce((sum, e) => sum + e.stockValue, 0);
        const modalTotalExpectedProfit = activeBreakdown.reduce((sum, e) => sum + e.expectedProfit, 0);
        const modalTotalProfit = activeBreakdown.reduce((sum, e) => sum + e.profit, 0);
        const modalTotalLoss = activeBreakdown.reduce((sum, e) => sum + e.loss, 0);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
            <div className="w-full max-w-6xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden relative my-8">
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-600 shadow-xs shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900 leading-tight">
                        {selectedProductForSupplierStock.name}
                      </h2>
                      {selectedProductForSupplierStock.sku && (
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono font-medium">
                          {selectedProductForSupplierStock.sku}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                      <span>Supplier-wise Stock, Purchases &amp; Profit/Loss Breakdown</span>
                      <span>•</span>
                      <span>Sale Price: <strong className="text-slate-900 font-bold">{formatCurrency(selectedProductForSupplierStock.unit_price)}</strong></span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* 0 Stock Filter ON/OFF Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setHideZeroStockModal(!hideZeroStockModal)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer",
                      hideZeroStockModal 
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-xs" 
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                    )}
                    title="Toggle filter to hide or show 0 stock suppliers"
                  >
                    <span>0 Stock Filter:</span>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
                      hideZeroStockModal ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
                    )}>
                      {hideZeroStockModal ? "ON" : "OFF"}
                    </span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsSupplierStockModalOpen(false)} 
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Complete Supplier Breakdown Table */}
              <div className="p-0">
                <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50/90 border-b border-slate-200 sticky top-0 z-10">
                        <th className="px-4 py-3 font-semibold text-slate-600 uppercase tracking-wider text-left whitespace-nowrap">Supplier</th>
                        <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Purchase Price</th>
                        <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Purchase Qty</th>
                        <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Purchase Amount</th>
                        <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Sale Qty</th>
                        <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Sales Amount</th>
                        <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Available Stock</th>
                        <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Stock Value</th>
                        <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Expected Profit</th>
                        <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Profit</th>
                        <th className="px-3 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center whitespace-nowrap">Loss</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeBreakdown.length > 0 ? (
                        activeBreakdown.map((entry, idx) => (
                          <tr key={entry.supplierId || idx} className="hover:bg-slate-50/80 transition-colors">
                            {/* Supplier Name & SL */}
                            <td className="px-4 py-3.5 whitespace-nowrap text-left select-text">
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-900">{entry.supplierName}</span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {entry.supplier_sl && entry.supplier_sl !== '-' && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary-50 text-primary-700 font-mono font-semibold">
                                      {entry.supplier_sl}
                                    </span>
                                  )}
                                  {entry.phone && (
                                    <span className="text-[11px] text-slate-400 font-normal">
                                      {entry.phone}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            {/* Purchase Price */}
                            <td className="px-3 py-3.5 whitespace-nowrap text-center text-slate-600">
                              {formatCurrency(entry.purchasePrice)}
                            </td>
                            {/* Purchase Qty */}
                            <td className="px-3 py-3.5 whitespace-nowrap text-center text-slate-700 font-medium">
                              {entry.purchaseQty}
                            </td>
                            {/* Purchase Amount */}
                            <td className="px-3 py-3.5 whitespace-nowrap text-center text-slate-600">
                              {formatCurrency(entry.purchaseAmount)}
                            </td>
                            {/* Sale Qty */}
                            <td className="px-3 py-3.5 whitespace-nowrap text-center text-slate-700 font-medium">
                              {entry.saleQty}
                            </td>
                            {/* Sales Amount */}
                            <td className="px-3 py-3.5 whitespace-nowrap text-center text-slate-600">
                              {formatCurrency(entry.salesAmount)}
                            </td>
                            {/* Available Stock */}
                            <td className="px-3 py-3.5 whitespace-nowrap text-center">
                              <span className={cn(
                                "text-xs font-bold px-2 py-0.5 rounded",
                                entry.availableStock <= 0
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : "text-slate-900"
                              )}>
                                {entry.availableStock}
                              </span>
                            </td>
                            {/* Stock Value */}
                            <td className="px-3 py-3.5 whitespace-nowrap text-center text-slate-900 font-medium">
                              {formatCurrency(entry.stockValue)}
                            </td>
                            {/* Expected Profit */}
                            <td className={cn(
                              "px-3 py-3.5 whitespace-nowrap text-center font-semibold",
                              entry.expectedProfit < 0 ? "text-rose-600 font-bold" : (entry.expectedProfit > 0 ? "text-blue-600" : "text-slate-500")
                            )}>
                              {entry.expectedProfit < 0 ? `-${formatCurrency(Math.abs(entry.expectedProfit))}` : formatCurrency(entry.expectedProfit)}
                            </td>
                            {/* Profit */}
                            <td className="px-3 py-3.5 whitespace-nowrap text-center font-semibold text-emerald-600">
                              {entry.profit > 0 ? `+${formatCurrency(entry.profit)}` : '0.00'}
                            </td>
                            {/* Loss */}
                            <td className="px-3 py-3.5 whitespace-nowrap text-center font-semibold text-rose-600">
                              {entry.loss > 0 ? `-${formatCurrency(entry.loss)}` : '0.00'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={11} className="px-6 py-10 text-center text-slate-400 text-xs">
                            No supplier stock records found for this product.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {activeBreakdown.length > 0 && (
                      <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                        <tr>
                          <td className="px-4 py-3 text-xs text-slate-800 uppercase tracking-wider text-left">
                            Total ({activeBreakdown.length} Suppliers)
                          </td>
                          <td className="px-3 py-3 text-center text-xs text-slate-400">-</td>
                          <td className="px-3 py-3 text-center text-xs text-slate-900 font-extrabold">{modalTotalPurchaseQty}</td>
                          <td className="px-3 py-3 text-center text-xs text-slate-900 font-extrabold">{formatCurrency(modalTotalPurchaseAmount)}</td>
                          <td className="px-3 py-3 text-center text-xs text-slate-900 font-extrabold">{modalTotalSaleQty}</td>
                          <td className="px-3 py-3 text-center text-xs text-slate-900 font-extrabold">{formatCurrency(modalTotalSalesAmount)}</td>
                          <td className="px-3 py-3 text-center text-xs text-slate-900 font-extrabold">{modalTotalAvailableStock}</td>
                          <td className="px-3 py-3 text-center text-xs text-slate-900 font-extrabold">{formatCurrency(modalTotalStockValue)}</td>
                          <td className={cn(
                            "px-3 py-3 text-center text-xs font-extrabold",
                            modalTotalExpectedProfit < 0 ? "text-rose-700" : "text-blue-700"
                          )}>
                            {modalTotalExpectedProfit < 0 ? `-${formatCurrency(Math.abs(modalTotalExpectedProfit))}` : formatCurrency(modalTotalExpectedProfit)}
                          </td>
                          <td className="px-3 py-3 text-center text-xs text-emerald-700 font-extrabold">+{formatCurrency(modalTotalProfit)}</td>
                          <td className="px-3 py-3 text-center text-xs text-rose-700 font-extrabold">-{formatCurrency(modalTotalLoss)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/30">
                <span className="text-xs text-slate-500 font-medium">
                  Showing {activeBreakdown.length} supplier batch{activeBreakdown.length === 1 ? '' : 'es'}
                </span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsSupplierStockModalOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Barcode Scanner */}
      {isScannerOpen && (
        <BarcodeScanner 
          onScan={(decodedText) => {
            if (scannerTarget === 'search') {
              setSearchTerm(decodedText);
            } else if (scannerTarget === 'sku') {
              setFormData({ ...formData, sku: decodedText });
            } else if (scannerTarget === 'item_code') {
              setFormData({ ...formData, item_code: decodedText });
            }
            setIsScannerOpen(false);
          }} 
          onClose={() => setIsScannerOpen(false)} 
        />
      )}
    </div>
  );
};
