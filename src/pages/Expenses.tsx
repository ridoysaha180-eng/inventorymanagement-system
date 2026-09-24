import React, { useState, useEffect, useMemo } from 'react';
import { 
  Receipt, Plus, Search, Calendar, Download, Trash2, Edit2, 
  X, Filter, DollarSign, Wallet, TrendingDown, Tag, ArrowUpDown, 
  CheckCircle2, FileSpreadsheet, RefreshCw, AlertCircle, Eye, FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, isToday, isThisMonth, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { formatCurrency, cn } from '../utils';
import { storageService } from '../services/storageService';
import { Expense } from '../types';

export const EXPENSE_CATEGORIES = [
  'Shop Rent',
  'Electricity & Utilities',
  'Staff Salary & Allowance',
  'Tea & Refreshments',
  'Transportation & Delivery',
  'Packaging & Bags',
  'Repair & Maintenance',
  'Internet & Mobile',
  'Stationery & Printing',
  'Cleaning & Sanitation',
  'Advance & Security',
  'Miscellaneous / Other'
];

export const PAYMENT_METHODS = [
  'Cash',
  'bKash',
  'Nagad',
  'Rocket',
  'Bank Transfer',
  'Other'
];

export const Expenses: React.FC = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'today' | 'month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Main Expense Add/Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id?: string }>({ isOpen: false });

  // Expense Category Management Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [editCatModal, setEditCatModal] = useState<{ isOpen: boolean; oldName: string; newName: string }>({
    isOpen: false,
    oldName: '',
    newName: ''
  });
  const [deleteCatModal, setDeleteCatModal] = useState<{ isOpen: boolean; name: string; count: number }>({
    isOpen: false,
    name: '',
    count: 0
  });

  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    category: '',
    customCategory: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    payment_method: PAYMENT_METHODS[0],
    description: '',
    reference_no: ''
  });

  const loadData = () => {
    setExpenses(storageService.getExpenses());
    const loadedCats = storageService.getExpenseCategories();
    setCategories(loadedCats);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);
    window.addEventListener('bizflow_expenses_updated', loadData);
    window.addEventListener('bizflow_expense_categories_updated', loadData);
    return () => {
      window.removeEventListener('storage', loadData);
      window.removeEventListener('bizflow_expenses_updated', loadData);
      window.removeEventListener('bizflow_expense_categories_updated', loadData);
    };
  }, []);

  const openAddModal = () => {
    setEditingExpense(null);
    const availableCats = storageService.getExpenseCategories();
    setFormData({
      category: availableCats[0] || 'Miscellaneous / Other',
      customCategory: '',
      amount: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      payment_method: PAYMENT_METHODS[0],
      description: '',
      reference_no: ''
    });
    setIsModalOpen(true);
  };

  useEffect(() => {
    const shouldOpenAdd = 
      (location.state as { openAdd?: boolean } | null)?.openAdd || 
      searchParams.get('action') === 'add' || 
      searchParams.get('add') === 'true';

    if (shouldOpenAdd) {
      openAddModal();

      if (searchParams.get('action') === 'add' || searchParams.get('add') === 'true') {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('action');
        nextParams.delete('add');
        setSearchParams(nextParams, { replace: true });
      }

      if ((location.state as { openAdd?: boolean } | null)?.openAdd) {
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, searchParams]);

  const openEditModal = (exp: Expense) => {
    setEditingExpense(exp);
    const availableCats = storageService.getExpenseCategories();
    const isKnownCategory = availableCats.includes(exp.category);
    setFormData({
      category: isKnownCategory ? exp.category : 'custom',
      customCategory: isKnownCategory ? '' : exp.category,
      amount: String(exp.amount),
      date: exp.date ? format(parseISO(exp.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      payment_method: exp.payment_method || PAYMENT_METHODS[0],
      description: exp.description || '',
      reference_no: exp.reference_no || ''
    });
    setIsModalOpen(true);
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryInput.trim()) return;
    storageService.addExpenseCategory(newCategoryInput.trim());
    setNewCategoryInput('');
    loadData();
  };

  const handleSaveCategoryRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCatModal.newName.trim()) return;
    storageService.renameExpenseCategory(editCatModal.oldName, editCatModal.newName.trim());
    setEditCatModal({ isOpen: false, oldName: '', newName: '' });
    loadData();
  };

  const handleConfirmDeleteCategory = () => {
    if (deleteCatModal.name) {
      storageService.deleteExpenseCategory(deleteCatModal.name);
      setDeleteCatModal({ isOpen: false, name: '', count: 0 });
      loadData();
    }
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(formData.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid expense amount.');
      return;
    }

    const finalCategory = formData.category === 'custom' 
      ? (formData.customCategory.trim() || 'Miscellaneous') 
      : formData.category;

    if (editingExpense) {
      const updated: Expense = {
        ...editingExpense,
        category: finalCategory,
        amount: amountNum,
        date: formData.date,
        payment_method: formData.payment_method,
        description: formData.description.trim(),
        reference_no: formData.reference_no.trim()
      };
      storageService.updateExpense(editingExpense.id, updated);
    } else {
      const newExp: Expense = {
        id: 'exp_' + Math.random().toString(36).substring(2, 9),
        user_id: 'default',
        category: finalCategory,
        amount: amountNum,
        date: formData.date,
        created_at: new Date().toISOString(),
        payment_method: formData.payment_method,
        description: formData.description.trim(),
        reference_no: formData.reference_no.trim()
      };
      storageService.addExpense(newExp);
    }

    setIsModalOpen(false);
    loadData();
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await storageService.deleteExpense(id);
      loadData();
    } catch (error) {
      console.error('Delete expense error:', error);
    }
    setDeleteConfirm({ isOpen: false });
  };

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      // Search
      const search = searchTerm.toLowerCase();
      const matchSearch = !search || 
        exp.category.toLowerCase().includes(search) ||
        (exp.description && exp.description.toLowerCase().includes(search)) ||
        (exp.reference_no && exp.reference_no.toLowerCase().includes(search));

      if (!matchSearch) return false;

      // Category filter
      if (categoryFilter !== 'all' && exp.category !== categoryFilter) {
        return false;
      }

      // Payment filter
      if (paymentFilter !== 'all' && exp.payment_method !== paymentFilter) {
        return false;
      }

      // Date filter
      if (dateRangeFilter === 'today') {
        const d = parseISO(exp.date || exp.created_at);
        if (!isToday(d)) return false;
      } else if (dateRangeFilter === 'month') {
        const d = parseISO(exp.date || exp.created_at);
        if (!isThisMonth(d)) return false;
      } else if (dateRangeFilter === 'custom' && customStartDate && customEndDate) {
        const d = parseISO(exp.date || exp.created_at);
        const start = startOfDay(parseISO(customStartDate));
        const end = endOfDay(parseISO(customEndDate));
        if (!isWithinInterval(d, { start, end })) return false;
      }

      return true;
    });
  }, [expenses, searchTerm, categoryFilter, paymentFilter, dateRangeFilter, customStartDate, customEndDate]);

  // Key metrics
  const totalFilteredAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  const todayAmount = useMemo(() => {
    return expenses
      .filter(e => isToday(parseISO(e.date || e.created_at)))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const thisMonthAmount = useMemo(() => {
    return expenses
      .filter(e => isThisMonth(parseISO(e.date || e.created_at)))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const allTimeAmount = useMemo(() => {
    return expenses.reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredExpenses.length === 0) {
      alert('No expense records to export.');
      return;
    }

    const exportData = filteredExpenses.map((e, index) => ({
      'SL': index + 1,
      'Date': e.date || e.created_at.slice(0, 10),
      'Category': e.category,
      'Description / Note': e.description || '-',
      'Payment Method': e.payment_method || 'Cash',
      'Reference / Voucher': e.reference_no || '-',
      'Amount (BDT)': e.amount
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses');
    XLSX.writeFile(workbook, `Expenses_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  // Export to PDF
  const handleExportPDF = () => {
    if (filteredExpenses.length === 0) {
      alert('No expense records to export.');
      return;
    }

    const doc = new jsPDF();
    
    // Add Header
    doc.setFontSize(18);
    doc.text('Expense Report', 14, 22);
    
    doc.setFontSize(10);
    doc.text(`Generated on: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, 14, 30);
    
    // Table
    const tableData = filteredExpenses.map((e, index) => [
      index + 1,
      e.date ? format(parseISO(e.date), 'dd MMM yyyy') : format(parseISO(e.created_at), 'dd MMM yyyy'),
      e.category,
      e.description || '-',
      e.payment_method || 'Cash',
      `BDT ${formatCurrency(e.amount)}`
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['#', 'Date', 'Category', 'Description', 'Method', 'Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [244, 63, 94] },
      styles: { fontSize: 8 },
      foot: [['', '', '', '', 'Total Filtered:', `BDT ${formatCurrency(totalFilteredAmount)}`]],
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' }
    });

    doc.save(`Expenses_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner (PRODUCT LIST & DETAILS Style) */}
      <div className="relative py-6 px-6 bg-gradient-to-b from-slate-50/90 via-white to-slate-50/40 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center text-center overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-500 to-indigo-500" />

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-wider uppercase font-['Outfit',sans-serif]">
          EXPENSE MANAGEMENT
        </h1>

        <p className="text-sm sm:text-base font-medium text-slate-500 mt-2 max-w-xl leading-relaxed">
          Record, Categorize & Track Daily Shop Expenditures & Operational Costs
        </p>

        {/* Action Buttons in Header */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Button
            variant="outline"
            onClick={handleExportPDF}
            className="bg-white hover:bg-slate-50 text-rose-700 font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl border border-rose-200 shadow-xs inline-flex items-center gap-2 cursor-pointer transition-all"
          >
            <FileText className="w-4 h-4 text-rose-500" />
            <span>Export PDF</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => setIsCategoryModalOpen(true)}
            className="bg-white hover:bg-slate-50 text-emerald-700 font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl border border-emerald-200 shadow-xs inline-flex items-center gap-2 cursor-pointer transition-all"
          >
            <Tag className="w-4 h-4 text-emerald-600" />
            <span>Category Management</span>
          </Button>

          <Button
            onClick={openAddModal}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-xs inline-flex items-center gap-2 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add New Expense</span>
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Today's Expense</p>
          <p className="text-2xl font-bold text-slate-900">৳{formatCurrency(todayAmount)}</p>
          <p className="text-xs text-slate-400 mt-1">Recorded for today</p>
        </Card>

        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">This Month</p>
          <p className="text-2xl font-bold text-slate-900">৳{formatCurrency(thisMonthAmount)}</p>
          <p className="text-xs text-slate-400 mt-1">{format(new Date(), 'MMMM yyyy')}</p>
        </Card>

        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total All-Time</p>
          <p className="text-2xl font-bold text-slate-900">৳{formatCurrency(allTimeAmount)}</p>
          <p className="text-xs text-slate-400 mt-1">{expenses.length} Total entries</p>
        </Card>

        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Filtered Total</p>
          <p className="text-2xl font-bold text-amber-600">৳{formatCurrency(totalFilteredAmount)}</p>
          <p className="text-xs text-slate-400 mt-1">{filteredExpenses.length} Filtered entries</p>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 rounded-2xl border-slate-200/80 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by description or category..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-700 font-medium bg-white"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <select
              value={paymentFilter}
              onChange={e => setPaymentFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-700 font-medium bg-white"
            >
              <option value="all">All Payment Methods</option>
              {PAYMENT_METHODS.map(pm => (
                <option key={pm} value={pm}>{pm}</option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div>
            <select
              value={dateRangeFilter}
              onChange={e => setDateRangeFilter(e.target.value as any)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-700 font-medium bg-white"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>
        </div>

        {dateRangeFilter === 'custom' && (
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100 animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">From:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-rose-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>
        )}
      </Card>

      {/* Expenses Table */}
      <Card className="rounded-2xl border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-bold uppercase text-[11px] tracking-wider">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">DATE</th>
                <th className="py-3 px-4">CATEGORY</th>
                <th className="py-3 px-4">DESCRIPTION / NOTE</th>
                <th className="py-3 px-4">PAYMENT METHOD</th>
                <th className="py-3 px-4">REF / VOUCHER</th>
                <th className="py-3 px-4 text-right">AMOUNT</th>
                <th className="py-3 px-4 text-center">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400 font-medium">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Receipt className="w-10 h-10 text-slate-300 stroke-[1.5]" />
                      <p>No expense records found</p>
                      <Button
                        onClick={openAddModal}
                        className="mt-2 text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl"
                      >
                        + Add First Expense
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp, index) => {
                  const cleanCategory = (exp.category || '').replace(/\s*\([\u0980-\u09FF\s]+\)/g, '').replace(/[\u0980-\u09FF]/g, '').trim() || 'Miscellaneous';
                  const cleanPayment = (exp.payment_method || 'Cash').replace(/\s*\([\u0980-\u09FF\s]+\)/g, '').replace(/[\u0980-\u09FF]/g, '').trim() || 'Cash';
                  const cleanDescription = (exp.description || '').replace(/\s*\([\u0980-\u09FF\s]+\)/g, '').replace(/[\u0980-\u09FF]/g, '').trim();

                  return (
                    <tr key={exp.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-center font-mono text-slate-400 text-[11px]">
                        {String(index + 1).padStart(3, '0')}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium whitespace-nowrap">
                        {exp.date ? format(parseISO(exp.date), 'dd MMM yyyy') : format(parseISO(exp.created_at), 'dd MMM yyyy')}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-100/80 font-semibold text-[11px]">
                          <Tag className="w-3 h-3 text-rose-500" />
                          <span>{cleanCategory}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate font-medium">
                        {cleanDescription || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium">
                          {cleanPayment}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {exp.reference_no || '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 text-sm whitespace-nowrap">
                        ৳{formatCurrency(exp.amount)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewingExpense(exp)}
                            title="View Expense"
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openEditModal(exp)}
                            title="Edit Expense"
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ isOpen: true, id: exp.id })}
                            title="Delete Expense"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredExpenses.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-900">
                  <td colSpan={6} className="py-3 px-4 text-right text-xs">
                    Total Filtered Expenses:
                  </td>
                  <td className="py-3 px-4 text-right text-rose-600 font-extrabold text-sm whitespace-nowrap">
                    ৳{formatCurrency(totalFilteredAmount)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* Add / Edit Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {editingExpense ? 'Edit Expense' : 'Add New Expense'}
                  </h3>
                  <p className="text-xs text-slate-500">Record shop expenditure and operational costs</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="mt-4 space-y-4">
              {/* Category */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Expense Category *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(true)}
                    className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <Tag className="w-3 h-3" />
                    <span>Manage Categories</span>
                  </button>
                </div>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="custom">+ Other / Custom Category...</option>
                </select>
              </div>

              {formData.category === 'custom' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Custom Category Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Renovation, Festival bonus..."
                    value={formData.customCategory}
                    onChange={e => setFormData({ ...formData, customCategory: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>
              )}

              {/* Amount & Date */}
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
                      value={formData.amount}
                      onChange={e => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Expense Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Payment Method & Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={formData.payment_method}
                    onChange={e => setFormData({ ...formData, payment_method: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  >
                    {PAYMENT_METHODS.map(pm => (
                      <option key={pm} value={pm}>{pm}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Reference / Voucher No.
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. VCH-0012, Memo #"
                    value={formData.reference_no}
                    onChange={e => setFormData({ ...formData, reference_no: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Details about this expense (e.g. Shop electricity bill, refreshments...)"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs px-5"
                >
                  {editingExpense ? 'Update Expense' : 'Save Expense'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Delete Expense?</h3>
            <p className="text-xs text-slate-500 mt-1">
              Are you sure you want to delete this expense record? It will be moved to the Recycle Bin and can be restored anytime.
            </p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm({ isOpen: false })}
                className="rounded-xl text-xs font-semibold px-4"
              >
                Cancel
              </Button>
              <Button
                onClick={() => deleteConfirm.id && handleDeleteExpense(deleteConfirm.id)}
                className="rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white px-4"
              >
                Yes, Delete
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Expense Category Management Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Expense Category Management</h3>
                  <p className="text-xs text-slate-500">Manage categories alongside tracking shop expenditures</p>
                </div>
              </div>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-emerald-600" />
                  <span>Categories ({categories.length})</span>
                </h4>
              </div>

              {/* Add New Category Form */}
              <form onSubmit={handleAddCategory} className="flex gap-2">
                <input
                  type="text"
                  placeholder="New category name..."
                  value={newCategoryInput}
                  onChange={e => setNewCategoryInput(e.target.value)}
                  className="flex-1 h-10 rounded-xl border border-slate-200 px-3.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900"
                />
                <Button
                  type="submit"
                  disabled={!newCategoryInput.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-4 text-xs font-bold rounded-xl shrink-0 cursor-pointer transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Add</span>
                </Button>
              </form>

              {/* Search Categories */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search categories..."
                  value={categorySearch}
                  onChange={e => setCategorySearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900"
                />
              </div>

              {/* Category Items List */}
              <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 max-h-64 overflow-y-auto bg-white shadow-xs">
                {categories
                  .filter(c => c.toLowerCase().includes(categorySearch.toLowerCase()))
                  .length > 0 ? (
                  categories
                    .filter(c => c.toLowerCase().includes(categorySearch.toLowerCase()))
                    .map((catName) => {
                      const count = expenses.filter(e => e.category === catName).length;
                      return (
                        <div key={catName} className="flex items-center justify-between p-3 hover:bg-slate-50/80 transition-colors">
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">{catName}</span>
                            <span className="text-[10px] font-medium text-slate-400">{count} {count === 1 ? 'expense' : 'expenses'} linked</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditCatModal({ isOpen: true, oldName: catName, newName: catName })}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit Category"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteCatModal({ isOpen: true, name: catName, count })}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Category"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <div className="p-8 text-center text-xs text-slate-400">No expense categories found.</div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end p-4 border-t border-slate-100 bg-slate-50/50">
              <Button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="h-9 px-6 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Category Rename Sub-Modal */}
      {editCatModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl border border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Edit Expense Category</h3>
            <p className="text-xs text-slate-500 mb-3">Renaming will update all existing expense records linked to this category.</p>
            <form onSubmit={handleSaveCategoryRename} className="space-y-3">
              <input
                type="text"
                required
                autoFocus
                value={editCatModal.newName}
                onChange={e => setEditCatModal(prev => ({ ...prev, newName: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditCatModal({ isOpen: false, oldName: '', newName: '' })}
                  className="rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-4 cursor-pointer"
                >
                  Save Rename
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Category Sub-Modal */}
      {deleteCatModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Delete Category?</h3>
            <p className="text-xs text-slate-500 mt-1">
              Are you sure you want to delete <span className="font-bold text-slate-800">"{deleteCatModal.name}"</span>?
              {deleteCatModal.count > 0 && ` (${deleteCatModal.count} expense records are currently linked to this category)`}
            </p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <Button
                variant="outline"
                onClick={() => setDeleteCatModal({ isOpen: false, name: '', count: 0 })}
                className="rounded-xl text-xs font-semibold px-4 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmDeleteCategory}
                className="rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white px-4 cursor-pointer"
              >
                Yes, Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* View Expense Modal */}
      {viewingExpense && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100 relative">
            <button
              onClick={() => setViewingExpense(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 mb-5 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Expense Details</h3>
                <p className="text-xs text-slate-500">Full information for this record</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Amount</p>
                <p className="text-2xl font-black text-rose-600">৳{formatCurrency(viewingExpense.amount)}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {viewingExpense.date ? format(parseISO(viewingExpense.date), 'dd MMM yyyy') : format(parseISO(viewingExpense.created_at), 'dd MMM yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Category</p>
                  <p className="text-sm font-semibold text-slate-800 break-words">{viewingExpense.category}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Payment Method</p>
                  <p className="text-sm font-semibold text-slate-800">{viewingExpense.payment_method}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Reference / Voucher</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">{viewingExpense.reference_no || '—'}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Description / Note</p>
                <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap">{viewingExpense.description || '—'}</p>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <Button
                onClick={() => setViewingExpense(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer"
              >
                Close Details
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
