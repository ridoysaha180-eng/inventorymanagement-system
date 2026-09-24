import React, { useEffect, useState, useMemo } from 'react';
import { 
  ShoppingCart,
  Store,
  TrendingUp,
  TrendingDown,
  Wallet,
  Box,
  ClipboardList,
  AlertTriangle,
  BarChart3,
  Check,
  Calendar,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  X,
  Star,
  Receipt,
  ShoppingBag,
  ExternalLink,
  Edit3,
  Briefcase,
  Landmark,
  Coins,
  Eye,
  HandCoins,
  CheckCircle2,
  Truck,
  Sparkles,
  CalendarDays,
  History
} from 'lucide-react';
import { formatCurrency, cn, calculateSaleFinancials, calculateInventoryProfitLoss, getInventoryOverviewStats } from '../utils';
import { storageService } from '../services/storageService';
import { InventoryItem, Expense, Sale, Purchase, Loan, Investment, Customer, DuePayment, Supplier } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { 
  subDays, 
  subWeeks, 
  subMonths, 
  subYears, 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear, 
  format, 
  parseISO 
} from 'date-fns';
import { FastAverageColor } from 'fast-average-color';
import groceryBasketImg from '../assets/images/grocery_basket_1789389330782.jpg';

interface MetricGrowth {
  pct: number;
  text: string;
  isPositive: boolean;
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeFilter, setActiveFilter] = useState('Today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const DASHBOARD_EXPENSE_CATEGORIES = [
    'Shop Rent',
    'Electricity & Utilities',
    'Staff Salary & Allowance',
    'Tea & Refreshments',
    'Transportation & Delivery',
    'Packaging & Bags',
    'Repair & Maintenance',
    'Internet & Mobile Bill',
    'Stationery & Printing',
    'Cleaning & Sanitation',
    'Miscellaneous / Other'
  ];

  // Quick Expense Entry Modal State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState(DASHBOARD_EXPENSE_CATEGORIES[0]);
  const [customExpenseCategory, setCustomExpenseCategory] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [expensePaymentMethod, setExpensePaymentMethod] = useState('Cash');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseReference, setExpenseReference] = useState('');

  // Loans & Investments State
  const [loans, setLoans] = useState<Loan[]>(() => storageService.getLoans());
  const [investments, setInvestments] = useState<Investment[]>(() => storageService.getInvestments() || []);
  const [customers, setCustomers] = useState<Customer[]>(() => storageService.getCustomers());
  const [duePayments, setDuePayments] = useState<DuePayment[]>(() => storageService.getDuePayments());
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => storageService.getSuppliers());
  const [isExpectedProfitModalOpen, setIsExpectedProfitModalOpen] = useState(false);
  const [isBalanceBreakdownModalOpen, setIsBalanceBreakdownModalOpen] = useState(false);
  const [isOwnerCashModalOpen, setIsOwnerCashModalOpen] = useState(false);
  const [isQuickLoanModalOpen, setIsQuickLoanModalOpen] = useState(false);
  const [quickLoanTitle, setQuickLoanTitle] = useState('');
  const [quickLoanLender, setQuickLoanLender] = useState('');
  const [quickLoanType, setQuickLoanType] = useState<Loan['provider_type']>('bank');
  const [quickLoanPrincipal, setQuickLoanPrincipal] = useState('');
  const [quickLoanInterest, setQuickLoanInterest] = useState('0');
  const [quickLoanTotalPayable, setQuickLoanTotalPayable] = useState('');
  const [quickLoanInstallment, setQuickLoanInstallment] = useState('');
  const [quickLoanDisbursementDate, setQuickLoanDisbursementDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [quickLoanDueDate, setQuickLoanDueDate] = useState('');
  const [quickLoanNotes, setQuickLoanNotes] = useState('');
  const [quickLoanPhone, setQuickLoanPhone] = useState('');
  const [quickLoanVoucher, setQuickLoanVoucher] = useState('');
  const [showAdvancedQuickLoan, setShowAdvancedQuickLoan] = useState(false);

  const [businessSettings, setBusinessSettings] = useState(() => storageService.getBusinessSettings());
  const [logoColor, setLogoColor] = useState<string>('#10b981'); // Default Emerald 500

  useEffect(() => {
    const fac = new FastAverageColor();
    const imgSrc = businessSettings?.logo || groceryBasketImg;
    fac.getColorAsync(imgSrc)
      .then(color => {
        setLogoColor(color.hex);
      })
      .catch(() => {
        setLogoColor('#10b981');
      });
  }, [businessSettings?.logo]);

  // Quick Opening Balance Modal State
  const [isOpeningBalanceModalOpen, setIsOpeningBalanceModalOpen] = useState(false);
  const [openingBalanceInput, setOpeningBalanceInput] = useState('');

  const handleSaveOpeningBalance = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(openingBalanceInput) || 0;
    const current = businessSettings || {} as any;
    const updated = { ...current, opening_balance: val };
    storageService.saveBusinessSettings(updated);
    setBusinessSettings(updated);
    setIsOpeningBalanceModalOpen(false);
  };

  const refreshData = () => {
    setInventory(storageService.getInventory());
    setSales(storageService.getSales());
    setPurchases(storageService.getPurchases());
    setExpenses(storageService.getExpenses());
    setLoans(storageService.getLoans());
    setInvestments(storageService.getInvestments() || []);
    setCustomers(storageService.getCustomers());
    setDuePayments(storageService.getDuePayments());
    setSuppliers(storageService.getSuppliers());
    setBusinessSettings(storageService.getBusinessSettings());
  };

  useEffect(() => {
    refreshData();
    window.addEventListener('storage', refreshData);
    window.addEventListener('bizflow_business_settings_updated', refreshData);
    window.addEventListener('bizflow_expenses_updated', refreshData);
    window.addEventListener('bizflow_loans_updated', refreshData);
    window.addEventListener('bizflow_investments_updated', refreshData);
    window.addEventListener('bizflow_sales_updated', refreshData);
    window.addEventListener('bizflow_purchases_updated', refreshData);
    window.addEventListener('bizflow_customers_updated', refreshData);
    window.addEventListener('bizflow_due_payments_updated', refreshData);
    window.addEventListener('bizflow_suppliers_updated', refreshData);
    return () => {
      window.removeEventListener('storage', refreshData);
      window.removeEventListener('bizflow_business_settings_updated', refreshData);
      window.removeEventListener('bizflow_expenses_updated', refreshData);
      window.removeEventListener('bizflow_loans_updated', refreshData);
      window.removeEventListener('bizflow_investments_updated', refreshData);
      window.removeEventListener('bizflow_sales_updated', refreshData);
      window.removeEventListener('bizflow_purchases_updated', refreshData);
      window.removeEventListener('bizflow_customers_updated', refreshData);
      window.removeEventListener('bizflow_due_payments_updated', refreshData);
      window.removeEventListener('bizflow_suppliers_updated', refreshData);
    };
  }, []);

  const handleSaveQuickLoan = (e: React.FormEvent) => {
    e.preventDefault();
    const principal = parseFloat(quickLoanPrincipal);
    if (isNaN(principal) || principal <= 0) {
      alert('Please enter a valid loan amount.');
      return;
    }
    const lender = quickLoanLender.trim();
    if (!lender) {
      alert('Please enter the loan provider name.');
      return;
    }

    const rate = parseFloat(quickLoanInterest) || 0;
    const payable = parseFloat(quickLoanTotalPayable) || (principal + (principal * rate / 100));

    const newLoan: Loan = {
      id: 'loan_' + Math.random().toString(36).substring(2, 9),
      user_id: 'default',
      title: quickLoanTitle.trim() || `${lender} Loan`,
      provider_type: quickLoanType,
      lender_name: lender,
      contact_number: quickLoanPhone.trim() || undefined,
      account_or_voucher: quickLoanVoucher.trim() || undefined,
      principal_amount: principal,
      interest_rate: rate,
      total_payable: payable,
      total_paid: 0,
      remaining_amount: payable,
      disbursement_date: quickLoanDisbursementDate || format(new Date(), 'yyyy-MM-dd'),
      due_date: quickLoanDueDate || undefined,
      installment_type: 'monthly',
      installment_amount: parseFloat(quickLoanInstallment) || undefined,
      notes: quickLoanNotes.trim() || undefined,
      status: 'active',
      created_at: new Date().toISOString(),
      repayments: []
    };

    storageService.addLoan(newLoan);
    refreshData();
    setIsQuickLoanModalOpen(false);

    // Reset fields
    setQuickLoanLender('');
    setQuickLoanPrincipal('');
    setQuickLoanNotes('');
    setQuickLoanTitle('');
    setQuickLoanInterest('0');
    setQuickLoanTotalPayable('');
    setQuickLoanInstallment('');
    setQuickLoanPhone('');
    setQuickLoanVoucher('');
    setShowAdvancedQuickLoan(false);
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(expenseAmount);
    if (isNaN(val) || val <= 0) {
      alert('Please enter a valid expense amount.');
      return;
    }

    const finalCategory = expenseCategory === 'custom' 
      ? (customExpenseCategory.trim() || 'Miscellaneous') 
      : expenseCategory;

    const newExp: Expense = {
      id: 'exp_' + Math.random().toString(36).substring(2, 9),
      user_id: 'default',
      category: finalCategory,
      amount: val,
      date: expenseDate,
      created_at: new Date().toISOString(),
      payment_method: expensePaymentMethod,
      description: expenseDescription.trim(),
      reference_no: expenseReference.trim()
    };

    storageService.addExpense(newExp);
    refreshData();
    setIsExpenseModalOpen(false);

    // Reset form
    setExpenseAmount('');
    setExpenseDescription('');
    setExpenseReference('');
    setCustomExpenseCategory('');
  };

  const handleDeleteExpenseQuick = (id: string) => {
    storageService.deleteExpense(id);
    refreshData();
  };

  const businessName = businessSettings?.name || 'Grocery Point';

  // Calculate start date based on active filter
  const getFilterDateRange = () => {
    const today = startOfDay(new Date());
    let startDate: Date;
    let endDate: Date | null = null;
    let prevStartDate: Date;
    let prevEndDate: Date;

    switch (activeFilter) {
      case 'Today':
        startDate = startOfDay(today);
        endDate = endOfDay(today);
        prevStartDate = startOfDay(subDays(today, 1));
        prevEndDate = endOfDay(subDays(today, 1));
        break;
      case 'Yesterday':
        startDate = startOfDay(subDays(today, 1));
        endDate = endOfDay(subDays(today, 1));
        prevStartDate = startOfDay(subDays(today, 2));
        prevEndDate = endOfDay(subDays(today, 2));
        break;
      case 'This Week':
      case 'Current Week':
        startDate = startOfWeek(today, { weekStartsOn: 6 });
        endDate = endOfDay(today);
        prevStartDate = startOfWeek(subWeeks(today, 1), { weekStartsOn: 6 });
        prevEndDate = endOfWeek(subWeeks(today, 1), { weekStartsOn: 6 });
        break;
      case '7 Days':
        startDate = startOfDay(subDays(today, 7));
        endDate = endOfDay(today);
        prevStartDate = startOfDay(subDays(today, 14));
        prevEndDate = endOfDay(subDays(today, 7));
        break;
      case '14 Days':
        startDate = startOfDay(subDays(today, 14));
        endDate = endOfDay(today);
        prevStartDate = startOfDay(subDays(today, 28));
        prevEndDate = endOfDay(subDays(today, 14));
        break;
      case 'This Month':
      case 'Current Month':
        startDate = startOfMonth(today);
        endDate = endOfDay(today);
        prevStartDate = startOfMonth(subMonths(today, 1));
        prevEndDate = endOfMonth(subMonths(today, 1));
        break;
      case 'Last Month':
        startDate = startOfMonth(subMonths(today, 1));
        endDate = endOfMonth(subMonths(today, 1));
        prevStartDate = startOfMonth(subMonths(today, 2));
        prevEndDate = endOfMonth(subMonths(today, 2));
        break;
      case '1 Month':
        startDate = startOfDay(subMonths(today, 1));
        endDate = endOfDay(today);
        prevStartDate = startOfDay(subMonths(today, 2));
        prevEndDate = endOfDay(subMonths(today, 1));
        break;
      case '3 Months':
        startDate = startOfDay(subMonths(today, 3));
        endDate = endOfDay(today);
        prevStartDate = startOfDay(subMonths(today, 6));
        prevEndDate = endOfDay(subMonths(today, 3));
        break;
      case '6 Months':
        startDate = startOfDay(subMonths(today, 6));
        endDate = endOfDay(today);
        prevStartDate = startOfDay(subMonths(today, 12));
        prevEndDate = endOfDay(subMonths(today, 6));
        break;
      case 'This Year':
      case 'Current Year':
        startDate = startOfYear(today);
        endDate = endOfDay(today);
        prevStartDate = startOfYear(subYears(today, 1));
        prevEndDate = endOfYear(subYears(today, 1));
        break;
      case '1 Year':
        startDate = startOfDay(subYears(today, 1));
        endDate = endOfDay(today);
        prevStartDate = startOfDay(subYears(today, 2));
        prevEndDate = endOfDay(subYears(today, 1));
        break;
      case 'Custom Date':
        startDate = customStartDate ? startOfDay(parseISO(customStartDate)) : new Date(0);
        endDate = customEndDate ? endOfDay(parseISO(customEndDate)) : null;
        prevStartDate = new Date(0); // Prev stats not supported for custom
        prevEndDate = new Date(0);
        break;
      case 'Lifetime':
      default:
        startDate = new Date(0);
        endDate = null;
        prevStartDate = new Date(0);
        prevEndDate = new Date(0);
        break;
    }
    return { startDate, endDate, prevStartDate, prevEndDate };
  };

  const { startDate, endDate, prevStartDate, prevEndDate } = getFilterDateRange();

  // Current period filtered items
  const isWithinPeriod = (dateStr: string) => {
    const d = parseISO(dateStr);
    if (d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  };

  const filteredSales = sales.filter(s => isWithinPeriod(s.created_at));
  const filteredPurchases = purchases.filter(p => isWithinPeriod(p.created_at));
  const filteredExpenses = expenses.filter(e => isWithinPeriod(e.created_at || e.date));

  // Previous period items for dynamic growth rate calculation
  const prevSales = activeFilter === 'Lifetime' || activeFilter === 'Custom Date' ? [] : sales.filter(s => {
    const d = parseISO(s.created_at);
    return d >= prevStartDate && d <= prevEndDate;
  });
  const prevPurchases = activeFilter === 'Lifetime' || activeFilter === 'Custom Date' ? [] : purchases.filter(p => {
    const d = parseISO(p.created_at);
    return d >= prevStartDate && d <= prevEndDate;
  });
  const prevExpenses = activeFilter === 'Lifetime' || activeFilter === 'Custom Date' ? [] : expenses.filter(e => {
    const d = parseISO(e.created_at || e.date);
    return d >= prevStartDate && d <= prevEndDate;
  });

  // Overall inventory overview stats (computed from exact supplier FIFO batches)
  const inventoryOverview = useMemo(() => {
    return getInventoryOverviewStats(inventory, sales, purchases, suppliers);
  }, [inventory, sales, purchases, suppliers]);

  // Financial calculations for current period (based strictly on Inventory Product Profit & Loss)
  const currentPeriodProfitLoss = useMemo(() => {
    if (activeFilter === 'Lifetime') {
      return { totalProfit: inventoryOverview.totalProfit, totalLoss: inventoryOverview.totalLoss };
    }
    return calculateInventoryProfitLoss(filteredSales, inventory, purchases, suppliers);
  }, [activeFilter, filteredSales, inventory, purchases, suppliers, inventoryOverview]);

  const salesProfit = currentPeriodProfitLoss.totalProfit;
  const salesLoss = currentPeriodProfitLoss.totalLoss;

  const periodSalesAmount = filteredSales.reduce((sum, s) => sum + s.total_amount, 0);
  const periodPurchasesAmount = filteredPurchases.reduce((sum, p) => sum + p.total_amount, 0);
  const periodExpensesAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Previous period financial calculations (based strictly on Inventory Product Profit & Loss)
  const prevPeriodProfitLoss = useMemo(() => {
    return calculateInventoryProfitLoss(prevSales, inventory, purchases, suppliers);
  }, [prevSales, inventory, purchases, suppliers]);

  const prevSalesProfit = prevPeriodProfitLoss.totalProfit;
  const prevSalesLoss = prevPeriodProfitLoss.totalLoss;

  const prevSalesAmount = prevSales.reduce((sum, s) => sum + s.total_amount, 0);
  const prevPurchasesAmount = prevPurchases.reduce((sum, p) => sum + p.total_amount, 0);
  const prevExpensesAmount = prevExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Dynamic Growth Helper
  const getGrowth = (curr: number, prev: number, defaultPositive = true): MetricGrowth => {
    const periodName = activeFilter === '7 Days' ? 'last week' : activeFilter === 'Today' ? 'yesterday' : 'prev period';
    if (prev === 0 && curr === 0) {
      return { pct: 0, text: `0% vs ${periodName}`, isPositive: defaultPositive };
    }
    if (prev === 0 && curr > 0) {
      return { pct: 100, text: `+100% vs ${periodName}`, isPositive: true };
    }
    if (prev > 0) {
      const pct = Math.round(((curr - prev) / prev) * 100);
      const sign = pct >= 0 ? '+' : '';
      return { pct, text: `${sign}${pct}% vs ${periodName}`, isPositive: pct >= 0 };
    }
    return { pct: 0, text: `0% vs ${periodName}`, isPositive: defaultPositive };
  };

  const purchasesGrowth = getGrowth(periodPurchasesAmount, prevPurchasesAmount, true);
  const salesGrowth = getGrowth(periodSalesAmount, prevSalesAmount, true);
  const profitGrowth = getGrowth(salesProfit, prevSalesProfit, true);
  const lossGrowth = getGrowth(salesLoss, prevSalesLoss, false);
  const expenseGrowth = getGrowth(periodExpensesAmount, prevExpensesAmount, false);

  // Overall metrics (All time)
  const totalSalesAmount = sales.reduce((sum, s) => sum + s.total_amount, 0);
  const totalPurchasesAmount = purchases.reduce((sum, p) => sum + p.total_amount, 0);
  const totalExpensesAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
  const openingBalance = businessSettings?.opening_balance || 0;
  const capitalInvestment = investments.reduce((sum, inv) => sum + inv.amount, 0);

  // Customer & Supplier Due calculations
  const totalCustomerDue = useMemo(() => {
    return sales.reduce((sum, s) => {
      if (s.due_amount !== undefined) return sum + s.due_amount;
      return (s.payment_method === 'due' || s.status === 'pending') ? sum + s.total_amount : sum;
    }, 0);
  }, [sales]);

  const dueCustomersCount = useMemo(() => {
    const custDueMap = new Map<string, number>();
    sales.forEach(s => {
      const due = s.due_amount !== undefined ? s.due_amount : ((s.payment_method === 'due' || s.status === 'pending') ? s.total_amount : 0);
      if (due > 0) {
        const id = s.customer_id || s.customer_name || 'unknown';
        custDueMap.set(id, (custDueMap.get(id) || 0) + due);
      }
    });
    return Array.from(custDueMap.values()).filter(d => d > 0).length;
  }, [sales]);

  const supplierTotalDue = useMemo(() => {
    return purchases.reduce((sum, p) => {
      return (p.payment_method === 'due' || p.status === 'pending') ? sum + p.total_amount : sum;
    }, 0);
  }, [purchases]);

  const supplierDueCount = useMemo(() => {
    const suppDueMap = new Map<string, number>();
    purchases.forEach(p => {
      if (p.payment_method === 'due' || p.status === 'pending') {
        const id = p.supplier_id || p.supplier_name || 'unknown';
        suppDueMap.set(id, (suppDueMap.get(id) || 0) + p.total_amount);
      }
    });
    return Array.from(suppDueMap.values()).filter(d => d > 0).length;
  }, [purchases]);

  // Realized Sales Cash Collected: Excludes unpaid customer due. Whenever due is collected, due_amount decreases and realized cash increases!
  const totalSalesCashCollected = Math.max(0, totalSalesAmount - totalCustomerDue);

  // Purchases Cash Paid: Real cash paid to suppliers (excluding supplier due credit)
  const totalPurchasesCashPaid = Math.max(0, totalPurchasesAmount - supplierTotalDue);
  
  // Loans calculations for Cash Balance
  const totalLoanReceived = loans.reduce((sum, l) => sum + (l.principal_amount || 0), 0);
  const totalLoanPaid = loans.reduce((sum, l) => sum + (l.total_paid || 0), 0);
  const netLoanCash = totalLoanReceived - totalLoanPaid;

  // Total Current Balance (Cash & Bank in Hand):
  // Opening Balance + Capital Investment + Sales Cash Received (minus Unpaid Customer Due) + Net Loan Cash - Purchases Cash Paid - Expenses
  const totalCurrentBalance = openingBalance + capitalInvestment + totalSalesCashCollected + netLoanCash - totalPurchasesCashPaid - totalExpensesAmount;
  const cashBalance = totalCurrentBalance;
  
  // Accurate Stock Valuation & Units (Sourced directly from canonical inventory stats)
  const totalStockQuantity = inventoryOverview.totalStockQuantity;
  const totalProductsCount = inventoryOverview.totalProducts;
  const stockCostValue = inventoryOverview.stockCostValue;
  const stockRetailValue = inventoryOverview.stockRetailValue;

  const totalInvestment = capitalInvestment + stockCostValue;
  const lowStockItems = inventoryOverview.itemsWithStats.filter(item => item.stats.availableStock <= (item.min_stock_level || 0));

  // Expected Profit calculations from current stock
  const expectedProfit = inventoryOverview.expectedProfit;
  const expectedMarginPercent = inventoryOverview.expectedMarginPercent;

  // Loans calculations
  const totalOutstandingLoan = loans.reduce((sum, l) => sum + (l.remaining_amount || 0), 0);
  const totalPaidLoan = loans.reduce((sum, l) => sum + (l.total_paid || 0), 0);
  const totalLoanPrincipal = loans.reduce((sum, l) => sum + (l.principal_amount || 0), 0);
  const activeLoansCount = loans.filter(l => l.status === 'active' && (l.remaining_amount || 0) > 0).length;

  // Total Cash (Owner) calculation: Customer Due + Total Current Balance + Stock Cost Value - Total Loan / Liability
  const totalOwnerCash = totalCustomerDue + totalCurrentBalance + stockCostValue - totalOutstandingLoan;

  // Inventory items ranked by expected profit contribution
  const topProfitInventoryItems = useMemo(() => {
    return inventoryOverview.itemsWithStats
      .map(item => {
        const qty = item.stats.availableStock;
        const cost = item.stats.avgPurchasePrice;
        const retail = (typeof item.unit_price === 'number' && item.unit_price > 0) ? item.unit_price : (item.mrp || cost);
        const profitPerUnit = Math.max(0, retail - cost);
        const totalItemExpectedProfit = item.stats.expectedProfit;
        return {
          id: item.id,
          name: item.name,
          category: item.category,
          quantity: qty,
          cost_price: cost,
          retail_price: retail,
          profit_per_unit: profitPerUnit,
          total_expected_profit: totalItemExpectedProfit,
          image_url: item.image_url
        };
      })
      .sort((a, b) => b.total_expected_profit - a.total_expected_profit);
  }, [inventoryOverview]);

  // Fixed Quick 4-Period Snapshot (Today, This Week, Current Month, This Year)
  const fixedPeriodStats = useMemo(() => {
    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);
    const weekStart = startOfWeek(today, { weekStartsOn: 6 });
    const monthStart = startOfMonth(today);
    const yearStart = startOfYear(today);

    const calcForPeriod = (start: Date, end: Date = todayEnd) => {
      const pSales = sales.filter(s => {
        const d = parseISO(s.created_at);
        return d >= start && d <= end;
      });
      const pPurchases = purchases.filter(p => {
        const d = parseISO(p.created_at);
        return d >= start && d <= end;
      });
      const pExpenses = expenses.filter(e => {
        const d = parseISO(e.created_at || e.date);
        return d >= start && d <= end;
      });

      const pAmount = pSales.reduce((sum, s) => sum + s.total_amount, 0);
      const fin = calculateInventoryProfitLoss(pSales, inventory, purchases, suppliers);
      return {
        salesCount: pSales.length,
        salesAmount: pAmount,
        profit: fin.totalProfit,
        loss: fin.totalLoss,
        expensesAmount: pExpenses.reduce((sum, e) => sum + e.amount, 0),
        purchasesAmount: pPurchases.reduce((sum, p) => sum + p.total_amount, 0)
      };
    };

    return {
      today: calcForPeriod(todayStart, todayEnd),
      thisWeek: calcForPeriod(weekStart, todayEnd),
      thisMonth: calcForPeriod(monthStart, todayEnd),
      thisYear: calcForPeriod(yearStart, todayEnd)
    };
  }, [sales, inventory, purchases, expenses, suppliers]);

  const filters = [
    'Today', 
    'This Week', 
    'This Month', 
    'This Year', 
    'Yesterday', 
    'Last Month', 
    '7 Days', 
    '14 Days', 
    '1 Month', 
    '3 Months', 
    '6 Months', 
    '1 Year', 
    'Lifetime', 
    'Custom Date'
  ];
  const formattedToday = format(new Date(), 'MMMM d, yyyy');
  const periodLabel = activeFilter === 'Today' 
    ? "Today's" 
    : (activeFilter === 'This Month' || activeFilter === 'Current Month')
    ? "Current Month"
    : (activeFilter === 'This Week' || activeFilter === 'Current Week')
    ? "This Week's"
    : (activeFilter === 'This Year' || activeFilter === 'Current Year')
    ? "This Year's"
    : activeFilter === 'Yesterday'
    ? "Yesterday's"
    : activeFilter === 'Last Month'
    ? "Last Month's"
    : `${activeFilter}`;

  return (
    <div className="space-y-6 pb-12">
      
      {/* 1. TOP HEADER SECTION (Welcome Banner + Investment Box + Action Buttons) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
        
        {/* Banner Card */}
        <div className="md:col-span-12 xl:col-span-6 rounded-[24px] bg-gradient-to-br from-[#effdf4] to-[#e4f9ec] border border-[#c6f6d5] relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          
          {/* Subtle logo-colored watermark in background */}
          <div className="absolute -left-10 -bottom-10 w-48 h-48 rounded-full blur-2xl pointer-events-none transition-colors duration-500 bg-emerald-300/10" />
          <div className="absolute right-0 -top-10 w-40 h-40 rounded-full blur-xl pointer-events-none transition-colors duration-500 bg-emerald-200/20" />

          {/* Left Text details */}
          <div className="z-10 text-left w-full sm:w-auto p-5 lg:p-6 sm:pr-0">
            <div className="flex items-start gap-4">
               {/* Store Icon Representation */}
               <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 relative flex-col mt-1 hidden sm:flex">
                  <div className="absolute inset-0 bg-[#c0ecd0] rounded-[14px] rotate-[6deg]"></div>
                  <div className="absolute inset-0 bg-white rounded-[14px] -rotate-[3deg] border border-[#129c54] flex items-center justify-center shadow-sm overflow-hidden">
                    <div className="absolute top-0 w-full h-3 bg-[#129c54]"></div>
                    <div className="absolute top-3 w-full flex justify-between px-1">
                      <div className="w-1.5 h-3 bg-[#c0ecd0] rounded-b-full"></div>
                      <div className="w-1.5 h-3 bg-[#c0ecd0] rounded-b-full"></div>
                      <div className="w-1.5 h-3 bg-[#c0ecd0] rounded-b-full"></div>
                      <div className="w-1.5 h-3 bg-[#c0ecd0] rounded-b-full"></div>
                    </div>
                    <ShoppingCart className="w-6 h-6 text-[#129c54] mt-2" />
                  </div>
               </div>

               <div className="flex flex-col pt-1">
                 <span className="text-[13px] font-medium text-slate-600 mb-0.5">
                   Welcome Back,
                 </span>
                 <h1 className="text-2xl lg:text-3xl font-black text-[#129c54] tracking-tight uppercase italic drop-shadow-sm">
                   {businessName}
                 </h1>
               </div>
            </div>

            {/* Date Tag */}
            <div className="flex items-center gap-1.5 text-[11px] font-semibold mt-4 bg-white/70 px-3 py-1.5 rounded-lg w-fit border border-[#c6f6d5] shadow-xs text-slate-600 sm:ml-[80px]">
              <Calendar className="w-3.5 h-3.5 text-[#129c54]" />
              <span>{formattedToday}</span>
            </div>

            <div className="mt-4 sm:ml-[80px] hidden sm:block">
              <span className="text-[13px] font-serif font-bold italic tracking-wide text-slate-500 block leading-tight">
                Good Business
              </span>
              <span className="text-[13px] font-serif font-bold italic tracking-wide text-slate-500 block leading-tight ml-4">
                Grows Here
              </span>
            </div>
          </div>

          {/* Right Chart Graphic */}
          <div className="relative shrink-0 z-10 w-28 h-28 sm:w-36 sm:h-36 flex items-end justify-end p-4 lg:p-6 opacity-90 hidden sm:flex">
             <div className="w-full h-full relative flex items-end justify-between gap-1.5">
                <div className="w-4 bg-[#86efac] rounded-t-sm h-[30%]"></div>
                <div className="w-4 bg-[#86efac] rounded-t-sm h-[50%]"></div>
                <div className="w-4 bg-[#4ade80] rounded-t-sm h-[80%]"></div>
                <div className="absolute bottom-[30%] -right-2 transform -rotate-12">
                   <ArrowUpRight className="w-14 h-14 text-[#34d399] stroke-[4]" />
                </div>
             </div>
          </div>
        </div>

        {/* Investment Box */}
        <Link 
          to="/investments"
          className="md:col-span-6 xl:col-span-3 rounded-[24px] p-5 lg:p-6 bg-white border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between group cursor-pointer transition-all hover:shadow-md hover:border-blue-200"
        >
          {/* Top Section */}
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-[#eff6ff] text-[#3b82f6] flex items-center justify-center shrink-0">
              <TrendingUp className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">INVESTEMENT</p>
              <h2 className="text-2xl font-black text-[#1e293b] leading-none">
                {formatCurrency(capitalInvestment)}
              </h2>
            </div>
          </div>

          <div className="border-t border-slate-100/80 my-2"></div>

          {/* Bottom Section */}
          <div className="bg-[#f8fafc] rounded-2xl p-3 flex items-center gap-4 mt-2">
             <div className="w-10 h-10 rounded-full bg-[#eff6ff] text-[#3b82f6] flex items-center justify-center shrink-0">
              <Coins className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 mb-0.5">Total Investment</p>
              <h2 className="text-lg font-bold text-[#1e293b] leading-none">
                {formatCurrency(totalInvestment)}
              </h2>
            </div>
          </div>
        </Link>

        {/* Sale Now Box */}
        <Link
            to="/sales"
            className="md:col-span-6 xl:col-span-3 rounded-[24px] p-5 lg:p-6 bg-gradient-to-br from-[#12a159] to-[#0d8749] relative overflow-hidden flex items-center justify-between group cursor-pointer transition-all hover:shadow-lg shadow-sm"
        >
           {/* Darker blobs in background */}
           <div className="absolute -right-6 -top-6 w-32 h-32 bg-[#09753e]/40 rounded-full blur-xl pointer-events-none group-hover:scale-110 transition-transform duration-500" />
           <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-[#09753e]/30 rounded-full blur-xl pointer-events-none" />
           
           <div className="flex items-center gap-4 z-10 w-full h-full">
             <div className="w-16 h-16 rounded-full bg-[#09753e] flex items-center justify-center shrink-0 border border-[#14b363]/30 shadow-inner relative">
                <ShoppingCart className="w-7 h-7 text-white relative z-10" />
                <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-white rounded-full animate-ping"></div>
             </div>
             
             <div className="w-px h-16 bg-[#39ba78] shrink-0 hidden sm:block"></div>

             <div className="flex-1 flex flex-col justify-center">
               <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">Sale Now</h3>
               <p className="text-[11px] sm:text-xs text-[#a4e6c3] leading-snug font-medium">Create a new sale & serve your customers</p>
             </div>

             <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm group-hover:translate-x-1 transition-transform ml-1">
                <ArrowRight className="w-5 h-5 text-[#12a159] stroke-[2.5]" />
             </div>
           </div>
        </Link>
      </div>

      {/* 2. FIXED MULTI-PERIOD PERFORMANCE SNAPSHOT (Today, This Week, Current Month, This Year) */}
      <div className="bg-gradient-to-r from-slate-50 via-white to-slate-50 p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-800 tracking-tight">
                Quick Multi-Period Performance
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Fixed live metrics for Today, This Week, Current Month, and This Year
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 bg-white px-2.5 py-1 rounded-full border border-slate-200">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            <span>Click any card to filter entire view</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Today */}
          <div 
            onClick={() => setActiveFilter('Today')}
            className={cn(
              "p-4 rounded-2xl bg-white border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between group hover:shadow-md",
              activeFilter === 'Today' 
                ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/30 shadow-xs" 
                : "border-slate-200 hover:border-slate-300 shadow-xs"
            )}
          >
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block leading-tight">Today</span>
                  <span className="text-[10px] text-slate-400 font-medium">Daily Fixed</span>
                </div>
              </div>
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                activeFilter === 'Today' 
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs" 
                  : "bg-slate-50 text-slate-600 border-slate-200"
              )}>
                {activeFilter === 'Today' ? 'Active' : `${fixedPeriodStats.today.salesCount} Orders`}
              </span>
            </div>
            <div className="space-y-1.5 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Sales</span>
                <span className="text-sm font-extrabold text-slate-900">৳{formatCurrency(fixedPeriodStats.today.salesAmount)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Profit</span>
                <span className="text-xs font-bold text-emerald-600">+৳{formatCurrency(fixedPeriodStats.today.profit)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Loss</span>
                <span className={cn("text-xs font-bold", fixedPeriodStats.today.loss > 0 ? "text-rose-600" : "text-slate-400")}>
                  {fixedPeriodStats.today.loss > 0 ? `-৳${formatCurrency(fixedPeriodStats.today.loss)}` : '৳0'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: This Week */}
          <div 
            onClick={() => setActiveFilter('This Week')}
            className={cn(
              "p-4 rounded-2xl bg-white border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between group hover:shadow-md",
              (activeFilter === 'This Week' || activeFilter === 'Current Week') 
                ? "border-sky-500 ring-2 ring-sky-500/20 bg-sky-50/30 shadow-xs" 
                : "border-slate-200 hover:border-slate-300 shadow-xs"
            )}
          >
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block leading-tight">This Week</span>
                  <span className="text-[10px] text-slate-400 font-medium">Weekly Fixed</span>
                </div>
              </div>
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                (activeFilter === 'This Week' || activeFilter === 'Current Week') 
                  ? "bg-sky-600 text-white border-sky-600 shadow-2xs" 
                  : "bg-slate-50 text-slate-600 border-slate-200"
              )}>
                {(activeFilter === 'This Week' || activeFilter === 'Current Week') ? 'Active' : `${fixedPeriodStats.thisWeek.salesCount} Orders`}
              </span>
            </div>
            <div className="space-y-1.5 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Sales</span>
                <span className="text-sm font-extrabold text-slate-900">৳{formatCurrency(fixedPeriodStats.thisWeek.salesAmount)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Profit</span>
                <span className="text-xs font-bold text-emerald-600">+৳{formatCurrency(fixedPeriodStats.thisWeek.profit)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Loss</span>
                <span className={cn("text-xs font-bold", fixedPeriodStats.thisWeek.loss > 0 ? "text-rose-600" : "text-slate-400")}>
                  {fixedPeriodStats.thisWeek.loss > 0 ? `-৳${formatCurrency(fixedPeriodStats.thisWeek.loss)}` : '৳0'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Current Month (This Month) */}
          <div 
            onClick={() => setActiveFilter('This Month')}
            className={cn(
              "p-4 rounded-2xl bg-white border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between group hover:shadow-md",
              (activeFilter === 'This Month' || activeFilter === 'Current Month') 
                ? "border-teal-500 ring-2 ring-teal-500/20 bg-teal-50/30 shadow-xs" 
                : "border-slate-200 hover:border-slate-300 shadow-xs"
            )}
          >
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block leading-tight">Current Month</span>
                  <span className="text-[10px] text-teal-600 font-bold">Monthly Fixed</span>
                </div>
              </div>
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                (activeFilter === 'This Month' || activeFilter === 'Current Month') 
                  ? "bg-teal-600 text-white border-teal-600 shadow-2xs" 
                  : "bg-teal-50 text-teal-700 border-teal-200/80"
              )}>
                {(activeFilter === 'This Month' || activeFilter === 'Current Month') ? 'Active' : `${fixedPeriodStats.thisMonth.salesCount} Orders`}
              </span>
            </div>
            <div className="space-y-1.5 bg-teal-50/40 p-2.5 rounded-xl border border-teal-100/60">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Sales</span>
                <span className="text-sm font-extrabold text-slate-900">৳{formatCurrency(fixedPeriodStats.thisMonth.salesAmount)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Profit</span>
                <span className="text-xs font-bold text-emerald-600">+৳{formatCurrency(fixedPeriodStats.thisMonth.profit)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Loss</span>
                <span className={cn("text-xs font-bold", fixedPeriodStats.thisMonth.loss > 0 ? "text-rose-600" : "text-slate-400")}>
                  {fixedPeriodStats.thisMonth.loss > 0 ? `-৳${formatCurrency(fixedPeriodStats.thisMonth.loss)}` : '৳0'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: This Year */}
          <div 
            onClick={() => setActiveFilter('This Year')}
            className={cn(
              "p-4 rounded-2xl bg-white border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between group hover:shadow-md",
              (activeFilter === 'This Year' || activeFilter === 'Current Year') 
                ? "border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/30 shadow-xs" 
                : "border-slate-200 hover:border-slate-300 shadow-xs"
            )}
          >
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block leading-tight">This Year</span>
                  <span className="text-[10px] text-slate-400 font-medium">Yearly Fixed</span>
                </div>
              </div>
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                (activeFilter === 'This Year' || activeFilter === 'Current Year') 
                  ? "bg-purple-600 text-white border-purple-600 shadow-2xs" 
                  : "bg-slate-50 text-slate-600 border-slate-200"
              )}>
                {(activeFilter === 'This Year' || activeFilter === 'Current Year') ? 'Active' : `${fixedPeriodStats.thisYear.salesCount} Orders`}
              </span>
            </div>
            <div className="space-y-1.5 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Sales</span>
                <span className="text-sm font-extrabold text-slate-900">৳{formatCurrency(fixedPeriodStats.thisYear.salesAmount)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Profit</span>
                <span className="text-xs font-bold text-emerald-600">+৳{formatCurrency(fixedPeriodStats.thisYear.profit)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Loss</span>
                <span className={cn("text-xs font-bold", fixedPeriodStats.thisYear.loss > 0 ? "text-rose-600" : "text-slate-400")}>
                  {fixedPeriodStats.thisYear.loss > 0 ? `-৳${formatCurrency(fixedPeriodStats.thisYear.loss)}` : '৳0'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. ACTIONS & TIME FILTERS */}
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
        
        {/* TIME FILTERS PILLS */}
        <div className="flex flex-col gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {filters.map(filter => {
              const isActive = activeFilter === filter;
              return (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={cn(
                    "px-5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer",
                    isActive 
                      ? "bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-500/20" 
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                  )}
                >
                  {filter}
                </button>
              );
            })}
          </div>

          {activeFilter === 'Custom Date' && (
            <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm w-fit animate-in fade-in slide-in-from-top-2">
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Start Date</label>
                <input 
                  type="date" 
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="text-sm font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">End Date</label>
                <input 
                  type="date" 
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="text-sm font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>
          )}
        </div>

        {/* QUICK ACTIONS TOOLBAR */}
        <div className="flex items-center gap-3 shrink-0 overflow-x-auto pb-1 no-scrollbar pt-1 xl:pt-0">
           <Link to="/activity-log" className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-full text-xs font-bold transition-all flex items-center gap-2 shadow-2xs">
              <History className="w-3.5 h-3.5 text-emerald-400" /> Activity Log
           </Link>
           <Link to="/purchases" className="px-4 py-2 bg-[#0288d1]/10 text-[#0288d1] hover:bg-[#0288d1]/20 rounded-full text-xs font-bold transition-all flex items-center gap-2 border border-[#0288d1]/20">
              <Box className="w-3.5 h-3.5" /> Stock Entry
           </Link>
           <button 
             onClick={() => navigate('/dues', { state: { openCollect: true } })} 
             className="px-4 py-2 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 rounded-full text-xs font-bold transition-all flex items-center gap-2 border border-amber-500/20 cursor-pointer"
           >
              <HandCoins className="w-3.5 h-3.5" /> + Collect Due
           </button>
           <button 
             onClick={() => navigate('/expenses', { state: { openAdd: true } })} 
             className="px-4 py-2 bg-[#9c27b0]/10 text-[#9c27b0] hover:bg-[#9c27b0]/20 rounded-full text-xs font-bold transition-all flex items-center gap-2 border border-[#9c27b0]/20 cursor-pointer"
           >
              <Wallet className="w-3.5 h-3.5" /> + Add Expense
           </button>
           <button 
              onClick={() => {
                setQuickLoanTitle('');
                setQuickLoanLender('');
                setQuickLoanType('bank');
                setQuickLoanPrincipal('');
                setQuickLoanInterest('0');
                setQuickLoanTotalPayable('');
                setQuickLoanInstallment('');
                setQuickLoanDueDate('');
                setIsQuickLoanModalOpen(true);
              }} 
              className="px-4 py-2 bg-[#e91e63]/10 text-[#e91e63] hover:bg-[#e91e63]/20 rounded-full text-xs font-bold transition-all flex items-center gap-2 border border-[#e91e63]/20">
              <Landmark className="w-3.5 h-3.5" /> + Loan
           </button>
        </div>
      </div>

      {/* 3. TWELVE METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Purchases */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-[#ecfdf5] via-white to-[#d1fae5]/30 border border-emerald-100 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-700">Total Purchases</span>
            </div>
            <div className={cn("text-xs font-bold flex items-center gap-0.5", purchasesGrowth.isPositive ? "text-emerald-600" : "text-slate-500")}>
              <span>↗</span>
              <span>{purchasesGrowth.text}</span>
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              ৳{formatCurrency(periodPurchasesAmount)}
            </h3>
            <p className="text-xs font-medium text-slate-500 mt-0.5">{periodLabel} Purchases</p>
          </div>
        </div>

        {/* Card 2: Total Sales */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-[#f0f9ff] via-white to-[#e0f2fe]/40 border border-sky-100 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-xs">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-700">Total Sales</span>
            </div>
            <div className={cn("text-xs font-bold flex items-center gap-0.5", salesGrowth.isPositive ? "text-emerald-600" : "text-rose-500")}>
              <span>↗</span>
              <span>{salesGrowth.text}</span>
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              ৳{formatCurrency(periodSalesAmount)}
            </h3>
            <p className="text-xs font-medium text-slate-500 mt-0.5">{periodLabel} Sales</p>
          </div>
        </div>

        {/* Card 3: Total Profit */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-[#f0fdf4] via-white to-[#dcfce7]/40 border border-emerald-100 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[140px] transition-all hover:shadow-md">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-700">Total Profit</span>
            </div>
            <div className={cn("text-[11px] font-bold flex items-center gap-0.5 px-2.5 py-0.5 rounded-full border whitespace-nowrap shrink-0", profitGrowth.isPositive ? "bg-emerald-50 text-emerald-700 border-emerald-200/60" : "bg-slate-50 text-slate-600 border-slate-200")}>
              <span>{profitGrowth.isPositive ? '↗' : '↘'}</span>
              <span>{profitGrowth.text}</span>
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-extrabold text-emerald-700 tracking-tight">
              ৳{formatCurrency(salesProfit)}
            </h3>
            <p className="text-xs font-medium text-slate-500 mt-0.5 flex items-center justify-between">
              <span>{periodLabel} Sales Profit</span>
              {salesProfit > 0 && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80">
                  Sales Profit
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Card 4: Total Loss */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-[#fff1f2] via-white to-[#ffe4e6]/40 border border-rose-200 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[140px] transition-all hover:shadow-md">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-xs shrink-0">
                <TrendingDown className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-700">Total Loss</span>
            </div>
            <div className={cn("text-[11px] font-bold flex items-center gap-0.5 px-2.5 py-0.5 rounded-full border whitespace-nowrap shrink-0", salesLoss > 0 ? "bg-rose-50 text-rose-700 border-rose-200/60" : "bg-slate-50 text-slate-600 border-slate-200")}>
              <span>{salesLoss > 0 ? '↘' : '✓'}</span>
              <span>{salesLoss > 0 ? lossGrowth.text : 'No Loss'}</span>
            </div>
          </div>
          <div className="mt-3">
            <h3 className={cn("text-3xl font-extrabold tracking-tight", salesLoss > 0 ? "text-rose-600" : "text-slate-400")}>
              ৳{formatCurrency(salesLoss)}
            </h3>
            <p className="text-xs font-medium text-slate-500 mt-0.5 flex items-center justify-between">
              <span>{periodLabel} Sales Loss</span>
              {salesLoss > 0 ? (
                <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-200/80">
                  Sales Loss
                </span>
              ) : (
                <span className="text-[10px] font-medium text-slate-400">
                  0 Deficit
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Card 4: Expected Profit */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-[#f0fdfa] via-white to-[#ccfbf1]/40 border border-teal-100 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[140px] group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-teal-500 text-white flex items-center justify-center shadow-xs">
                <Coins className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-700">Expected Profit</span>
            </div>
            <div className="text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200/80 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <span>↗</span>
              <span>{expectedMarginPercent}% Margin</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                ৳{formatCurrency(expectedProfit)}
              </h3>
              <button
                onClick={() => setIsExpectedProfitModalOpen(true)}
                title="View Expected Profit Breakdown"
                className="text-[11px] font-semibold text-teal-700 hover:text-teal-900 bg-teal-100/80 hover:bg-teal-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Eye className="w-3 h-3" />
                <span>Details</span>
              </button>
            </div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 mt-1">
              <span>From stock resale</span>
              <span className="text-[11px] text-teal-700 font-semibold bg-teal-50/80 px-2 py-0.5 rounded-md border border-teal-100">
                Retail: ৳{formatCurrency(stockRetailValue)}
              </span>
            </div>
          </div>
        </div>

        {/* Card 5: Total Current Balance */}
        <div 
          onClick={() => {
            setOpeningBalanceInput(businessSettings?.opening_balance?.toString() || '');
            setIsOpeningBalanceModalOpen(true);
          }}
          className="p-5 rounded-3xl bg-gradient-to-br from-[#faf5ff] via-white to-[#f3e8ff]/40 border border-purple-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[140px] group cursor-pointer transition-all hover:shadow-md hover:border-purple-300"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform">
                <Wallet className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-700">Total Current Balance</span>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-purple-500 transition-colors" />
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                ৳{formatCurrency(totalCurrentBalance)}
              </h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsBalanceBreakdownModalOpen(true)}
                  title="View Balance Calculation Formula"
                  className="text-[11px] font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1 bg-purple-100/70 hover:bg-purple-200/80 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  <Eye className="w-3 h-3" />
                  <span>Breakdown</span>
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between text-xs font-medium text-slate-500 mt-1 gap-1">
              <span>Cash & Bank in Hand</span>
              <div className="flex items-center flex-wrap gap-1">
                {totalCustomerDue > 0 && (
                  <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200" title="Customer dues are excluded until collected">
                    -৳{formatCurrency(totalCustomerDue)} Due
                  </span>
                )}
                {netLoanCash > 0 && (
                  <span className="text-[10px] text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                    +৳{formatCurrency(netLoanCash)} Loan
                  </span>
                )}
                {totalExpensesAmount > 0 && (
                  <span className="text-[10px] text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                    -৳{formatCurrency(totalExpensesAmount)} Expense
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Card: Total Cash (Owner) */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-[#eef2ff] via-white to-[#e0e7ff]/60 border border-indigo-200/90 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[140px] group transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">Total Cash (Owner)</span>
              </div>
            </div>
            <div className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
              Net Equity
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-3xl font-extrabold text-indigo-950 tracking-tight">
                ৳{formatCurrency(totalOwnerCash)}
              </h3>
              <button
                onClick={() => setIsOwnerCashModalOpen(true)}
                title="View Owner Cash Calculation Breakdown"
                className="text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 bg-indigo-100/70 hover:bg-indigo-200/80 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                <Eye className="w-3 h-3" />
                <span>Formula</span>
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between text-xs font-medium text-slate-500 mt-1 gap-1">
              <span className="text-[11px] text-slate-600 font-semibold">Due + Balance + Stock - Loan</span>
              <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                Owner Value
              </span>
            </div>
          </div>
        </div>

        {/* Card: Customer Due */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-[#fffbeb] via-white to-[#fef3c7]/50 border border-amber-200/90 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[140px] group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs">
                <HandCoins className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-700">Customer Due</span>
            </div>
            <div className={cn(
              "text-xs font-bold flex items-center gap-1 px-2.5 py-0.5 rounded-full border",
              dueCustomersCount > 0 
                ? "bg-amber-50 text-amber-700 border-amber-200" 
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
            )}>
              {dueCustomersCount > 0 ? (
                <span>{dueCustomersCount} Customers</span>
              ) : (
                <span>All Paid ✓</span>
              )}
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                ৳{formatCurrency(totalCustomerDue)}
              </h3>
              <button
                onClick={() => navigate('/dues', { state: { openCollect: true } })}
                title="Collect Customer Due"
                className="text-[11px] font-bold text-amber-800 hover:text-amber-950 bg-amber-100/90 hover:bg-amber-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3 stroke-[2.5]" />
                <span>Collect</span>
              </button>
            </div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 mt-1">
              <span className="text-amber-700 font-semibold text-[11px]">Receivable from Customers</span>
              <Link
                to="/dues"
                className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 flex items-center gap-0.5 hover:underline"
              >
                <span>{dueCustomersCount} Records</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Card: Supplier Due */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-[#fff7ed] via-white to-[#ffedd5]/50 border border-orange-200/90 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[140px] group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-xs">
                <Truck className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-700">Supplier Due</span>
            </div>
            <div className={cn(
              "text-xs font-bold flex items-center gap-1 px-2.5 py-0.5 rounded-full border",
              supplierDueCount > 0 
                ? "bg-orange-50 text-orange-700 border-orange-200" 
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
            )}>
              {supplierDueCount > 0 ? (
                <span>{supplierDueCount} Suppliers</span>
              ) : (
                <span>Debt Free ✓</span>
              )}
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                ৳{formatCurrency(supplierTotalDue)}
              </h3>
              <button
                onClick={() => navigate('/dues')}
                title="Pay Supplier Due"
                className="text-[11px] font-bold text-orange-800 hover:text-orange-950 bg-orange-100/90 hover:bg-orange-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3 stroke-[2.5]" />
                <span>Pay</span>
              </button>
            </div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 mt-1">
              <span className="text-orange-700 font-semibold text-[11px]">Payable to Suppliers</span>
              <Link
                to="/dues"
                className="text-[11px] font-semibold text-orange-700 hover:text-orange-900 flex items-center gap-0.5 hover:underline"
              >
                <span>{supplierDueCount} Records</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Card 6: Total Expense */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-[#fff1f2] via-white to-[#ffe4e6]/40 border border-rose-100 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[140px] group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-xs">
                <Receipt className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-700">Total Expense</span>
            </div>
            <div className="text-xs font-bold text-rose-500 flex items-center gap-0.5">
              <span>↘</span>
              <span>{expenseGrowth.text}</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                ৳{formatCurrency(periodExpensesAmount)}
              </h3>
              <button
                onClick={() => navigate('/expenses', { state: { openAdd: true } })}
                title="Add New Expense"
                className="text-[11px] font-bold text-rose-700 hover:text-rose-900 bg-rose-100/80 hover:bg-rose-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3 stroke-[2.5]" />
                <span>Add</span>
              </button>
            </div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 mt-1">
              <span className="text-rose-600 font-semibold text-[11px]">Deducted from Balance ✓</span>
              <Link
                to="/expenses"
                className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-0.5 hover:underline"
              >
                <span>{expenses.length} Records</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Card 9: Total Loan / Liability */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-[#fff1f2] via-white to-[#ffe4e6]/40 border border-rose-200/90 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[140px] group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xs">
                <Landmark className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-700">Total Loan / Liability</span>
            </div>
            <div className={cn(
              "text-xs font-bold flex items-center gap-1 px-2.5 py-0.5 rounded-full border",
              activeLoansCount > 0 
                ? "bg-rose-50 text-rose-700 border-rose-200" 
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
            )}>
              {activeLoansCount > 0 ? (
                <span>{activeLoansCount} Active Loans</span>
              ) : (
                <span>Debt Free ✓</span>
              )}
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                ৳{formatCurrency(totalOutstandingLoan)}
              </h3>
              <button
                onClick={() => {
                  setQuickLoanTitle('');
                  setQuickLoanLender('');
                  setQuickLoanType('bank');
                  setQuickLoanPrincipal('');
                  setQuickLoanInterest('0');
                  setQuickLoanTotalPayable('');
                  setQuickLoanInstallment('');
                  setQuickLoanDueDate('');
                  setIsQuickLoanModalOpen(true);
                }}
                title="Add New Loan"
                className="text-[11px] font-semibold text-rose-700 hover:text-rose-900 bg-rose-100/80 hover:bg-rose-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3 stroke-[2.5]" />
                <span>+ Add</span>
              </button>
            </div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 mt-1">
              <span>Outstanding balance</span>
              <Link
                to="/loans"
                className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-0.5 hover:underline"
              >
                <span>Paid ৳{formatCurrency(totalPaidLoan)}</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Card 10: Stock Cost Value */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-[#eff6ff] via-white to-[#dbeafe]/40 border border-blue-100 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[140px] group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-xs">
                <Box className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-700">Stock Cost Value</span>
            </div>

            {/* Dynamic Status / Real Stock Rating Badge */}
            <div className={cn(
              "text-xs font-bold flex items-center gap-1 px-2.5 py-0.5 rounded-full border",
              lowStockItems.length > 0
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : totalStockQuantity > 0
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-slate-50 text-slate-600 border-slate-200"
            )}>
              {lowStockItems.length > 0 ? (
                <>
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  <span>{lowStockItems.length} Low Stock</span>
                </>
              ) : totalStockQuantity > 0 ? (
                <>
                  <span>✓</span>
                  <span>{totalStockQuantity} Units in Stock</span>
                </>
              ) : (
                <span>0 in Stock</span>
              )}
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                ৳{formatCurrency(stockCostValue)}
              </h3>
              <Link
                to="/inventory"
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 hover:underline"
              >
                <span>{totalProductsCount} Products</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 mt-1">
              <span>Current inventory cost</span>
              {stockRetailValue > 0 && (
                <span className="text-[11px] text-blue-700 font-semibold bg-blue-50/80 px-2 py-0.5 rounded-md border border-blue-100">
                  Retail: ৳{formatCurrency(stockRetailValue)}
                </span>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* QUICK OPENING BALANCE ADJUSTMENT MODAL */}
      {isOpeningBalanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100 relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsOpeningBalanceModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-inner">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">Opening Balance</h3>
                <p className="text-xs font-semibold text-slate-500">Update initial cash/bank balance</p>
              </div>
            </div>
            <form onSubmit={handleSaveOpeningBalance} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Amount</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-slate-500 font-bold">{businessSettings?.currency || 'BDT'}</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={openingBalanceInput}
                    onChange={(e) => setOpeningBalanceInput(e.target.value)}
                    className="block w-full pl-14 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-md shadow-purple-500/20 transition-all hover:shadow-lg hover:shadow-purple-500/30 active:scale-[0.98]"
              >
                Save Balance
              </button>
            </form>
          </div>
        </div>
      )}

      {/* QUICK EXPENSE ENTRY MODAL */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Add Shop Expense</h3>
                  <p className="text-xs text-slate-500">Record shop bills, staff salary, tea, or daily expenditures</p>
                </div>
              </div>
              <button 
                onClick={() => setIsExpenseModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="mt-4 space-y-4">
              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Expense Category *
                </label>
                <select
                  value={expenseCategory}
                  onChange={e => setExpenseCategory(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                >
                  {DASHBOARD_EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="custom">+ Other / Custom Category...</option>
                </select>
              </div>

              {expenseCategory === 'custom' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Custom Category Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Shop Renovation, Festival Gift..."
                    value={customExpenseCategory}
                    onChange={e => setCustomExpenseCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>
              )}

              {/* Amount and Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Amount (৳) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">৳</span>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={expenseAmount}
                      onChange={e => setExpenseAmount(e.target.value)}
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={e => setExpenseDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Payment Method and Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={expensePaymentMethod}
                    onChange={e => setExpensePaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  >
                    <option value="Cash">Cash</option>
                    <option value="bKash">bKash</option>
                    <option value="Nagad">Nagad</option>
                    <option value="Rocket">Rocket</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Voucher / Memo No. (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. VCH-102"
                    value={expenseReference}
                    onChange={e => setExpenseReference(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description / Note
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Shop electricity bill, refreshments, maintenance..."
                  value={expenseDescription}
                  onChange={e => setExpenseDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              {/* Recent Recorded Expenses list */}
              {expenses.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Recent Expenses ({expenses.length})
                    </span>
                    <Link
                      to="/expenses"
                      onClick={() => setIsExpenseModalOpen(false)}
                      className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold hover:underline flex items-center gap-0.5"
                    >
                      <span>Manage All</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {expenses.slice(0, 3).map(exp => (
                      <div key={exp.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                        <div className="min-w-0 pr-2">
                          <p className="font-semibold text-slate-800 truncate">{exp.category}</p>
                          <p className="text-[10px] text-slate-400">
                            {exp.date ? format(parseISO(exp.date), 'dd MMM yyyy') : ''} • {exp.payment_method || 'Cash'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-rose-600">৳{formatCurrency(exp.amount)}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteExpenseQuick(exp.id)}
                            title="Delete"
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expected Profit Analytics Modal */}
      {isExpectedProfitModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-teal-500 text-white flex items-center justify-center shadow-xs">
                  <Coins className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Expected Profit Breakdown
                  </h3>
                  <p className="text-xs text-slate-500">
                    Projected gross margin based on current stock retail value vs purchase cost
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsExpectedProfitModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 4 Summary Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] font-bold text-slate-500 uppercase">Stock Cost</p>
                <p className="text-base font-black text-slate-900 mt-1">৳{formatCurrency(stockCostValue)}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{totalProductsCount} Products</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-100">
                <p className="text-[11px] font-bold text-blue-700 uppercase">Retail Value</p>
                <p className="text-base font-black text-blue-900 mt-1">৳{formatCurrency(stockRetailValue)}</p>
                <p className="text-[10px] text-blue-600 mt-0.5">{totalStockQuantity} Total Units</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-100">
                <p className="text-[11px] font-bold text-teal-700 uppercase">Expected Profit</p>
                <p className="text-base font-black text-teal-900 mt-1">৳{formatCurrency(expectedProfit)}</p>
                <p className="text-[10px] text-teal-600 mt-0.5">Potential Gross</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                <p className="text-[11px] font-bold text-emerald-700 uppercase">Profit Margin</p>
                <p className="text-base font-black text-emerald-900 mt-1">{expectedMarginPercent}%</p>
                <p className="text-[10px] text-emerald-600 mt-0.5">Return on Resale</p>
              </div>
            </div>

            {/* Top Profit Contributors in Stock */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Top Expected Profit Products
                </h4>
                <Link
                  to="/inventory"
                  onClick={() => setIsExpectedProfitModalOpen(false)}
                  className="text-xs font-bold text-teal-600 hover:text-teal-800 flex items-center gap-1 hover:underline"
                >
                  <span>Go to Inventory</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {topProfitInventoryItems.length === 0 ? (
                <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
                  <Box className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-semibold">No stock available currently.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {topProfitInventoryItems.slice(0, 10).map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-100 flex items-center justify-between gap-3 text-xs transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-400 text-xs shrink-0">
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">{item.name}</p>
                          <p className="text-[11px] text-slate-500">
                            {item.quantity} in stock • Cost: ৳{formatCurrency(item.cost_price)} → Sale: ৳{formatCurrency(item.retail_price)}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-extrabold text-teal-700 text-sm">
                          +৳{formatCurrency(item.total_expected_profit)}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          ৳{formatCurrency(item.profit_per_unit)}/unit
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsExpectedProfitModalOpen(false)}
                className="px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Loan Modal */}
      {isQuickLoanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Add New Loan
                  </h3>
                  <p className="text-xs text-slate-500">Record bank loan, microcredit, or personal liabilities</p>
                </div>
              </div>
              <button
                onClick={() => setIsQuickLoanModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickLoan} className="mt-4 space-y-4">
              {/* Primary Required Fields */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Loan Provider Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BRAC Bank, Sonali Bank, Karim Mia"
                  value={quickLoanLender}
                  onChange={e => {
                    const name = e.target.value;
                    setQuickLoanLender(name);
                    if (!quickLoanTitle) {
                      setQuickLoanTitle(`${name} Loan`);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Loan Amount (৳) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">৳</span>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    placeholder="e.g. 100000"
                    value={quickLoanPrincipal}
                    onChange={e => {
                      const p = e.target.value;
                      setQuickLoanPrincipal(p);
                      const pNum = parseFloat(p) || 0;
                      const rNum = parseFloat(quickLoanInterest) || 0;
                      const tot = pNum + (pNum * rNum / 100);
                      setQuickLoanTotalPayable(tot > 0 ? tot.toString() : '');
                    }}
                    className="w-full pl-8 pr-3.5 py-2.5 text-sm font-extrabold text-indigo-900 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Details / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional details, purpose, or repayment terms..."
                  value={quickLoanNotes}
                  onChange={e => setQuickLoanNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                />
              </div>

              {/* Advanced Fields Toggle */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdvancedQuickLoan(!showAdvancedQuickLoan)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-indigo-50/80 transition-colors cursor-pointer"
                >
                  <span>{showAdvancedQuickLoan ? '– Hide Advanced Options' : '+ More Options (Dates, Interest, Installments)'}</span>
                </button>
              </div>

              {/* Collapsible Advanced Options */}
              {showAdvancedQuickLoan && (
                <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-3.5 animate-in fade-in duration-150">
                  {/* Provider Type & Purpose Title */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Provider Type
                      </label>
                      <select
                        value={quickLoanType}
                        onChange={e => setQuickLoanType(e.target.value as Loan['provider_type'])}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-medium bg-white"
                      >
                        <option value="bank">Commercial Bank</option>
                        <option value="ngo">NGO / Microfinance</option>
                        <option value="personal">Personal / Relative</option>
                        <option value="sme">SME Loan</option>
                        <option value="other">Other Liability</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Loan Title / Purpose
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Working Capital, Shop Expansion"
                        value={quickLoanTitle}
                        onChange={e => setQuickLoanTitle(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                      />
                    </div>
                  </div>

                  {/* Interest % & Total Payable */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Interest Rate (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0"
                          value={quickLoanInterest}
                          onChange={e => {
                            const r = e.target.value;
                            setQuickLoanInterest(r);
                            const pNum = parseFloat(quickLoanPrincipal) || 0;
                            const rNum = parseFloat(r) || 0;
                            const tot = pNum + (pNum * rNum / 100);
                            setQuickLoanTotalPayable(tot > 0 ? tot.toString() : '');
                          }}
                          className="w-full pr-7 pl-3 py-2 text-xs font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Total Payable (৳)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-500">৳</span>
                        <input
                          type="number"
                          step="any"
                          placeholder="Equal to Principal"
                          value={quickLoanTotalPayable}
                          onChange={e => setQuickLoanTotalPayable(e.target.value)}
                          className="w-full pl-7 pr-2 py-2 text-xs font-extrabold text-indigo-900 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Disbursement Date
                      </label>
                      <input
                        type="date"
                        value={quickLoanDisbursementDate}
                        onChange={e => setQuickLoanDisbursementDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Due / Maturity Date
                      </label>
                      <input
                        type="date"
                        value={quickLoanDueDate}
                        onChange={e => setQuickLoanDueDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                      />
                    </div>
                  </div>

                  {/* Installment Amount */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Monthly Installment (৳)
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 5000"
                      value={quickLoanInstallment}
                      onChange={e => setQuickLoanInstallment(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                    />
                  </div>

                  {/* Phone & Account Voucher */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Contact Phone
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 017xxxxxxxx"
                        value={quickLoanPhone}
                        onChange={e => setQuickLoanPhone(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Account / Memo No.
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. AC-9901, Cheque #442"
                        value={quickLoanVoucher}
                        onChange={e => setQuickLoanVoucher(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQuickLoanModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Save Loan Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expected Profit & Inventory Valuation Modal */}
      {isExpectedProfitModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-teal-100 animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-500 text-white flex items-center justify-center shadow-xs">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Expected Profit & Stock Valuation</h3>
                  <p className="text-xs text-slate-500 font-medium">Inventory-wide resale margin and stock wholesale valuation</p>
                </div>
              </div>
              <button
                onClick={() => setIsExpectedProfitModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-2xl">
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Stock Cost Value</span>
                  <span className="text-lg font-black text-blue-950">৳{formatCurrency(stockCostValue)}</span>
                  <span className="text-[10px] text-blue-700/80 block mt-0.5">{totalStockQuantity} units in stock</span>
                </div>

                <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Stock Retail Value</span>
                  <span className="text-lg font-black text-emerald-950">৳{formatCurrency(stockRetailValue)}</span>
                  <span className="text-[10px] text-emerald-700/80 block mt-0.5">{totalProductsCount} unique products</span>
                </div>

                <div className="p-3.5 bg-teal-50/80 border border-teal-200 rounded-2xl">
                  <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider block">Expected Profit</span>
                  <span className="text-lg font-black text-teal-900">৳{formatCurrency(expectedProfit)}</span>
                  <span className="text-[10px] font-bold text-teal-700 block mt-0.5">{expectedMarginPercent}% Margin</span>
                </div>
              </div>

              {/* Product wise breakdown table */}
              <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
                <div className="bg-slate-50/90 px-4 py-2.5 border-b border-slate-200/80 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Top Profit Items In Stock</span>
                  <span className="text-[10px] text-slate-500 font-medium">Sorted by expected profit contribution</span>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                  {topProfitInventoryItems.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No stock items available in inventory.
                    </div>
                  ) : (
                    topProfitInventoryItems.map((item) => (
                      <div key={item.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors text-xs">
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 font-bold flex items-center justify-center shrink-0 border border-teal-100">
                            {item.quantity}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-900 truncate">{item.name}</h4>
                            <p className="text-[11px] text-slate-500">
                              Cost: ৳{formatCurrency(item.cost_price)} · Retail: ৳{formatCurrency(item.retail_price)} · <span className="text-teal-700 font-medium">+৳{formatCurrency(item.profit_per_unit)}/unit</span>
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-black text-teal-700 text-sm block">
                            +৳{formatCurrency(item.total_expected_profit)}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Valuation: ৳{formatCurrency(item.quantity * item.cost_price)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-5 flex items-center justify-between pt-3 border-t border-slate-100 shrink-0">
              <Link
                to="/inventory"
                onClick={() => setIsExpectedProfitModalOpen(false)}
                className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1.5 hover:underline"
              >
                <span>Open Inventory Full View</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => setIsExpectedProfitModalOpen(false)}
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Current Balance Breakdown Modal */}
      {isBalanceBreakdownModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-purple-100 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Current Balance Breakdown</h3>
                  <p className="text-xs text-slate-500 font-medium">Calculation details of current cash balance</p>
                </div>
              </div>
              <button
                onClick={() => setIsBalanceBreakdownModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {/* Formula explanation box */}
              <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-2xl text-xs text-purple-900 font-medium leading-relaxed">
                <span className="font-bold text-purple-950">Calculation Rule: </span>
                Total Current Balance reflects real Cash & Bank in Hand. Unpaid customer dues are excluded, and automatically added whenever a customer due is collected.
              </div>

              {/* Mathematical List */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 divide-y divide-slate-200/70 text-xs font-semibold">
                {/* 1. Opening Balance */}
                <div className="pb-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                    <span className="text-slate-700">Opening Balance</span>
                  </div>
                  <span className="font-bold text-emerald-600">+ ৳{formatCurrency(openingBalance)}</span>
                </div>

                {/* 1.5 Capital Investments */}
                {capitalInvestment > 0 && (
                  <div className="py-2.5 flex items-center justify-between bg-blue-50/50 -mx-4 px-4 my-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                      <span className="text-blue-950 font-bold">Capital Investments</span>
                    </div>
                    <span className="font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
                      + ৳{formatCurrency(capitalInvestment)}
                    </span>
                  </div>
                )}

                {/* 2. Sales Cash Collected */}
                <div className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <div>
                      <span className="text-slate-700 font-bold block">Sales Cash Collected</span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        Total Invoiced: ৳{formatCurrency(totalSalesAmount)} {totalCustomerDue > 0 ? `(Unpaid Due: -৳${formatCurrency(totalCustomerDue)})` : ''}
                      </span>
                    </div>
                  </div>
                  <span className="font-bold text-emerald-600">+ ৳{formatCurrency(totalSalesCashCollected)}</span>
                </div>

                {/* 3. Loan Funds Received */}
                {totalLoanReceived > 0 && (
                  <div className="py-2.5 flex items-center justify-between bg-purple-50/50 -mx-4 px-4 my-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                      <span className="text-purple-950 font-bold">Loan Funds Received</span>
                    </div>
                    <span className="font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                      + ৳{formatCurrency(totalLoanReceived)}
                    </span>
                  </div>
                )}

                {/* 4. Total Purchases */}
                <div className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <div>
                      <span className="text-slate-700 font-bold block">Purchases Paid (Cash)</span>
                      {supplierTotalDue > 0 && (
                        <span className="text-[10px] text-slate-500 font-normal">
                          Total: ৳{formatCurrency(totalPurchasesAmount)} (Supplier Due: ৳{formatCurrency(supplierTotalDue)})
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="font-bold text-rose-600">- ৳{formatCurrency(totalPurchasesCashPaid)}</span>
                </div>

                {/* 5. Total Expense Cost */}
                <div className="py-2.5 flex items-center justify-between bg-rose-50/50 -mx-4 px-4 my-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    <span className="text-rose-950 font-bold">Total Expense Cost</span>
                  </div>
                  <span className="font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">
                    - ৳{formatCurrency(totalExpensesAmount)}
                  </span>
                </div>

                {/* 6. Loan Repayments Paid */}
                {totalLoanPaid > 0 && (
                  <div className="py-2.5 flex items-center justify-between bg-amber-50/50 -mx-4 px-4 my-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      <span className="text-amber-950 font-bold">Loan Repayments Paid</span>
                    </div>
                    <span className="font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                      - ৳{formatCurrency(totalLoanPaid)}
                    </span>
                  </div>
                )}

                {/* Net Total Current Balance */}
                <div className="pt-3 flex items-center justify-between text-sm">
                  <span className="font-extrabold text-slate-900">Total Current Balance</span>
                  <span className="font-black text-purple-700 text-base">
                    = ৳{formatCurrency(totalCurrentBalance)}
                  </span>
                </div>
              </div>

              {/* Status Note */}
              <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Total Expense System Synced</span>
                </span>
                <Link
                  to="/expenses"
                  onClick={() => setIsBalanceBreakdownModalOpen(false)}
                  className="font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1 hover:underline"
                >
                  <span>Manage Expenses</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-5 flex items-center justify-end">
              <button
                onClick={() => setIsBalanceBreakdownModalOpen(false)}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Total Cash (Owner) Breakdown Modal */}
      {isOwnerCashModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-indigo-100 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Total Cash (Owner) Breakdown</h3>
                  <p className="text-xs text-slate-500 font-medium">Calculation details of net business valuation & capital</p>
                </div>
              </div>
              <button
                onClick={() => setIsOwnerCashModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {/* Formula explanation banner */}
              <div className="p-3 bg-indigo-50/80 border border-indigo-100 rounded-2xl text-center">
                <p className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider mb-0.5">Calculation Formula</p>
                <p className="text-xs font-black text-indigo-950">
                  Customer Due + Total Current Balance + Stock Cost Value - Total Loan / Liability
                </p>
              </div>

              {/* Mathematical List */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 divide-y divide-slate-200/70 text-xs font-semibold space-y-2.5">
                {/* 1. Customer Due */}
                <div className="pb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">+</span>
                    <div>
                      <span className="text-slate-800 font-bold block">Customer Due</span>
                      <span className="text-[10px] text-slate-400 font-normal">Receivable from customers</span>
                    </div>
                  </div>
                  <span className="font-extrabold text-amber-700 text-sm">+ ৳{formatCurrency(totalCustomerDue)}</span>
                </div>

                {/* 2. Total Current Balance */}
                <div className="py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">+</span>
                    <div>
                      <span className="text-slate-800 font-bold block">Total Current Balance</span>
                      <span className="text-[10px] text-slate-400 font-normal">Liquid cash & bank in hand</span>
                    </div>
                  </div>
                  <span className="font-extrabold text-purple-700 text-sm">+ ৳{formatCurrency(totalCurrentBalance)}</span>
                </div>

                {/* 3. Stock Cost Value */}
                <div className="py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">+</span>
                    <div>
                      <span className="text-slate-800 font-bold block">Stock Cost Value</span>
                      <span className="text-[10px] text-slate-400 font-normal">Total wholesale value of current inventory</span>
                    </div>
                  </div>
                  <span className="font-extrabold text-blue-700 text-sm">+ ৳{formatCurrency(stockCostValue)}</span>
                </div>

                {/* 4. Total Loan / Liability */}
                <div className="py-2 flex items-center justify-between bg-rose-50/60 -mx-4 px-4 my-1">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs">−</span>
                    <div>
                      <span className="text-rose-950 font-bold block">Total Loan / Liability</span>
                      <span className="text-[10px] text-rose-600 font-normal">Outstanding debt balance</span>
                    </div>
                  </div>
                  <span className="font-extrabold text-rose-700 text-sm">- ৳{formatCurrency(totalOutstandingLoan)}</span>
                </div>

                {/* Net Total Cash (Owner) */}
                <div className="pt-3 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-extrabold text-slate-900 block">Total Cash (Owner)</span>
                    <span className="text-[10px] text-indigo-600 font-semibold">Net Owner Equity</span>
                  </div>
                  <span className="font-black text-indigo-700 text-lg">
                    = ৳{formatCurrency(totalOwnerCash)}
                  </span>
                </div>
              </div>

              {/* Status Note */}
              <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                <span className="flex items-center gap-1.5 text-indigo-700 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  <span>Real-time Financial Equity</span>
                </span>
                <span className="text-[11px] font-medium text-slate-400">
                  Auto-updated
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-5 flex items-center justify-end">
              <button
                onClick={() => setIsOwnerCashModalOpen(false)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
