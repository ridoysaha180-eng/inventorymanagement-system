import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Calendar, Download, ShoppingBag, X, Trash2, Printer, 
  CheckCircle2, ScanLine, CreditCard, Banknote, Landmark, Eye, Edit2, 
  FileSpreadsheet, UserPlus, Layers, TrendingUp, TrendingDown, Receipt, ShieldCheck,
  AlertCircle, Maximize2, Minimize2
} from 'lucide-react';
import QRCode from 'react-qr-code';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { formatCurrency, cn, resolveItemCost, calculateSaleFinancials, resolveSaleOfficeAuditLots } from '../utils';
import { storageService } from '../services/storageService';
import { InventoryItem, Sale, SaleItem, Customer, Supplier, Brand, Category, Purchase } from '../types';
import { BarcodeScanner } from '../components/common/BarcodeScanner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCodeLib from 'qrcode';
import { useSearchParams } from 'react-router-dom';

const formatDateInvoice = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = date.getDate().toString().padStart(2, '0');
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

export const Sales: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [sales, setSales] = useState<Sale[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // View Mode: Invoices Table vs Product Sales Summary
  const [viewMode, setViewMode] = useState<'table' | 'product_summary'>('table');
  const [productSummarySearch, setProductSummarySearch] = useState('');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id?: string }>({ isOpen: false });

  // Quick Customer Creation Modal inside POS
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({ name: '', phone: '', email: '', address: '' });

  // Scanner state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<'search' | 'pos'>('search');
  const [invoiceCopyType, setInvoiceCopyType] = useState<'customer' | 'office' | 'both' | 'thermal'>('customer');
  const [isPosFullscreen, setIsPosFullscreen] = useState(false);

  // New Sale POS State
  const [cart, setCart] = useState<(SaleItem & { name: string; sku: string; total_quantity: number; cost_price?: number })[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'due'>('cash');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedCompany, setSelectedCompany] = useState('All');
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(0);

  const businessSettings = storageService.getBusinessSettings();

  useEffect(() => {
    loadData();

    const handleDataUpdate = () => {
      loadData();
    };

    window.addEventListener('bizflow_purchases_updated', handleDataUpdate);
    window.addEventListener('bizflow_inventory_updated', handleDataUpdate);
    window.addEventListener('bizflow_sales_updated', handleDataUpdate);
    window.addEventListener('bizflow_due_payments_updated', handleDataUpdate);
    window.addEventListener('bizflow_suppliers_updated', handleDataUpdate);
    window.addEventListener('bizflow_customers_updated', handleDataUpdate);
    window.addEventListener('storage', handleDataUpdate);

    return () => {
      window.removeEventListener('bizflow_purchases_updated', handleDataUpdate);
      window.removeEventListener('bizflow_inventory_updated', handleDataUpdate);
      window.removeEventListener('bizflow_sales_updated', handleDataUpdate);
      window.removeEventListener('bizflow_due_payments_updated', handleDataUpdate);
      window.removeEventListener('bizflow_suppliers_updated', handleDataUpdate);
      window.removeEventListener('bizflow_customers_updated', handleDataUpdate);
      window.removeEventListener('storage', handleDataUpdate);
    };
  }, []);

  useEffect(() => {
    const q = searchParams.get('search');
    if (q !== null) {
      setSearchTerm(q);
    }
  }, [searchParams]);

  const loadData = () => {
    setSales(storageService.getSales() || []);
    setInventory(storageService.getInventory() || []);
    setPurchases(storageService.getPurchases() || []);
    setCustomers(storageService.getCustomers() || []);
    setSuppliers(storageService.getSuppliers() || []);
    setBrands(storageService.getBrands() || []);
    setCategories(storageService.getCategories() || []);
  };

  // --- Group Inventory by SKU for POS ---
  const groupedInventory = useMemo(() => {
    const map = new Map<string, InventoryItem & { total_quantity: number; suppliers_count: number }>();
    inventory.forEach(item => {
      const sku = item.sku || item.id;
      if (!map.has(sku)) {
        map.set(sku, { ...item, total_quantity: 0, suppliers_count: 0 });
      }
      const existing = map.get(sku)!;
      existing.total_quantity += item.quantity;
      if (item.quantity > 0) {
        existing.suppliers_count += 1;
      }
    });
    return Array.from(map.values());
  }, [inventory]);

  // --- Sales with item cost, COGS, and true net profit/loss analytics ---
  const salesWithStats = useMemo(() => {
    return sales.map(sale => {
      let totalCost = 0;
      let totalItemsCount = 0;

      const officeLots = resolveSaleOfficeAuditLots(sale, inventory, purchases, suppliers, sales);
      if (officeLots && officeLots.length > 0) {
        totalCost = officeLots.reduce((sum, lot) => sum + lot.total_cost, 0);
        totalItemsCount = (sale.items || []).reduce((sum, i) => sum + i.quantity, 0);
      } else {
        (sale.items || []).forEach(item => {
          totalItemsCount += item.quantity;
          const cost = resolveItemCost(item, inventory, purchases);
          totalCost += (cost * item.quantity);
        });
      }

      // Subtotal (sum of items sold)
      const subtotal = (sale.subtotal !== undefined && sale.subtotal !== null)
        ? sale.subtotal 
        : (sale.items || []).reduce((sum, i) => sum + (i.quantity * i.unit_price), 0);
      
      const discount = sale.discount_amount || 0;
      // Net revenue realized by the business (excluding tax, which is a government liability)
      const netRevenue = Math.max(0, subtotal - discount);
      
      // Realized Profit / (Loss) = Net Sales Revenue - COGS
      const profit = netRevenue - totalCost;
      const margin = netRevenue > 0 ? (profit / netRevenue) * 100 : 0;
      const isProfit = profit >= 0;
      const isLoss = profit < 0;

      return {
        ...sale,
        subtotal,
        netRevenue,
        totalCost,
        totalItemsCount,
        profit,
        margin,
        isProfit,
        isLoss
      };
    });
  }, [sales, inventory, purchases, suppliers]);

  // --- KPI Metrics ---
  const totalRevenue = useMemo(() => salesWithStats.reduce((sum, s) => sum + s.netRevenue, 0), [salesWithStats]);
  const totalGrossAmount = useMemo(() => sales.reduce((sum, s) => sum + (s.total_amount || 0), 0), [sales]);
  const totalCOGS = useMemo(() => salesWithStats.reduce((sum, s) => sum + s.totalCost, 0), [salesWithStats]);
  const totalRealizedProfit = useMemo(() => salesWithStats.reduce((sum, s) => sum + s.profit, 0), [salesWithStats]);
  
  const overallMargin = useMemo(() => {
    return totalRevenue > 0 ? (totalRealizedProfit / totalRevenue) * 100 : 0;
  }, [totalRevenue, totalRealizedProfit]);

  const profitableSalesCount = useMemo(() => salesWithStats.filter(s => s.profit > 0).length, [salesWithStats]);
  const lossSalesCount = useMemo(() => salesWithStats.filter(s => s.profit < 0).length, [salesWithStats]);
  const totalPositiveProfit = useMemo(() => salesWithStats.filter(s => s.profit > 0).reduce((sum, s) => sum + s.profit, 0), [salesWithStats]);
  const totalLossAmount = useMemo(() => salesWithStats.filter(s => s.profit < 0).reduce((sum, s) => sum + Math.abs(s.profit), 0), [salesWithStats]);

  const todayStr = new Date().toISOString().split('T')[0];
  const salesToday = useMemo(() => salesWithStats.filter(s => (s.created_at || '').startsWith(todayStr)), [salesWithStats, todayStr]);
  const todayRevenue = useMemo(() => salesToday.reduce((sum, s) => sum + s.netRevenue, 0), [salesToday]);
  const todayProfit = useMemo(() => salesToday.reduce((sum, s) => sum + s.profit, 0), [salesToday]);

  const totalSoldUnits = useMemo(() => {
    return salesWithStats.reduce((sum, s) => sum + s.totalItemsCount, 0);
  }, [salesWithStats]);

  const avgOrderValue = useMemo(() => {
    return salesWithStats.length > 0 ? totalRevenue / salesWithStats.length : 0;
  }, [salesWithStats, totalRevenue]);

  // --- Filtered Sales ---
  const filteredSales = useMemo(() => {
    return salesWithStats.filter(sale => {
      const search = searchTerm.toLowerCase();
      const customer = customers.find(c => c.id === sale.customer_id);
      const customerName = (customer?.name || 'Walk-in Customer').toLowerCase();
      const customerPhone = (customer?.phone || '').toLowerCase();
      const invoiceId = (sale.id || '').toLowerCase();
      const hasItemMatch = (sale.items || []).some(i => 
        (i.item_name || '').toLowerCase().includes(search) || 
        (i.supplier_name || '').toLowerCase().includes(search) ||
        (i.supplier_sl || '').toLowerCase().includes(search)
      );

      const matchesSearch = !searchTerm || 
        invoiceId.includes(search) || 
        customerName.includes(search) || 
        customerPhone.includes(search) || 
        hasItemMatch;

      const matchesCustomer = customerFilter === 'all' || 
        (customerFilter === 'walkin' && !sale.customer_id) || 
        sale.customer_id === customerFilter;

      const isOriginalDue = sale.payment_method === 'due';
      const effectivePaid = sale.paid_amount !== undefined 
        ? sale.paid_amount 
        : (sale.payment_method === 'cash' ? sale.total_amount : (sale.cash_received || 0));
      const effectiveDue = sale.due_amount !== undefined 
        ? sale.due_amount 
        : (isOriginalDue ? Math.max(0, sale.total_amount - effectivePaid) : 0);
      const currentStatus = effectiveDue === 0 ? 'completed' : (effectivePaid > 0 ? 'partial' : sale.status);

      const isPartial = (effectivePaid > 0 && effectiveDue > 0) || currentStatus === 'partial';
      const isDueOrUnpaid = effectiveDue > 0 || sale.payment_method === 'due' || currentStatus === 'pending';

      let matchesPayment = true;
      if (paymentMethodFilter === 'all') {
        matchesPayment = true;
      } else if (paymentMethodFilter === 'cash') {
        matchesPayment = sale.payment_method === 'cash';
      } else if (paymentMethodFilter === 'due') {
        matchesPayment = isDueOrUnpaid;
      } else if (paymentMethodFilter === 'partial') {
        matchesPayment = isPartial;
      } else if (paymentMethodFilter === 'card') {
        matchesPayment = sale.payment_method === 'card';
      } else if (paymentMethodFilter === 'transfer') {
        matchesPayment = sale.payment_method === 'transfer';
      }

      const matchesStatus = statusFilter === 'all' || currentStatus === statusFilter || sale.status === statusFilter;

      let matchesDate = true;
      if (dateFilter === 'today') {
        matchesDate = (sale.created_at || '').startsWith(todayStr);
      } else if (dateFilter === 'week') {
        const saleDate = new Date(sale.created_at).getTime();
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        matchesDate = saleDate >= weekAgo;
      } else if (dateFilter === 'month') {
        const saleDate = new Date(sale.created_at).getTime();
        const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        matchesDate = saleDate >= monthAgo;
      } else if (dateFilter === 'custom') {
        const saleTime = new Date(sale.created_at).getTime();
        const start = startDate ? new Date(startDate).getTime() : 0;
        const end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : Date.now();
        matchesDate = saleTime >= start && saleTime <= end;
      }

      return matchesSearch && matchesCustomer && matchesPayment && matchesStatus && matchesDate;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [salesWithStats, searchTerm, customerFilter, paymentMethodFilter, statusFilter, dateFilter, startDate, endDate, customers, todayStr]);

  // --- Filtered Sales Totals ---
  const filteredTotals = useMemo(() => {
    let subtotal = 0;
    let discount = 0;
    let tax = 0;
    let totalAmount = 0;
    let totalCost = 0;
    let profit = 0;
    let totalItems = 0;

    filteredSales.forEach(s => {
      subtotal += (s.subtotal || s.total_amount || 0);
      discount += (s.discount_amount || 0);
      tax += (s.tax_amount || 0);
      totalAmount += (s.total_amount || 0);
      totalCost += (s.totalCost || 0);
      profit += (s.profit || 0);
      totalItems += (s.totalItemsCount || 0);
    });

    const netRevenue = Math.max(0, subtotal - discount);
    const margin = netRevenue > 0 ? (profit / netRevenue) * 100 : 0;

    return {
      subtotal,
      discount,
      tax,
      totalAmount,
      totalCost,
      profit,
      margin,
      totalItems
    };
  }, [filteredSales]);

  // --- Product-wise Sales Breakdown ---
  const productSalesSummary = useMemo(() => {
    const map = new Map<string, {
      sku: string;
      name: string;
      category: string;
      company: string;
      quantitySold: number;
      totalRevenue: number;
      totalCost: number;
      profit: number;
      margin: number;
      avgSellingPrice: number;
      avgCostPrice: number;
      lastSoldDate: string;
    }>();

    filteredSales.forEach(sale => {
      const saleSubtotal = sale.subtotal || (sale.items || []).reduce((sum, i) => sum + (i.quantity * i.unit_price), 0);
      const discountRatio = saleSubtotal > 0 ? (sale.discount_amount || 0) / saleSubtotal : 0;

      (sale.items || []).forEach(item => {
        const invItem = inventory.find(i => i.id === item.inventory_item_id) || 
                        inventory.find(i => (i.sku && item.sku && i.sku === item.sku)) ||
                        inventory.find(i => i.name.toLowerCase() === (item.item_name || '').toLowerCase());
        const sku = invItem?.sku || item.sku || item.item_name || 'GEN-SKU';
        const name = item.item_name || invItem?.name || 'Product';
        const category = invItem?.category || 'General';
        const company = invItem?.company || 'N/A';
        const costPrice = resolveItemCost(item, inventory, purchases);

        if (!map.has(sku)) {
          map.set(sku, {
            sku,
            name,
            category,
            company,
            quantitySold: 0,
            totalRevenue: 0,
            totalCost: 0,
            profit: 0,
            margin: 0,
            avgSellingPrice: 0,
            avgCostPrice: 0,
            lastSoldDate: sale.created_at
          });
        }

        const entry = map.get(sku)!;
        entry.quantitySold += item.quantity;
        const itemGross = item.quantity * item.unit_price;
        const itemDiscount = itemGross * discountRatio;
        const itemNetRevenue = itemGross - itemDiscount;
        const itemCostTotal = item.quantity * costPrice;

        entry.totalRevenue += itemNetRevenue;
        entry.totalCost += itemCostTotal;
        entry.profit = entry.totalRevenue - entry.totalCost;
        entry.margin = entry.totalRevenue > 0 ? (entry.profit / entry.totalRevenue) * 100 : 0;
        entry.avgSellingPrice = entry.quantitySold > 0 ? entry.totalRevenue / entry.quantitySold : 0;
        entry.avgCostPrice = entry.quantitySold > 0 ? entry.totalCost / entry.quantitySold : 0;
        if (new Date(sale.created_at) > new Date(entry.lastSoldDate)) {
          entry.lastSoldDate = sale.created_at;
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [filteredSales, inventory, purchases]);

  const filteredProductSalesSummary = useMemo(() => {
    if (!productSummarySearch.trim()) return productSalesSummary;
    const q = productSummarySearch.toLowerCase();
    return productSalesSummary.filter(item => 
      item.name.toLowerCase().includes(q) || 
      item.sku.toLowerCase().includes(q) || 
      item.category.toLowerCase().includes(q) || 
      item.company.toLowerCase().includes(q)
    );
  }, [productSalesSummary, productSummarySearch]);

  const productSummaryTotals = useMemo(() => {
    let totalQty = 0;
    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;

    filteredProductSalesSummary.forEach(p => {
      totalQty += p.quantitySold;
      totalRevenue += p.totalRevenue;
      totalCost += p.totalCost;
      totalProfit += p.profit;
    });

    const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    return {
      totalQty,
      totalRevenue,
      totalCost,
      totalProfit,
      margin
    };
  }, [filteredProductSalesSummary]);

  // --- Cart / POS Operations ---
  const addToCart = (product: InventoryItem & { total_quantity: number }) => {
    const sku = product.sku || product.id;
    const existing = cart.find(item => item.sku === sku);
    if (existing) {
      if (existing.quantity >= product.total_quantity) {
        alert(`Cannot add more. Available stock limit is ${product.total_quantity}.`);
        return;
      }
      setCart(cart.map(item => 
        item.sku === sku 
          ? { ...item, quantity: item.quantity + 1 } 
          : item
      ));
    } else {
      if (product.total_quantity <= 0) {
        alert('This product is out of stock.');
        return;
      }
      setCart([...cart, {
        id: Math.random().toString(36).substr(2, 9),
        sale_id: '',
        inventory_item_id: product.id,
        item_name: product.name,
        name: product.name,
        sku: product.sku || product.id,
        quantity: 1,
        unit_price: product.unit_price,
        cost_price: product.cost_price,
        total_quantity: product.total_quantity
      }]);
    }
  };

  const updateCartQuantity = (sku: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.sku === sku) {
        const newQty = Math.max(1, item.quantity + delta);
        if (newQty > item.total_quantity) {
          alert(`Maximum available stock is ${item.total_quantity}`);
          return item;
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const updateCartPrice = (sku: string, newPrice: number) => {
    setCart(cart.map(item => {
      if (item.sku === sku) {
        return { ...item, unit_price: newPrice };
      }
      return item;
    }));
  };

  const removeFromCart = (sku: string) => {
    setCart(cart.filter(item => item.sku !== sku));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const taxAmount = (subtotal - discount) > 0 ? (subtotal - discount) * (taxRate / 100) : 0;
  const totalAmount = Math.max(0, subtotal - discount + taxAmount);

  // Cash Tendered, Change Return & Due calculations
  const parsedCashReceived = cashReceived === '' ? null : Math.max(0, parseFloat(cashReceived) || 0);
  const effectiveCashReceived = parsedCashReceived !== null 
    ? parsedCashReceived 
    : (paymentMethod === 'cash' ? totalAmount : 0);

  const changeAmount = paymentMethod === 'cash'
    ? Math.max(0, effectiveCashReceived - totalAmount)
    : (effectiveCashReceived > totalAmount ? effectiveCashReceived - totalAmount : 0);

  const dueAmount = Math.max(0, totalAmount - effectiveCashReceived);
  const paidAmount = Math.min(totalAmount, effectiveCashReceived);

  // Real-time Cart COGS and Profit/Loss Estimation
  const cartCOGS = useMemo(() => {
    return cart.reduce((sum, item) => {
      const cost = resolveItemCost(item, inventory, purchases);
      return sum + (cost * item.quantity);
    }, 0);
  }, [cart, inventory, purchases]);

  const cartNetRevenue = Math.max(0, subtotal - discount);
  const cartEstProfit = cartNetRevenue - cartCOGS;
  const cartEstMargin = cartNetRevenue > 0 ? (cartEstProfit / cartNetRevenue) * 100 : 0;

  // --- Quick Create Customer ---
  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerData.name.trim()) return;

    const newCust: Customer = {
      id: Math.random().toString(36).substr(2, 9),
      user_id: '123',
      name: newCustomerData.name.trim(),
      phone: newCustomerData.phone.trim(),
      email: newCustomerData.email.trim(),
      address: newCustomerData.address.trim(),
      created_at: new Date().toISOString()
    };

    storageService.addCustomer(newCust);
    setCustomers(prev => [...prev, newCust]);
    setSelectedCustomerId(newCust.id);
    setIsAddingCustomer(false);
    setNewCustomerData({ name: '', phone: '', email: '', address: '' });
  };

  // --- Checkout / Submit Sale with Supplier-wise Sequential (FIFO) Deduction ---
  const handleCheckout = () => {
    if (cart.length === 0) {
      alert('Please add at least one product to the cart.');
      return;
    }

    try {
      let saleId = editingSaleId;
      if (!isEditMode) {
        let maxSeq = 0;
        for (const s of sales) {
          if (!isNaN(Number(s.id))) {
            maxSeq = Math.max(maxSeq, Number(s.id));
          }
        }
        saleId = (maxSeq + 1).toString().padStart(6, '0');
      }

      const saleItems: SaleItem[] = [];
      let tempInventory = [...inventory.map(i => ({ ...i }))];

      // Revert previous sale stock if editing
      if (isEditMode) {
        const oldSale = sales.find(s => s.id === editingSaleId);
        if (oldSale) {
          oldSale.items.forEach(item => {
            const invItem = tempInventory.find(i => i.id === item.inventory_item_id);
            if (invItem) {
              invItem.quantity += item.quantity;
            }
          });
        }
      }

      // Deduct each cart product using Supplier Serial-wise FIFO logic
      cart.forEach(cartItem => {
        let remainingToDeduct = cartItem.quantity;
        
        // Find all inventory items for this SKU or ID or Name
        const matchingInventory = tempInventory.filter(i => (
          (cartItem.sku && i.sku && i.sku.trim().toLowerCase() === cartItem.sku.trim().toLowerCase()) || 
          i.id === cartItem.inventory_item_id ||
          (cartItem.name && i.name && i.name.trim().toLowerCase() === cartItem.name.trim().toLowerCase())
        ));

        // Sort matching inventory items strictly by Supplier SL number (e.g. SL-001 before SL-002)
        matchingInventory.sort((a, b) => {
          const suppA = suppliers.find(s => s.id === a.supplier_id);
          const suppB = suppliers.find(s => s.id === b.supplier_id);
          const slA = suppA?.sl_number || a.supplier_sl || 'SL-9999';
          const slB = suppB?.sl_number || b.supplier_sl || 'SL-9999';
          if (slA !== slB) {
            return slA.localeCompare(slB, undefined, { numeric: true });
          }
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        });

        // Deduct from available supplier inventory items sequentially by SL number
        for (const invItem of matchingInventory) {
          if (remainingToDeduct <= 0) break;
          if (invItem.quantity > 0) {
            const deductAmount = Math.min(invItem.quantity, remainingToDeduct);
            invItem.quantity = Math.max(0, invItem.quantity - deductAmount);
            remainingToDeduct -= deductAmount;

            const supp = suppliers.find(s => s.id === invItem.supplier_id);
            const cost = resolveItemCost({ ...cartItem, supplier_id: invItem.supplier_id, cost_price: invItem.cost_price, inventory_item_id: invItem.id }, inventory, purchases);

            saleItems.push({
              id: Math.random().toString(36).substr(2, 9),
              sale_id: saleId!,
              inventory_item_id: invItem.id,
              sku: cartItem.sku || invItem.sku || '',
              item_name: cartItem.name || invItem.name || '',
              quantity: deductAmount,
              unit_price: cartItem.unit_price,
              cost_price: cost,
              supplier_id: invItem.supplier_id || '',
              supplier_name: supp?.name || invItem.supplier_name || 'Direct Stock',
              supplier_sl: supp?.sl_number || invItem.supplier_sl || '-'
            });
          }
        }

        // If stock was exhausted across all inventory items or oversold, assign remaining to fallback supplier
        if (remainingToDeduct > 0) {
          const invItem = matchingInventory[0];
          const supp = invItem ? suppliers.find(s => s.id === invItem.supplier_id) : suppliers[0];
          const suppId = supp?.id || invItem?.supplier_id || '';
          const suppName = supp?.name || invItem?.supplier_name || 'Direct / Store';
          const suppSL = supp?.sl_number || invItem?.supplier_sl || 'SL-001';
          const cost = resolveItemCost({ ...cartItem, cost_price: invItem?.cost_price || cartItem.cost_price, inventory_item_id: invItem?.id || cartItem.inventory_item_id, supplier_id: suppId }, inventory, purchases);

          saleItems.push({
            id: Math.random().toString(36).substr(2, 9),
            sale_id: saleId!,
            inventory_item_id: invItem?.id || cartItem.inventory_item_id,
            sku: cartItem.sku || invItem?.sku || '',
            item_name: cartItem.name || invItem?.name || '',
            quantity: remainingToDeduct,
            unit_price: cartItem.unit_price,
            cost_price: cost,
            supplier_id: suppId,
            supplier_name: suppName,
            supplier_sl: suppSL
          });

          if (invItem) {
            invItem.quantity = Math.max(0, (invItem.quantity || 0) - remainingToDeduct);
          }
        }
      });

      const calculatedStatus = dueAmount === 0 ? 'completed' : (paidAmount > 0 ? 'partial' : 'pending');
      const calculatedPaymentMethod = dueAmount > 0 && paidAmount === 0 ? 'due' : paymentMethod;

      const newSale: Sale = {
        id: saleId!,
        user_id: '123',
        ...(selectedCustomerId ? { customer_id: selectedCustomerId } : {}),
        subtotal,
        discount_amount: discount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        cash_received: effectiveCashReceived,
        change_amount: changeAmount,
        paid_amount: paidAmount,
        due_amount: dueAmount,
        payment_method: calculatedPaymentMethod,
        status: calculatedStatus,
        created_at: isEditMode ? sales.find(s => s.id === editingSaleId)?.created_at || new Date().toISOString() : new Date().toISOString(),
        items: saleItems
      };

      if (isEditMode) {
        storageService.updateSale(saleId!, newSale);
      } else {
        storageService.addSale(newSale);
      }

      // Save updated inventory deductions
      storageService.saveInventory(tempInventory);

      // Reset states
      setCart([]);
      setSelectedCustomerId('');
      setPaymentMethod('cash');
      setCashReceived('');
      setIsPreviewMode(false);
      setDiscount(0);
      setTaxRate(0);
      setProductSearch('');
      setSelectedCategory('All');
      setSelectedCompany('All');
      setIsEditMode(false);
      setEditingSaleId(null);
      setIsModalOpen(false);

      loadData();
      setSelectedSale(newSale);
    } catch (error: any) {
      console.error('Checkout error:', error);
      alert(error.message || 'Failed to complete sale. Please verify inventory stock.');
    }
  };

  const handleEditSale = (e: React.MouseEvent, sale: Sale) => {
    e.stopPropagation();
    setIsEditMode(true);
    setEditingSaleId(sale.id);
    setSelectedCustomerId(sale.customer_id || '');
    setPaymentMethod(sale.payment_method === 'due' ? 'due' : 'cash');
    setCashReceived(sale.cash_received !== undefined ? sale.cash_received.toString() : (sale.paid_amount !== undefined ? sale.paid_amount.toString() : ''));
    setIsPreviewMode(false);
    setDiscount(sale.discount_amount || 0);

    const taxable = (sale.subtotal || sale.total_amount) - (sale.discount_amount || 0);
    if (taxable > 0 && sale.tax_amount) {
      setTaxRate((sale.tax_amount / taxable) * 100);
    } else {
      setTaxRate(0);
    }

    const cartItemsMap = new Map<string, any>();
    (sale.items || []).forEach(item => {
      const invItem = inventory.find(i => i.id === item.inventory_item_id);
      const sku = invItem ? invItem.sku : item.item_name;
      const currentStock = inventory.filter(i => i.sku === sku).reduce((sum, i) => sum + i.quantity, 0);

      if (cartItemsMap.has(sku)) {
        const existing = cartItemsMap.get(sku);
        existing.quantity += item.quantity;
      } else {
        cartItemsMap.set(sku, {
          id: Math.random().toString(36).substr(2, 9),
          sale_id: sale.id,
          inventory_item_id: item.inventory_item_id,
          item_name: item.item_name || invItem?.name || 'Item',
          name: invItem?.name || item.item_name || 'Item',
          sku: sku,
          quantity: item.quantity,
          unit_price: item.unit_price,
          cost_price: item.cost_price,
          supplier_id: item.supplier_id,
          supplier_name: item.supplier_name,
          supplier_sl: item.supplier_sl,
          total_quantity: currentStock + item.quantity
        });
      }
    });

    setCart(Array.from(cartItemsMap.values()));
    setIsModalOpen(true);
  };

  const openDeleteConfirm = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirm({ isOpen: true, id });
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirm.id) return;
    storageService.deleteSale(deleteConfirm.id);
    setDeleteConfirm({ isOpen: false });
    loadData();
  };

  // --- Export Excel ---
  const handleExportExcel = () => {
    const data = filteredSales.map(sale => {
      const customer = customers.find(c => c.id === sale.customer_id);
      return {
        'Invoice #': sale.id,
        Date: formatDateInvoice(sale.created_at),
        Customer: customer?.name || 'Walk-in Customer',
        Phone: customer?.phone || 'N/A',
        Items: (sale.items || []).map(i => `${i.item_name} (x${i.quantity}) [${i.supplier_name || 'Supplier'}]`).join(', '),
        'Total Items': sale.totalItemsCount,
        'Payment Method': sale.payment_method.toUpperCase(),
        'Cash Received': sale.cash_received !== undefined ? sale.cash_received : (sale.payment_method === 'cash' ? sale.total_amount : 0),
        'Change Returned': sale.change_amount || 0,
        'Paid Amount': sale.paid_amount !== undefined ? sale.paid_amount : (sale.payment_method === 'cash' ? sale.total_amount : 0),
        'Due Amount': sale.due_amount !== undefined ? sale.due_amount : (sale.payment_method === 'due' ? sale.total_amount : 0),
        Subtotal: sale.subtotal,
        Discount: sale.discount_amount || 0,
        'Net Revenue': sale.netRevenue,
        Tax: sale.tax_amount || 0,
        'Total Amount': sale.total_amount,
        'Cost of Goods (COGS)': sale.totalCost,
        'Profit / (Loss)': sale.profit,
        'Margin (%)': `${sale.margin.toFixed(2)}%`,
        'Result': sale.profit >= 0 ? 'PROFIT' : 'LOSS',
        Status: sale.status.toUpperCase()
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Report');
    XLSX.writeFile(wb, `Sales_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // --- Export PDF Report ---
  const handleExportPDF = () => {
    const doc = new jsPDF('landscape');
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    const primaryColor: [number, number, number] = [15, 23, 42]; // slate-900
    const secondaryColor: [number, number, number] = [71, 85, 105]; // slate-600
    const accentColor: [number, number, number] = [14, 165, 233]; // sky-500
    const borderColor: [number, number, number] = [226, 232, 240]; // slate-200

    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.rect(0, 0, pageWidth, 3, 'F');

    const shopName = (businessSettings?.name || '').trim() || 'BIZFLOW';
    const reportTitle = `${shopName.toUpperCase()} - SALES REPORT`;

    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.roundedRect(14, 10, pageWidth - 28, 22, 2, 2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(reportTitle, 20, 21);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(
      `Generated: ${new Date().toLocaleString()} | Filter: ${dateFilter.toUpperCase()} | Total Invoices: ${filteredSales.length}`,
      20,
      28
    );

    const totalFilteredRevenue = filteredTotals.totalAmount;
    const totalFilteredProfit = filteredTotals.profit;
    const isTotalProfit = totalFilteredProfit >= 0;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`Total Sales: ${formatCurrency(totalFilteredRevenue)}`, pageWidth - 90, 21);
    doc.text(
      isTotalProfit 
        ? `Net Profit: +${formatCurrency(totalFilteredProfit)} (${filteredTotals.margin.toFixed(1)}%)`
        : `Net Loss: -${formatCurrency(Math.abs(totalFilteredProfit))} (${Math.abs(filteredTotals.margin).toFixed(1)}%)`,
      pageWidth - 90, 
      28
    );

    const tableColumn = [
      'Invoice #',
      'Date',
      'Customer',
      'Items Sold',
      'Method',
      'Subtotal',
      'Discount',
      'Total Amount',
      'Profit / (Loss)',
      'Status'
    ];

    const tableRows = filteredSales.map(sale => {
      const customer = customers.find(c => c.id === sale.customer_id);
      return [
        `#${sale.id}`,
        formatDateInvoice(sale.created_at),
        customer?.name || 'Walk-in Customer',
        `${sale.totalItemsCount} pcs`,
        sale.payment_method.toUpperCase(),
        formatCurrency(sale.subtotal || sale.total_amount),
        sale.discount_amount ? `-${formatCurrency(sale.discount_amount)}` : '0',
        formatCurrency(sale.total_amount),
        sale.profit >= 0 ? `+${formatCurrency(sale.profit)}` : `-${formatCurrency(Math.abs(sale.profit))}`,
        sale.status.toUpperCase()
      ];
    });

    const tableFooter = [
      `Total (${filteredSales.length})`,
      '-',
      '-',
      `${filteredTotals.totalItems} pcs`,
      '-',
      formatCurrency(filteredTotals.subtotal),
      filteredTotals.discount > 0 ? `-${formatCurrency(filteredTotals.discount)}` : '0',
      formatCurrency(filteredTotals.totalAmount),
      isTotalProfit ? `+${formatCurrency(totalFilteredProfit)}` : `-${formatCurrency(Math.abs(totalFilteredProfit))}`,
      '-'
    ];

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      foot: [tableFooter],
      startY: 38,
      margin: { left: 14, right: 14, bottom: 12 },
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        font: 'helvetica',
        textColor: [51, 65, 85],
        lineColor: borderColor,
        lineWidth: 0.1,
        valign: 'middle'
      },
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 8,
        cellPadding: 3
      },
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: primaryColor,
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 8,
        cellPadding: 3
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 26, halign: 'center' },
        2: { cellWidth: 42, halign: 'left' },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 24, halign: 'center' },
        5: { cellWidth: 28, halign: 'right' },
        6: { cellWidth: 24, halign: 'right' },
        7: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
        8: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
        9: { cellWidth: 24, halign: 'center' }
      },
      didDrawPage: function (data) {
        const currentPage = (doc.internal as any).getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.text(`${shopName} • Sales & Billing Management`, data.settings.margin.left, pageHeight - 6);
        doc.text(`Page ${currentPage}`, pageWidth - data.settings.margin.right, pageHeight - 6, { align: 'right' });
      }
    });

    const safeName = shopName.replace(/[^a-zA-Z0-9]/g, '_') || 'Sales';
    doc.save(`${safeName}_Sales_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // --- Download Single Invoice PDF (Vector A4 Format) ---
  const handleDownloadInvoicePDF = async (saleToDownload?: Sale | string) => {
    const sale = typeof saleToDownload === 'object' && saleToDownload 
      ? saleToDownload 
      : (selectedSale || sales.find(s => s.id === saleToDownload));
      
    if (!sale) return;

    try {
      const doc = new jsPDF('portrait', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.width; // 210mm
      const pageHeight = doc.internal.pageSize.height; // 297mm
      const margin = 14;
      const contentWidth = pageWidth - margin * 2; // 182mm

      const primaryColor: [number, number, number] = [15, 23, 42]; // slate-900
      const secondaryColor: [number, number, number] = [71, 85, 105]; // slate-600
      const lightBg: [number, number, number] = [248, 250, 252]; // slate-50
      const borderColor: [number, number, number] = [226, 232, 240]; // slate-200
      const accentColor: [number, number, number] = [14, 165, 233]; // sky-500

      const copiesToRender = invoiceCopyType === 'both' ? ['customer', 'office'] : [invoiceCopyType];

      for (let pageIdx = 0; pageIdx < copiesToRender.length; pageIdx++) {
        const isOffice = copiesToRender[pageIdx] === 'office';
        if (pageIdx > 0) {
          doc.addPage('a4', 'portrait');
        }

        // Top Accent Color Bar
        doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.rect(0, 0, pageWidth, 4, 'F');

        // Header Shop Info
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

        // Right Side: Copy Type Badge, Invoice #, Date, QR Code
        const badgeText = isOffice ? 'OFFICE COPY (AUDIT)' : 'CUSTOMER COPY';
        const badgeWidth = doc.getTextWidth(badgeText) + 8;
        const badgeX = pageWidth - margin - badgeWidth;
        
        if (isOffice) {
          doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.roundedRect(badgeX, 10, badgeWidth, 6.5, 1.5, 1.5, 'F');
          doc.setTextColor(255, 255, 255);
        } else {
          doc.setFillColor(240, 249, 255);
          doc.roundedRect(badgeX, 10, badgeWidth, 6.5, 1.5, 1.5, 'F');
          doc.setDrawColor(186, 230, 253);
          doc.roundedRect(badgeX, 10, badgeWidth, 6.5, 1.5, 1.5, 'S');
          doc.setTextColor(3, 105, 161);
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(badgeText, badgeX + 4, 14.5);

        // Invoice Metadata (Top Right)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(`Invoice #${sale.id}`, pageWidth - margin, 22, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.text(`Date: ${formatDateInvoice(sale.created_at)} ${new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, pageWidth - margin, 27, { align: 'right' });
        doc.text(`Payment: ${sale.payment_method.toUpperCase()} | Status: ${sale.status.toUpperCase()}`, pageWidth - margin, 31.5, { align: 'right' });

        // QR Code
        try {
          const qrDataUrl = await QRCodeLib.toDataURL(`INV-${sale.id}`, { width: 90, margin: 1 });
          doc.addImage(qrDataUrl, 'PNG', pageWidth - margin - 17, 33, 17, 17);
        } catch {
          // ignore qr fallback
        }

        // Customer "Billed To" Box
        const customer = customers.find(c => c.id === sale.customer_id);
        const boxY = 38;
        const boxHeight = 20;
        doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
        doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
        doc.roundedRect(margin, boxY, contentWidth - 22, boxHeight, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.text('BILLED TO / CUSTOMER INFO', margin + 4, boxY + 5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(customer?.name || 'Walk-in Customer', margin + 4, boxY + 10.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        const custInfoLine: string[] = [];
        if (customer?.phone) custInfoLine.push(`Mobile: ${customer.phone}`);
        if (customer?.address) custInfoLine.push(`Address: ${customer.address}`);
        doc.text(custInfoLine.length > 0 ? custInfoLine.join(' | ') : 'Direct Store Customer', margin + 4, boxY + 15.5);

        // COGS and profits calculation
        const officeLots = resolveSaleOfficeAuditLots(sale, inventory, purchases, suppliers, sales);
        let totalCOGS = officeLots.reduce((sum, lot) => sum + lot.total_cost, 0);
        const saleSubtotal = (sale.subtotal !== undefined && sale.subtotal !== null) ? sale.subtotal : (sale.total_amount || 0);
        const saleDiscount = sale.discount_amount || 0;
        const netRevenue = Math.max(0, saleSubtotal - saleDiscount);
        const grossProfit = saleSubtotal - totalCOGS;
        const netProfit = netRevenue - totalCOGS;
        const profitMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

        // Build Table
        let tableHead: string[][] = [];
        let tableBody: (string | number)[][] = [];
        let columnStyles: Record<number, any> = {};

        if (isOffice) {
          tableHead = [[
            'SL', 'Product Description', 'Supplier Info (SL #)', 'Qty', 'Cost Price', 'Sale Price', 'Total Cost', 'Total Sale', 'Profit / (Loss)'
          ]];
          tableBody = officeLots.map((lot, idx) => {
            const suppDisplay = lot.supplier_sl !== '-' ? `${lot.supplier_name}\n(${lot.supplier_sl})` : lot.supplier_name;

            return [
              (idx + 1).toString(),
              lot.item_name + (lot.sku ? `\n${lot.sku}` : ''),
              suppDisplay,
              lot.quantity.toString(),
              formatCurrency(lot.cost_price),
              formatCurrency(lot.unit_price),
              formatCurrency(lot.total_cost),
              formatCurrency(lot.total_sale),
              lot.profit >= 0 ? `+${formatCurrency(lot.profit)}` : `-${formatCurrency(Math.abs(lot.profit))}`
            ];
          });

          columnStyles = {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 44, halign: 'left', fontStyle: 'bold' },
            2: { cellWidth: 32, halign: 'left' },
            3: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
            4: { cellWidth: 16, halign: 'right' },
            5: { cellWidth: 16, halign: 'right' },
            6: { cellWidth: 17, halign: 'right' },
            7: { cellWidth: 17, halign: 'right', fontStyle: 'bold' },
            8: { cellWidth: 18, halign: 'right', fontStyle: 'bold', textColor: [16, 120, 70] }
          };
        } else {
          tableHead = [[
            'SL', 'Product Description', 'Quantity', 'Unit Price', 'Total Amount'
          ]];
          
          // Merge customer items by product name and unit price
          const customerMergedMap = new Map<string, { item_name: string; quantity: number; unit_price: number; total: number }>();
          (sale.items || []).forEach(item => {
            const key = `${item.item_name || 'Item'}_${item.unit_price}`;
            if (!customerMergedMap.has(key)) {
              customerMergedMap.set(key, {
                item_name: item.item_name || 'Item',
                quantity: item.quantity,
                unit_price: item.unit_price,
                total: item.quantity * item.unit_price
              });
            } else {
              const ex = customerMergedMap.get(key)!;
              ex.quantity += item.quantity;
              ex.total += item.quantity * item.unit_price;
            }
          });

          tableBody = Array.from(customerMergedMap.values()).map((item, idx) => {
            return [
              (idx + 1).toString(),
              item.item_name,
              item.quantity.toString(),
              formatCurrency(item.unit_price),
              formatCurrency(item.total)
            ];
          });

          columnStyles = {
            0: { cellWidth: 12, halign: 'center' },
            1: { cellWidth: 94, halign: 'left', fontStyle: 'bold' },
            2: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
            3: { cellWidth: 28, halign: 'right' },
            4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
          };
        }

        autoTable(doc, {
          head: tableHead,
          body: tableBody,
          startY: boxY + boxHeight + 5,
          margin: { left: margin, right: margin, bottom: 22 },
          theme: 'grid',
          styles: {
            fontSize: 7.5,
            cellPadding: 2,
            font: 'helvetica',
            textColor: primaryColor,
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
            cellPadding: 2.5
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252]
          },
          columnStyles: columnStyles,
          didDrawPage: function (data) {
            const currentPage = (doc.internal as any).getNumberOfPages();
            doc.setFontSize(7.5);
            doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
            doc.text(
              isOffice 
                ? 'CONFIDENTIAL • FOR INTERNAL OFFICE & SUPPLIER AUDITING ONLY' 
                : 'Thank you for your business!', 
              margin, 
              pageHeight - 6
            );
            doc.text(`Page ${currentPage}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
          }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 5;

        // Totals Summary Block
        const summaryWidth = 72;
        const summaryX = pageWidth - margin - summaryWidth;

        const cashRec = sale.cash_received !== undefined ? sale.cash_received : (sale.payment_method === 'cash' ? sale.total_amount : 0);
        const changeRet = sale.change_amount || 0;
        const dueAmt = sale.due_amount !== undefined ? sale.due_amount : (sale.payment_method === 'due' ? sale.total_amount : 0);
        const paidAmt = sale.paid_amount !== undefined ? sale.paid_amount : (sale.payment_method === 'cash' ? sale.total_amount : 0);

        let summaryHeight = 44;
        if (sale.discount_amount && sale.discount_amount > 0) summaryHeight += 5;
        if (sale.tax_amount && sale.tax_amount > 0) summaryHeight += 5;
        if (changeRet > 0) summaryHeight += 4.5;
        if (dueAmt > 0) summaryHeight += 4.5;

        doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
        doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
        doc.roundedRect(summaryX, finalY, summaryWidth, summaryHeight, 1.5, 1.5, 'FD');

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.text('Subtotal:', summaryX + 3, finalY + 5.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(formatCurrency(sale.subtotal || sale.total_amount), summaryX + summaryWidth - 3, finalY + 5.5, { align: 'right' });

        let offsetSumY = finalY + 11;
        if (sale.discount_amount && sale.discount_amount > 0) {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
          doc.text('Discount:', summaryX + 3, offsetSumY);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(225, 29, 72); // rose-600
          doc.text(`-${formatCurrency(sale.discount_amount)}`, summaryX + summaryWidth - 3, offsetSumY, { align: 'right' });
          offsetSumY += 5.5;
        }

        if (sale.tax_amount && sale.tax_amount > 0) {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
          doc.text('VAT / Tax:', summaryX + 3, offsetSumY);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.text(`+${formatCurrency(sale.tax_amount)}`, summaryX + summaryWidth - 3, offsetSumY, { align: 'right' });
          offsetSumY += 5.5;
        }

        // Grand Total Bar
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.roundedRect(summaryX + 2, offsetSumY - 1, summaryWidth - 4, 7.5, 1, 1, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(255, 255, 255);
        doc.text('Grand Total:', summaryX + 4, offsetSumY + 4.2);
        doc.text(formatCurrency(sale.total_amount), summaryX + summaryWidth - 4, offsetSumY + 4.2, { align: 'right' });
        offsetSumY += 11;

        // Cash Received
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.text('Cash Received:', summaryX + 3, offsetSumY);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(formatCurrency(cashRec), summaryX + summaryWidth - 3, offsetSumY, { align: 'right' });
        offsetSumY += 4.5;

        // Change Return if any
        if (changeRet > 0) {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(16, 149, 106); // emerald-600
          doc.text('Change Returned:', summaryX + 3, offsetSumY);
          doc.setFont('helvetica', 'bold');
          doc.text(formatCurrency(changeRet), summaryX + summaryWidth - 3, offsetSumY, { align: 'right' });
          offsetSumY += 4.5;
        }

        // Due Amount if any
        if (dueAmt > 0) {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(217, 119, 6); // amber-600
          doc.text('Due Amount:', summaryX + 3, offsetSumY);
          doc.setFont('helvetica', 'bold');
          doc.text(formatCurrency(dueAmt), summaryX + summaryWidth - 3, offsetSumY, { align: 'right' });
          offsetSumY += 4.5;
        }

        // Net Paid
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text('Net Paid:', summaryX + 3, offsetSumY);
        doc.setTextColor(16, 149, 106);
        doc.text(formatCurrency(paidAmt), summaryX + summaryWidth - 3, offsetSumY, { align: 'right' });

        // If Office Copy: Draw Profit & COGS Audit Box on Left
        if (isOffice) {
          const auditBoxWidth = 95;
          const isAuditProfit = netProfit >= 0;
          doc.setFillColor(isAuditProfit ? 240 : 255, isAuditProfit ? 253 : 241, isAuditProfit ? 244 : 242); // emerald-50 or rose-50
          doc.setDrawColor(isAuditProfit ? 187 : 254, isAuditProfit ? 247 : 205, isAuditProfit ? 208 : 211); // emerald-200 or rose-200
          doc.roundedRect(margin, finalY, auditBoxWidth, 32, 1.5, 1.5, 'FD');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(isAuditProfit ? 22 : 190, isAuditProfit ? 101 : 18, isAuditProfit ? 52 : 60);
          doc.text(isAuditProfit ? 'PURCHASE COST & PROFIT AUDIT' : 'PURCHASE COST & LOSS AUDIT', margin + 3.5, finalY + 5.5);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.text('Total COGS (Purchase Cost):', margin + 3.5, finalY + 12);
          doc.setFont('helvetica', 'bold');
          doc.text(formatCurrency(totalCOGS), margin + auditBoxWidth - 3.5, finalY + 12, { align: 'right' });

          doc.setFont('helvetica', 'normal');
          doc.text('Gross Margin (Subtotal - Cost):', margin + 3.5, finalY + 17.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(grossProfit >= 0 ? 22 : 190, grossProfit >= 0 ? 101 : 18, grossProfit >= 0 ? 52 : 60);
          doc.text(
            grossProfit >= 0 ? `+${formatCurrency(grossProfit)}` : `-${formatCurrency(Math.abs(grossProfit))}`,
            margin + auditBoxWidth - 3.5,
            finalY + 17.5,
            { align: 'right' }
          );

          doc.setDrawColor(isAuditProfit ? 187 : 254, isAuditProfit ? 247 : 205, isAuditProfit ? 208 : 211);
          doc.line(margin + 3.5, finalY + 20.5, margin + auditBoxWidth - 3.5, finalY + 20.5);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(isAuditProfit ? 20 : 185, isAuditProfit ? 83 : 28, isAuditProfit ? 45 : 28);
          doc.text(isAuditProfit ? 'NET REALIZED PROFIT:' : 'NET REALIZED LOSS:', margin + 3.5, finalY + 26.5);
          doc.text(
            isAuditProfit
              ? `+${formatCurrency(netProfit)} (${profitMargin.toFixed(1)}%)`
              : `-${formatCurrency(Math.abs(netProfit))} (${Math.abs(profitMargin).toFixed(1)}%)`,
            margin + auditBoxWidth - 3.5,
            finalY + 26.5,
            { align: 'right' }
          );
        }
      }

      const safeFileName = `Invoice_${sale.id}_${invoiceCopyType.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(safeFileName);
    } catch (error) {
      console.error('Error generating Invoice PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const posCategories = ['All', ...Array.from(new Set(inventory.map(p => p.category || 'General').filter(Boolean)))];
  const posCompanies = ['All', ...Array.from(new Set(inventory.map(p => p.company || 'Direct / General').filter(Boolean)))];

  const posFilteredProducts = groupedInventory.filter(p => {
    const safeName = (p.name || '').toLowerCase();
    const safeSku = (p.sku || '').toLowerCase();
    const safeItemCode = (p.item_code || '').toLowerCase();
    const search = (productSearch || '').toLowerCase();

    const matchesSearch = safeName.includes(search) || safeSku.includes(search) || safeItemCode.includes(search);
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesCompany = selectedCompany === 'All' || (p.company || 'Direct / General') === selectedCompany;
    return matchesSearch && matchesCategory && matchesCompany;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="relative py-6 px-6 bg-gradient-to-b from-slate-50/90 via-white to-slate-50/40 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center text-center overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary-500 via-sky-500 to-emerald-500" />
        
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-wider uppercase font-['Outfit',sans-serif]">
          SALES
        </h1>
        <p className="text-sm sm:text-base font-medium text-slate-500 mt-2 max-w-lg leading-relaxed">
          Manage customer transactions, FIFO supplier stock deductions, and accurate profit tracking.
        </p>

        {/* Dynamic Action in Header */}
        <div className="mt-4 flex items-center gap-3">
          <Button 
            onClick={() => {
              setIsEditMode(false);
              setEditingSaleId(null);
              setCart([]);
              setCashReceived('');
              setDiscount(0);
              setTaxRate(0);
              setSelectedCustomerId('');
              setPaymentMethod('cash');
              setIsPreviewMode(false);
              setIsModalOpen(true);
            }}
            className="bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Sale (POS)</span>
          </Button>
        </div>
      </div>

      {/* 4 Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Revenue */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Sales Revenue</p>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalRevenue)}</p>
          <p className="text-xs text-slate-400 mt-1">{sales.length} total orders completed</p>
        </Card>

        {/* Card 2: Today's Sales */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sales Today</p>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              {salesToday.length} Orders
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(todayRevenue)}</p>
          <p className="text-xs text-slate-400 mt-1">Today's billing revenue</p>
        </Card>

        {/* Card 3: Sold Units & Avg Order */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Items Sold</p>
          <p className="text-2xl font-bold text-slate-900">{totalSoldUnits} <span className="text-sm font-normal text-slate-500">pcs</span></p>
          <p className="text-xs text-slate-400 mt-1">Avg. Order Value: <strong className="text-slate-700">{formatCurrency(avgOrderValue)}</strong></p>
        </Card>

        {/* Card 4: Realized Profit / Loss */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {totalRealizedProfit >= 0 ? 'Realized Net Profit' : 'Realized Net Loss'}
            </p>
            {totalRealizedProfit >= 0 ? (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" /> Profit ({overallMargin.toFixed(1)}%)
              </span>
            ) : (
              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 flex items-center gap-0.5">
                <TrendingDown className="w-3 h-3" /> Loss ({Math.abs(overallMargin).toFixed(1)}%)
              </span>
            )}
          </div>
          <p className={cn("text-2xl font-bold", totalRealizedProfit >= 0 ? "text-emerald-700" : "text-rose-600")}>
            {totalRealizedProfit >= 0 ? `+${formatCurrency(totalRealizedProfit)}` : `-${formatCurrency(Math.abs(totalRealizedProfit))}`}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
            <span>COGS: <strong className="text-slate-600 font-semibold">{formatCurrency(totalCOGS)}</strong></span>
            {lossSalesCount > 0 && (
              <span className="text-rose-600 font-semibold text-[11px] bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                {lossSalesCount} loss {lossSalesCount === 1 ? 'sale' : 'sales'}
              </span>
            )}
          </div>
        </Card>
      </div>

      {/* Main Content Card with Comprehensive Toolbar & Data View */}
      <Card className="p-0 border-slate-200 shadow-sm bg-white overflow-hidden">
        {/* Top Control Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white">
          {/* Search Box with Barcode scanner trigger */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search invoice #, customer, phone, supplier SL, product..." 
              className="w-full pl-10 pr-12 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button 
              onClick={() => { setScannerTarget('search'); setIsScannerOpen(true); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors cursor-pointer"
              title="Scan Barcode"
            >
              <ScanLine className="w-4 h-4" />
            </button>
          </div>

          {/* Filters & Actions Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Date Filter */}
            <select 
              className="bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 h-9"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="custom">Custom Date Range</option>
            </select>

            {dateFilter === 'custom' && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 h-9">
                <input 
                  type="date"
                  className="bg-transparent text-xs text-slate-700 focus:outline-none"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  title="Start Date"
                />
                <span className="text-slate-400 text-xs font-medium">to</span>
                <input 
                  type="date"
                  className="bg-transparent text-xs text-slate-700 focus:outline-none"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  title="End Date"
                />
              </div>
            )}

            {/* Customer Filter */}
            <select 
              className="bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 h-9 max-w-[150px]"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
            >
              <option value="all">All Customers</option>
              <option value="walkin">Walk-in Customer</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Payment Method Filter */}
            <select 
              className="bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 h-9 cursor-pointer"
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
            >
              <option value="all">All Payment Methods</option>
              <option value="cash">Cash Payment</option>
              <option value="due">Due / Unpaid</option>
              <option value="partial">Partial Payment</option>
              <option value="card">Card Payment</option>
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
              {viewMode === 'product_summary' ? 'Invoices Table' : 'Product Sales Summary'}
            </Button>

            {/* Export Excel */}
            <button 
              type="button"
              onClick={handleExportExcel} 
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 shadow-2xs transition-all duration-150 cursor-pointer h-9 active:scale-[0.98]"
              title="Download Sales Excel Report"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Excel</span>
            </button>

            {/* Export PDF */}
            <button 
              type="button"
              onClick={handleExportPDF} 
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 hover:border-primary-300 shadow-2xs transition-all duration-150 cursor-pointer h-9 active:scale-[0.98]"
              title="Download Sales PDF Report"
            >
              <Download className="w-4 h-4 text-primary-600" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* View 1: Main Invoices Table */}
        {viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-left whitespace-nowrap">Invoice #</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-left whitespace-nowrap">Customer</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">Date & Time</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">Items</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">Payment</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Subtotal</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Discount</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Total Amount</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Profit / (Loss)</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">Status</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.length > 0 ? (
                  filteredSales.map((sale) => {
                    const customer = customers.find(c => c.id === sale.customer_id);

                    return (
                      <tr 
                        key={sale.id} 
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                        onClick={() => setSelectedSale(sale)}
                      >
                        {/* Invoice No */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="font-mono text-xs font-bold text-primary-700 bg-primary-50 border border-primary-100 px-2 py-1 rounded-md">
                            #{sale.id}
                          </span>
                        </td>

                        {/* Customer */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div>
                            <span className="text-xs sm:text-sm font-bold text-slate-900 block">
                              {customer?.name || 'Walk-in Customer'}
                            </span>
                            {customer?.phone && (
                              <span className="text-[11px] font-medium text-slate-400 block">
                                {customer.phone}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Date */}
                        <td className="px-5 py-3.5 text-center whitespace-nowrap text-xs text-slate-500 font-medium">
                          {formatDateInvoice(sale.created_at)}{' '}
                          <span className="text-slate-400 text-[10px]">
                            {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>

                        {/* Items Qty */}
                        <td className="px-5 py-3.5 text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            {sale.totalItemsCount} pcs
                          </span>
                        </td>

                        {/* Payment Method */}
                        <td className="px-5 py-3.5 text-center whitespace-nowrap">
                          {(() => {
                            const isOriginalDue = sale.payment_method === 'due';
                            const effectivePaid = sale.paid_amount !== undefined 
                              ? sale.paid_amount 
                              : (sale.payment_method === 'cash' ? sale.total_amount : (sale.cash_received || 0));
                            const effectiveDue = sale.due_amount !== undefined 
                              ? sale.due_amount 
                              : (isOriginalDue ? Math.max(0, sale.total_amount - effectivePaid) : 0);
                            const isFullyPaid = effectiveDue === 0 && (effectivePaid >= sale.total_amount || sale.payment_method === 'cash' || sale.status === 'completed');
                            const isPartial = effectivePaid > 0 && effectiveDue > 0;

                            return (
                              <div className="flex flex-col items-center gap-1">
                                <span className={cn(
                                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border",
                                  isFullyPaid 
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                                    : isPartial 
                                    ? "bg-blue-50 text-blue-700 border-blue-200" 
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                )}>
                                  {isFullyPaid && <Banknote className="w-3 h-3" />}
                                  {isPartial && <CreditCard className="w-3 h-3" />}
                                  {!isFullyPaid && !isPartial && <CreditCard className="w-3 h-3" />}
                                  {isFullyPaid ? (sale.payment_method === 'cash' ? 'CASH' : 'PAID') : (isPartial ? 'PARTIAL' : 'DUE')}
                                </span>
                                
                                <div className="flex flex-col items-center text-[10px] font-medium font-mono leading-tight">
                                  <span className={isFullyPaid ? "text-emerald-700 font-semibold" : "text-slate-600"}>
                                    Rec: {formatCurrency(effectivePaid)}
                                    {(sale.change_amount || 0) > 0 ? ` (Ret: ${formatCurrency(sale.change_amount || 0)})` : ''}
                                  </span>
                                  {effectiveDue > 0 && (
                                    <span className="text-amber-700 font-bold">
                                      Due: {formatCurrency(effectiveDue)}
                                    </span>
                                  )}
                                  {isFullyPaid && isOriginalDue && (
                                    <span className="text-emerald-600 font-bold text-[9px]">
                                      ✓ Collected
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Subtotal */}
                        <td className="px-5 py-3.5 text-right whitespace-nowrap text-xs text-slate-600 font-medium">
                          {formatCurrency(sale.subtotal || sale.total_amount)}
                        </td>

                        {/* Discount */}
                        <td className="px-5 py-3.5 text-right whitespace-nowrap text-xs text-rose-600 font-medium">
                          {sale.discount_amount ? `-${formatCurrency(sale.discount_amount)}` : '-'}
                        </td>

                        {/* Total Amount */}
                        <td className="px-5 py-3.5 text-right whitespace-nowrap text-xs sm:text-sm font-bold text-slate-900">
                          {formatCurrency(sale.total_amount)}
                        </td>

                        {/* Realized Profit / Loss */}
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          {sale.profit >= 0 ? (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 whitespace-nowrap inline-block">
                              +{formatCurrency(sale.profit)}
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 whitespace-nowrap inline-block">
                              -{formatCurrency(Math.abs(sale.profit))}
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5 text-center whitespace-nowrap">
                          {(() => {
                            const isOriginalDue = sale.payment_method === 'due';
                            const effectivePaid = sale.paid_amount !== undefined 
                              ? sale.paid_amount 
                              : (sale.payment_method === 'cash' ? sale.total_amount : (sale.cash_received || 0));
                            const effectiveDue = sale.due_amount !== undefined 
                              ? sale.due_amount 
                              : (isOriginalDue ? Math.max(0, sale.total_amount - effectivePaid) : 0);
                            const currentStatus = effectiveDue === 0 ? 'completed' : (effectivePaid > 0 ? 'partial' : sale.status);

                            return (
                              <span className={cn(
                                "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                                currentStatus === 'completed' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                currentStatus === 'partial' ? "bg-blue-50 text-blue-700 border-blue-200" :
                                currentStatus === 'pending' ? "bg-amber-50 text-amber-700 border-amber-200" :
                                "bg-rose-50 text-rose-700 border-rose-200"
                              )}>
                                {currentStatus}
                              </span>
                            );
                          })()}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSale(sale);
                              }}
                              className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-primary-100"
                              title="View Invoice"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            <button 
                              type="button"
                              onClick={(e) => handleEditSale(e, sale)}
                              className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-sky-100"
                              title="Edit Sale"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSale(sale);
                                setTimeout(() => window.print(), 300);
                              }}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="Print Invoice"
                            >
                              <Printer className="w-4 h-4" />
                            </button>

                            <button 
                              type="button"
                              onClick={(e) => openDeleteConfirm(e, sale.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-100"
                              title="Delete Sale"
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
                    <td colSpan={11} className="px-6 py-12 text-center text-slate-400 text-xs">
                      No sales records found matching your filters. Click "Create New Sale" to start billing.
                    </td>
                  </tr>
                )}
              </tbody>
              {filteredSales.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50/90 border-t-2 border-slate-300 font-bold text-xs text-slate-800">
                    <td className="px-5 py-3 whitespace-nowrap text-primary-800">
                      Total ({filteredSales.length})
                    </td>
                    <td className="px-5 py-3">-</td>
                    <td className="px-5 py-3">-</td>
                    <td className="px-5 py-3 text-center whitespace-nowrap">
                      {filteredTotals.totalItems} pcs
                    </td>
                    <td className="px-5 py-3">-</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap text-slate-700">
                      {formatCurrency(filteredTotals.subtotal)}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap text-rose-600">
                      {filteredTotals.discount > 0 ? `-${formatCurrency(filteredTotals.discount)}` : '-'}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap text-slate-900 font-black">
                      {formatCurrency(filteredTotals.totalAmount)}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      {filteredTotals.profit >= 0 ? (
                        <span className="text-emerald-700 font-black">
                          +{formatCurrency(filteredTotals.profit)} <span className="text-[10px] font-medium text-emerald-600">({filteredTotals.margin.toFixed(1)}%)</span>
                        </span>
                      ) : (
                        <span className="text-rose-700 font-black">
                          -{formatCurrency(Math.abs(filteredTotals.profit))} <span className="text-[10px] font-medium text-rose-600">({Math.abs(filteredTotals.margin).toFixed(1)}%)</span>
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">-</td>
                    <td className="px-5 py-3">-</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        ) : (
          /* View 2: Product-wise Sales Summary */
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Filter product sales..." 
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={productSummarySearch}
                  onChange={e => setProductSummarySearch(e.target.value)}
                />
              </div>
              <span className="text-xs font-bold text-slate-500">
                {filteredProductSalesSummary.length} Products Sold
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-4 py-3 font-semibold text-xs text-slate-500 uppercase">Product Name</th>
                    <th className="px-4 py-3 font-semibold text-xs text-slate-500 uppercase">SKU</th>
                    <th className="px-4 py-3 font-semibold text-xs text-slate-500 uppercase">Category</th>
                    <th className="px-4 py-3 font-semibold text-xs text-slate-500 uppercase">Company</th>
                    <th className="px-4 py-3 font-semibold text-xs text-slate-500 uppercase text-center">Units Sold</th>
                    <th className="px-4 py-3 font-semibold text-xs text-slate-500 uppercase text-right">Total Revenue</th>
                    <th className="px-4 py-3 font-semibold text-xs text-slate-500 uppercase text-right">Total Cost</th>
                    <th className="px-4 py-3 font-semibold text-xs text-slate-500 uppercase text-right">Profit / (Loss)</th>
                    <th className="px-4 py-3 font-semibold text-xs text-slate-500 uppercase text-center">Last Sold</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProductSalesSummary.map(item => (
                    <tr key={item.sku} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-xs sm:text-sm font-bold text-slate-900">{item.name}</td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-500">{item.sku}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{item.category}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{item.company}</td>
                      <td className="px-4 py-3 text-xs font-bold text-center text-slate-900">{item.quantitySold} pcs</td>
                      <td className="px-4 py-3 text-xs font-bold text-right text-slate-900">{formatCurrency(item.totalRevenue)}</td>
                      <td className="px-4 py-3 text-xs text-right text-slate-500">{formatCurrency(item.totalCost)}</td>
                      <td className="px-4 py-3 text-xs font-bold text-right">
                        {item.profit >= 0 ? (
                          <span className="text-emerald-700">+{formatCurrency(item.profit)}</span>
                        ) : (
                          <span className="text-rose-700">-{formatCurrency(Math.abs(item.profit))}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-center text-slate-400">
                        {new Date(item.lastSoldDate).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {filteredProductSalesSummary.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-xs text-slate-400">
                        No product sales recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
                {filteredProductSalesSummary.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold text-xs text-slate-800">
                      <td className="px-4 py-3 text-primary-800" colSpan={4}>
                        Total ({filteredProductSalesSummary.length} Products)
                      </td>
                      <td className="px-4 py-3 text-center text-slate-900">
                        {productSummaryTotals.totalUnits} pcs
                      </td>
                      <td className="px-4 py-3 text-right text-slate-900">
                        {formatCurrency(productSummaryTotals.totalRevenue)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500">
                        {formatCurrency(productSummaryTotals.totalCost)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {productSummaryTotals.totalProfit >= 0 ? (
                          <span className="text-emerald-700 font-black">
                            +{formatCurrency(productSummaryTotals.totalProfit)} <span className="text-[10px] font-medium text-emerald-600">({productSummaryTotals.margin.toFixed(1)}%)</span>
                          </span>
                        ) : (
                          <span className="text-rose-700 font-black">
                            -{formatCurrency(Math.abs(productSummaryTotals.totalProfit))} <span className="text-[10px] font-medium text-rose-600">({Math.abs(productSummaryTotals.margin).toFixed(1)}%)</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">-</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}
      </Card>

      {/* POS / CREATE OR EDIT SALE MODAL */}
      {isModalOpen && (
        <div className={cn(
          "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs transition-all duration-150 animate-in fade-in",
          isPosFullscreen ? "p-0" : "p-2 sm:p-4"
        )}>
          <div className={cn(
            "flex flex-col bg-white overflow-hidden transition-all duration-200",
            isPosFullscreen 
              ? "w-full h-full rounded-none border-0 shadow-none" 
              : "w-full max-w-[98vw] xl:max-w-[1450px] h-[90vh] max-h-[920px] rounded-2xl border border-slate-200 shadow-2xl"
          )}>
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-3.5 border-b border-slate-100 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-600 shadow-2xs font-bold">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {isEditMode ? `Edit Sale Invoice #${editingSaleId}` : 'Point of Sale (POS) - New Sale'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Auto-deducts supplier purchase batches in FIFO sequence (Serial wise) for exact profit tracking
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPosFullscreen(!isPosFullscreen)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border shadow-2xs",
                    isPosFullscreen 
                      ? "bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100" 
                      : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                  )}
                  title={isPosFullscreen ? "Switch to Standard Windowed View" : "Expand to Full Page View"}
                >
                  {isPosFullscreen ? (
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
                  onClick={() => { 
                    setIsModalOpen(false); 
                    setIsEditMode(false); 
                    setEditingSaleId(null); 
                    setCart([]); 
                  }} 
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="Close POS Window"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Split Content or Preview Screen */}
            {isPreviewMode ? (
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50 flex items-center justify-center">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 w-full max-w-2xl space-y-6">
                  <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                    <div>
                      <h3 className="font-black text-slate-900 text-lg">Order Preview</h3>
                      <p className="text-xs text-slate-500">Please review order details before final confirmation.</p>
                    </div>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border",
                      paymentMethod === 'cash' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                    )}>
                      Payment: {paymentMethod.toUpperCase()}
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Customer</span>
                        <span className="font-bold text-slate-900 text-sm">
                          {customers.find(c => c.id === selectedCustomerId)?.name || 'Walk-in Customer'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Date & Time</span>
                        <span className="font-medium text-slate-700">{new Date().toLocaleString()}</span>
                      </div>
                    </div>

                    <div>
                      <span className="font-bold text-slate-700 block mb-2">Order Items ({cart.reduce((sum, i) => sum + i.quantity, 0)} items)</span>
                      <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200 sticky top-0">
                            <tr>
                              <th className="py-2.5 px-3">Item</th>
                              <th className="py-2.5 px-3 text-center">Qty</th>
                              <th className="py-2.5 px-3 text-right">Price</th>
                              <th className="py-2.5 px-3 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {cart.map(item => (
                              <tr key={item.sku}>
                                <td className="py-2.5 px-3 font-bold text-slate-900">{item.name}</td>
                                <td className="py-2.5 px-3 text-center font-bold text-slate-800">{item.quantity}</td>
                                <td className="py-2.5 px-3 text-right text-slate-600">{formatCurrency(item.unit_price)}</td>
                                <td className="py-2.5 px-3 text-right font-bold text-slate-900">{formatCurrency(item.quantity * item.unit_price)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal</span>
                        <span className="font-semibold text-slate-900">{formatCurrency(subtotal)}</span>
                      </div>
                      {discount > 0 && (
                        <div className="flex justify-between text-rose-600">
                          <span>Discount</span>
                          <span>-{formatCurrency(discount)}</span>
                        </div>
                      )}
                      {taxRate > 0 && (
                        <div className="flex justify-between text-slate-600">
                          <span>VAT / Tax ({taxRate}%)</span>
                          <span>+{formatCurrency(taxAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
                        <span>Grand Total</span>
                        <span className="text-primary-700">{formatCurrency(totalAmount)}</span>
                      </div>

                      <div className="pt-2 border-t border-slate-200 space-y-1.5 text-xs">
                        <div className="flex justify-between text-slate-600">
                          <span>Payment Method</span>
                          <span className="font-bold uppercase text-slate-900">{paymentMethod}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Cash Received</span>
                          <span className="font-bold text-slate-900">{formatCurrency(effectiveCashReceived)}</span>
                        </div>
                        {changeAmount > 0 && (
                          <div className="flex justify-between items-center text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                            <span>Change Return to Customer</span>
                            <span className="text-sm font-black">{formatCurrency(changeAmount)}</span>
                          </div>
                        )}
                        {dueAmount > 0 && (
                          <div className="flex justify-between items-center text-amber-800 font-bold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                            <span>Remaining Due</span>
                            <span className="text-sm font-black">{formatCurrency(dueAmount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-slate-900 font-bold pt-1 border-t border-slate-200">
                          <span>Net Paid Amount</span>
                          <span className="text-emerald-700 font-black">{formatCurrency(paidAmount)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-slate-200">
                    <Button
                      variant="outline"
                      className="flex-1 h-11 border-slate-300 font-bold text-slate-700 cursor-pointer"
                      onClick={() => setIsPreviewMode(false)}
                    >
                      Back to Edit
                    </Button>
                    <Button
                      className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md cursor-pointer"
                      onClick={() => {
                        setIsPreviewMode(false);
                        handleCheckout();
                      }}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Confirm & Place Order
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden min-h-0 bg-slate-50/20 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
                
                {/* PART 1: LEFT - Product Catalog & Search Filter (30% / 3.5 cols) */}
                <div className="lg:col-span-4 xl:col-span-3.5 flex flex-col h-full overflow-hidden bg-white">
                  <div className="p-3 border-b border-slate-100 bg-white space-y-2 flex-shrink-0">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Scan or type Product Name / SKU / Barcode..." 
                        className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
                        value={productSearch}
                        onChange={e => setProductSearch(e.target.value)}
                        autoFocus
                      />
                      <button 
                        type="button"
                        onClick={() => { setScannerTarget('pos'); setIsScannerOpen(true); }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                        title="Scan Barcode"
                      >
                        <ScanLine className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Dropdowns for Category & Brand */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">PRODUCT CATEGORY</label>
                        <select
                          value={selectedCategory}
                          onChange={e => setSelectedCategory(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                        >
                          <option value="All">All Categories ({posCategories.length - 1})</option>
                          {posCategories.filter(c => c !== 'All').map(cat => (
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
                          <option value="All">All Companies ({posCompanies.length - 1})</option>
                          {posCompanies.filter(c => c !== 'All').map(comp => (
                            <option key={comp} value={comp}>{comp}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Product Catalog Table */}
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
                          {posFilteredProducts.map(product => {
                            const isOutOfStock = product.total_quantity <= 0;

                            return (
                              <tr 
                                key={product.id} 
                                onClick={() => !isOutOfStock && addToCart(product)}
                                className={cn(
                                  "hover:bg-slate-50 transition-colors cursor-pointer group",
                                  isOutOfStock && "opacity-50 cursor-not-allowed bg-slate-50/50"
                                )}
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
                                    isOutOfStock ? "bg-rose-50 text-rose-700" :
                                    product.total_quantity < 5 ? "bg-amber-50 text-amber-700" :
                                    "bg-emerald-50 text-emerald-700"
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
                                    disabled={isOutOfStock}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      addToCart(product);
                                    }}
                                    className="px-3 py-1 rounded-full text-xs font-bold bg-primary-600 hover:bg-primary-700 text-white shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                                  >
                                    + Add
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          {posFilteredProducts.length === 0 && (
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

                {/* PART 2: MIDDLE - Detailed Cart Items (42% / 5 cols) */}
                <div className="lg:col-span-5 xl:col-span-5 flex flex-col h-full overflow-hidden bg-white">
                  <div className="p-3 border-b border-slate-100 bg-white flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-primary-50 rounded-lg text-primary-600">
                        <Receipt className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Detailed Cart Items ({cart.length})</h4>
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
                        Clear Cart
                      </button>
                    )}
                  </div>

                  {/* Cart Items List Table */}
                  {cart.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-slate-50/20">
                      <div className="w-16 h-16 rounded-2xl bg-slate-100/80 flex items-center justify-center mb-3 text-slate-300">
                        <ShoppingBag className="w-8 h-8" />
                      </div>
                      <p className="text-sm font-bold text-slate-600">Your cart is empty.</p>
                      <p className="text-xs text-slate-400 mt-1">Select products from the catalog.</p>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto p-2.5 min-h-0 bg-slate-50/20">
                      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                        <table className="w-full text-left">
                          <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <tr>
                              <th className="px-3 py-2.5">PRODUCT NAME</th>
                              <th className="px-2.5 py-2.5 text-right">UNIT PRICE</th>
                              <th className="px-2 py-2.5 text-center">QUANTITY</th>
                              <th className="px-3 py-2.5 text-right">TOTAL</th>
                              <th className="px-2 py-2.5 text-center"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {cart.map(item => (
                              <tr key={item.sku} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-3 py-2.5">
                                   <span className="text-xs font-bold text-slate-900 block leading-snug">{item.name}</span>
                                 </td>
                                <td className="px-2.5 py-2.5 text-right">
                                  <div className="inline-flex items-center justify-end gap-1 text-xs">
                                    <input 
                                      type="number" 
                                      min="0"
                                      step="any"
                                      value={item.unit_price} 
                                      onChange={(e) => updateCartPrice(item.sku, Math.max(0, parseFloat(e.target.value) || 0))} 
                                      className="w-16 px-1.5 py-0.5 text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 text-right" 
                                    />
                                    <span className="text-[10px] text-slate-400 font-medium">pcs</span>
                                  </div>
                                </td>
                                <td className="px-2 py-2.5 text-center">
                                  <div className="inline-flex items-center gap-1 bg-slate-100/80 rounded-lg p-0.5 border border-slate-200">
                                    <button 
                                      type="button"
                                      onClick={() => updateCartQuantity(item.sku, -1)}
                                      className="w-5 h-5 flex items-center justify-center rounded bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 cursor-pointer text-xs"
                                    >
                                      -
                                    </button>
                                    <span className="text-xs font-bold w-6 text-center">{item.quantity}</span>
                                    <button 
                                      type="button"
                                      onClick={() => updateCartQuantity(item.sku, 1)}
                                      className="w-5 h-5 flex items-center justify-center rounded bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 cursor-pointer text-xs"
                                    >
                                      +
                                    </button>
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                  <span className="text-xs font-bold text-slate-900">{formatCurrency(item.quantity * item.unit_price)}</span>
                                </td>
                                <td className="px-2 py-2.5 text-center">
                                  <button 
                                    type="button"
                                    onClick={() => removeFromCart(item.sku)} 
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                    title="Remove item"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* PART 3: RIGHT - Customer, Payment Method & Order Summary (28% / 3.5 cols) */}
                <div className="lg:col-span-3 xl:col-span-3.5 flex flex-col h-full overflow-y-auto bg-slate-50/40 p-3.5 space-y-3.5 border-t lg:border-t-0 border-slate-200">
                  
                  {/* Customer Selection Block */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-800">Customer</label>
                      <button
                        type="button"
                        onClick={() => setIsAddingCustomer(true)}
                        className="text-[11px] font-bold text-primary-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <UserPlus className="w-3 h-3" />
                        <span>+ Add Customer</span>
                      </button>
                    </div>
                    <select 
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                      value={selectedCustomerId}
                      onChange={e => setSelectedCustomerId(e.target.value)}
                    >
                      <option value="">Walk-in Customer</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  {/* Payment Method Block */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
                    <label className="text-xs font-bold text-slate-800 block">Payment Method</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['cash', 'due'] as const).map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            setPaymentMethod(m);
                            if (m === 'cash') {
                              setCashReceived(totalAmount > 0 ? totalAmount.toString() : '');
                            } else {
                              setCashReceived('0');
                            }
                          }}
                          className={cn(
                            "py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs",
                            paymentMethod === m 
                              ? m === 'cash'
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-amber-600 text-white border-amber-600"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                          )}
                        >
                          {m === 'cash' && <Banknote className="w-3.5 h-3.5" />}
                          {m === 'due' && <CreditCard className="w-3.5 h-3.5" />}
                          <span>{m === 'cash' ? 'CASH' : 'DUE'}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Financial Calculation Summary Card */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600 font-medium">
                      <span>Subtotal</span>
                      <span className="font-bold text-slate-900">{formatCurrency(subtotal)}</span>
                    </div>

                    <div className="flex justify-between items-center text-slate-600">
                      <span>Discount Amount</span>
                      <input 
                        type="number" 
                        min="0"
                        placeholder="0"
                        className="w-20 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-right font-bold text-slate-900 text-xs focus:ring-1 focus:ring-primary-500"
                        value={discount || ''}
                        onChange={e => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                      />
                    </div>

                    <div className="flex justify-between items-center text-slate-600">
                      <span>VAT / Tax (%)</span>
                      <input 
                        type="number" 
                        min="0"
                        placeholder="0"
                        className="w-20 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-right font-bold text-slate-900 text-xs focus:ring-1 focus:ring-primary-500"
                        value={taxRate || ''}
                        onChange={e => setTaxRate(Math.max(0, parseFloat(e.target.value) || 0))}
                      />
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-sm font-black text-slate-900">
                      <span>Grand Total</span>
                      <span className="text-primary-700 text-base font-extrabold">{formatCurrency(totalAmount)}</span>
                    </div>
                  </div>

                  {/* Cash Received Tender Panel (Light Emerald Box) */}
                  <div className={cn(
                    "p-3 rounded-xl border transition-all space-y-2.5",
                    paymentMethod === 'cash' 
                      ? "bg-emerald-50/80 border-emerald-200" 
                      : "bg-amber-50/80 border-amber-200"
                  )}>
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Banknote className={cn("w-4 h-4 shrink-0", paymentMethod === 'cash' ? "text-emerald-700" : "text-amber-700")} />
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">
                            {paymentMethod === 'cash' ? 'Cash Received' : 'Paid / Cash Deposit'}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium block">
                            Amount handed by customer
                          </span>
                        </div>
                      </div>
                      <div className="relative w-28 shrink-0">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">৳</span>
                        <input 
                          type="number" 
                          min="0" 
                          step="any"
                          placeholder="0"
                          className="w-full pl-6 pr-2 py-1 bg-white border border-emerald-300 rounded-lg text-right font-black text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                          value={cashReceived}
                          onChange={e => {
                            const val = e.target.value;
                            setCashReceived(val);
                            const num = parseFloat(val);
                            if (!isNaN(num)) {
                              if (num >= totalAmount && totalAmount > 0) {
                                setPaymentMethod('cash');
                              } else if (num === 0) {
                                setPaymentMethod('due');
                              } else if (num > 0 && num < totalAmount) {
                                setPaymentMethod('cash');
                              }
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-emerald-200/80 flex items-center justify-between text-xs font-bold text-emerald-900">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Change Return:</span>
                      </div>
                      <span className="text-xs font-black text-emerald-900">
                        {changeAmount > 0 ? formatCurrency(changeAmount) : `${formatCurrency(0)} (Exact Paid)`}
                      </span>
                    </div>
                  </div>

                  {/* Primary Action Buttons */}
                  <div className="pt-1 space-y-2">
                    <Button 
                      className="w-full h-11 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2" 
                      disabled={cart.length === 0}
                      onClick={handleCheckout}
                    >
                      <Printer className="w-4 h-4" />
                      <span>{isEditMode ? 'Update Sale & Print Receipt' : 'Finalize and Print Receipt'}</span>
                    </Button>

                    <button
                      type="button"
                      disabled={cart.length === 0}
                      onClick={() => setIsPreviewMode(true)}
                      className="w-full py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview Order</span>
                    </button>
                  </div>

                </div>

              </div>
          )}
          </div>
        </div>
      )}

      {/* QUICK ADD CUSTOMER MODAL */}
      {isAddingCustomer && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <Card className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">Add New Customer</h3>
              <button onClick={() => setIsAddingCustomer(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. John Doe"
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={newCustomerData.name}
                  onChange={e => setNewCustomerData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. +1 555-0199"
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={newCustomerData.phone}
                  onChange={e => setNewCustomerData(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Address / Location</label>
                <input
                  type="text"
                  placeholder="e.g. 123 Main Street"
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={newCustomerData.address}
                  onChange={e => setNewCustomerData(prev => ({ ...prev, address: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAddingCustomer(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-primary-600 text-white font-bold">
                  Save Customer
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* DEDICATED DELETE CONFIRMATION MODAL */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <Card className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-6">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Sale Invoice</h3>
                <p className="text-xs text-slate-500">Invoice #{deleteConfirm.id}</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed mb-4">
              Are you sure you want to delete this sale? This action will permanently remove the invoice and <strong>automatically restore the sold product quantities</strong> back into their respective supplier inventory batches.
            </p>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setDeleteConfirm({ isOpen: false })}
                className="h-9 px-4 text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button 
                type="button" 
                onClick={handleConfirmDelete} 
                className="h-9 px-5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-2xs inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete & Restore Stock</span>
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* FULL INVOICE & RECEIPT MODAL (Customer Copy / Office Copy with Supplier Info & Profit Breakdown) */}
      {selectedSale && (() => {
        const safeSubtotal = selectedSale.subtotal || selectedSale.total_amount || 0;
        const safeDiscount = selectedSale.discount_amount || 0;
        const safeTax = selectedSale.tax_amount || 0;
        const safeTotal = selectedSale.total_amount || 0;
        const safeItems = selectedSale.items || [];
        const safeCustomer = customers.find(c => c.id === selectedSale.customer_id);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs print:static print:p-0 print:bg-white print:block">
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
                      onClick={() => setInvoiceCopyType('customer')}
                      className={cn(
                        "px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer",
                        invoiceCopyType === 'customer' ? "bg-white shadow-xs text-primary-700 font-bold" : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      Customer Copy
                    </button>
                    <button 
                      onClick={() => setInvoiceCopyType('office')}
                      className={cn(
                        "px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1",
                        invoiceCopyType === 'office' ? "bg-white shadow-xs text-primary-700 font-bold" : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-primary-600" />
                      <span>Office Copy (Supplier & Profit)</span>
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
                    <button 
                      onClick={() => setInvoiceCopyType('thermal')}
                      className={cn(
                        "px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1",
                        invoiceCopyType === 'thermal' ? "bg-white shadow-xs text-primary-700 font-bold" : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      <Receipt className="w-3.5 h-3.5 text-primary-600" />
                      <span>Thermal Receipt (80mm)</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleDownloadInvoicePDF(selectedSale)}
                    className="bg-slate-900 text-white font-bold px-3.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs cursor-pointer shadow-xs"
                    title="Download pristine vector A4 PDF"
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
                  <button onClick={() => setSelectedSale(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 ml-1 cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Printable Invoice Sheet Container */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100 print:bg-white print:p-0 print:overflow-visible flex flex-col items-center gap-8" id="invoice-content-wrapper">
                {['customer', 'office'].map((type, index) => {
                  if (invoiceCopyType !== 'both' && invoiceCopyType !== type) return null;

                  const isOffice = type === 'office';
                  const auditLots = resolveSaleOfficeAuditLots(selectedSale, inventory, purchases, suppliers, sales);

                  // Calculate COGS per supplier lot accurately
                  const totalCOGS = (auditLots && auditLots.length > 0)
                    ? auditLots.reduce((sum, lot) => sum + lot.total_cost, 0)
                    : safeItems.reduce((sum, item) => sum + (resolveItemCost(item, inventory, purchases) * item.quantity), 0);

                  // Net revenue realized by the business (Subtotal - Discount)
                  const netRevenue = Math.max(0, safeSubtotal - safeDiscount);
                  const netProfit = netRevenue - totalCOGS;
                  const profitMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

                  return (
                    <div 
                      key={type} 
                      className={`print-sheet bg-white border border-slate-200 shadow-sm p-8 sm:p-10 rounded-2xl relative w-full max-w-[210mm] min-h-[297mm] flex flex-col justify-between print:border-none print:shadow-none print:p-0 print:max-w-none print:min-h-0 ${index > 0 ? 'page-break' : ''}`}
                    >
                      <div>
                        {/* Top Header Grid */}
                        <div className="flex justify-between items-start mb-6 pb-6 border-b border-slate-200">
                          {/* Customer Details */}
                          <div className="w-1/3">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Billed To</span>
                            <h3 className="font-bold text-slate-900 text-sm mb-0.5">
                              {safeCustomer?.name || 'Walk-in Customer'}
                            </h3>
                            {safeCustomer?.phone && (
                              <p className="text-slate-600 text-xs">Mobile: {safeCustomer.phone}</p>
                            )}
                            {safeCustomer?.address && (
                              <p className="text-slate-600 text-xs">Address: {safeCustomer.address}</p>
                            )}
                          </div>

                          {/* Shop Details */}
                          <div className="w-1/3 text-center flex flex-col items-center justify-center">
                            {businessSettings.invoice_show_logo !== false && businessSettings.logo && businessSettings.invoice_show_name !== false ? (
                              <div className="flex items-center justify-center gap-2.5 mb-1">
                                <img src={businessSettings.logo} alt="Logo" className="h-10 w-auto max-h-12 object-contain" />
                                <div className="text-left">
                                  <div className="font-black text-lg text-primary-700 tracking-wider leading-tight">
                                    {businessSettings.name || 'BIZFLOW'}
                                  </div>
                                  {businessSettings.tagline && (
                                    <p className="text-[10px] text-slate-500 font-medium leading-none">{businessSettings.tagline}</p>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <>
                                {businessSettings.invoice_show_logo !== false && businessSettings.logo && (
                                  <img src={businessSettings.logo} alt="Logo" className="h-12 w-auto mb-1.5 object-contain" />
                                )}
                                {businessSettings.invoice_show_name !== false && (
                                  <div className="font-black text-xl text-primary-700 tracking-wider mb-1">
                                    {businessSettings.name || 'BIZFLOW'}
                                  </div>
                                )}
                              </>
                            )}
                            {businessSettings.address && <p className="text-[11px] text-slate-500">{businessSettings.address}</p>}
                            {businessSettings.invoice_show_phone !== false && businessSettings.phone && <p className="text-[11px] text-slate-500">Phone: {businessSettings.phone}</p>}
                          </div>

                          {/* Invoice & QR */}
                          <div className="w-1/3 flex flex-col items-end text-right">
                            <span className={cn(
                              "px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-lg mb-2 inline-block",
                              isOffice ? "bg-slate-900 text-white" : "bg-sky-50 text-sky-800 border border-sky-200"
                            )}>
                              {isOffice ? 'Office Copy (Audit)' : 'Customer Copy'}
                            </span>
                            <p className="text-slate-900 text-xs font-bold">Invoice #{selectedSale.id}</p>
                            <p className="text-slate-500 text-[11px]">{formatDateInvoice(selectedSale.created_at)} {new Date(selectedSale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            <div className="mt-2 p-1 bg-white border border-slate-200 rounded">
                              <QRCode value={`INV-${selectedSale.id}`} size={56} />
                            </div>
                          </div>
                        </div>

                        {/* Items Table - Tailored for Customer vs Office Copy */}
                        {isOffice ? (
                          /* OFFICE COPY TABLE: With Supplier Information, Purchase Cost & Profit per lot */
                          <div className="mb-6">
                            <div className="bg-slate-50 border border-slate-200 rounded-t-lg p-2 flex items-center justify-between text-[11px] font-semibold text-slate-700">
                              <span>Supplier Purchase Lot Deductions & Profit Audit</span>
                              <span className="text-emerald-700 font-bold">FIFO Sequential Stock Matching</span>
                            </div>

                            <div className="border-x border-b border-slate-200 rounded-b-lg overflow-hidden">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-300 text-[10px] font-bold text-slate-700 uppercase bg-slate-100">
                                    <th className="py-2.5 px-2 text-center w-8">SL</th>
                                    <th className="py-2.5 px-2">Product Description</th>
                                    <th className="py-2.5 px-2">Supplier Info (SL #)</th>
                                    <th className="py-2.5 px-2 text-center w-12">Qty</th>
                                    <th className="py-2.5 px-2 text-right">Cost Price</th>
                                    <th className="py-2.5 px-2 text-right">Sale Price</th>
                                    <th className="py-2.5 px-2 text-right">Total Cost</th>
                                    <th className="py-2.5 px-2 text-right">Total Sale</th>
                                    <th className="py-2.5 px-2 text-right">Profit</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 text-xs">
                                  {auditLots.map((lot, idx) => {
                                    return (
                                      <tr key={idx} className="hover:bg-slate-50">
                                        <td className="py-2 px-2 text-slate-400 font-mono text-[11px] text-center">{idx + 1}</td>
                                        <td className="py-2 px-2 font-bold text-slate-900">
                                          {lot.item_name}
                                          {lot.sku && (
                                            <span className="block text-[10px] font-mono text-slate-400 font-normal">{lot.sku}</span>
                                          )}
                                        </td>
                                        <td className="py-2 px-2">
                                          <span className="font-semibold text-slate-800 text-[11px] block">{lot.supplier_name}</span>
                                          {lot.supplier_sl !== '-' && (
                                            <span className="inline-block px-1.5 py-0.2 bg-slate-100 text-slate-600 font-mono text-[10px] rounded border border-slate-200 mt-0.5">
                                              {lot.supplier_sl}
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-2 px-2 text-center font-bold text-slate-800">{lot.quantity}</td>
                                        <td className="py-2 px-2 text-right text-slate-600 font-mono text-[11px]">
                                          {formatCurrency(lot.cost_price)}
                                        </td>
                                        <td className="py-2 px-2 text-right text-slate-800 font-medium">
                                          {formatCurrency(lot.unit_price)}
                                        </td>
                                        <td className="py-2 px-2 text-right text-slate-600 font-mono text-[11px]">
                                          {formatCurrency(lot.total_cost)}
                                        </td>
                                        <td className="py-2 px-2 text-right font-bold text-slate-900">
                                          {formatCurrency(lot.total_sale)}
                                        </td>
                                        <td className="py-2 px-2 text-right font-bold">
                                          {lot.profit >= 0 ? (
                                            <span className="text-emerald-700 bg-emerald-50/70 px-1.5 py-0.5 rounded border border-emerald-100 block">
                                              +{formatCurrency(lot.profit)}
                                            </span>
                                          ) : (
                                            <span className="text-rose-700 bg-rose-50/70 px-1.5 py-0.5 rounded border border-rose-100 block">
                                              -{formatCurrency(Math.abs(lot.profit))}
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : (
                          /* CUSTOMER COPY TABLE: Clean, Professional standard client invoice with merged item quantities and no SKU */
                          (() => {
                            const customerMergedItems: { item_name: string; quantity: number; unit_price: number; total: number }[] = [];
                            const map = new Map<string, { item_name: string; quantity: number; unit_price: number; total: number }>();
                            safeItems.forEach(item => {
                              const key = `${item.item_name || 'Item'}_${item.unit_price}`;
                              if (!map.has(key)) {
                                map.set(key, {
                                  item_name: item.item_name || 'Item',
                                  quantity: item.quantity,
                                  unit_price: item.unit_price,
                                  total: item.quantity * item.unit_price
                                });
                              } else {
                                const ex = map.get(key)!;
                                ex.quantity += item.quantity;
                                ex.total += item.quantity * item.unit_price;
                              }
                            });

                            return (
                              <div className="mb-6 border border-slate-200 rounded-lg overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="border-b border-slate-300 text-[11px] font-bold text-slate-700 uppercase bg-slate-100">
                                      <th className="py-2.5 px-3 text-center w-12">SL</th>
                                      <th className="py-2.5 px-3">Product Description</th>
                                      <th className="py-2.5 px-3 text-center w-20">Qty</th>
                                      <th className="py-2.5 px-3 text-right w-32">Unit Price</th>
                                      <th className="py-2.5 px-3 text-right w-36">Total Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 text-xs">
                                    {Array.from(map.values()).map((item, idx) => (
                                      <tr key={idx} className="hover:bg-slate-50/60">
                                        <td className="py-2.5 px-3 text-slate-400 font-mono text-center">{idx + 1}</td>
                                        <td className="py-2.5 px-3 font-bold text-slate-900">
                                          {item.item_name}
                                        </td>
                                        <td className="py-2.5 px-3 text-center font-bold text-slate-800">{item.quantity}</td>
                                        <td className="py-2.5 px-3 text-right text-slate-800">{formatCurrency(item.unit_price)}</td>
                                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                                          {formatCurrency(item.total)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            );
                          })()
                        )}

                        {/* Bottom Total Summary */}
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-4 border-t border-slate-200">
                          <div className="w-full sm:w-1/2 text-xs text-slate-500 space-y-1.5">
                            <p><strong>Payment Method:</strong> <span className="uppercase font-bold text-slate-700">{selectedSale.payment_method}</span></p>
                            <p><strong>Status:</strong> <span className="uppercase font-bold text-emerald-600">{selectedSale.status}</span></p>
                            {selectedSale.cash_received !== undefined && (
                              <p><strong>Cash Received:</strong> <span className="font-bold text-slate-800">{formatCurrency(selectedSale.cash_received)}</span></p>
                            )}
                            
                            {isOffice && (
                              <div className={cn(
                                "mt-3 p-3.5 rounded-xl space-y-1.5 border",
                                netProfit >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"
                              )}>
                                <div className="flex items-center justify-between gap-4">
                                  <span className={cn("text-xs font-semibold", netProfit >= 0 ? "text-emerald-800" : "text-rose-800")}>
                                    Total Purchase Cost (COGS):
                                  </span>
                                  <span className="text-xs font-mono font-bold text-slate-900">{formatCurrency(totalCOGS)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className={cn("text-xs font-semibold", netProfit >= 0 ? "text-emerald-800" : "text-rose-800")}>
                                    Net Revenue (Subtotal - Discount):
                                  </span>
                                  <span className="text-xs font-mono font-bold text-slate-900">{formatCurrency(netRevenue)}</span>
                                </div>
                                <div className={cn(
                                  "flex items-center justify-between gap-4 pt-1.5 border-t",
                                  netProfit >= 0 ? "border-emerald-200" : "border-rose-200"
                                )}>
                                  <span className={cn("text-xs font-bold", netProfit >= 0 ? "text-emerald-900" : "text-rose-900")}>
                                    {netProfit >= 0 ? 'NET REALIZED PROFIT:' : 'NET REALIZED LOSS:'}
                                  </span>
                                  <span className={cn("text-sm font-black", netProfit >= 0 ? "text-emerald-800" : "text-rose-700")}>
                                    {netProfit >= 0 ? `+${formatCurrency(netProfit)}` : `-${formatCurrency(Math.abs(netProfit))}`} ({Math.abs(profitMargin).toFixed(1)}%)
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="w-full sm:w-64 space-y-1.5 text-xs text-right ml-auto">
                            <div className="flex justify-between text-slate-600">
                              <span>Subtotal</span>
                              <span className="font-semibold text-slate-900">{formatCurrency(safeSubtotal)}</span>
                            </div>
                            {safeDiscount > 0 && (
                              <div className="flex justify-between text-rose-600">
                                <span>Discount</span>
                                <span>-{formatCurrency(safeDiscount)}</span>
                              </div>
                            )}
                            {safeTax > 0 && (
                              <div className="flex justify-between text-slate-600">
                                <span>VAT / Tax</span>
                                <span>+{formatCurrency(safeTax)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                              <span>Grand Total</span>
                              <span className="text-primary-700 text-base">{formatCurrency(safeTotal)}</span>
                            </div>

                            <div className="pt-2 border-t border-slate-200 space-y-1 text-xs">
                              <div className="flex justify-between text-slate-600">
                                <span>Cash Received:</span>
                                <span className="font-bold text-slate-900">
                                  {formatCurrency(selectedSale.cash_received !== undefined ? selectedSale.cash_received : (selectedSale.payment_method === 'cash' ? safeTotal : 0))}
                                </span>
                              </div>
                              {(selectedSale.change_amount || 0) > 0 && (
                                <div className="flex justify-between text-emerald-700 font-bold">
                                  <span>Change Returned:</span>
                                  <span>{formatCurrency(selectedSale.change_amount || 0)}</span>
                                </div>
                              )}
                              {(selectedSale.due_amount !== undefined ? selectedSale.due_amount : (selectedSale.payment_method === 'due' ? safeTotal : 0)) > 0 && (
                                <div className="flex justify-between text-amber-700 font-bold">
                                  <span>Due Amount:</span>
                                  <span>{formatCurrency(selectedSale.due_amount !== undefined ? selectedSale.due_amount : (selectedSale.payment_method === 'due' ? safeTotal : 0))}</span>
                                </div>
                              )}
                              <div className="flex justify-between font-bold pt-1 border-t border-slate-100 text-slate-900">
                                <span>Net Paid:</span>
                                <span className="text-emerald-700 font-black">
                                  {formatCurrency(selectedSale.paid_amount !== undefined ? selectedSale.paid_amount : (selectedSale.payment_method === 'cash' ? safeTotal : 0))}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="mt-8 pt-4 border-t border-slate-100 text-center text-[10px] text-slate-400">
                        {isOffice 
                          ? 'CONFIDENTIAL • FOR INTERNAL OFFICE & SUPPLIER COST AUDITING ONLY'
                          : 'Thank you for your business! Please visit us again.'
                        }
                      </div>
                    </div>
                  );
                })}

                {/* 80mm POS Thermal Receipt Layout */}
                {invoiceCopyType === 'thermal' && (
                  <div className="print-thermal-receipt bg-white border border-slate-300 shadow-lg p-5 rounded-xl w-full max-w-[80mm] font-mono text-slate-900 mx-auto print:border-none print:shadow-none print:p-0 print:w-[80mm] print:mx-auto">
                    {/* Business Header */}
                    <div className="text-center pb-3 border-b border-dashed border-slate-300 space-y-1">
                      {businessSettings.invoice_show_logo !== false && businessSettings.logo && businessSettings.invoice_show_name !== false ? (
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <img src={businessSettings.logo} alt="Logo" className="h-9 w-auto object-contain" />
                          <div className="text-left">
                            <h2 className="font-black text-base tracking-wider text-slate-900 leading-tight">
                              {businessSettings.name || 'BIZFLOW'}
                            </h2>
                            {businessSettings.tagline && (
                              <p className="text-[9px] text-slate-500 font-medium leading-none">{businessSettings.tagline}</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <>
                          {businessSettings.invoice_show_logo !== false && businessSettings.logo && (
                            <img src={businessSettings.logo} alt="Logo" className="h-10 mx-auto mb-1 object-contain" />
                          )}
                          {businessSettings.invoice_show_name !== false && (
                            <h2 className="font-black text-lg tracking-wider text-slate-900">{businessSettings.name || 'BIZFLOW'}</h2>
                          )}
                        </>
                      )}
                      {businessSettings.address && <p className="text-[10px] text-slate-600 leading-tight">{businessSettings.address}</p>}
                      {businessSettings.invoice_show_phone !== false && businessSettings.phone && <p className="text-[10px] text-slate-600">Tel: {businessSettings.phone}</p>}
                      <div className="inline-block mt-1.5 px-2.5 py-0.5 bg-slate-900 text-white text-[9px] font-bold uppercase tracking-wider rounded">
                        Sales Receipt
                      </div>
                    </div>

                    {/* Receipt Metadata */}
                    <div className="py-2.5 border-b border-dashed border-slate-300 text-[11px] space-y-1 font-medium">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Invoice No:</span>
                        <span className="font-bold">#INV-{selectedSale.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Date:</span>
                        <span>{formatDateInvoice(selectedSale.created_at)} {new Date(selectedSale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Customer:</span>
                        <span className="font-bold">{safeCustomer?.name || 'Walk-in Customer'}</span>
                      </div>
                      {safeCustomer?.phone && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Phone:</span>
                          <span>{safeCustomer.phone}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-slate-500">Payment Method:</span>
                        <span className="uppercase font-bold text-slate-800">{selectedSale.payment_method}</span>
                      </div>
                    </div>

                    {/* Itemized Table */}
                    <div className="py-2.5 border-b border-dashed border-slate-300">
                      <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase mb-1.5 pb-1 border-b border-slate-200">
                        <span>Item / Qty</span>
                        <span>Amount</span>
                      </div>
                      <div className="space-y-2 text-[11px]">
                        {safeItems.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-start gap-2">
                            <div className="flex-1 pr-1">
                              <span className="font-bold text-slate-900 block leading-tight">{item.item_name}</span>
                              <span className="text-[10px] text-slate-500 font-sans">
                                {item.quantity} pcs x {formatCurrency(item.unit_price)}
                              </span>
                            </div>
                            <span className="font-bold text-slate-900 text-right shrink-0">
                              {formatCurrency(item.quantity * item.unit_price)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Financial Totals */}
                    <div className="py-2.5 border-b border-dashed border-slate-300 text-[11px] space-y-1">
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(safeSubtotal)}</span>
                      </div>
                      {safeDiscount > 0 && (
                        <div className="flex justify-between text-rose-600 font-semibold">
                          <span>Discount:</span>
                          <span>-{formatCurrency(safeDiscount)}</span>
                        </div>
                      )}
                      {safeTax > 0 && (
                        <div className="flex justify-between text-slate-600">
                          <span>VAT / Tax:</span>
                          <span>+{formatCurrency(safeTax)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-black text-slate-900 pt-1.5 border-t border-slate-300 mt-1">
                        <span>GRAND TOTAL:</span>
                        <span>{formatCurrency(safeTotal)}</span>
                      </div>

                      <div className="pt-1.5 border-t border-slate-200 mt-1 space-y-0.5 text-[10px]">
                        <div className="flex justify-between text-slate-600">
                          <span>Cash Received:</span>
                          <span className="font-bold">{formatCurrency(selectedSale.cash_received !== undefined ? selectedSale.cash_received : (selectedSale.payment_method === 'cash' ? safeTotal : 0))}</span>
                        </div>
                        {(selectedSale.change_amount || 0) > 0 && (
                          <div className="flex justify-between text-emerald-700 font-bold">
                            <span>Change Returned:</span>
                            <span>{formatCurrency(selectedSale.change_amount || 0)}</span>
                          </div>
                        )}
                        {(selectedSale.due_amount !== undefined ? selectedSale.due_amount : (selectedSale.payment_method === 'due' ? safeTotal : 0)) > 0 && (
                          <div className="flex justify-between text-amber-700 font-bold">
                            <span>Due Balance:</span>
                            <span>{formatCurrency(selectedSale.due_amount !== undefined ? selectedSale.due_amount : (selectedSale.payment_method === 'due' ? safeTotal : 0))}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* QR & Thank You Footer */}
                    <div className="pt-3 text-center space-y-2">
                      <div className="flex justify-center my-1 bg-white p-1 rounded">
                        <QRCode value={`INV-${selectedSale.id}`} size={60} />
                      </div>
                      <p className="text-[10px] font-bold text-slate-800">Thank you for your visit!</p>
                      <p className="text-[9px] text-slate-400 font-sans">Please preserve this receipt for returns/exchanges.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Barcode Scanner Modal */}
      {isScannerOpen && (
        <BarcodeScanner 
          isOpen={isScannerOpen} 
          onClose={() => setIsScannerOpen(false)}
          onScan={(code) => {
            setIsScannerOpen(false);
            if (scannerTarget === 'search') {
              setSearchTerm(code);
            } else if (scannerTarget === 'pos') {
              setProductSearch(code);
              const matched = groupedInventory.find(p => p.sku === code || p.item_code === code);
              if (matched) {
                addToCart(matched);
              }
            }
          }}
        />
      )}
    </div>
  );
};
