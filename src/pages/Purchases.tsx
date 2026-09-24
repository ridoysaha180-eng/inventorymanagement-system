import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Search, Edit2, Calendar, Download, ShoppingBag, X, Trash2, 
  Printer, CheckCircle2, ScanLine, FileSpreadsheet, Layers, Banknote, 
  CreditCard, ArrowLeftRight, Eye, ShieldCheck, Building2, Store, 
  Clock, RefreshCw, AlertCircle, PackageCheck, User, ArrowLeft,
  TrendingUp, TrendingDown, Percent, BadgePercent, Tag, PackagePlus, Sparkles,
  Maximize2, Minimize2, Receipt
} from 'lucide-react';
import * as XLSX from 'xlsx';
import QRCodeLib from 'qrcode';
import QRCode from 'react-qr-code';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { formatCurrency, cn } from '../utils';
import { storageService } from '../services/storageService';
import { InventoryItem, Purchase, PurchaseItem, Supplier, Brand, Category } from '../types';
import { BarcodeScanner } from '../components/common/BarcodeScanner';
import { AddProductModal } from '../components/common/AddProductModal';

const formatDateInvoice = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

export const Purchases: React.FC = () => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categoriesList, setCategoriesList] = useState<Category[]>([]);

  // Filtering & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // View Mode: Invoices Table vs Product Purchases Summary
  const [viewMode, setViewMode] = useState<'table' | 'product_summary'>('table');
  const [productSummarySearch, setProductSummarySearch] = useState('');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPurchaseFullscreen, setIsPurchaseFullscreen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [invoiceCopyType, setInvoiceCopyType] = useState<'supplier' | 'office' | 'both'>('supplier');
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id?: string }>({ isOpen: false });

  // Quick Supplier Creation
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierAddress, setNewSupplierAddress] = useState('');

  // Quick Product Creation
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);

  const handleProductAddedFromModal = (newProduct: InventoryItem) => {
    setInventory(storageService.getInventory());
    setBrands(storageService.getBrands());
    setCategoriesList(storageService.getCategories());
    addToCart(newProduct);
  };

  // Scanner state
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // New Purchase POS / Inflow State
  const [cart, setCart] = useState<(PurchaseItem & { 
    name: string; 
    sku: string; 
    total_quantity: number; 
    default_sales_price: number; 
    total_amount_input?: string; 
  })[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedCompany, setSelectedCompany] = useState('All');
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(0);

  const businessSettings = storageService.getBusinessSettings();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setPurchases(storageService.getPurchases() || []);
    setInventory(storageService.getInventory() || []);
    setSuppliers(storageService.getSuppliers() || []);
    setBrands(storageService.getBrands() || []);
    setCategoriesList(storageService.getCategories() || []);
  };

  // Helper to determine the product's default sales price from inventory
  const getProductDefaultSalesPrice = (item: { inventory_item_id?: string; sku?: string; item_name?: string; default_sales_price?: number }): number => {
    if (typeof item.default_sales_price === 'number' && item.default_sales_price > 0) {
      return item.default_sales_price;
    }
    const invItem = inventory.find(i => 
      (item.inventory_item_id && i.id === item.inventory_item_id) ||
      (item.sku && i.sku === item.sku) ||
      (item.item_name && i.name.toLowerCase() === item.item_name.toLowerCase())
    );
    return invItem?.unit_price || invItem?.mrp || 0;
  };

  // Helper to calculate estimated sales and profit for a purchase bill
  const getPurchaseEstimatedFinancials = (purchase: Purchase) => {
    let estSalesTotal = 0;
    let costSubtotal = 0;

    (purchase.items || []).forEach(item => {
      const salesPrice = getProductDefaultSalesPrice(item);
      const qty = item.quantity || 0;
      const unitCost = item.unit_price || 0;
      estSalesTotal += qty * salesPrice;
      costSubtotal += qty * unitCost;
    });

    const netCost = purchase.total_amount ?? Math.max(0, costSubtotal - (purchase.discount_amount || 0) + (purchase.tax_amount || 0));
    const estimatedProfit = purchase.estimated_profit !== undefined ? purchase.estimated_profit : (estSalesTotal - netCost);
    const estSales = purchase.estimated_sales_amount !== undefined ? purchase.estimated_sales_amount : estSalesTotal;
    const profitMargin = estSales > 0 ? (estimatedProfit / estSales) * 100 : 0;
    const markupPercentage = netCost > 0 ? (estimatedProfit / netCost) * 100 : 0;

    return {
      estSalesTotal: estSales,
      costSubtotal,
      netCost,
      estimatedProfit,
      profitMargin,
      markupPercentage
    };
  };

  // Group inventory by SKU for catalog (Sorted A-Z by Product Name)
  const groupedInventory = useMemo(() => {
    const map = new Map<string, InventoryItem & { total_quantity: number }>();
    inventory.forEach(item => {
      const sku = item.sku || item.id;
      if (!map.has(sku)) {
        map.set(sku, { ...item, total_quantity: 0 });
      }
      const existing = map.get(sku)!;
      existing.total_quantity += item.quantity;
    });
    return Array.from(map.values()).sort((a, b) => 
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })
    );
  }, [inventory]);

  // Purchases with stats including profit calculation based on product default sales price
  const purchasesWithStats = useMemo(() => {
    return purchases.map(purchase => {
      let totalItemsCount = 0;
      let estSalesTotal = 0;
      let costSubtotal = 0;

      (purchase.items || []).forEach(item => {
        const qty = item.quantity || 0;
        totalItemsCount += qty;
        const salesPrice = getProductDefaultSalesPrice(item);
        estSalesTotal += qty * salesPrice;
        costSubtotal += qty * (item.unit_price || 0);
      });

      const netCost = purchase.total_amount ?? Math.max(0, costSubtotal - (purchase.discount_amount || 0) + (purchase.tax_amount || 0));
      const estSales = purchase.estimated_sales_amount !== undefined ? purchase.estimated_sales_amount : estSalesTotal;
      const estimatedProfit = purchase.estimated_profit !== undefined ? purchase.estimated_profit : (estSales - netCost);
      const margin = estSales > 0 ? (estimatedProfit / estSales) * 100 : 0;

      return {
        ...purchase,
        totalItemsCount,
        estSales,
        estimatedProfit,
        margin
      };
    });
  }, [purchases, inventory]);

  // KPI Metrics
  const totalPurchasesAmount = useMemo(() => {
    return purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
  }, [purchases]);

  const totalEstimatedSales = useMemo(() => {
    return purchasesWithStats.reduce((sum, p) => sum + (p.estSales || 0), 0);
  }, [purchasesWithStats]);

  const totalEstimatedProfit = useMemo(() => {
    return purchasesWithStats.reduce((sum, p) => sum + (p.estimatedProfit || 0), 0);
  }, [purchasesWithStats]);

  const overallProfitMargin = useMemo(() => {
    return totalEstimatedSales > 0 ? (totalEstimatedProfit / totalEstimatedSales) * 100 : 0;
  }, [totalEstimatedSales, totalEstimatedProfit]);

  const todayStr = new Date().toISOString().split('T')[0];
  const purchasesToday = useMemo(() => {
    return purchases.filter(p => (p.created_at || '').startsWith(todayStr));
  }, [purchases, todayStr]);

  const todayPurchasesAmount = useMemo(() => {
    return purchasesToday.reduce((sum, p) => sum + (p.total_amount || 0), 0);
  }, [purchasesToday]);

  const totalInflowUnits = useMemo(() => {
    return purchases.reduce((sum, p) => sum + (p.items || []).reduce((itemSum, i) => itemSum + (i.quantity || 0), 0), 0);
  }, [purchases]);

  const avgOrderValue = useMemo(() => {
    return purchases.length > 0 ? totalPurchasesAmount / purchases.length : 0;
  }, [purchases, totalPurchasesAmount]);

  // Filtered Purchases
  const filteredPurchases = useMemo(() => {
    return purchasesWithStats.filter(p => {
      const search = searchTerm.toLowerCase();
      const supplier = suppliers.find(s => s.id === p.supplier_id);
      const supplierName = (supplier?.name || 'Direct Supplier').toLowerCase();
      const supplierPhone = (supplier?.phone || '').toLowerCase();
      const supplierSL = (supplier?.sl_number || '').toLowerCase();
      const billId = (p.id || '').toLowerCase();

      const hasItemMatch = (p.items || []).some(i => 
        (i.item_name || '').toLowerCase().includes(search)
      );

      const matchesSearch = !searchTerm ||
        billId.includes(search) ||
        supplierName.includes(search) ||
        supplierPhone.includes(search) ||
        supplierSL.includes(search) ||
        hasItemMatch;

      const matchesSupplier = supplierFilter === 'all' || 
        (supplierFilter === 'direct' && !p.supplier_id) || 
        p.supplier_id === supplierFilter;

      const matchesPayment = paymentMethodFilter === 'all' || p.payment_method === paymentMethodFilter;
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;

      let matchesDate = true;
      if (dateFilter === 'today') {
        matchesDate = (p.created_at || '').startsWith(todayStr);
      } else if (dateFilter === 'week') {
        const pDate = new Date(p.created_at).getTime();
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        matchesDate = pDate >= weekAgo;
      } else if (dateFilter === 'month') {
        const pDate = new Date(p.created_at).getTime();
        const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        matchesDate = pDate >= monthAgo;
      } else if (dateFilter === 'custom') {
        const pTime = new Date(p.created_at).getTime();
        const start = startDate ? new Date(startDate).getTime() : 0;
        const end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : Date.now();
        matchesDate = pTime >= start && pTime <= end;
      }

      return matchesSearch && matchesSupplier && matchesPayment && matchesStatus && matchesDate;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [purchasesWithStats, searchTerm, supplierFilter, paymentMethodFilter, statusFilter, dateFilter, startDate, endDate, suppliers, todayStr]);

  // Product-wise Purchases Summary Breakdown
  const productPurchasesSummary = useMemo(() => {
    const map = new Map<string, {
      sku: string;
      name: string;
      category: string;
      defaultSalesPrice: number;
      totalQtyPurchased: number;
      totalCost: number;
      estSalesValue: number;
      estProfit: number;
      margin: number;
      ordersCount: number;
      lastDate: string;
    }>();

    purchases.forEach(purchase => {
      (purchase.items || []).forEach(item => {
        const key = item.sku || item.item_name || item.inventory_item_id;
        const inv = inventory.find(i => 
          (item.inventory_item_id && i.id === item.inventory_item_id) || 
          (item.sku && i.sku === item.sku) ||
          (item.item_name && i.name.toLowerCase() === item.item_name.toLowerCase())
        );
        const cat = inv?.category || 'General';
        const costTotal = (item.quantity || 0) * (item.unit_price || 0);
        const defaultSalesPrice = getProductDefaultSalesPrice(item);
        const estSales = (item.quantity || 0) * defaultSalesPrice;

        if (!map.has(key)) {
          map.set(key, {
            sku: item.sku || inv?.sku || '-',
            name: item.item_name || inv?.name || 'Product',
            category: cat,
            defaultSalesPrice,
            totalQtyPurchased: 0,
            totalCost: 0,
            estSalesValue: 0,
            estProfit: 0,
            margin: 0,
            ordersCount: 0,
            lastDate: purchase.created_at
          });
        }

        const entry = map.get(key)!;
        entry.totalQtyPurchased += (item.quantity || 0);
        entry.totalCost += costTotal;
        entry.estSalesValue += estSales;
        entry.ordersCount += 1;
        if (defaultSalesPrice > 0 && entry.defaultSalesPrice === 0) {
          entry.defaultSalesPrice = defaultSalesPrice;
        }
        if (new Date(purchase.created_at).getTime() > new Date(entry.lastDate).getTime()) {
          entry.lastDate = purchase.created_at;
        }
      });
    });

    const list = Array.from(map.values()).map(entry => {
      const estProfit = entry.estSalesValue - entry.totalCost;
      const margin = entry.estSalesValue > 0 ? (estProfit / entry.estSalesValue) * 100 : 0;
      return {
        ...entry,
        estProfit,
        margin
      };
    });

    return list.filter(item => {
      const search = productSummarySearch.toLowerCase();
      return !search || item.name.toLowerCase().includes(search) || item.category.toLowerCase().includes(search);
    }).sort((a, b) => b.totalCost - a.totalCost);
  }, [purchases, inventory, productSummarySearch]);

  // Cart Management
  const addToCart = (product: InventoryItem) => {
    const defaultSalesPrice = product.unit_price || product.mrp || 0;
    const existing = cart.find(item => item.sku === product.sku);
    if (existing) {
      setCart(cart.map(item => {
        if (item.sku === product.sku) {
          const newQty = item.quantity + 1;
          const currentTotal = item.total_amount_input !== undefined && item.total_amount_input !== '' 
            ? (parseFloat(item.total_amount_input) || 0) 
            : (item.quantity * item.unit_price);
          const newUnitPrice = (newQty > 0 && currentTotal > 0) ? (currentTotal / newQty) : 0;
          return { 
            ...item, 
            quantity: newQty, 
            unit_price: newUnitPrice,
            default_sales_price: item.default_sales_price || defaultSalesPrice
          };
        }
        return item;
      }));
    } else {
      setCart([...cart, {
        id: Math.random().toString(36).substr(2, 9),
        purchase_id: '',
        inventory_item_id: product.id,
        item_name: product.name,
        name: product.name,
        sku: product.sku,
        quantity: 1,
        unit_price: 0,
        default_sales_price: defaultSalesPrice,
        total_quantity: 0,
        total_amount_input: ''
      }]);
    }
  };

  const updateCartQuantity = (sku: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.sku === sku) {
        const newQty = Math.max(1, item.quantity + delta);
        // Total cost remains unchanged; Unit Cost adjusts automatically
        const currentTotal = item.total_amount_input !== undefined && item.total_amount_input !== '' 
          ? (parseFloat(item.total_amount_input) || 0) 
          : (item.quantity * item.unit_price);
        const newUnitPrice = (newQty > 0 && currentTotal > 0) ? (currentTotal / newQty) : 0;
        return { 
          ...item, 
          quantity: newQty, 
          unit_price: newUnitPrice,
          total_amount_input: item.total_amount_input !== undefined ? item.total_amount_input : (currentTotal > 0 ? (Math.round(currentTotal * 100) / 100).toString() : '')
        };
      }
      return item;
    }));
  };

  const updateCartQuantityDirect = (sku: string, newQtyStr: string) => {
    setCart(cart.map(item => {
      if (item.sku === sku) {
        const newQty = newQtyStr === '' ? 0 : (parseFloat(newQtyStr) || 0);
        const safeQty = Math.max(0, newQty);
        // Total cost remains unchanged; Unit Cost adjusts automatically
        const currentTotal = item.total_amount_input !== undefined && item.total_amount_input !== '' 
          ? (parseFloat(item.total_amount_input) || 0) 
          : (item.quantity * item.unit_price);
        const newUnitPrice = (safeQty > 0 && currentTotal > 0) ? (currentTotal / safeQty) : 0;
        return { 
          ...item, 
          quantity: safeQty, 
          unit_price: newUnitPrice,
          total_amount_input: item.total_amount_input !== undefined ? item.total_amount_input : (currentTotal > 0 ? (Math.round(currentTotal * 100) / 100).toString() : '')
        };
      }
      return item;
    }));
  };

  const updateCartTotalAmount = (sku: string, newTotalStr: string) => {
    setCart(cart.map(item => {
      if (item.sku === sku) {
        const newTotal = newTotalStr === '' ? 0 : parseFloat(newTotalStr);
        const safeTotal = isNaN(newTotal) ? 0 : Math.max(0, newTotal);
        // Calculate unit cost from total amount / quantity
        const calculatedUnitCost = (item.quantity > 0 && safeTotal > 0) ? (safeTotal / item.quantity) : 0;
        return { 
          ...item, 
          unit_price: calculatedUnitCost, 
          total_amount_input: newTotalStr 
        };
      }
      return item;
    }));
  };

  const removeFromCart = (sku: string) => {
    setCart(cart.filter(item => item.sku !== sku));
  };

  const subtotal = cart.reduce((sum, item) => {
    const itemTotal = item.total_amount_input !== undefined && item.total_amount_input !== '' 
      ? (parseFloat(item.total_amount_input) || 0) 
      : (item.quantity * item.unit_price);
    return sum + itemTotal;
  }, 0);
  const taxAmount = ((subtotal - discount) * taxRate) / 100;
  const totalAmount = Math.max(0, subtotal - discount + taxAmount);

  // Profit calculation in Cart based on product's default sales price
  const cartEstTotalSales = cart.reduce((sum, item) => sum + (item.quantity * (item.default_sales_price || 0)), 0);
  const cartEstProfit = cartEstTotalSales - totalAmount;
  const cartProfitMargin = cartEstTotalSales > 0 ? (cartEstProfit / cartEstTotalSales) * 100 : 0;

  const handleEditPurchase = (purchase: Purchase) => {
    setEditingPurchaseId(purchase.id);
    setSelectedSupplierId(purchase.supplier_id || '');
    setPaymentMethod(purchase.payment_method);
    setDiscount(purchase.discount_amount || 0);

    const subtotalAfterDiscount = (purchase.subtotal || purchase.total_amount) - (purchase.discount_amount || 0);
    const tax = subtotalAfterDiscount > 0 ? ((purchase.tax_amount || 0) / subtotalAfterDiscount) * 100 : 0;
    setTaxRate(tax);

    const loadedCart = (purchase.items || []).map(item => {
      const invItem = inventory.find(i => (item.inventory_item_id && i.id === item.inventory_item_id) || (item.sku && i.sku === item.sku));
      const defaultSalesPrice = item.default_sales_price || invItem?.unit_price || invItem?.mrp || 0;
      const total = item.quantity * item.unit_price;
      return {
        ...item,
        id: item.id || Math.random().toString(36).substr(2, 9),
        inventory_item_id: item.inventory_item_id || invItem?.id || '',
        name: item.item_name || invItem?.name || 'Unknown',
        sku: item.sku || invItem?.sku || '',
        total_quantity: invItem?.quantity || 0,
        default_sales_price: defaultSalesPrice,
        total_amount_input: total > 0 ? (Math.round(total * 100) / 100).toString() : ''
      };
    });
    setCart(loadedCart);
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      await storageService.deletePurchase(deleteConfirm.id);
      loadData();
      if (selectedPurchase?.id === deleteConfirm.id) {
        setSelectedPurchase(null);
      }
    } catch (error) {
      console.error('Delete purchase error:', error);
    }
    setDeleteConfirm({ isOpen: false });
  };

  const handleAddSupplier = () => {
    if (!newSupplierName.trim()) return;
    const newSupplier: Supplier = {
      id: Math.random().toString(36).substr(2, 9),
      user_id: '123',
      sl_number: `SL-${(suppliers.length + 1).toString().padStart(3, '0')}`,
      name: newSupplierName.trim(),
      phone: newSupplierPhone.trim(),
      address: newSupplierAddress.trim(),
      created_at: new Date().toISOString(),
    };
    storageService.addSupplier(newSupplier);
    loadData();
    setSelectedSupplierId(newSupplier.id);
    setNewSupplierName('');
    setNewSupplierPhone('');
    setNewSupplierAddress('');
    setIsAddSupplierOpen(false);
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      alert('Please add items to the purchase list first.');
      return;
    }

    const hasInvalidTotalCost = cart.some(item => {
      const inputVal = item.total_amount_input;
      if (inputVal === undefined || inputVal === null || inputVal.toString().trim() === '') {
        return true;
      }
      const parsed = parseFloat(inputVal.toString());
      return isNaN(parsed) || parsed <= 0;
    });

    if (hasInvalidTotalCost) {
      alert('দয়া করে প্রতিটি পণ্যের জন্য একটি সঠিক Total Cost (৳) ইনপুট দিন।\nPlease enter a valid Total Cost (৳) for all items in the list.');
      return;
    }

    try {
      const purchaseId = editingPurchaseId ? editingPurchaseId : ('PUR-' + Math.floor(100000 + Math.random() * 900000));
      
      const purchaseItems: PurchaseItem[] = [];
      cart.forEach(cartItem => {
        const invItem = inventory.find(i => (cartItem.inventory_item_id && i.id === cartItem.inventory_item_id) || (cartItem.sku && i.sku === cartItem.sku));
        const defaultSalesPrice = cartItem.default_sales_price || invItem?.unit_price || invItem?.mrp || 0;
        purchaseItems.push({
          id: cartItem.id || Math.random().toString(36).substr(2, 9),
          purchase_id: purchaseId,
          inventory_item_id: cartItem.inventory_item_id || invItem?.id || '',
          sku: cartItem.sku || invItem?.sku || '',
          item_name: cartItem.name || invItem?.name || 'Product',
          quantity: cartItem.quantity,
          unit_price: cartItem.unit_price,
          default_sales_price: defaultSalesPrice
        });
      });

      const purchaseData: Purchase = {
        id: purchaseId,
        user_id: '123',
        ...(selectedSupplierId ? { supplier_id: selectedSupplierId } : {}),
        subtotal,
        discount_amount: discount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        estimated_sales_amount: cartEstTotalSales,
        estimated_profit: cartEstProfit,
        payment_method: paymentMethod,
        status: 'completed',
        created_at: editingPurchaseId 
          ? (purchases.find(p => p.id === editingPurchaseId)?.created_at || new Date().toISOString()) 
          : new Date().toISOString(),
        items: purchaseItems
      };

      if (editingPurchaseId) {
        storageService.updatePurchase(editingPurchaseId, purchaseData);
      } else {
        storageService.addPurchase(purchaseData);
      }

      setCart([]);
      setSelectedSupplierId('');
      setDiscount(0);
      setTaxRate(0);
      setProductSearch('');
      setSelectedCategory('All');
      setEditingPurchaseId(null);
      
      loadData();
      setIsPreviewModalOpen(false);
      setIsModalOpen(false);
      setSelectedPurchase(purchaseData);
    } catch (error) {
      console.error('Purchase checkout error:', error);
      alert('Failed to save purchase bill. Please try again.');
    }
  };

  // Export Excel
  const handleExportExcel = () => {
    const data = filteredPurchases.map((p, idx) => {
      const supp = suppliers.find(s => s.id === p.supplier_id);
      return {
        SL: idx + 1,
        'Purchase / Bill #': `#${p.id}`,
        Supplier: supp?.name || 'Direct Supplier',
        'Supplier SL': supp?.sl_number || '-',
        'Date & Time': `${formatDateInvoice(p.created_at)} ${new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        'Total Items': p.totalItemsCount,
        'Payment Method': p.payment_method?.toUpperCase(),
        Subtotal: p.subtotal || p.total_amount,
        Discount: p.discount_amount || 0,
        'Total Bill (Cost)': p.total_amount,
        'Est. Sales Value': p.estSales,
        'Est. Expected Profit': p.estimatedProfit,
        'Margin %': `${p.margin.toFixed(1)}%`,
        Status: p.status?.toUpperCase()
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Purchases');
    XLSX.writeFile(wb, `Purchases_Report_${Date.now()}.xlsx`);
  };

  // Export PDF Table
  const handleExportPDF = async () => {
    try {
      const doc = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.width;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59);
      doc.text((businessSettings?.name || 'BIZFLOW') + ' - PURCHASES INFLOW & PROFIT REPORT', 14, 15);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated on: ${formatDateInvoice(new Date().toISOString())} | Total Bills: ${filteredPurchases.length} | Total Cost: ${formatCurrency(filteredPurchases.reduce((s, p) => s + p.total_amount, 0))} | Est. Sales: ${formatCurrency(filteredPurchases.reduce((s, p) => s + p.estSales, 0))} | Est. Profit: +${formatCurrency(filteredPurchases.reduce((s, p) => s + p.estimatedProfit, 0))}`, 14, 21);

      const tableData = filteredPurchases.map((p, idx) => {
        const supp = suppliers.find(s => s.id === p.supplier_id);
        return [
          (idx + 1).toString(),
          `#${p.id}`,
          supp?.name || 'Direct Supplier',
          `${formatDateInvoice(p.created_at)}`,
          `${p.totalItemsCount} pcs`,
          p.payment_method?.toUpperCase(),
          formatCurrency(p.total_amount),
          formatCurrency(p.estSales),
          `+${formatCurrency(p.estimatedProfit)} (${p.margin.toFixed(0)}%)`,
          p.status?.toUpperCase()
        ];
      });

      autoTable(doc, {
        startY: 26,
        head: [['SL', 'Bill #', 'Supplier', 'Date', 'Qty', 'Method', 'Total Cost', 'Est. Sales', 'Est. Profit', 'Status']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' }
      });

      doc.save(`Purchases_Report_${Date.now()}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
    }
  };

  // Download Single Purchase Bill PDF (Matching Sales invoice style with profit support)
  const handleDownloadSinglePDF = async (purchase: Purchase, overrideCopyType?: 'supplier' | 'office') => {
    try {
      const activeCopyType = overrideCopyType || invoiceCopyType || 'office';
      const isOffice = activeCopyType === 'office';

      const doc = new jsPDF('portrait', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.width;
      const margin = 14;
      const contentWidth = pageWidth - margin * 2;

      const primaryColor: [number, number, number] = [30, 41, 59];
      const secondaryColor: [number, number, number] = [71, 85, 105];
      const lightBg: [number, number, number] = [248, 250, 252];
      const borderColor: [number, number, number] = [226, 232, 240];

      // Top Accent Line
      doc.setFillColor(15, 118, 110); // teal-700
      doc.rect(0, 0, pageWidth, 4, 'F');

      // Shop Name & Details
      const shopName = (businessSettings?.name || 'BIZFLOW').toUpperCase();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(shopName, margin, 17);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      let currentY = 22;
      if (businessSettings?.address) {
        doc.text(businessSettings.address, margin, currentY);
        currentY += 4.5;
      }
      if (businessSettings?.phone) {
        doc.text(`Phone: ${businessSettings.phone}`, margin, currentY);
        currentY += 4.5;
      }

      // Top Right: Badge & Metadata
      const badgeText = isOffice ? 'OFFICE COPY (AUDIT)' : 'SUPPLIER COPY';
      const badgeWidth = doc.getTextWidth(badgeText) + 8;
      const badgeX = pageWidth - margin - badgeWidth;

      if (isOffice) {
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.roundedRect(badgeX, 10, badgeWidth, 6.5, 1.5, 1.5, 'F');
        doc.setTextColor(255, 255, 255);
      } else {
        doc.setFillColor(240, 253, 250); // teal-50
        doc.setDrawColor(153, 246, 228); // teal-200
        doc.roundedRect(badgeX, 10, badgeWidth, 6.5, 1.5, 1.5, 'FD');
        doc.setTextColor(15, 118, 110); // teal-700
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(badgeText, badgeX + 4, 14.5);

      // Bill Number & Date
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`Bill #${purchase.id}`, pageWidth - margin, 22, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text(`Date: ${formatDateInvoice(purchase.created_at)} ${new Date(purchase.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, pageWidth - margin, 27, { align: 'right' });
      doc.text(`Payment: ${purchase.payment_method?.toUpperCase() || 'CASH'} | Status: ${purchase.status?.toUpperCase() || 'COMPLETED'}`, pageWidth - margin, 31.5, { align: 'right' });

      // QR Code
      try {
        const qrDataUrl = await QRCodeLib.toDataURL(`PUR-${purchase.id}`, { width: 90, margin: 1 });
        doc.addImage(qrDataUrl, 'PNG', pageWidth - margin - 17, 33, 17, 17);
      } catch {
        // ignore qr fallback
      }

      // Supplier Info Box
      const supplier = suppliers.find(s => s.id === purchase.supplier_id);
      const boxY = 38;
      const boxHeight = 20;
      doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
      doc.roundedRect(margin, boxY, contentWidth - 22, boxHeight, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text('SUPPLIER / VENDOR DETAILS', margin + 4, boxY + 5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(supplier?.name || 'Direct Supplier', margin + 4, boxY + 10.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      const suppInfoLine: string[] = [];
      if (supplier?.phone) suppInfoLine.push(`Phone: ${supplier.phone}`);
      if (supplier?.sl_number) suppInfoLine.push(`Supplier SL: ${supplier.sl_number}`);
      if (supplier?.address) suppInfoLine.push(`Address: ${supplier.address}`);
      doc.text(suppInfoLine.length > 0 ? suppInfoLine.join(' | ') : 'Direct Supplier Delivery', margin + 4, boxY + 15.5);

      // Table Data: Include Default Sale and Est. Profit in Office Copy
      const tableHead = isOffice
        ? [['SL', 'Product Description', 'Qty', 'Unit Cost', 'Total Cost', 'Default Sale', 'Est. Profit']]
        : [['SL', 'Product Description', 'Quantity', 'Unit Cost', 'Total Cost']];

      const tableBody = (purchase.items || []).map((item, idx) => {
        const itemDefaultPrice = getProductDefaultSalesPrice(item);
        const itemCost = (item.quantity || 0) * (item.unit_price || 0);
        const itemEstSales = (item.quantity || 0) * itemDefaultPrice;
        const itemProfit = itemEstSales - itemCost;

        if (isOffice) {
          return [
            (idx + 1).toString(),
            item.item_name || 'Product',
            (item.quantity || 0).toString(),
            formatCurrency(item.unit_price || 0),
            formatCurrency(itemCost),
            formatCurrency(itemDefaultPrice),
            (itemProfit >= 0 ? '+' : '') + formatCurrency(itemProfit)
          ];
        }

        return [
          (idx + 1).toString(),
          item.item_name || 'Product',
          (item.quantity || 0).toString(),
          formatCurrency(item.unit_price || 0),
          formatCurrency(itemCost)
        ];
      });

      const columnStylesConfig = isOffice
        ? {
            0: { cellWidth: 10, halign: 'center' as const },
            1: { cellWidth: 58, halign: 'left' as const, fontStyle: 'bold' as const },
            2: { cellWidth: 16, halign: 'center' as const, fontStyle: 'bold' as const },
            3: { cellWidth: 24, halign: 'right' as const },
            4: { cellWidth: 25, halign: 'right' as const, fontStyle: 'bold' as const },
            5: { cellWidth: 24, halign: 'right' as const },
            6: { cellWidth: 25, halign: 'right' as const, fontStyle: 'bold' as const, textColor: [5, 150, 105] as [number, number, number] }
          }
        : {
            0: { cellWidth: 12, halign: 'center' as const },
            1: { cellWidth: 94, halign: 'left' as const, fontStyle: 'bold' as const },
            2: { cellWidth: 20, halign: 'center' as const, fontStyle: 'bold' as const },
            3: { cellWidth: 26, halign: 'right' as const },
            4: { cellWidth: 30, halign: 'right' as const, fontStyle: 'bold' as const }
          };

      autoTable(doc, {
        startY: boxY + boxHeight + 6,
        head: tableHead,
        body: tableBody,
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 2.5, textColor: primaryColor, lineColor: borderColor, lineWidth: 0.1 },
        headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        columnStyles: columnStylesConfig
      });

      const finalY = (doc as any).lastAutoTable.finalY + 6;
      const summaryWidth = isOffice ? 74 : 65;
      const safeSubtotal = purchase.subtotal || purchase.total_amount || 0;
      const safeDiscount = purchase.discount_amount || 0;
      const safeTax = purchase.tax_amount || 0;
      const safeTotal = purchase.total_amount || 0;
      const fin = getPurchaseEstimatedFinancials(purchase);

      let calcHeight = 26;
      if (safeDiscount > 0) calcHeight += 5.5;
      if (safeTax > 0) calcHeight += 5.5;
      if (isOffice) calcHeight += 16.5;

      const summaryHeight = calcHeight;
      const summaryX = pageWidth - margin - summaryWidth;

      doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
      doc.roundedRect(summaryX, finalY, summaryWidth, summaryHeight, 1.5, 1.5, 'FD');

      let rowY = finalY + 5.5;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text('Subtotal:', summaryX + 3, rowY);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(formatCurrency(safeSubtotal), summaryX + summaryWidth - 3, rowY, { align: 'right' });
      rowY += 5.5;

      if (safeDiscount > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.text('Discount:', summaryX + 3, rowY);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(225, 29, 72);
        doc.text(`-${formatCurrency(safeDiscount)}`, summaryX + summaryWidth - 3, rowY, { align: 'right' });
        rowY += 5.5;
      }

      if (safeTax > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.text('VAT / Tax:', summaryX + 3, rowY);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(`+${formatCurrency(safeTax)}`, summaryX + summaryWidth - 3, rowY, { align: 'right' });
        rowY += 5.5;
      }

      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.roundedRect(summaryX + 2, rowY - 1, summaryWidth - 4, 7, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.text('Total Bill:', summaryX + 4, rowY + 3.8);
      doc.text(formatCurrency(safeTotal), summaryX + summaryWidth - 4, rowY + 3.8, { align: 'right' });
      rowY += 9;

      // Profit Estimation Section for Office Copy
      if (isOffice) {
        doc.setFillColor(236, 253, 245); // emerald-50
        doc.setDrawColor(167, 243, 208); // emerald-200
        doc.roundedRect(summaryX + 2, rowY, summaryWidth - 4, 13, 1, 1, 'FD');

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text('Est. Retail Sales:', summaryX + 4, rowY + 4.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(formatCurrency(fin.estSalesTotal), summaryX + summaryWidth - 4, rowY + 4.5, { align: 'right' });

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(6, 95, 70); // emerald-800
        doc.text('Expected Profit:', summaryX + 4, rowY + 9.5);
        doc.text(
          `${fin.estimatedProfit >= 0 ? '+' : ''}${formatCurrency(fin.estimatedProfit)} (${fin.profitMargin.toFixed(1)}%)`,
          summaryX + summaryWidth - 4,
          rowY + 9.5,
          { align: 'right' }
        );
      }

      // Stock Receiving Note on left side
      const noteY = finalY + 4;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('Stock Receiving Note:', margin, noteY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text('Goods received in sound condition. Inventory registers updated accordingly.', margin, noteY + 4.5);
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text(`Generated by ${businessSettings?.name || "Daily's Need"}`, margin, noteY + 9);

      // Signatures
      const sigY = Math.min(275, Math.max(finalY + summaryHeight + 16, 250));
      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
      doc.line(margin + 10, sigY, margin + 55, sigY);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text("Receiver's Signature", margin + 32.5, sigY + 4, { align: 'center' });

      doc.line(pageWidth - margin - 55, sigY, pageWidth - margin - 10, sigY);
      doc.text('Authorized Officer', pageWidth - margin - 32.5, sigY + 4, { align: 'center' });

      doc.save(`Purchase_Bill_${purchase.id}_${activeCopyType}.pdf`);
    } catch (err) {
      console.error('Download PDF error:', err);
    }
  };

  const categories = ['All', ...Array.from(new Set(inventory.map(p => p.category || 'General')))];
  const companies = ['All', ...Array.from(new Set(inventory.map(p => p.company || p.brand || '').filter(Boolean)))];

  const filteredProducts = groupedInventory.filter(p => {
    const safeName = (p.name || '').toLowerCase();
    const safeSku = (p.sku || '').toLowerCase();
    const safeItemCode = (p.item_code || '').toLowerCase();
    const search = (productSearch || '').toLowerCase();
    
    const matchesSearch = safeName.includes(search) || safeSku.includes(search) || safeItemCode.includes(search);
    const matchesCategory = selectedCategory === 'All' || (p.category || 'General') === selectedCategory;
    const matchesCompany = selectedCompany === 'All' || (p.company || p.brand || '') === selectedCompany;
    return matchesSearch && matchesCategory && matchesCompany;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="relative py-6 px-6 bg-gradient-to-b from-slate-50/90 via-white to-slate-50/40 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center text-center overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary-500 via-sky-500 to-emerald-500" />
        
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-wider uppercase font-['Outfit',sans-serif]">
          PURCHASES
        </h1>
        <p className="text-sm sm:text-base font-medium text-slate-500 mt-2 max-w-lg leading-relaxed">
          Manage supplier purchase bills, stock receiving, FIFO cost tracking, and projected profit.
        </p>

        {/* Dynamic Action in Header */}
        <div className="mt-4 flex items-center gap-3">
          <Button 
            onClick={() => {
              setEditingPurchaseId(null);
              setCart([]);
              setSelectedSupplierId('');
              setDiscount(0);
              setTaxRate(0);
              setIsModalOpen(true);
            }} 
            className="bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Purchase (PO)</span>
          </Button>
        </div>
      </div>

      {/* 4 Metric KPI Cards matching Sales.tsx */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Purchases Cost */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Purchases Cost</p>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalPurchasesAmount)}</p>
          <p className="text-xs text-slate-400 mt-1">{purchases.length} total bills completed</p>
        </Card>

        {/* Card 2: Purchases Today */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Purchases Today</p>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              {purchasesToday.length} Bills
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(todayPurchasesAmount)}</p>
          <p className="text-xs text-slate-400 mt-1">Today's procurement inflow</p>
        </Card>

        {/* Card 3: Stock Received & Avg Order */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Items Received</p>
          <p className="text-2xl font-bold text-slate-900">{totalInflowUnits.toLocaleString()} <span className="text-sm font-normal text-slate-500">pcs</span></p>
          <p className="text-xs text-slate-400 mt-1">Avg. Bill Value: <strong className="text-slate-700">{formatCurrency(avgOrderValue)}</strong></p>
        </Card>

        {/* Card 4: Projected Expected Profit */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {totalEstimatedProfit >= 0 ? 'Projected Net Profit' : 'Projected Loss'}
            </p>
            {totalEstimatedProfit >= 0 ? (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" /> Profit ({overallProfitMargin.toFixed(1)}%)
              </span>
            ) : (
              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 flex items-center gap-0.5">
                <TrendingDown className="w-3 h-3" /> Loss ({Math.abs(overallProfitMargin).toFixed(1)}%)
              </span>
            )}
          </div>
          <p className={cn("text-2xl font-bold", totalEstimatedProfit >= 0 ? "text-emerald-700" : "text-rose-600")}>
            {totalEstimatedProfit >= 0 ? `+${formatCurrency(totalEstimatedProfit)}` : `-${formatCurrency(Math.abs(totalEstimatedProfit))}`}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
            <span>Est. Sales: <strong className="text-slate-600 font-semibold">{formatCurrency(totalEstimatedSales)}</strong></span>
            <span className="text-slate-500 font-medium text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">
              Retail value
            </span>
          </div>
        </Card>
      </div>

      {/* Main Content Area Matching Sales Toolbar */}
      <Card className="p-0 border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Toolbar Header */}
        <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 flex-1">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search by bill #, supplier, phone, item..." 
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-colors"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Date Filters */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start md:self-auto overflow-x-auto">
              {(['all', 'today', 'week', 'month', 'custom'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDateFilter(mode)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap capitalize",
                    dateFilter === mode 
                      ? "bg-white text-slate-900 shadow-xs" 
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {mode === 'all' ? 'All Time' : mode === 'week' ? 'This Week' : mode === 'month' ? 'This Month' : mode}
                </button>
              ))}
            </div>

            {/* Custom Date Pickers */}
            {dateFilter === 'custom' && (
              <div className="flex items-center gap-2">
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700"
                />
                <span className="text-xs text-slate-400">to</span>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700"
                />
              </div>
            )}
          </div>

          {/* Right Toolbar Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Supplier Filter */}
            <select
              className="bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium px-2.5 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 h-9"
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
            >
              <option value="all">All Suppliers</option>
              <option value="direct">Direct Supplier</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.sl_number || 'SL'})</option>
              ))}
            </select>

            {/* Payment Method Filter */}
            <select
              className="bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium px-2.5 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 h-9"
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
            >
              <option value="all">All Payment Methods</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="transfer">Bank / MFS</option>
            </select>

            {/* View Mode Toggle Button */}
            <Button 
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === 'table' ? 'product_summary' : 'table')}
              className={cn(
                "text-xs font-semibold h-9",
                viewMode === 'product_summary' ? "bg-primary-50 text-primary-700 border-primary-300" : "text-slate-700"
              )}
            >
              <Layers className="w-4 h-4 mr-1.5" />
              {viewMode === 'product_summary' ? 'Bills Table' : 'Product Purchases Summary'}
            </Button>

            {/* Export Excel */}
            <button 
              type="button"
              onClick={handleExportExcel} 
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 shadow-2xs transition-all duration-150 cursor-pointer h-9 active:scale-[0.98]"
              title="Download Purchases Excel Report"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Excel</span>
            </button>

            {/* Export PDF */}
            <button 
              type="button"
              onClick={handleExportPDF} 
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 hover:border-primary-300 shadow-2xs transition-all duration-150 cursor-pointer h-9 active:scale-[0.98]"
              title="Download Purchases PDF Report"
            >
              <Download className="w-4 h-4 text-primary-600" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* View 1: Main Purchases Table (Matching Sales Table Layout) */}
        {viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-left whitespace-nowrap">Bill #</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-left whitespace-nowrap">Supplier</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">Date & Time</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">Items</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">Payment</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Total Cost</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Est. Sales</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Est. Profit</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">Status</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPurchases.length > 0 ? (
                  filteredPurchases.map((purchase) => {
                    const supplier = suppliers.find(s => s.id === purchase.supplier_id);

                    return (
                      <tr 
                        key={purchase.id} 
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                        onClick={() => setSelectedPurchase(purchase)}
                      >
                        {/* Bill No */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="font-mono text-xs font-bold text-primary-700 bg-primary-50 border border-primary-100 px-2 py-1 rounded-md">
                            #{purchase.id}
                          </span>
                        </td>

                        {/* Supplier */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div>
                            <span className="text-xs sm:text-sm font-bold text-slate-900 block">
                              {supplier?.name || 'Direct Supplier'}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              {supplier?.sl_number && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded border border-slate-200">
                                  {supplier.sl_number}
                                </span>
                              )}
                              {supplier?.phone && (
                                <span className="text-[11px] font-medium text-slate-400">
                                  {supplier.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Date */}
                        <td className="px-5 py-3.5 text-center whitespace-nowrap text-xs text-slate-500 font-medium">
                          {formatDateInvoice(purchase.created_at)}{' '}
                          <span className="text-slate-400 text-[10px]">
                            {new Date(purchase.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>

                        {/* Items Qty */}
                        <td className="px-5 py-3.5 text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            {purchase.totalItemsCount} pcs
                          </span>
                        </td>

                        {/* Payment Method */}
                        <td className="px-5 py-3.5 text-center whitespace-nowrap">
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border",
                            purchase.payment_method === 'cash' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            purchase.payment_method === 'card' ? "bg-purple-50 text-purple-700 border-purple-200" :
                            "bg-sky-50 text-sky-700 border-sky-200"
                          )}>
                            {purchase.payment_method === 'cash' && <Banknote className="w-3 h-3" />}
                            {purchase.payment_method === 'card' && <CreditCard className="w-3 h-3" />}
                            {purchase.payment_method === 'transfer' && <ArrowLeftRight className="w-3 h-3" />}
                            {purchase.payment_method}
                          </span>
                        </td>

                        {/* Total Bill Cost */}
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <span className="text-xs sm:text-sm font-bold font-mono text-slate-900 block">
                            {formatCurrency(purchase.total_amount)}
                          </span>
                          {purchase.discount_amount && purchase.discount_amount > 0 ? (
                            <span className="text-[10px] text-rose-600 font-mono">-{formatCurrency(purchase.discount_amount)}</span>
                          ) : null}
                        </td>

                        {/* Est. Sales Revenue */}
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <span className="text-xs font-mono font-medium text-slate-700 block">
                            {formatCurrency(purchase.estSales)}
                          </span>
                        </td>

                        {/* Est. Profit */}
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div className="flex flex-col items-end">
                            <span className={cn(
                              "font-mono font-bold text-xs",
                              purchase.estimatedProfit >= 0 ? "text-emerald-700" : "text-rose-700"
                            )}>
                              {purchase.estimatedProfit >= 0 ? '+' : ''}{formatCurrency(purchase.estimatedProfit)}
                            </span>
                            <span className={cn(
                              "text-[10px] font-bold px-1.5 py-0.2 rounded mt-0.5 inline-block",
                              purchase.estimatedProfit >= 0 
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            )}>
                              {purchase.margin.toFixed(1)}% margin
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5 text-center whitespace-nowrap">
                          <span className={cn(
                            "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            purchase.status === 'completed' ? "bg-emerald-100 text-emerald-700" : 
                            purchase.status === 'pending' ? "bg-amber-100 text-amber-700" : 
                            "bg-red-100 text-red-700"
                          )}>
                            {purchase.status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => setSelectedPurchase(purchase)}
                              className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
                              title="View & Print Bill"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDownloadSinglePDF(purchase, 'office')}
                              className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
                              title="Download PDF (Audit Copy with Profit)"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleEditPurchase(purchase)}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                              title="Edit Bill"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setDeleteConfirm({ isOpen: true, id: purchase.id })}
                              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Delete Bill"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-slate-400 text-sm">
                      <div className="flex flex-col items-center justify-center">
                        <ShoppingBag className="w-10 h-10 text-slate-300 mb-2" />
                        <p className="font-medium text-slate-600">No purchase records found</p>
                        <p className="text-xs text-slate-400 mt-1">Try changing your search terms or date filter</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
              {filteredPurchases.length > 0 && (
                <tfoot className="bg-slate-50/90 font-semibold text-xs text-slate-700 border-t-2 border-slate-200">
                  <tr>
                    <td colSpan={3} className="px-5 py-3 text-left font-bold text-slate-800">
                      Total ({filteredPurchases.length} bills)
                    </td>
                    <td className="px-5 py-3 text-center font-bold text-slate-800">
                      {filteredPurchases.reduce((s, p) => s + p.totalItemsCount, 0)} pcs
                    </td>
                    <td></td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(filteredPurchases.reduce((s, p) => s + p.total_amount, 0))}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-slate-800">
                      {formatCurrency(filteredPurchases.reduce((s, p) => s + p.estSales, 0))}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-emerald-700">
                      +{formatCurrency(filteredPurchases.reduce((s, p) => s + p.estimatedProfit, 0))}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        ) : (
          /* View 2: Product Purchases Summary Table Matching Sales */
          <div className="p-4 space-y-4">
            {/* Summary Top Strip for Products */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <div className="px-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Products Tracked</span>
                <span className="text-lg font-bold text-slate-900">{productPurchasesSummary.length}</span>
              </div>
              <div className="px-2 border-l border-slate-200">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Inflow Qty</span>
                <span className="text-lg font-bold text-primary-700">
                  {productPurchasesSummary.reduce((s, p) => s + p.totalQtyPurchased, 0).toLocaleString()} pcs
                </span>
              </div>
              <div className="px-2 border-l border-slate-200">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Cost Spent</span>
                <span className="text-lg font-bold font-mono text-slate-900">
                  {formatCurrency(productPurchasesSummary.reduce((s, p) => s + p.totalCost, 0))}
                </span>
              </div>
              <div className="px-2 border-l border-slate-200">
                <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">Expected Profit</span>
                <span className="text-lg font-bold font-mono text-emerald-700">
                  +{formatCurrency(productPurchasesSummary.reduce((s, p) => s + p.estProfit, 0))}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter product summary..."
                  value={productSummarySearch}
                  onChange={(e) => setProductSummarySearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <p className="text-xs text-slate-500">
                Profit calculated using default product sales prices
              </p>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                    <th className="py-3 px-4 text-center w-12">SL</th>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-center">Inflow Qty</th>
                    <th className="py-3 px-4 text-right">Avg. Unit Cost</th>
                    <th className="py-3 px-4 text-right">Default Sales Price</th>
                    <th className="py-3 px-4 text-right">Total Cost Spent</th>
                    <th className="py-3 px-4 text-right">Est. Sales Value</th>
                    <th className="py-3 px-4 text-right">Est. Profit</th>
                    <th className="py-3 px-4 text-center">Orders</th>
                    <th className="py-3 px-4 text-right">Last Purchased</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {productPurchasesSummary.length > 0 ? (
                    productPurchasesSummary.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{item.name}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-primary-700">{item.totalQtyPurchased} pcs</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-700">
                          {formatCurrency(item.totalQtyPurchased > 0 ? item.totalCost / item.totalQtyPurchased : 0)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800">
                          {item.defaultSalesPrice > 0 ? formatCurrency(item.defaultSalesPrice) : <span className="text-slate-400">-</span>}
                        </td>
                        <td className="py-3 px-4 text-right font-bold font-mono text-slate-900">
                          {formatCurrency(item.totalCost)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-700">
                          {formatCurrency(item.estSalesValue)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className={cn(
                              "font-mono font-bold",
                              item.estProfit >= 0 ? "text-emerald-700" : "text-rose-700"
                            )}>
                              {item.estProfit >= 0 ? '+' : ''}{formatCurrency(item.estProfit)}
                            </span>
                            <span className={cn(
                              "text-[10px] font-bold px-1.5 py-0.2 rounded mt-0.5",
                              item.estProfit >= 0 
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            )}>
                              {item.margin.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-600">
                          {item.ordersCount} bills
                        </td>
                        <td className="py-3 px-4 text-right text-slate-500 font-mono text-[11px]">
                          {formatDateInvoice(item.lastDate)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-slate-400">
                        No product summary data found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {/* Invoice Details Modal (Matching Sales Modal Design) */}
      {selectedPurchase && (() => {
        const supplier = suppliers.find(s => s.id === selectedPurchase.supplier_id);
        const safeItems = selectedPurchase.items || [];
        const safeSubtotal = selectedPurchase.subtotal || selectedPurchase.total_amount || 0;
        const safeDiscount = selectedPurchase.discount_amount || 0;
        const safeTax = selectedPurchase.tax_amount || 0;
        const safeTotal = selectedPurchase.total_amount || 0;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150 overflow-y-auto print:p-0 print:bg-white print:block">
            <style>{`
              @media print {
                @page { 
                  size: A4 portrait; 
                  margin: 10mm 10mm 10mm 10mm; 
                }
              }
            `}</style>
            <div className="print-modal-container w-full max-w-4xl h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden print:w-full print:max-w-none print:h-auto print:rounded-none print:border-none print:shadow-none">
              
              {/* Modal Control Header */}
              <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-b border-slate-200 bg-white print:hidden gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-700">Select Invoice Copy:</span>
                  <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
                    <button 
                      onClick={() => setInvoiceCopyType('supplier')}
                      className={cn(
                        "px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer",
                        invoiceCopyType === 'supplier' ? "bg-white shadow-xs text-primary-700 font-bold" : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      Supplier Copy
                    </button>
                    <button 
                      onClick={() => setInvoiceCopyType('office')}
                      className={cn(
                        "px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1",
                        invoiceCopyType === 'office' ? "bg-white shadow-xs text-primary-700 font-bold" : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-primary-600" />
                      <span>Office Copy (Audit & Profit)</span>
                    </button>
                    <button 
                      onClick={() => setInvoiceCopyType('both')}
                      className={cn(
                        "px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer",
                        invoiceCopyType === 'both' ? "bg-white shadow-xs text-primary-700 font-bold" : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      Both Copies (A4)
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleDownloadSinglePDF(selectedPurchase, invoiceCopyType === 'both' ? 'office' : invoiceCopyType)}
                    className="bg-slate-900 text-white font-bold px-3.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs cursor-pointer shadow-xs"
                    title="Download A4 PDF"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-400" />
                    <span>Download A4 PDF</span>
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className="bg-primary-600 text-white font-bold px-4 py-1.5 rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-1.5 text-xs shadow-2xs cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Invoice</span>
                  </button>
                  <button onClick={() => setSelectedPurchase(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 ml-1 cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Printable Invoice Sheet Container */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100 print:bg-white print:p-0 print:overflow-visible flex flex-col items-center gap-8" id="purchase-content-wrapper">
                {['supplier', 'office'].map((type, index) => {
                  if (invoiceCopyType !== 'both' && invoiceCopyType !== type) return null;
                  const isOffice = type === 'office';

                  return (
                    <div 
                      key={type} 
                      className={`print-sheet bg-white border border-slate-200 shadow-sm p-8 sm:p-10 rounded-2xl relative w-full max-w-[210mm] min-h-[297mm] flex flex-col justify-between print:border-none print:shadow-none print:p-0 print:max-w-none print:min-h-0 ${index > 0 ? 'page-break' : ''}`}
                    >
                      <div>
                        {/* Top Header Grid */}
                        <div className="flex justify-between items-start mb-6 pb-6 border-b border-slate-200 gap-4">
                          {/* Supplier Details */}
                          <div className="w-1/3">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                              SUPPLIER / VENDOR DETAILS
                            </span>
                            <h3 className="font-bold text-slate-900 text-sm mb-0.5">
                              {supplier?.name || 'Direct Supplier'}
                            </h3>
                            {supplier?.phone && (
                              <p className="text-slate-600 text-xs">Mobile: {supplier.phone}</p>
                            )}
                            {supplier?.address && (
                              <p className="text-slate-600 text-xs">Address: {supplier.address}</p>
                            )}
                            {supplier?.sl_number && (
                              <span className="inline-block mt-1 px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-mono rounded font-semibold">
                                SL: {supplier.sl_number}
                              </span>
                            )}
                          </div>

                          {/* Business Info Center */}
                          <div className="text-center w-1/3 flex flex-col items-center justify-center">
                            {businessSettings?.invoice_show_logo !== false && businessSettings?.logo && businessSettings?.invoice_show_name !== false ? (
                              <div className="flex items-center justify-center gap-2.5 mb-1">
                                <img src={businessSettings.logo} alt="Logo" className="h-10 w-auto max-h-12 object-contain" />
                                <div className="text-left">
                                  <h2 className="text-lg font-black text-slate-900 tracking-wider leading-tight">
                                    {(businessSettings?.name || "Daily's Need").toUpperCase()}
                                  </h2>
                                  {businessSettings?.tagline && (
                                    <p className="text-[10px] text-slate-500 font-medium leading-none">{businessSettings.tagline}</p>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <>
                                {businessSettings?.invoice_show_logo !== false && businessSettings?.logo && (
                                  <img src={businessSettings.logo} alt="Logo" className="h-10 w-auto mb-1 object-contain mx-auto" />
                                )}
                                {businessSettings?.invoice_show_name !== false && (
                                  <h2 className="text-xl font-black text-slate-900 tracking-wider">
                                    {(businessSettings?.name || "Daily's Need").toUpperCase()}
                                  </h2>
                                )}
                              </>
                            )}
                            {businessSettings?.address && (
                              <p className="text-xs text-slate-500 mt-0.5">{businessSettings.address}</p>
                            )}
                            {businessSettings?.invoice_show_phone !== false && businessSettings?.phone && (
                              <p className="text-xs text-slate-500">Phone: {businessSettings.phone}</p>
                            )}
                          </div>

                          {/* Invoice Meta Right + QR Code */}
                          <div className="text-right w-1/3 flex flex-col items-end">
                            <span className={cn(
                              "inline-block px-3 py-1 rounded-md text-[11px] font-bold tracking-wider mb-2",
                              isOffice ? "bg-slate-900 text-white" : "bg-teal-50 text-teal-700 border border-teal-200"
                            )}>
                              {isOffice ? 'OFFICE COPY (AUDIT)' : 'SUPPLIER COPY'}
                            </span>
                            <h4 className="text-lg font-mono font-bold text-slate-900">
                              Bill #{selectedPurchase.id}
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5 font-medium">
                              {formatDateInvoice(selectedPurchase.created_at)} {new Date(selectedPurchase.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <div className="mt-2.5 p-1 bg-white border border-slate-200 rounded-lg shadow-2xs">
                              <QRCode value={`PUR-${selectedPurchase.id}`} size={64} />
                            </div>
                          </div>
                        </div>

                        {/* Items Table */}
                        <div className="mb-6 border border-slate-200 rounded-xl overflow-hidden">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase bg-slate-50/80">
                                <th className="py-2.5 px-3 text-center w-12">SL</th>
                                <th className="py-2.5 px-3">PRODUCT DESCRIPTION</th>
                                <th className="py-2.5 px-3 text-center w-16">QTY</th>
                                <th className="py-2.5 px-3 text-right w-28">UNIT COST</th>
                                <th className="py-2.5 px-3 text-right w-32">TOTAL COST</th>
                                {isOffice && (
                                  <>
                                    <th className="py-2.5 px-3 text-right w-28">DEFAULT SALE</th>
                                    <th className="py-2.5 px-3 text-right w-32">EST. PROFIT</th>
                                  </>
                                )}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                              {safeItems.map((item, idx) => {
                                const itemDefaultPrice = getProductDefaultSalesPrice(item);
                                const itemCost = item.quantity * item.unit_price;
                                const itemEstSales = item.quantity * itemDefaultPrice;
                                const itemProfit = itemEstSales - itemCost;
                                return (
                                  <tr key={idx} className="hover:bg-slate-50/60">
                                    <td className="py-2.5 px-3 text-slate-400 font-mono text-center">{idx + 1}</td>
                                    <td className="py-2.5 px-3 font-bold text-slate-900">
                                      {item.item_name || 'Product'}
                                    </td>
                                    <td className="py-2.5 px-3 text-center font-bold text-slate-800">{item.quantity}</td>
                                    <td className="py-2.5 px-3 text-right text-slate-800 font-mono">{formatCurrency(item.unit_price)}</td>
                                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                                      {formatCurrency(itemCost)}
                                    </td>
                                    {isOffice && (
                                      <>
                                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                                          {formatCurrency(itemDefaultPrice)}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                                          {itemProfit >= 0 ? '+' : ''}{formatCurrency(itemProfit)}
                                        </td>
                                      </>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Bottom Summary & Notes */}
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-4">
                          <div className="text-xs text-slate-500 space-y-1.5 max-w-sm">
                            <div className="space-y-0.5">
                              <p className="font-bold text-slate-700">Payment Method: <span className="uppercase text-slate-900">{selectedPurchase.payment_method}</span></p>
                              <p className="font-bold text-slate-700">Status: <span className="uppercase text-emerald-700">{selectedPurchase.status}</span></p>
                            </div>
                            <p className="font-semibold text-slate-600 mt-2">Stock Receiving Note:</p>
                            <p className="text-[11px] text-slate-500">Goods received in sound condition. Inventory registers updated accordingly.</p>
                            <p className="text-[10px] text-slate-400 pt-1">Generated by {businessSettings?.name || "Daily's Need"}</p>
                          </div>

                          <div className="w-full sm:w-80 space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div className="flex justify-between text-xs text-slate-600">
                              <span>Subtotal:</span>
                              <span className="font-mono font-semibold">{formatCurrency(safeSubtotal)}</span>
                            </div>
                            {safeDiscount > 0 && (
                              <div className="flex justify-between text-xs text-rose-600 font-semibold">
                                <span>Discount:</span>
                                <span className="font-mono">-{formatCurrency(safeDiscount)}</span>
                              </div>
                            )}
                            {safeTax > 0 && (
                              <div className="flex justify-between text-xs text-slate-600">
                                <span>VAT / Tax:</span>
                                <span className="font-mono font-semibold">+{formatCurrency(safeTax)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                              <span>Total Bill:</span>
                              <span className="font-mono text-base text-primary-700">{formatCurrency(safeTotal)}</span>
                            </div>

                            {/* Profit Estimation Section */}
                            {isOffice && (() => {
                              const fin = getPurchaseEstimatedFinancials(selectedPurchase);
                              return (
                                <div className="mt-3 pt-2.5 border-t border-dashed border-emerald-300 bg-emerald-50/80 -mx-4 -mb-4 p-3 rounded-b-xl">
                                  <div className="flex justify-between text-xs text-slate-700">
                                    <span>Est. Retail Sales:</span>
                                    <span className="font-mono font-semibold">{formatCurrency(fin.estSalesTotal)}</span>
                                  </div>
                                  <div className="flex justify-between text-xs font-bold text-emerald-800 mt-1">
                                    <span className="flex items-center gap-1">
                                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                                      Expected Profit:
                                    </span>
                                    <span className="font-mono text-emerald-700">
                                      +{formatCurrency(fin.estimatedProfit)} ({fin.profitMargin.toFixed(1)}%)
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Footer Signatures */}
                      <div className="mt-12 flex justify-between items-end text-xs text-slate-500 px-4">
                        <div className="text-center">
                          <div className="w-40 border-t border-slate-300 mb-1"></div>
                          <p className="font-medium text-slate-600">Receiver's Signature</p>
                        </div>
                        <div className="text-center">
                          <div className="w-40 border-t border-slate-300 mb-1"></div>
                          <p className="font-medium text-slate-600">Authorized Officer</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        );
      })()}

      {/* New / Edit Purchase Modal (Split POS Layout) */}
      {isModalOpen && (
        <div className={cn(
          "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs transition-all duration-150 animate-in fade-in",
          isPurchaseFullscreen ? "p-0" : "p-2 sm:p-4"
        )}>
          <div className={cn(
            "flex flex-col bg-white overflow-hidden transition-all duration-200",
            isPurchaseFullscreen 
              ? "w-full h-full rounded-none border-0 shadow-none" 
              : "w-full h-full max-w-7xl max-h-[92vh] rounded-2xl border border-slate-200 shadow-2xl"
          )}>
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-3.5 border-b border-slate-200 bg-white">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-primary-100 text-primary-700 rounded-lg">
                  <ShoppingBag className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingPurchaseId ? `Edit Purchase #${editingPurchaseId}` : 'Create New Purchase Bill'}
                  </h3>
                  <p className="text-xs text-slate-500">Record stock received from supplier and cost price</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPurchaseFullscreen(!isPurchaseFullscreen)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border shadow-2xs",
                    isPurchaseFullscreen 
                      ? "bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100" 
                      : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                  )}
                  title={isPurchaseFullscreen ? "Switch to Standard Windowed View" : "Expand to Full Page View"}
                >
                  {isPurchaseFullscreen ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5 text-primary-600" />
                      <span>Standard Window</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5 text-slate-600" />
                      <span>Full Page</span>
                    </>
                  )}
                </button>
                <button 
                  onClick={() => { setIsModalOpen(false); setEditingPurchaseId(null); setCart([]); }} 
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                  title="Close Window"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* 3-Part Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden min-h-0 bg-slate-50/20 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
                
                {/* PART 1: LEFT - Product Catalog & Search Filter */}
                <div className="lg:col-span-4 xl:col-span-4 flex flex-col h-full overflow-hidden bg-white">
                  <div className="p-3 border-b border-slate-100 bg-white space-y-2 flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">Product Catalog</span>
                      <button
                        type="button"
                        onClick={() => setIsAddProductOpen(true)}
                        className="text-[11px] font-bold text-primary-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>+ Add New</span>
                      </button>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Search product name, SKU or barcode..." 
                        className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
                        value={productSearch}
                        onChange={e => setProductSearch(e.target.value)}
                        autoFocus
                      />
                      <button 
                        type="button"
                        onClick={() => setIsScannerOpen(true)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                        title="Scan Barcode"
                      >
                        <ScanLine className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">PRODUCT CATEGORY</label>
                        <select
                          value={selectedCategory}
                          onChange={e => setSelectedCategory(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                        >
                          {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-0.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">COMPANY / BRAND</label>
                        <select
                          value={selectedCompany}
                          onChange={e => setSelectedCompany(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                        >
                          {companies.map(comp => (
                            <option key={comp} value={comp}>{comp}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Catalog Table */}
                  <div className="flex-1 overflow-y-auto p-2 min-h-0 bg-slate-50/30">
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                      <table className="w-full text-left">
                        <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          <tr>
                            <th className="px-3 py-2">PRODUCT</th>
                            <th className="px-2 py-2 text-center">STOCK</th>
                            <th className="px-2 py-2 text-right">PRICE</th>
                            <th className="px-2 py-2 text-right">ACTION</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredProducts.map(product => (
                            <tr 
                              key={product.id} 
                              onClick={() => addToCart(product)}
                              className="hover:bg-slate-50 transition-colors cursor-pointer group"
                            >
                              <td className="px-3 py-2">
                                <span className="text-xs font-bold text-slate-900 block leading-tight">{product.name}</span>
                                <div className="flex items-center gap-1.5 mt-0.5 text-[10px]">
                                  <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">{product.category || 'General'}</span>
                                  {product.company && <span className="text-slate-400">• {product.company}</span>}
                                </div>
                              </td>
                              <td className="px-2 py-2 text-center whitespace-nowrap">
                                <span className={cn(
                                  "text-[10px] font-bold px-2 py-0.5 rounded-full",
                                  product.total_quantity < 10 ? "text-amber-700 bg-amber-50" : "text-emerald-700 bg-emerald-50"
                                )}>
                                  {product.total_quantity} {product.unit || 'pcs'}
                                </span>
                              </td>
                              <td className="px-2 py-2 text-right font-bold text-xs text-slate-900 whitespace-nowrap">
                                {formatCurrency(product.unit_price)}
                              </td>
                              <td className="px-2 py-2 text-right whitespace-nowrap">
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addToCart(product);
                                  }}
                                  className="px-3 py-1 rounded-full text-xs font-bold bg-primary-600 hover:bg-primary-700 text-white shadow-2xs transition-colors cursor-pointer"
                                >
                                  + Add
                                </button>
                              </td>
                            </tr>
                          ))}
                          {filteredProducts.length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-4 py-12 text-center text-xs text-slate-400">
                                No products found matching filters.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* PART 2: MIDDLE - Detailed Cart Items */}
                <div className="lg:col-span-4 xl:col-span-4 flex flex-col h-full overflow-hidden bg-white">
                  <div className="p-3 border-b border-slate-100 bg-white flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-primary-50 rounded-lg text-primary-600">
                        <Receipt className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Bill Items ({cart.length})</h4>
                        <p className="text-[10px] text-slate-500">
                          Sub-count: ({cart.reduce((sum, item) => sum + item.quantity, 0)}) total items, {cart.length} types
                        </p>
                      </div>
                    </div>
                    {cart.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCart([])}
                        className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  {cart.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-slate-50/20">
                      <div className="w-16 h-16 rounded-2xl bg-slate-100/80 flex items-center justify-center mb-3 text-slate-300">
                        <ShoppingBag className="w-8 h-8" />
                      </div>
                      <p className="text-sm font-bold text-slate-600">No items added yet.</p>
                      <p className="text-xs text-slate-400 mt-1">Select products from the catalog on the left.</p>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto p-2.5 min-h-0 bg-slate-50/20 space-y-2.5">
                      {cart.map(item => {
                        const itemTotal = item.total_amount_input !== undefined && item.total_amount_input !== '' 
                          ? (parseFloat(item.total_amount_input) || 0) 
                          : (item.quantity * item.unit_price);
                        const calculatedUnitCost = (item.quantity > 0 && itemTotal > 0) ? (itemTotal / item.quantity) : (item.unit_price || 0);
                        const estSalesTotal = item.quantity * (item.default_sales_price || 0);
                        const estProfitTotal = estSalesTotal - itemTotal;

                        return (
                          <div key={item.sku} className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <span className="text-xs font-bold text-slate-900 block">{item.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">SKU: {item.sku}</span>
                              </div>
                              <button 
                                onClick={() => removeFromCart(item.sku)} 
                                className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                                title="Remove item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 items-end">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                                  Quantity
                                </label>
                                <div className="flex items-center h-8 border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                                  <button 
                                    type="button"
                                    onClick={() => updateCartQuantity(item.sku, -1)}
                                    className="w-8 h-full flex items-center justify-center bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold transition-colors"
                                  >
                                    -
                                  </button>
                                  <input 
                                    type="number" 
                                    min="1"
                                    value={item.quantity || ''}
                                    onChange={e => updateCartQuantityDirect(item.sku, e.target.value)}
                                    className="w-full h-full text-center text-xs font-bold text-slate-800 bg-transparent focus:outline-none"
                                  />
                                  <button 
                                    type="button"
                                    onClick={() => updateCartQuantity(item.sku, 1)}
                                    className="w-8 h-full flex items-center justify-center bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold transition-colors"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-primary-700 uppercase mb-1 truncate">
                                  Total Cost (৳)
                                </label>
                                <input 
                                  type="number" 
                                  step="any"
                                  placeholder="0.00"
                                  value={item.total_amount_input !== undefined ? item.total_amount_input : (itemTotal > 0 ? (Math.round(itemTotal * 100) / 100).toString() : '')}
                                  onChange={e => updateCartTotalAmount(item.sku, e.target.value)}
                                  className="w-full h-8 border border-primary-300 rounded-lg px-2 text-xs font-bold text-right font-mono bg-primary-50/50 text-primary-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100 text-slate-500 font-mono">
                              <div>
                                Unit Cost: <span className="font-bold text-slate-700">৳{calculatedUnitCost > 0 ? (Math.round(calculatedUnitCost * 100) / 100).toFixed(2) : '0.00'}</span>
                              </div>
                              <div className="text-emerald-700 font-bold">
                                Profit: ৳{formatCurrency(estProfitTotal)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* PART 3: RIGHT - Supplier, Profit Summary & Submit */}
                <div className="lg:col-span-4 xl:col-span-4 flex flex-col h-full overflow-y-auto bg-slate-50/40 p-3.5 space-y-3.5 border-t lg:border-t-0 border-slate-200">
                  
                  {/* Supplier Selection Block */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-800">Supplier / Vendor</label>
                      <button
                        type="button"
                        onClick={() => setIsAddSupplierOpen(true)}
                        className="text-[11px] font-bold text-primary-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>+ Add New</span>
                      </button>
                    </div>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                      value={selectedSupplierId}
                      onChange={e => setSelectedSupplierId(e.target.value)}
                    >
                      <option value="">Direct Supplier / Walk-in Vendor</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.sl_number || 'SL'})</option>
                      ))}
                    </select>
                  </div>

                  {/* Live Profit Estimation Card */}
                  {cart.length > 0 && (
                    <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs space-y-2">
                      <div className="flex items-center justify-between text-emerald-800 font-bold">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                          Expected Profit
                        </span>
                        <span className="font-mono bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[11px]">
                          {cartProfitMargin.toFixed(1)}% margin
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1.5 border-t border-emerald-200/60 font-mono">
                        <div>
                          <span className="text-slate-500 block text-[10px]">Retail Sales Value</span>
                          <span className="font-bold text-slate-800">{formatCurrency(cartEstTotalSales)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-emerald-700 font-semibold block text-[10px]">Expected Profit</span>
                          <span className={cn(
                            "font-bold",
                            cartEstProfit >= 0 ? "text-emerald-700" : "text-rose-700"
                          )}>
                            {cartEstProfit >= 0 ? '+' : ''}{formatCurrency(cartEstProfit)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Total Bill Card & Preview Button */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-3 mt-auto">
                    <div className="flex justify-between items-center">
                      <span className="text-xs uppercase font-bold text-slate-500">Total Purchase Bill</span>
                      <span className="text-xl font-black font-mono text-primary-700">{formatCurrency(totalAmount)}</span>
                    </div>

                    <Button 
                      onClick={() => {
                        if (cart.length === 0) {
                          alert('Please add items to the purchase list first.');
                          return;
                        }
                        const hasInvalidTotalCost = cart.some(item => {
                          const inputVal = item.total_amount_input;
                          if (inputVal === undefined || inputVal === null || inputVal.toString().trim() === '') {
                            return true;
                          }
                          const parsed = parseFloat(inputVal.toString());
                          return isNaN(parsed) || parsed <= 0;
                        });

                        if (hasInvalidTotalCost) {
                          alert('দয়া করে প্রতিটি পণ্যের জন্য একটি সঠিক Total Cost (৳) ইনপুট দিন।\nPlease enter a valid Total Cost (৳) for all items in the list.');
                          return;
                        }
                        setIsPreviewModalOpen(true);
                      }} 
                      disabled={cart.length === 0}
                      className="w-full py-2.5 shadow-md shadow-primary-500/20 font-bold gap-2 cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      {editingPurchaseId ? 'Preview & Update Bill' : 'Preview Purchase Bill'}
                    </Button>
                  </div>

                </div>
              </div>
          </div>
        </div>
      )}

      {/* Purchase Bill Preview Modal */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50/80">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-primary-100 text-primary-700 rounded-lg">
                  <Eye className="w-5 h-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">Purchase Bill Preview</h3>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] uppercase">
                      Draft Review
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Review items, supplier, quantities, and cost before confirming</p>
                </div>
              </div>
              <button 
                onClick={() => setIsPreviewModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Supplier & Bill Info */}
              {(() => {
                const supp = suppliers.find(s => s.id === selectedSupplierId);
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Supplier Details
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm">{supp ? supp.name : 'Direct Supplier / Walk-in Vendor'}</h4>
                      {supp?.sl_number && (
                        <p className="text-xs font-mono text-slate-500 mt-0.5">SL: {supp.sl_number}</p>
                      )}
                      {supp?.phone && (
                        <p className="text-xs text-slate-600 mt-0.5">Phone: {supp.phone}</p>
                      )}
                      {supp?.address && (
                        <p className="text-xs text-slate-500 mt-0.5">Address: {supp.address}</p>
                      )}
                    </div>
                    <div className="md:text-right space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Bill Summary
                      </span>
                      <p className="text-xs text-slate-600">
                        Date: <span className="font-semibold text-slate-800">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </p>
                      <p className="text-xs text-slate-600">
                        Total Items: <span className="font-bold text-slate-800">{cart.length}</span>
                      </p>
                      <p className="text-xs text-slate-600">
                        Total Quantity: <span className="font-bold text-slate-800 font-mono">{cart.reduce((s, i) => s + i.quantity, 0)} pcs</span>
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase">
                    <tr>
                      <th className="py-3 px-3.5 text-center w-10">#</th>
                      <th className="py-3 px-3.5">Product Name & SKU</th>
                      <th className="py-3 px-3.5 text-center">Qty</th>
                      <th className="py-3 px-3.5 text-right">Unit Cost (৳)</th>
                      <th className="py-3 px-3.5 text-right">Total Cost (৳)</th>
                      <th className="py-3 px-3.5 text-right">Sales Price (৳)</th>
                      <th className="py-3 px-3.5 text-right">Est. Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {cart.map((item, idx) => {
                      const itemTotal = item.total_amount_input !== undefined && item.total_amount_input !== ''
                        ? (parseFloat(item.total_amount_input) || 0)
                        : (item.quantity * item.unit_price);
                      const unitCost = item.quantity > 0 ? (itemTotal / item.quantity) : 0;
                      const salesPrice = item.default_sales_price || 0;
                      const estSales = item.quantity * salesPrice;
                      const estProfit = estSales - itemTotal;

                      return (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-3.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-3 px-3.5">
                            <span className="font-bold text-slate-900 block">{item.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">SKU: {item.sku}</span>
                          </td>
                          <td className="py-3 px-3.5 text-center font-bold text-slate-800 font-mono">
                            {item.quantity} pcs
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-slate-700">
                            {formatCurrency(unitCost)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(itemTotal)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-slate-700">
                            {formatCurrency(salesPrice)}
                          </td>
                          <td className={cn(
                            "py-3 px-3.5 text-right font-mono font-bold",
                            estProfit >= 0 ? "text-emerald-700" : "text-rose-700"
                          )}>
                            {estProfit >= 0 ? '+' : ''}{formatCurrency(estProfit)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Financial Breakdown Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-emerald-900 font-bold text-xs">
                    <span className="flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                      Profit Projection
                    </span>
                    <span className="bg-emerald-200/80 text-emerald-900 font-mono px-2 py-0.5 rounded text-xs">
                      {cartProfitMargin.toFixed(1)}% margin
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-emerald-200 text-slate-700">
                    <div>
                      <span className="text-[11px] text-slate-500 block">Retail Sales Value:</span>
                      <span className="font-bold font-mono text-slate-900">{formatCurrency(cartEstTotalSales)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-slate-500 block">Expected Profit:</span>
                      <span className={cn(
                        "font-bold font-mono",
                        cartEstProfit >= 0 ? "text-emerald-700" : "text-rose-700"
                      )}>
                        {cartEstProfit >= 0 ? '+' : ''}{formatCurrency(cartEstProfit)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-sm font-bold text-slate-900">
                    <span>Total Purchase Bill:</span>
                    <span className="text-xl font-mono text-primary-700">{formatCurrency(totalAmount)}</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Inventory stock will be increased and unit cost prices updated upon confirmation.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/80">
              <Button 
                variant="outline" 
                onClick={() => setIsPreviewModalOpen(false)}
                className="gap-2 text-slate-700"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Edit
              </Button>
              <Button 
                onClick={handleCheckout} 
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-7 shadow-md shadow-emerald-600/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                {editingPurchaseId ? 'Confirm & Update' : 'Confirm Purchase'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Supplier Modal */}
      {isAddSupplierOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <Card className="w-full max-w-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900">Add New Supplier</h3>
              <button onClick={() => setIsAddSupplierOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <Input 
                label="Supplier Name" 
                placeholder="e.g. Pran Foods Ltd."
                value={newSupplierName}
                onChange={e => setNewSupplierName(e.target.value)}
                required
              />
              <Input 
                label="Phone Number" 
                placeholder="017XXXXXXXX"
                value={newSupplierPhone}
                onChange={e => setNewSupplierPhone(e.target.value)}
              />
              <Input 
                label="Address / Location" 
                placeholder="Dhaka, Bangladesh"
                value={newSupplierAddress}
                onChange={e => setNewSupplierAddress(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" onClick={() => setIsAddSupplierOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddSupplier} disabled={!newSupplierName.trim()}>
                Save Supplier
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Quick Add Product Modal */}
      <AddProductModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        onSuccess={handleProductAddedFromModal}
        suppliers={suppliers}
        brands={brands}
        categories={categoriesList}
        subCategories={[]}
        onOpenScanner={(target) => setIsScannerOpen(true)}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <Card className="w-full max-w-md bg-white">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Purchase Bill</h3>
            <p className="text-sm text-slate-600 mb-5">
              Are you sure you want to delete this purchase bill? It will be moved to the Recycle Bin and can be restored anytime.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteConfirm({ isOpen: false })}>
                Cancel
              </Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={confirmDelete}>
                Delete & Reverse Stock
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {isScannerOpen && (
        <BarcodeScanner 
          onScan={(decodedText) => {
            setProductSearch(decodedText);
            const match = inventory.find(i => 
              (i.sku || '').toLowerCase() === decodedText.toLowerCase() || 
              (i.item_code || '').toLowerCase() === decodedText.toLowerCase()
            );
            if (match) {
              addToCart(match);
              setProductSearch('');
            }
            setIsScannerOpen(false);
          }} 
          onClose={() => setIsScannerOpen(false)} 
        />
      )}
    </div>
  );
};
