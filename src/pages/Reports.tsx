import React, { useState, useEffect, useMemo } from 'react';
import { 
  Download, 
  Calendar, 
  ShoppingCart, 
  Package, 
  TrendingUp, 
  TrendingDown, 
  FileSpreadsheet, 
  AlertTriangle, 
  Trophy, 
  Users, 
  UserPlus, 
  UserCheck, 
  Crown, 
  CreditCard, 
  Lightbulb, 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownRight,
  ChevronDown,
  Boxes,
  PieChart as PieChartIcon,
  DollarSign,
  PackageCheck,
  Inbox
} from 'lucide-react';
import { 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  Line,
  ComposedChart
} from 'recharts';
import { storageService } from '../services/storageService';
import { InventoryItem, Sale, Purchase, Customer, Expense, Supplier } from '../types';
import { formatCurrency, calculateSaleFinancials, resolveItemCost, cn } from '../utils';
import { Link } from 'react-router-dom';
import { 
  startOfDay, 
  startOfMonth, 
  endOfMonth, 
  subMonths, 
  startOfYear, 
  subDays, 
  isAfter, 
  isBefore, 
  format, 
  parseISO 
} from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Donut chart colors matching reference design
const CATEGORY_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#f97316', '#06b6d4', '#ec4899', '#64748b'];

// Helper to get product initials / emoji
const getProductBadge = (name: string) => {
  const n = (name || '').toLowerCase();
  if (n.includes('milk')) return { icon: '🥛', bg: 'bg-blue-50 border-blue-200' };
  if (n.includes('rice') || n.includes('chal')) return { icon: '🌾', bg: 'bg-amber-50 border-amber-200' };
  if (n.includes('oil') || n.includes('tel')) return { icon: '🌻', bg: 'bg-yellow-50 border-yellow-200' };
  if (n.includes('sugar') || n.includes('chini')) return { icon: '🧂', bg: 'bg-rose-50 border-rose-200' };
  if (n.includes('tea') || n.includes('cha')) return { icon: '🍃', bg: 'bg-emerald-50 border-emerald-200' };
  if (n.includes('soap') || n.includes('shampoo')) return { icon: '🧼', bg: 'bg-cyan-50 border-cyan-200' };
  if (n.includes('biscuit') || n.includes('cake') || n.includes('snack')) return { icon: '🍪', bg: 'bg-orange-50 border-orange-200' };
  return { icon: '📦', bg: 'bg-slate-50 border-slate-200' };
};

export const Reports: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'this_month' | 'last_30_days' | 'last_6_months' | 'this_year' | 'all_time'>('this_month');
  const [trendPeriod, setTrendPeriod] = useState<'6months' | '12months' | 'thisyear'>('6months');
  const [topSellingFilter, setTopSellingFilter] = useState<'this_month' | 'last_month' | 'this_year'>('this_month');
  const [bestProfitFilter, setBestProfitFilter] = useState<'this_month' | 'last_month' | 'this_year'>('this_month');

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    setInventory(storageService.getInventory());
    setSales(storageService.getSales());
    setPurchases(storageService.getPurchases());
    setCustomers(storageService.getCustomers());
    setExpenses(storageService.getExpenses());
    setSuppliers(storageService.getSuppliers());
  }, []);

  const businessSettings = storageService.getBusinessSettings();

  // Helper date boundaries based on selected filter
  const dateIntervals = useMemo(() => {
    const now = new Date();
    let currentStart = startOfMonth(now);
    let previousStart = startOfMonth(subMonths(now, 1));
    let previousEnd = endOfMonth(subMonths(now, 1));

    switch (timeRange) {
      case 'this_month':
        currentStart = startOfMonth(now);
        previousStart = startOfMonth(subMonths(now, 1));
        previousEnd = endOfMonth(subMonths(now, 1));
        break;
      case 'last_30_days':
        currentStart = subDays(now, 30);
        previousStart = subDays(now, 60);
        previousEnd = subDays(now, 30);
        break;
      case 'last_6_months':
        currentStart = subMonths(now, 6);
        previousStart = subMonths(now, 12);
        previousEnd = subMonths(now, 6);
        break;
      case 'this_year':
        currentStart = startOfYear(now);
        previousStart = startOfYear(subMonths(now, 12));
        previousEnd = startOfYear(now);
        break;
      case 'all_time':
        currentStart = new Date(0);
        previousStart = new Date(0);
        previousEnd = new Date(0);
        break;
    }

    return { currentStart, previousStart, previousEnd };
  }, [timeRange]);

  // Filter items by main time range
  const currentFilteredSales = useMemo(() => {
    return sales.filter(s => {
      try {
        const d = parseISO(s.created_at);
        return isAfter(d, dateIntervals.currentStart);
      } catch {
        return true;
      }
    });
  }, [sales, dateIntervals.currentStart]);

  const prevFilteredSales = useMemo(() => {
    return sales.filter(s => {
      try {
        const d = parseISO(s.created_at);
        return isAfter(d, dateIntervals.previousStart) && isBefore(d, dateIntervals.previousEnd);
      } catch {
        return false;
      }
    });
  }, [sales, dateIntervals.previousStart, dateIntervals.previousEnd]);

  const currentFilteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      try {
        const d = parseISO(p.created_at);
        return isAfter(d, dateIntervals.currentStart);
      } catch {
        return true;
      }
    });
  }, [purchases, dateIntervals.currentStart]);

  const prevFilteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      try {
        const d = parseISO(p.created_at);
        return isAfter(d, dateIntervals.previousStart) && isBefore(d, dateIntervals.previousEnd);
      } catch {
        return false;
      }
    });
  }, [purchases, dateIntervals.previousStart, dateIntervals.previousEnd]);

  const currentFilteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      try {
        const d = parseISO(e.created_at || e.date);
        return isAfter(d, dateIntervals.currentStart);
      } catch {
        return true;
      }
    });
  }, [expenses, dateIntervals.currentStart]);

  const prevFilteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      try {
        const d = parseISO(e.created_at || e.date);
        return isAfter(d, dateIntervals.previousStart) && isBefore(d, dateIntervals.previousEnd);
      } catch {
        return false;
      }
    });
  }, [expenses, dateIntervals.previousStart, dateIntervals.previousEnd]);

  // 1. Calculate Real Totals & Trends dynamically
  const summaryMetrics = useMemo(() => {
    // Current period metrics
    const totalSales = currentFilteredSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const currentStock = inventory.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
    const currentStockValue = inventory.reduce((sum, i) => {
      const qty = Number(i.quantity) || 0;
      const cost = Number(i.cost_price ?? i.unit_price ?? 0);
      return sum + (qty * cost);
    }, 0);
    const sellQty = currentFilteredSales.reduce((sum, s) => 
      sum + (s.items || []).reduce((itemSum, item) => itemSum + (item.quantity || 0), 0), 0
    );
    const totalPurchase = currentFilteredPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
    
    let grossProfit = 0;
    currentFilteredSales.forEach(sale => {
      const fin = calculateSaleFinancials(sale, inventory, purchases, suppliers, sales);
      grossProfit += fin.profit;
    });

    const expensesAmount = currentFilteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netProfit = grossProfit - expensesAmount;
    const loss = expensesAmount + (netProfit < 0 ? Math.abs(netProfit) : 0);

    // Previous period metrics for comparison
    const prevSales = prevFilteredSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const prevSellQty = prevFilteredSales.reduce((sum, s) => 
      sum + (s.items || []).reduce((itemSum, item) => itemSum + (item.quantity || 0), 0), 0
    );
    const prevPurchase = prevFilteredPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);

    let prevGrossProfit = 0;
    prevFilteredSales.forEach(sale => {
      const fin = calculateSaleFinancials(sale, inventory, purchases, suppliers, sales);
      prevGrossProfit += fin.profit;
    });
    const prevExpenses = prevFilteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const prevNetProfit = prevGrossProfit - prevExpenses;
    const prevLoss = prevExpenses + (prevNetProfit < 0 ? Math.abs(prevNetProfit) : 0);

    // Growth helper
    const calcGrowth = (curr: number, prev: number) => {
      if (prev === 0 && curr > 0) return { pct: 100, isUp: true };
      if (prev === 0 && curr === 0) return { pct: 0, isUp: true };
      const diff = curr - prev;
      const pct = (diff / prev) * 100;
      return {
        pct: Math.abs(Number(pct.toFixed(1))),
        isUp: diff >= 0
      };
    };

    return {
      totalSales,
      currentStock,
      currentStockValue,
      sellQty,
      profit: netProfit,
      loss,
      totalPurchase,
      grossProfit,
      salesGrowth: calcGrowth(totalSales, prevSales),
      sellQtyGrowth: calcGrowth(sellQty, prevSellQty),
      purchaseGrowth: calcGrowth(totalPurchase, prevPurchase),
      profitGrowth: calcGrowth(netProfit, prevNetProfit),
      lossGrowth: calcGrowth(loss, prevLoss),
    };
  }, [
    currentFilteredSales,
    prevFilteredSales,
    currentFilteredPurchases,
    prevFilteredPurchases,
    currentFilteredExpenses,
    prevFilteredExpenses,
    inventory
  ]);

  // 2. Real Monthly Trend Data (Sales & Profit)
  const trendData = useMemo(() => {
    const now = new Date();
    const monthCount = trendPeriod === '12months' ? 12 : trendPeriod === 'thisyear' ? (now.getMonth() + 1) : 6;
    const monthsList: { monthLabel: string; startDate: Date; endDate: Date }[] = [];

    for (let i = monthCount - 1; i >= 0; i--) {
      const targetMonthDate = subMonths(now, i);
      monthsList.push({
        monthLabel: format(targetMonthDate, 'MMM'),
        startDate: startOfMonth(targetMonthDate),
        endDate: endOfMonth(targetMonthDate),
      });
    }

    return monthsList.map(({ monthLabel, startDate, endDate }) => {
      // Find sales in this month
      const monthSales = sales.filter(s => {
        try {
          const d = parseISO(s.created_at);
          return isAfter(d, startDate) && isBefore(d, endDate);
        } catch {
          return false;
        }
      });

      // Find expenses in this month
      const monthExpenses = expenses.filter(e => {
        try {
          const d = parseISO(e.created_at || e.date);
          return isAfter(d, startDate) && isBefore(d, endDate);
        } catch {
          return false;
        }
      });

      let monthSalesTotal = 0;
      let monthProfitTotal = 0;

      monthSales.forEach(sale => {
        monthSalesTotal += (sale.total_amount || 0);
        const fin = calculateSaleFinancials(sale, inventory, purchases, suppliers, sales);
        monthProfitTotal += fin.profit;
      });

      const totalExpenses = monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const netMonthProfit = monthProfitTotal - totalExpenses;

      return {
        month: monthLabel,
        sales: Math.round(monthSalesTotal),
        profit: Math.round(netMonthProfit)
      };
    });
  }, [trendPeriod, sales, expenses, inventory, purchases]);

  // 3. Real Category Sales Data for Donut Chart
  const categoryChartData = useMemo(() => {
    const catMap: Record<string, number> = {};
    
    currentFilteredSales.forEach(sale => {
      (sale.items || []).forEach(item => {
        const inv = inventory.find(i => i.id === item.inventory_item_id || (item.sku && i.sku === item.sku));
        const cat = (inv?.category || 'General').trim() || 'General';
        catMap[cat] = (catMap[cat] || 0) + (item.quantity * item.unit_price);
      });
    });

    const categories = Object.keys(catMap);
    const total = Object.values(catMap).reduce((a, b) => a + b, 0);

    if (categories.length === 0 || total === 0) {
      return [];
    }

    return categories
      .sort((a, b) => catMap[b] - catMap[a])
      .map((name, idx) => ({
        name,
        value: catMap[name],
        percent: Math.max(1, Math.round((catMap[name] / total) * 100)),
        color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length]
      }));
  }, [currentFilteredSales, inventory]);

  // 4. Real Low Stock Alert Items from Project Inventory
  const lowStockAlertItems = useMemo(() => {
    const lowItems = inventory.filter(i => (i.quantity || 0) <= (i.min_stock_level ?? 5));
    
    return lowItems
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 5)
      .map(item => {
        const badge = getProductBadge(item.name);
        return {
          id: item.id,
          name: item.name,
          stock: item.quantity,
          unit: item.unit || 'pcs',
          status: item.quantity <= ((item.min_stock_level || 5) / 2) ? 'Low' : 'Warning',
          emoji: badge.icon,
          bg: badge.bg
        };
      });
  }, [inventory]);

  // Helper date filter for top products & profit tables
  const getSubFilterDate = (filter: 'this_month' | 'last_month' | 'this_year') => {
    const now = new Date();
    if (filter === 'last_month') {
      return {
        start: startOfMonth(subMonths(now, 1)),
        end: endOfMonth(subMonths(now, 1))
      };
    }
    if (filter === 'this_year') {
      return {
        start: startOfYear(now),
        end: now
      };
    }
    return {
      start: startOfMonth(now),
      end: now
    };
  };

  // 5. Real Top Selling Products
  const topSellingProducts = useMemo(() => {
    const { start, end } = getSubFilterDate(topSellingFilter);
    const targetSales = sales.filter(s => {
      try {
        const d = parseISO(s.created_at);
        return isAfter(d, start) && isBefore(d, end);
      } catch {
        return true;
      }
    });

    const productStats: Record<string, { name: string; category: string; qty: number; amount: number; profit: number }> = {};
    
    targetSales.forEach(sale => {
      (sale.items || []).forEach(item => {
        const inv = inventory.find(i => i.id === item.inventory_item_id || (item.sku && i.sku === item.sku));
        const name = inv?.name || item.item_name || 'Product';
        const cat = inv?.category || 'General';
        const cost = resolveItemCost(item, inventory, purchases);
        const itemProfit = (item.unit_price - cost) * item.quantity;

        if (!productStats[name]) {
          productStats[name] = { name, category: cat, qty: 0, amount: 0, profit: 0 };
        }
        productStats[name].qty += item.quantity;
        productStats[name].amount += (item.quantity * item.unit_price);
        productStats[name].profit += itemProfit;
      });
    });

    const sorted = Object.values(productStats).sort((a, b) => b.qty - a.qty);
    return sorted.slice(0, 5).map((p, idx) => {
      const badge = getProductBadge(p.name);
      return {
        rank: idx + 1,
        name: p.name,
        category: p.category,
        sellQty: p.qty,
        amount: p.amount,
        profit: p.profit,
        emoji: badge.icon,
        bg: badge.bg
      };
    });
  }, [sales, inventory, topSellingFilter]);

  // 6. Real Best Profit Products
  const bestProfitProducts = useMemo(() => {
    const { start, end } = getSubFilterDate(bestProfitFilter);
    const targetSales = sales.filter(s => {
      try {
        const d = parseISO(s.created_at);
        return isAfter(d, start) && isBefore(d, end);
      } catch {
        return true;
      }
    });

    const productStats: Record<string, { name: string; profit: number }> = {};
    
    targetSales.forEach(sale => {
      (sale.items || []).forEach(item => {
        const inv = inventory.find(i => i.id === item.inventory_item_id || (item.sku && i.sku === item.sku));
        const name = inv?.name || item.item_name || 'Product';
        const cost = resolveItemCost(item, inventory, purchases);
        const itemProfit = (item.unit_price - cost) * item.quantity;

        if (!productStats[name]) {
          productStats[name] = { name, profit: 0 };
        }
        productStats[name].profit += itemProfit;
      });
    });

    const sorted = Object.values(productStats).sort((a, b) => b.profit - a.profit);
    return sorted.slice(0, 5).map(p => {
      const badge = getProductBadge(p.name);
      return {
        name: p.name,
        profit: p.profit,
        emoji: badge.icon,
        bg: badge.bg
      };
    });
  }, [sales, inventory, bestProfitFilter]);

  // 7. Real Customer Performance Metrics
  const customerMetrics = useMemo(() => {
    const totalCustomers = customers.length;

    // Find customer purchase frequency from sales
    const custPurchaseMap: Record<string, { count: number; totalSpent: number; name: string }> = {};
    
    sales.forEach(s => {
      const custId = s.customer_id || 'walk_in';
      const custObj = customers.find(c => c.id === custId);
      const custName = custObj?.name || (custId === 'walk_in' ? 'Walk-in Customer' : 'Customer');

      if (!custPurchaseMap[custId]) {
        custPurchaseMap[custId] = { count: 0, totalSpent: 0, name: custName };
      }
      custPurchaseMap[custId].count += 1;
      custPurchaseMap[custId].totalSpent += (s.total_amount || 0);
    });

    // Count new vs returning
    let returningCount = 0;
    let newCount = 0;
    let topCustomerName = 'N/A';
    let highestSpent = 0;

    Object.entries(custPurchaseMap).forEach(([id, data]) => {
      if (id !== 'walk_in') {
        if (data.count > 1) returningCount++;
        else newCount++;
      }
      if (data.totalSpent > highestSpent && id !== 'walk_in') {
        highestSpent = data.totalSpent;
        topCustomerName = data.name;
      }
    });

    if (totalCustomers > 0 && topCustomerName === 'N/A' && customers[0]?.name) {
      topCustomerName = customers[0].name;
    }

    // Real due amount from unpaid / due sales
    const customerDueTotal = sales
      .filter(s => s.payment_method === 'due' || s.status === 'pending')
      .reduce((sum, s) => sum + (s.total_amount || 0), 0);

    return {
      total: totalCustomers > 0 ? totalCustomers : Object.keys(custPurchaseMap).length,
      newCust: newCount,
      returning: returningCount,
      topCustomer: topCustomerName,
      dueAmount: customerDueTotal
    };
  }, [customers, sales]);

  // 8. Generate Comprehensive PDF Report using Real Data
  const handleGeneratePDF = () => {
    try {
      const doc = new jsPDF();
      const shopName = businessSettings.name || 'BizFlow Store';
      const address = businessSettings.address || 'Dhaka, Bangladesh';
      const phone = businessSettings.phone || '';

      // Title & Header Banner
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, 210, 26, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(shopName, 14, 11);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Reports & Business Analytics Summary | Period: ${timeRange.replace('_', ' ').toUpperCase()} | Date: ${new Date().toLocaleDateString()}`, 14, 19);

      // Section 1: Executive KPI Summary
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Key Performance Indicators (KPIs)', 14, 34);

      const kpiData = [
        ['Total Sales', `BDT ${summaryMetrics.totalSales.toLocaleString()}`, 'Current Value', `BDT ${summaryMetrics.currentStockValue.toLocaleString()} (${summaryMetrics.currentStock.toLocaleString()} pcs)`],
        ['Sell Quantity', `${summaryMetrics.sellQty.toLocaleString()} pcs`, 'Total Purchase', `BDT ${summaryMetrics.totalPurchase.toLocaleString()}`],
        ['Net Profit', `BDT ${summaryMetrics.profit.toLocaleString()}`, 'Operating Loss/Exp', `BDT ${summaryMetrics.loss.toLocaleString()}`]
      ];

      autoTable(doc, {
        startY: 38,
        body: kpiData,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3.5 },
        headStyles: { fillColor: [79, 70, 229] }
      });

      // Section 2: Top Selling Products
      const lastY = (doc as any).lastAutoTable.finalY + 8;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Top Selling Products', 14, lastY);

      const topProductsTable = topSellingProducts.length > 0 
        ? topSellingProducts.map(p => [
            p.rank,
            p.name,
            p.category,
            p.sellQty,
            `BDT ${p.amount.toLocaleString()}`,
            `BDT ${p.profit.toLocaleString()}`
          ])
        : [['-', 'No sales recorded yet', '-', '-', '-', '-']];

      autoTable(doc, {
        startY: lastY + 3,
        head: [['#', 'Product Name', 'Category', 'Sell Qty', 'Sales Amount', 'Net Profit']],
        body: topProductsTable,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 8.5, cellPadding: 2.5 }
      });

      // Section 3: Low Stock Alerts
      const lastY2 = (doc as any).lastAutoTable.finalY + 8;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Low Stock Alert Items', 14, lastY2);

      const lowStockTable = lowStockAlertItems.length > 0
        ? lowStockAlertItems.map(item => [
            item.name,
            `${item.stock} ${item.unit}`,
            item.status
          ])
        : [['All items are sufficiently stocked', '-', 'Good']];

      autoTable(doc, {
        startY: lastY2 + 3,
        head: [['Product Name', 'Current Stock Level', 'Status']],
        body: lowStockTable,
        theme: 'grid',
        headStyles: { fillColor: [239, 68, 68] },
        styles: { fontSize: 8.5, cellPadding: 2.5 }
      });

      doc.save(`Business_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('Error generating PDF report.');
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Reports & Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track your real business performance with live project data.</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Time Filter Dropdown */}
          <div className="relative">
            <select
              value={timeRange}
              onChange={e => setTimeRange(e.target.value as any)}
              className="h-10 pl-9 pr-8 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold text-slate-700 shadow-xs focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer appearance-none transition-all"
            >
              <option value="this_month">This Month</option>
              <option value="last_30_days">Last 30 Days</option>
              <option value="last_6_months">Last 6 Months</option>
              <option value="this_year">This Year</option>
              <option value="all_time">All Time</option>
            </select>
            <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Generate PDF Button */}
          <button
            onClick={handleGeneratePDF}
            className="h-10 px-4 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 transition-all cursor-pointer hover:shadow-md active:scale-98"
          >
            <Download className="w-4 h-4" />
            <span>Generate PDF</span>
          </button>
        </div>
      </div>

      {/* 2. Top 6 Metric / KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3.5 md:gap-4">
        {/* Card 1: Total Sales */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-full bg-teal-500 text-white flex items-center justify-center shadow-xs">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-500">Total Sales</span>
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
              ৳ {formatCurrency(summaryMetrics.totalSales)}
            </h3>
            <div className={cn(
              "flex items-center gap-1 text-[11px] font-bold mt-1",
              summaryMetrics.salesGrowth.isUp ? "text-emerald-600" : "text-rose-500"
            )}>
              {summaryMetrics.salesGrowth.isUp ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              <span>{summaryMetrics.salesGrowth.pct}% vs prev period</span>
            </div>
          </div>
        </div>

        {/* Card 2: Current Value */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-xs">
              <Package className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-500">Current Value</span>
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
              ৳ {formatCurrency(summaryMetrics.currentStockValue)}
            </h3>
            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 mt-1">
              <PackageCheck className="w-3.5 h-3.5 text-blue-500" />
              <span>{summaryMetrics.currentStock.toLocaleString()} pcs in stock</span>
            </div>
          </div>
        </div>

        {/* Card 3: Sell Qty */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center shadow-xs">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-500">Sell Qty</span>
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
              {summaryMetrics.sellQty.toLocaleString()} pcs
            </h3>
            <div className={cn(
              "flex items-center gap-1 text-[11px] font-bold mt-1",
              summaryMetrics.sellQtyGrowth.isUp ? "text-emerald-600" : "text-rose-500"
            )}>
              {summaryMetrics.sellQtyGrowth.isUp ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              <span>{summaryMetrics.sellQtyGrowth.pct}% vs prev period</span>
            </div>
          </div>
        </div>

        {/* Card 4: Profit */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-500">Profit</span>
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
              ৳ {formatCurrency(summaryMetrics.profit)}
            </h3>
            <div className={cn(
              "flex items-center gap-1 text-[11px] font-bold mt-1",
              summaryMetrics.profitGrowth.isUp ? "text-emerald-600" : "text-rose-500"
            )}>
              {summaryMetrics.profitGrowth.isUp ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              <span>{summaryMetrics.profitGrowth.pct}% vs prev period</span>
            </div>
          </div>
        </div>

        {/* Card 5: Loss */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-xs">
              <TrendingDown className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-500">Loss / Exp</span>
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
              ৳ {formatCurrency(summaryMetrics.loss)}
            </h3>
            <div className="flex items-center gap-1 text-[11px] font-bold text-rose-500 mt-1">
              <ArrowDownRight className="w-3.5 h-3.5" />
              <span>{summaryMetrics.lossGrowth.pct}% vs prev period</span>
            </div>
          </div>
        </div>

        {/* Card 6: Total Purchase */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-500">Total Purchase</span>
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
              ৳ {formatCurrency(summaryMetrics.totalPurchase)}
            </h3>
            <div className={cn(
              "flex items-center gap-1 text-[11px] font-bold mt-1",
              summaryMetrics.purchaseGrowth.isUp ? "text-emerald-600" : "text-rose-500"
            )}>
              {summaryMetrics.purchaseGrowth.isUp ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              <span>{summaryMetrics.purchaseGrowth.pct}% vs prev period</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Middle Grid: Sales & Profit Trend (5) + Sales by Category (4) + Low Stock Alert (3) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Card A: Sales & Profit Trend */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-100/90 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Sales & Profit Trend</h2>
              <div className="flex items-center gap-4 mt-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                  <span>Sales</span>
                </div>
                <div className="flex items-center gap-1.5 font-medium text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  <span>Profit</span>
                </div>
              </div>
            </div>

            {/* Time Filter Pills */}
            <div className="flex items-center p-1 bg-slate-100 rounded-lg text-[11px] font-semibold text-slate-600 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setTrendPeriod('6months')}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-all cursor-pointer",
                  trendPeriod === '6months' ? "bg-primary-600 text-white shadow-xs" : "hover:text-slate-900"
                )}
              >
                6 Months
              </button>
              <button
                type="button"
                onClick={() => setTrendPeriod('12months')}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-all cursor-pointer",
                  trendPeriod === '12months' ? "bg-primary-600 text-white shadow-xs" : "hover:text-slate-900"
                )}
              >
                12 Months
              </button>
              <button
                type="button"
                onClick={() => setTrendPeriod('thisyear')}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-all cursor-pointer",
                  trendPeriod === 'thisyear' ? "bg-primary-600 text-white shadow-xs" : "hover:text-slate-900"
                )}
              >
                This Year
              </button>
            </div>
          </div>

          <div className="h-[240px] w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: '#64748b', fontSize: 11 }} 
                />
                <YAxis 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickFormatter={val => `৳ ${val >= 1000 ? `${val / 1000}K` : val}`}
                />
                <Tooltip 
                  formatter={(val: any, name: any) => [`৳ ${formatCurrency(Number(val))}`, name === 'sales' ? 'Sales' : 'Profit']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                />
                <Bar dataKey="sales" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={26} />
                <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card B: Sales by Category */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-100/90 shadow-xs flex flex-col justify-between">
          <h2 className="text-sm font-bold text-slate-900 mb-2">Sales by Category</h2>
          
          {categoryChartData.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 my-auto">
              {/* Donut Chart with Center Total */}
              <div className="relative w-44 h-44 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={categoryChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {categoryChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(val: any) => [`৳ ${formatCurrency(Number(val))}`, 'Sales']}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0' }}
                    />
                  </RePieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-1">
                  <span className="text-xs font-bold text-slate-900 truncate max-w-[90px]">
                    ৳ {formatCurrency(summaryMetrics.totalSales)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Total Sales</span>
                </div>
              </div>

              {/* Custom Legend on Right */}
              <div className="flex flex-col gap-2 min-w-32 max-h-44 overflow-y-auto pr-1">
                {categoryChartData.map((cat, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs gap-3">
                    <div className="flex items-center gap-2 font-medium text-slate-700">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="break-words leading-tight">{cat.name}</span>
                    </div>
                    <span className="font-bold text-slate-900">{cat.percent}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="my-auto py-10 flex flex-col items-center justify-center text-center">
              <PieChartIcon className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-500">No category sales recorded yet</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Sales will automatically reflect category breakdowns here.</p>
            </div>
          )}
        </div>

        {/* Card C: Low Stock Alert */}
        <div className="lg:col-span-3 bg-white p-5 rounded-2xl border border-slate-100/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-rose-600 font-bold text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>Low Stock Alert</span>
            </div>
            <Link 
              to="/inventory" 
              className="text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline"
            >
              View All
            </Link>
          </div>

          <div className="overflow-x-auto">
            {lowStockAlertItems.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 font-semibold border-b border-slate-100 pb-1.5">
                    <th className="pb-2 font-medium">Product</th>
                    <th className="pb-2 font-medium text-center">Current Stock</th>
                    <th className="pb-2 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {lowStockAlertItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 pr-2">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-6 h-6 rounded-md flex items-center justify-center text-xs shrink-0 border", item.bg)}>
                            {item.emoji}
                          </div>
                          <span className="font-semibold text-slate-800 break-words leading-tight">{item.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-1 text-center font-bold text-slate-700">
                        {item.stock} {item.unit}
                      </td>
                      <td className="py-2.5 pl-1 text-right">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold inline-block",
                          item.status === 'Low' 
                            ? "bg-rose-50 text-rose-600 border border-rose-100" 
                            : "bg-amber-50 text-amber-700 border border-amber-100"
                        )}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-8 flex flex-col items-center justify-center text-center">
                <PackageCheck className="w-8 h-8 text-emerald-500 mb-1.5" />
                <p className="text-xs font-bold text-slate-700">All Products Well Stocked</p>
                <p className="text-[11px] text-slate-400 mt-0.5">No products are currently under minimum stock level.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Third Grid Section: Top Selling (5 cols) + Best Profit (3.5 cols) + Customer Performance (3.5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Card D: Top Selling Products */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-100/90 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>Top Selling Products</span>
            </div>
            
            <div className="relative">
              <select
                value={topSellingFilter}
                onChange={e => setTopSellingFilter(e.target.value as any)}
                className="h-7 pl-2.5 pr-6 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600 focus:outline-none appearance-none cursor-pointer"
              >
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="this_year">This Year</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="overflow-x-auto">
            {topSellingProducts.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 font-semibold border-b border-slate-100">
                    <th className="pb-2.5 w-6 font-medium">#</th>
                    <th className="pb-2.5 font-medium">Product</th>
                    <th className="pb-2.5 font-medium">Category</th>
                    <th className="pb-2.5 font-medium text-center">Sell Qty</th>
                    <th className="pb-2.5 font-medium text-right">Sales Amount</th>
                    <th className="pb-2.5 font-medium text-right">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {topSellingProducts.map((item) => (
                    <tr key={item.rank} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 text-slate-400 font-semibold">{item.rank}</td>
                      <td className="py-2.5 pr-2">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-6 h-6 rounded-md flex items-center justify-center text-xs shrink-0 border", item.bg)}>
                            {item.emoji}
                          </div>
                          <span className="font-semibold text-slate-800 break-words leading-tight">{item.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-1 text-slate-500 font-medium">{item.category}</td>
                      <td className="py-2.5 px-1 text-center font-bold text-slate-700">{item.sellQty}</td>
                      <td className="py-2.5 px-1 text-right font-bold text-slate-900">৳ {formatCurrency(item.amount)}</td>
                      <td className="py-2.5 pl-1 text-right font-bold text-emerald-600">৳ {formatCurrency(item.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-8 text-center">
                <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-slate-500">No sales recorded for this period</p>
              </div>
            )}
          </div>
        </div>

        {/* Card E: Best Profit Products */}
        <div className="lg:col-span-3 bg-white p-5 rounded-2xl border border-slate-100/90 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span>Best Profit Products</span>
            </div>

            <div className="relative">
              <select
                value={bestProfitFilter}
                onChange={e => setBestProfitFilter(e.target.value as any)}
                className="h-7 pl-2.5 pr-6 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600 focus:outline-none appearance-none cursor-pointer"
              >
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="this_year">This Year</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="overflow-x-auto">
            {bestProfitProducts.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 font-semibold border-b border-slate-100">
                    <th className="pb-2.5 font-medium">Product</th>
                    <th className="pb-2.5 font-medium text-right">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {bestProfitProducts.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 pr-2">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-6 h-6 rounded-md flex items-center justify-center text-xs shrink-0 border", item.bg)}>
                            {item.emoji}
                          </div>
                          <span className="font-semibold text-slate-800 break-words leading-tight">{item.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 pl-1 text-right font-bold text-emerald-600">
                        ৳ {formatCurrency(item.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-8 text-center">
                <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-slate-500">No profit data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Card F: Customer Performance */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-100/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm mb-3">
            <Users className="w-4 h-4 text-blue-500" />
            <span>Customer Performance</span>
          </div>

          <div className="space-y-2.5">
            {/* Total Customers */}
            <div className="p-2.5 bg-slate-50/80 rounded-xl flex items-center justify-between border border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-xs">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-medium text-slate-500 block">Total Customers</span>
                  <span className="text-sm font-extrabold text-slate-900">{customerMetrics.total}</span>
                </div>
              </div>
              <div className="flex items-center gap-0.5 text-xs font-bold text-emerald-600">
                <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                <span>Active</span>
              </div>
            </div>

            {/* New Customers */}
            <div className="p-2.5 bg-slate-50/80 rounded-xl flex items-center justify-between border border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-medium text-slate-500 block">New Customers</span>
                  <span className="text-sm font-extrabold text-slate-900">{customerMetrics.newCust}</span>
                </div>
              </div>
              <div className="flex items-center gap-0.5 text-xs font-bold text-emerald-600">
                <span>{customerMetrics.newCust} joined</span>
              </div>
            </div>

            {/* Returning Customers */}
            <div className="p-2.5 bg-slate-50/80 rounded-xl flex items-center justify-between border border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-medium text-slate-500 block">Returning Customers</span>
                  <span className="text-sm font-extrabold text-slate-900">{customerMetrics.returning}</span>
                </div>
              </div>
              <div className="flex items-center gap-0.5 text-xs font-bold text-slate-500">
                <span>Repeat</span>
              </div>
            </div>

            {/* Top Customer */}
            <div className="p-2.5 bg-amber-50/40 rounded-xl flex items-center justify-between border border-amber-100/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <Crown className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-medium text-amber-800 block">Top Customer</span>
                  <span className="text-sm font-extrabold text-slate-900 truncate max-w-36 block">{customerMetrics.topCustomer}</span>
                </div>
              </div>
            </div>

            {/* Customer Due */}
            <div className="p-2.5 bg-rose-50/40 rounded-xl flex items-center justify-between border border-rose-100/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-xs">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-medium text-rose-700 block">Customer Due</span>
                  <span className="text-sm font-extrabold text-rose-700">৳ {formatCurrency(customerMetrics.dueAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Bottom Row: Purchase vs Sales (6 cols) + Quick Insights (6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Card G: Purchase vs Sales */}
        <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-100/90 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm mb-4">
            <Boxes className="w-4 h-4 text-primary-600" />
            <span>Purchase vs Sales</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Purchase */}
            <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block">Purchase</span>
                <span className="text-base font-extrabold text-slate-900">৳ {formatCurrency(summaryMetrics.totalPurchase)}</span>
              </div>
            </div>

            {/* Sales */}
            <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block">Sales</span>
                <span className="text-base font-extrabold text-slate-900">৳ {formatCurrency(summaryMetrics.totalSales)}</span>
              </div>
            </div>

            {/* Gross Profit */}
            <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block">Gross Profit</span>
                <span className="text-base font-extrabold text-slate-900">৳ {formatCurrency(summaryMetrics.grossProfit)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card H: Quick Insights */}
        <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-100/90 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm mb-4">
            <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <Lightbulb className="w-3.5 h-3.5" />
            </div>
            <span>Quick Insights</span>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-2.5 text-xs text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">
                Sales {summaryMetrics.salesGrowth.isUp ? 'increased' : 'changed'} by <strong>{summaryMetrics.salesGrowth.pct}%</strong> compared to previous period.
              </span>
            </div>

            <div className="flex items-start gap-2.5 text-xs text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">
                {bestProfitProducts.length > 0 ? (
                  <>
                    <strong>{bestProfitProducts[0].name}</strong> is your top profit generating product (৳ {formatCurrency(bestProfitProducts[0].profit)} profit).
                  </>
                ) : (
                  <>Add products and register sales to discover your top profit generators.</>
                )}
              </span>
            </div>

            <div className="flex items-start gap-2.5 text-xs text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">
                {lowStockAlertItems.length > 0 ? (
                  <>
                    Stock is low for <strong>{lowStockAlertItems.length} product(s)</strong>. Please review your inventory.
                  </>
                ) : (
                  <>All products currently have safe inventory stock levels.</>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
