import React, { useState, useEffect, useMemo } from 'react';
import { 
  Landmark, Plus, Search, Download, Trash2, Edit2, 
  X, FileSpreadsheet, Eye, Printer, HandCoins, Building2,
  CheckCircle2, History, Truck, ArrowUpDown, Calendar, DollarSign
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO, isAfter } from 'date-fns';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { formatCurrency, cn } from '../utils';
import { storageService } from '../services/storageService';
import { Loan, LoanRepayment, BusinessSettings } from '../types';

export const PROVIDER_TYPES: { id: Loan['provider_type']; label: string; color: string }[] = [
  { id: 'bank', label: 'Commercial Bank', color: 'blue' },
  { id: 'ngo', label: 'NGO / Microfinance', color: 'emerald' },
  { id: 'personal', label: 'Personal / Relative', color: 'amber' },
  { id: 'business', label: 'SME / Business Loan', color: 'purple' },
  { id: 'other', label: 'Other Liability', color: 'slate' },
];

export const Loans: React.FC = () => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'loans' | 'history'>('loans');

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'due_desc' | 'due_asc' | 'name' | 'recent'>('due_desc');

  // Add / Edit Loan Modal
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [showAdvancedLoanFields, setShowAdvancedLoanFields] = useState(false);

  // Repayment Modal
  const [isRepayModalOpen, setIsRepayModalOpen] = useState(false);
  const [selectedLoanForRepay, setSelectedLoanForRepay] = useState<Loan | null>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayDate, setRepayDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [repayMethod, setRepayMethod] = useState('Cash');
  const [repayReference, setRepayReference] = useState('');
  const [repayNote, setRepayNote] = useState('');

  // Repayment History Drawer / Modal for single loan
  const [historyModalLoan, setHistoryModalLoan] = useState<Loan | null>(null);

  // Printable Receipt Voucher Modal
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedRepaymentReceipt, setSelectedRepaymentReceipt] = useState<{
    loan: Loan;
    repayment: LoanRepayment;
  } | null>(null);

  // Delete Confirmation Modal
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id?: string; title?: string }>({ isOpen: false });

  // Loan Form State
  const [formData, setFormData] = useState({
    title: '',
    provider_type: 'bank' as Loan['provider_type'],
    lender_name: '',
    contact_number: '',
    principal_amount: '',
    interest_rate: '0',
    total_payable: '',
    installment_type: 'monthly' as Loan['installment_type'],
    installment_amount: '',
    disbursement_date: format(new Date(), 'yyyy-MM-dd'),
    due_date: '',
    account_or_voucher: '',
    notes: '',
    status: 'active' as Loan['status']
  });

  const loadData = () => {
    setLoans(storageService.getLoans());
    setBusinessSettings(storageService.getBusinessSettings());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);
    window.addEventListener('bizflow_loans_updated', loadData);
    return () => {
      window.removeEventListener('storage', loadData);
      window.removeEventListener('bizflow_loans_updated', loadData);
    };
  }, []);

  const openAddModal = () => {
    setEditingLoan(null);
    setShowAdvancedLoanFields(false);
    setFormData({
      title: '',
      provider_type: 'bank',
      lender_name: '',
      contact_number: '',
      principal_amount: '',
      interest_rate: '0',
      total_payable: '',
      installment_type: 'monthly',
      installment_amount: '',
      disbursement_date: format(new Date(), 'yyyy-MM-dd'),
      due_date: '',
      account_or_voucher: '',
      notes: '',
      status: 'active'
    });
    setIsLoanModalOpen(true);
  };

  const openEditModal = (loan: Loan) => {
    setEditingLoan(loan);
    setShowAdvancedLoanFields(true);
    setFormData({
      title: loan.title,
      provider_type: loan.provider_type,
      lender_name: loan.lender_name,
      contact_number: loan.contact_number || '',
      principal_amount: String(loan.principal_amount),
      interest_rate: String(loan.interest_rate || 0),
      total_payable: String(loan.total_payable),
      installment_type: loan.installment_type || 'monthly',
      installment_amount: loan.installment_amount ? String(loan.installment_amount) : '',
      disbursement_date: loan.disbursement_date || format(new Date(), 'yyyy-MM-dd'),
      due_date: loan.due_date || '',
      account_or_voucher: loan.account_or_voucher || '',
      notes: loan.notes || '',
      status: loan.status
    });
    setIsLoanModalOpen(true);
  };

  // Auto calculate total payable when principal or interest changes
  const handlePrincipalOrInterestChange = (principalVal: string, interestVal: string) => {
    const p = parseFloat(principalVal) || 0;
    const rate = parseFloat(interestVal) || 0;
    const total = p + (p * (rate / 100));
    setFormData(prev => ({
      ...prev,
      principal_amount: principalVal,
      interest_rate: interestVal,
      total_payable: total > 0 ? String(Math.round(total)) : principalVal
    }));
  };

  const handleSaveLoan = (e: React.FormEvent) => {
    e.preventDefault();
    const principal = parseFloat(formData.principal_amount);
    const payable = parseFloat(formData.total_payable) || principal;

    if (isNaN(principal) || principal <= 0) {
      alert('Please enter a valid loan principal amount.');
      return;
    }

    if (editingLoan) {
      const remaining = Math.max(0, payable - editingLoan.total_paid);
      const updated: Loan = {
        ...editingLoan,
        title: formData.title.trim() || `${formData.lender_name} Loan`,
        provider_type: formData.provider_type,
        lender_name: formData.lender_name.trim(),
        contact_number: formData.contact_number.trim(),
        principal_amount: principal,
        interest_rate: parseFloat(formData.interest_rate) || 0,
        total_payable: payable,
        remaining_amount: remaining,
        disbursement_date: formData.disbursement_date,
        due_date: formData.due_date || undefined,
        installment_type: formData.installment_type,
        installment_amount: parseFloat(formData.installment_amount) || undefined,
        account_or_voucher: formData.account_or_voucher.trim(),
        notes: formData.notes.trim(),
        status: remaining <= 0 ? 'paid' : formData.status
      };
      storageService.updateLoan(editingLoan.id, updated);
    } else {
      const newLoan: Loan = {
        id: 'loan_' + Math.random().toString(36).substring(2, 9),
        user_id: 'default',
        title: formData.title.trim() || `${formData.lender_name} Loan`,
        provider_type: formData.provider_type,
        lender_name: formData.lender_name.trim(),
        contact_number: formData.contact_number.trim(),
        principal_amount: principal,
        interest_rate: parseFloat(formData.interest_rate) || 0,
        total_payable: payable,
        total_paid: 0,
        remaining_amount: payable,
        disbursement_date: formData.disbursement_date,
        due_date: formData.due_date || undefined,
        installment_type: formData.installment_type,
        installment_amount: parseFloat(formData.installment_amount) || undefined,
        status: 'active',
        account_or_voucher: formData.account_or_voucher.trim(),
        notes: formData.notes.trim(),
        created_at: new Date().toISOString(),
        repayments: []
      };
      storageService.addLoan(newLoan);
    }

    setIsLoanModalOpen(false);
    loadData();
  };

  const openRepayModal = (loan: Loan) => {
    setSelectedLoanForRepay(loan);
    setRepayAmount(loan.installment_amount ? String(loan.installment_amount) : String(loan.remaining_amount));
    setRepayDate(format(new Date(), 'yyyy-MM-dd'));
    setRepayMethod('Cash');
    setRepayReference(`LREP-${Date.now().toString().slice(-6)}`);
    setRepayNote('');
    setIsRepayModalOpen(true);
  };

  const handleSaveRepayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanForRepay) return;

    const amt = parseFloat(repayAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid repayment amount.');
      return;
    }

    if (amt > selectedLoanForRepay.remaining_amount) {
      alert(`Repayment amount cannot exceed remaining balance of ৳${formatCurrency(selectedLoanForRepay.remaining_amount)}`);
      return;
    }

    const newRepayment: LoanRepayment = {
      id: 'rep_' + Math.random().toString(36).substring(2, 9),
      loan_id: selectedLoanForRepay.id,
      amount: amt,
      payment_date: repayDate,
      payment_method: repayMethod,
      reference_no: repayReference.trim(),
      note: repayNote.trim(),
      created_at: new Date().toISOString()
    };

    storageService.addLoanRepayment(selectedLoanForRepay.id, newRepayment);
    setIsRepayModalOpen(false);
    loadData();

    // Open Printable Voucher Modal automatically
    const updatedLoan = storageService.getLoans().find(l => l.id === selectedLoanForRepay.id);
    if (updatedLoan) {
      setSelectedRepaymentReceipt({
        loan: updatedLoan,
        repayment: newRepayment
      });
      setIsReceiptModalOpen(true);
    }
  };

  const handleDeleteRepayment = (loanId: string, repaymentId: string) => {
    if (window.confirm('Are you sure you want to delete this repayment record?')) {
      storageService.deleteLoanRepayment(loanId, repaymentId);
      loadData();
      if (historyModalLoan) {
        const updated = storageService.getLoans().find(l => l.id === historyModalLoan.id);
        setHistoryModalLoan(updated || null);
      }
    }
  };

  const handleDeleteLoan = async (loanId: string) => {
    try {
      await storageService.deleteLoan(loanId);
      loadData();
    } catch (error) {
      console.error('Delete loan error:', error);
    }
    setDeleteConfirm({ isOpen: false });
  };

  // Unique list of lenders for filter dropdown
  const uniqueProviders = useMemo(() => {
    const setNames = new Set<string>();
    loans.forEach(l => {
      if (l.lender_name) setNames.add(l.lender_name.trim());
    });
    return Array.from(setNames);
  }, [loans]);

  // Filtered Loans
  const filteredLoans = useMemo(() => {
    return loans.filter(l => {
      // Search
      const searchLower = searchTerm.toLowerCase();
      const matchSearch = 
        !searchTerm ||
        l.title.toLowerCase().includes(searchLower) ||
        l.lender_name.toLowerCase().includes(searchLower) ||
        (l.contact_number && l.contact_number.toLowerCase().includes(searchLower)) ||
        (l.account_or_voucher && l.account_or_voucher.toLowerCase().includes(searchLower)) ||
        (l.notes && l.notes.toLowerCase().includes(searchLower));

      if (!matchSearch) return false;

      // Provider filter
      if (providerFilter !== 'all') {
        if (providerFilter.startsWith('type:')) {
          const pType = providerFilter.replace('type:', '');
          if (l.provider_type !== pType) return false;
        } else {
          if (l.lender_name !== providerFilter) return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'active' && l.status !== 'active') return false;
        if (statusFilter === 'paid' && l.status !== 'paid') return false;
        if (statusFilter === 'has_due' && l.remaining_amount <= 0) return false;
        if (statusFilter === 'overdue') {
          if (l.status === 'paid' || l.remaining_amount <= 0) return false;
          if (!l.due_date) return false;
          return isAfter(new Date(), parseISO(l.due_date));
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'due_desc') return b.remaining_amount - a.remaining_amount;
      if (sortBy === 'due_asc') return a.remaining_amount - b.remaining_amount;
      if (sortBy === 'name') return a.lender_name.localeCompare(b.lender_name);
      if (sortBy === 'recent') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return 0;
    });
  }, [loans, searchTerm, providerFilter, statusFilter, sortBy]);

  // Combined Repayments History
  const allRepaymentsList = useMemo(() => {
    const list: { loan: Loan; repayment: LoanRepayment }[] = [];
    loans.forEach(l => {
      if (l.repayments && l.repayments.length > 0) {
        l.repayments.forEach(r => {
          list.push({ loan: l, repayment: r });
        });
      }
    });
    return list.sort((a, b) => new Date(b.repayment.payment_date || b.repayment.created_at).getTime() - new Date(a.repayment.payment_date || a.repayment.created_at).getTime());
  }, [loans]);

  const filteredHistoryList = useMemo(() => {
    if (!searchTerm) return allRepaymentsList;
    const term = searchTerm.toLowerCase();
    return allRepaymentsList.filter(({ loan, repayment }) => 
      loan.lender_name.toLowerCase().includes(term) ||
      loan.title.toLowerCase().includes(term) ||
      (repayment.reference_no && repayment.reference_no.toLowerCase().includes(term)) ||
      (repayment.payment_method && repayment.payment_method.toLowerCase().includes(term)) ||
      (repayment.note && repayment.note.toLowerCase().includes(term))
    );
  }, [allRepaymentsList, searchTerm]);

  // Overall Financial Totals
  const totalPrincipal = useMemo(() => loans.reduce((sum, l) => sum + l.principal_amount, 0), [loans]);
  const totalPayable = useMemo(() => loans.reduce((sum, l) => sum + l.total_payable, 0), [loans]);
  const totalPaid = useMemo(() => loans.reduce((sum, l) => sum + l.total_paid, 0), [loans]);
  const totalRemaining = useMemo(() => loans.reduce((sum, l) => sum + l.remaining_amount, 0), [loans]);
  const activeLoansCount = useMemo(() => loans.filter(l => l.remaining_amount > 0).length, [loans]);
  const overallRepaidPercent = totalPayable > 0 ? Math.round((totalPaid / totalPayable) * 100) : 0;

  // Export Excel
  const handleExportExcel = () => {
    if (loans.length === 0) {
      alert('No loan records to export.');
      return;
    }

    const exportData = loans.map((l, index) => ({
      'SL': index + 1,
      'Loan Title': l.title,
      'Lender Name': l.lender_name,
      'Type': l.provider_type.toUpperCase(),
      'Disbursement Date': l.disbursement_date,
      'Due Date': l.due_date || '-',
      'Principal (BDT)': l.principal_amount,
      'Interest Rate (%)': l.interest_rate || 0,
      'Total Payable (BDT)': l.total_payable,
      'Total Paid (BDT)': l.total_paid,
      'Remaining Loan (BDT)': l.remaining_amount,
      'Installment Type': l.installment_type || 'Monthly',
      'Installment Amount (BDT)': l.installment_amount || '-',
      'Status': l.status.toUpperCase(),
      'Account / Voucher': l.account_or_voucher || '-',
      'Notes': l.notes || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Loans_and_Liabilities');
    XLSX.writeFile(workbook, `Business_Loans_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  // Export PDF Report
  const handleExportPDF = () => {
    const doc = new jsPDF();
    const storeName = businessSettings?.name || "Daily's Need";

    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text(storeName, 14, 18);

    doc.setFontSize(12);
    doc.setTextColor(100, 116, 139);
    doc.text('Loan & Liability Summary Report', 14, 25);
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, 14, 31);
    doc.text(`Total Outstanding Liability: BDT ${formatCurrency(totalRemaining)}`, 14, 37);

    const tableData = filteredLoans.map((l, i) => [
      i + 1,
      l.lender_name || l.title,
      l.provider_type.toUpperCase(),
      formatCurrency(l.principal_amount),
      formatCurrency(l.total_payable),
      formatCurrency(l.total_paid),
      formatCurrency(l.remaining_amount),
      l.remaining_amount <= 0 ? 'CLEARED' : 'DUE'
    ]);

    autoTable(doc, {
      startY: 43,
      head: [['#', 'Loan Provider', 'Type', 'Principal', 'Total Payable', 'Paid', 'Remaining', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save(`Loans_and_Liabilities_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner matching Due Management page design */}
      <div className="relative py-6 px-6 bg-gradient-to-b from-slate-50/90 via-white to-slate-50/40 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center text-center overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500" />
        
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-wider uppercase font-['Outfit',sans-serif]">
          LOAN & LIABILITY MANAGEMENT
        </h1>
        <p className="text-sm sm:text-base font-medium text-slate-500 mt-2 max-w-lg leading-relaxed">
          Track business debt, bank loans, NGO microcredit, and installment repayments.
        </p>

        {/* Header Action Buttons */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Button 
            onClick={openAddModal}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add New Loan</span>
          </Button>

          <Button 
            onClick={handleExportExcel}
            variant="outline"
            className="bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-sm inline-flex items-center gap-2 border-slate-200"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Excel</span>
          </Button>
        </div>
      </div>

      {/* 4 Metric KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Outstanding Loan */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Outstanding Loan</p>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
              {activeLoansCount} Active
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalRemaining)}</p>
          <p className="text-xs text-slate-400 mt-1">Remaining debt to repay ({100 - overallRepaidPercent}% Due)</p>
        </Card>

        {/* Card 2: Total Borrowed */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Borrowed</p>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
              {loans.length} Loans Total
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalPrincipal)}</p>
          <p className="text-xs text-slate-400 mt-1">Total Payable: {formatCurrency(totalPayable)}</p>
        </Card>

        {/* Card 3: Total Repaid */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Repaid Amount</p>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              ↗ {overallRepaidPercent}%
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalPaid)}</p>
          <p className="text-xs text-slate-400 mt-1">Total credit settled</p>
        </Card>

        {/* Card 4: Debt Recovery Status */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Debt Recovery Status</p>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
              {loans.filter(l => l.status === 'paid' || l.remaining_amount <= 0).length} Paid Off
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{overallRepaidPercent}%</p>
          <p className="text-xs text-slate-400 mt-1">
            {activeLoansCount === 0 ? 'All loans are fully repaid!' : `${activeLoansCount} loans pending installment`}
          </p>
        </Card>
      </div>

      {/* Main Content Card with Navigation Tabs Bar & Comprehensive Toolbar */}
      <Card className="p-0 border-slate-200 shadow-sm bg-white overflow-hidden">
        {/* Navigation Tabs Bar */}
        <div className="border-b border-slate-200 bg-slate-50/70 px-4 pt-3 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('loans')}
            className={cn(
              "px-4 py-2.5 text-xs font-bold transition-all relative flex items-center gap-2 border-b-2 -mb-[1px] cursor-pointer",
              activeTab === 'loans'
                ? "border-indigo-600 text-indigo-600 bg-white rounded-t-lg shadow-2xs"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <Landmark className="w-4 h-4" />
            <span>Loan Accounts Book</span>
            <span className={cn(
              "text-[10px] px-2 py-0.5 rounded-full font-bold",
              activeTab === 'loans' ? "bg-indigo-50 text-indigo-700" : "bg-slate-200 text-slate-600"
            )}>
              {activeLoansCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              "px-4 py-2.5 text-xs font-bold transition-all relative flex items-center gap-2 border-b-2 -mb-[1px] cursor-pointer",
              activeTab === 'history'
                ? "border-indigo-600 text-indigo-600 bg-white rounded-t-lg shadow-2xs"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <History className="w-4 h-4" />
            <span>Repayment History</span>
            <span className={cn(
              "text-[10px] px-2 py-0.5 rounded-full font-bold",
              activeTab === 'history' ? "bg-indigo-50 text-indigo-700" : "bg-slate-200 text-slate-600"
            )}>
              {allRepaymentsList.length}
            </span>
          </button>
        </div>

        {/* Top Control Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={
                activeTab === 'loans' 
                  ? "Search by Loan Provider Name, account, or notes..." 
                  : "Search receipt #, provider name, notes..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

          <div className="flex flex-wrap items-center gap-2">
            {activeTab === 'loans' && (
              <>
                <select
                  value={providerFilter}
                  onChange={(e) => setProviderFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="all">All Loan Providers</option>
                  {uniqueProviders.length > 0 && (
                    <optgroup label="Providers">
                      {uniqueProviders.map(pName => (
                        <option key={pName} value={pName}>{pName}</option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Provider Types">
                    {PROVIDER_TYPES.map(pt => (
                      <option key={pt.id} value={`type:${pt.id}`}>{pt.label}</option>
                    ))}
                  </optgroup>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="has_due">Due Only</option>
                  <option value="active">Active / Running</option>
                  <option value="paid">Fully Paid Off</option>
                  <option value="overdue">Overdue / Past Due</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="due_desc">Highest Due First</option>
                  <option value="due_asc">Lowest Due First</option>
                  <option value="name">Name (A-Z)</option>
                  <option value="recent">Recent Transaction</option>
                </select>
              </>
            )}

            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Excel</span>
            </button>

            <button
              onClick={handleExportPDF}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-rose-600" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Loan Accounts Book */}
        {activeTab === 'loans' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Loan Provider Name</th>
                  <th className="py-3 px-4">Disbursement & Due</th>
                  <th className="py-3 px-4 text-right">Principal</th>
                  <th className="py-3 px-4 text-right">Total Payable</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Remaining Balance</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {filteredLoans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <Landmark className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-sm">No loan or liability records found</p>
                      <Button
                        onClick={openAddModal}
                        className="mt-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
                      >
                        + Add First Loan
                      </Button>
                    </td>
                  </tr>
                ) : (
                  filteredLoans.map((loan) => {
                    const progressPct = loan.total_payable > 0 ? Math.round((loan.total_paid / loan.total_payable) * 100) : 0;
                    const isOverdue = loan.status !== 'paid' && loan.due_date && isAfter(new Date(), parseISO(loan.due_date));
                    const isPaid = loan.remaining_amount <= 0 || loan.status === 'paid';

                    return (
                      <tr key={loan.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Loan Provider Name */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0",
                              isPaid ? "bg-emerald-100 text-emerald-800" : isOverdue ? "bg-rose-100 text-rose-800" : "bg-indigo-100 text-indigo-800"
                            )}>
                              {(loan.lender_name || loan.title).slice(0, 1).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 block">{loan.lender_name || loan.title}</span>
                              <span className="text-[11px] text-slate-400 font-normal">
                                {loan.title !== loan.lender_name ? `${loan.title} • ` : ''}
                                {loan.account_or_voucher ? `A/C: ${loan.account_or_voucher}` : loan.provider_type.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Disbursement & Due */}
                        <td className="py-3 px-4 text-slate-600">
                          <div>Start: {format(parseISO(loan.disbursement_date), 'dd MMM yyyy')}</div>
                          {loan.due_date ? (
                            <div className={cn("text-[11px]", isOverdue ? "text-rose-600 font-bold" : "text-slate-400")}>
                              Due: {format(parseISO(loan.due_date), 'dd MMM yyyy')}
                              {isOverdue && ' (Overdue!)'}
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400">Due: Open</div>
                          )}
                        </td>

                        {/* Principal */}
                        <td className="py-3 px-4 text-right font-medium text-slate-700">
                          {formatCurrency(loan.principal_amount)}
                          {loan.interest_rate ? (
                            <div className="text-[10px] text-slate-400 font-normal">
                              +{loan.interest_rate}% interest
                            </div>
                          ) : null}
                        </td>

                        {/* Total Payable */}
                        <td className="py-3 px-4 text-right font-semibold text-slate-800">
                          {formatCurrency(loan.total_payable)}
                          {loan.installment_amount ? (
                            <div className="text-[10px] text-indigo-600 font-semibold">
                              {formatCurrency(loan.installment_amount)}/{loan.installment_type || 'mo'}
                            </div>
                          ) : null}
                        </td>

                        {/* Paid */}
                        <td className="py-3 px-4 text-right">
                          <span className="font-bold text-emerald-600 block">
                            {formatCurrency(loan.total_paid)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {progressPct}% paid
                          </span>
                        </td>

                        {/* Remaining Balance */}
                        <td className="py-3 px-4 text-right">
                          <span className={cn(
                            "font-bold text-sm block",
                            loan.remaining_amount > 0 ? "text-rose-600" : "text-emerald-600"
                          )}>
                            {formatCurrency(loan.remaining_amount)}
                          </span>
                          {loan.remaining_amount > 0 && (
                            <div className="w-16 ml-auto bg-slate-100 h-1 rounded-full overflow-hidden mt-1">
                              <div 
                                className="bg-emerald-500 h-full rounded-full"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center">
                          {isPaid ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              CLEARED
                            </span>
                          ) : isOverdue ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              OVERDUE
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              DUE
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!isPaid && (
                              <button
                                onClick={() => openRepayModal(loan)}
                                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                                title="Pay Installment"
                              >
                                <Plus className="w-3 h-3 stroke-[2.5]" />
                                <span>Pay</span>
                              </button>
                            )}

                            <button
                              onClick={() => setHistoryModalLoan(loan)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="View Payment History"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => openEditModal(loan)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit Loan"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => setDeleteConfirm({ isOpen: true, id: loan.id, title: loan.lender_name || loan.title })}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Loan"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Repayment History */}
        {activeTab === 'history' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Voucher #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Loan Provider</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Note / Ref</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {filteredHistoryList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <History className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-sm">No repayment records found</p>
                    </td>
                  </tr>
                ) : (
                  filteredHistoryList.map(({ loan, repayment }) => (
                    <tr key={repayment.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {repayment.reference_no || repayment.id.slice(-8)}
                      </td>

                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {repayment.payment_date || (repayment.created_at ? format(parseISO(repayment.created_at), 'dd-MMM-yyyy') : '-')}
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-900">
                        {loan.lender_name || loan.title}
                      </td>

                      <td className="py-3 px-4 capitalize font-medium text-slate-600">
                        {repayment.payment_method}
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-sm text-emerald-700">
                        + {formatCurrency(repayment.amount)}
                      </td>

                      <td className="py-3 px-4 text-slate-500 text-[11px] truncate max-w-[150px]">
                        {repayment.note || '-'}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedRepaymentReceipt({ loan, repayment });
                              setIsReceiptModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Print Voucher"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRepayment(loan.id, repayment.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* MODAL 1: ADD / EDIT LOAN MODAL */}
      {isLoanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {editingLoan ? 'Edit Loan Record' : 'Add New Loan'}
                  </h3>
                  <p className="text-xs text-slate-500">Record bank loan, microcredit, or personal liabilities</p>
                </div>
              </div>
              <button
                onClick={() => setIsLoanModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLoan} className="mt-4 space-y-4">
              {/* Primary Required Fields */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Loan Provider Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BRAC Bank, Sonali Bank, Karim Mia"
                  value={formData.lender_name}
                  onChange={e => {
                    const name = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      lender_name: name,
                      title: prev.title || name
                    }));
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
                    value={formData.principal_amount}
                    onChange={e => handlePrincipalOrInterestChange(e.target.value, formData.interest_rate)}
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
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                />
              </div>

              {/* Advanced Fields Toggle */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdvancedLoanFields(!showAdvancedLoanFields)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-indigo-50/80 transition-colors"
                >
                  <span>{showAdvancedLoanFields ? '– Hide Advanced Options' : '+ More Options (Dates, Interest, Installments)'}</span>
                </button>
              </div>

              {/* Collapsible Advanced Options */}
              {showAdvancedLoanFields && (
                <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-3.5 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Provider Type
                      </label>
                      <select
                        value={formData.provider_type}
                        onChange={e => setFormData({ ...formData, provider_type: e.target.value as any })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-medium bg-white"
                      >
                        {PROVIDER_TYPES.map(pt => (
                          <option key={pt.id} value={pt.id}>{pt.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Loan Title / Purpose
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. BRAC SME Loan"
                        value={formData.title}
                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                      />
                    </div>
                  </div>

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
                          value={formData.interest_rate}
                          onChange={e => handlePrincipalOrInterestChange(formData.principal_amount, e.target.value)}
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
                          value={formData.total_payable}
                          onChange={e => setFormData({ ...formData, total_payable: e.target.value })}
                          className="w-full pl-7 pr-2 py-2 text-xs font-extrabold text-indigo-900 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Disbursement Date
                      </label>
                      <input
                        type="date"
                        value={formData.disbursement_date}
                        onChange={e => setFormData({ ...formData, disbursement_date: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Due / Maturity Date
                      </label>
                      <input
                        type="date"
                        value={formData.due_date}
                        onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Installment Type
                      </label>
                      <select
                        value={formData.installment_type}
                        onChange={e => setFormData({ ...formData, installment_type: e.target.value as any })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-medium bg-white"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="weekly">Weekly</option>
                        <option value="daily">Daily</option>
                        <option value="one_time">One-time / Lump Sum</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Installment Amount (৳)
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 5000"
                        value={formData.installment_amount}
                        onChange={e => setFormData({ ...formData, installment_amount: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Contact Phone
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 017xxxxxxxx"
                        value={formData.contact_number}
                        onChange={e => setFormData({ ...formData, contact_number: e.target.value })}
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
                        value={formData.account_or_voucher}
                        onChange={e => setFormData({ ...formData, account_or_voucher: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsLoanModalOpen(false)}
                  className="rounded-xl text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs px-5"
                >
                  {editingLoan ? 'Update Loan' : 'Save Loan Record'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: MAKE REPAYMENT MODAL */}
      {isRepayModalOpen && selectedLoanForRepay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 relative">
            <button
              onClick={() => setIsRepayModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <HandCoins className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Pay Loan Installment</h3>
                <p className="text-xs text-slate-500 truncate max-w-xs">{selectedLoanForRepay.lender_name || selectedLoanForRepay.title}</p>
              </div>
            </div>

            <div className="mb-4 p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500 font-semibold">Remaining Balance:</span>
                <p className="font-extrabold text-rose-600 text-base">৳{formatCurrency(selectedLoanForRepay.remaining_amount)}</p>
              </div>
              {selectedLoanForRepay.installment_amount && (
                <div className="text-right">
                  <span className="text-slate-500 font-semibold">Fixed Installment:</span>
                  <p className="font-bold text-indigo-700">৳{formatCurrency(selectedLoanForRepay.installment_amount)}</p>
                </div>
              )}
            </div>

            <form onSubmit={handleSaveRepayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Repayment Amount (৳) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-indigo-600">৳</span>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    max={selectedLoanForRepay.remaining_amount}
                    required
                    placeholder="e.g. 5000"
                    value={repayAmount}
                    onChange={e => setRepayAmount(e.target.value)}
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-base font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={repayDate}
                    onChange={e => setRepayDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={repayMethod}
                    onChange={e => setRepayMethod(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="bKash">bKash</option>
                    <option value="Nagad">Nagad</option>
                    <option value="Rocket">Rocket</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reference / Voucher No. (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. REC-1029, Bank Trx ID"
                  value={repayReference}
                  onChange={e => setRepayReference(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Note / Remarks (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 5th monthly installment paid"
                  value={repayNote}
                  onChange={e => setRepayNote(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsRepayModalOpen(false)}
                  className="rounded-xl text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs px-5"
                >
                  Submit Payment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: REPAYMENT HISTORY MODAL FOR SINGLE LOAN */}
      {historyModalLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 relative max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Payment History</h3>
                  <p className="text-xs text-slate-500 truncate max-w-xs">{historyModalLoan.lender_name || historyModalLoan.title}</p>
                </div>
              </div>
              <button
                onClick={() => setHistoryModalLoan(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick stats banner */}
            <div className="my-3 grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center shrink-0">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Total Payable</span>
                <p className="text-xs font-bold text-slate-800">৳{formatCurrency(historyModalLoan.total_payable)}</p>
              </div>
              <div>
                <span className="text-[10px] text-emerald-600 font-bold uppercase">Total Paid</span>
                <p className="text-xs font-bold text-emerald-600">৳{formatCurrency(historyModalLoan.total_paid)}</p>
              </div>
              <div>
                <span className="text-[10px] text-rose-600 font-bold uppercase">Remaining</span>
                <p className="text-xs font-extrabold text-rose-600">৳{formatCurrency(historyModalLoan.remaining_amount)}</p>
              </div>
            </div>

            {/* Repayments list */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 no-scrollbar">
              {(!historyModalLoan.repayments || historyModalLoan.repayments.length === 0) ? (
                <div className="text-center py-8 text-slate-400 text-xs font-medium">
                  <History className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                  <p>No repayments recorded yet for this loan</p>
                  <Button
                    onClick={() => {
                      const l = historyModalLoan;
                      setHistoryModalLoan(null);
                      openRepayModal(l);
                    }}
                    className="mt-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
                  >
                    + Record First Installment
                  </Button>
                </div>
              ) : (
                historyModalLoan.repayments.map((rep, idx) => (
                  <div key={rep.id} className="p-3 rounded-2xl bg-slate-50/80 hover:bg-slate-100/60 border border-slate-100 flex items-center justify-between text-xs transition-colors">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">#{historyModalLoan.repayments!.length - idx}</span>
                        <span className="font-semibold text-slate-700">{format(parseISO(rep.payment_date), 'dd MMM yyyy')}</span>
                        <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-medium text-slate-600">
                          {rep.payment_method}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {rep.reference_no ? `Ref: ${rep.reference_no}` : ''} {rep.note ? `• ${rep.note}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-600 text-sm">
                        +৳{formatCurrency(rep.amount)}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedRepaymentReceipt({ loan: historyModalLoan, repayment: rep });
                          setIsReceiptModalOpen(true);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors"
                        title="Print Voucher"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteRepayment(historyModalLoan.id, rep.id)}
                        className="p-1 text-slate-300 hover:text-rose-600 rounded-md transition-colors"
                        title="Delete repayment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
              <Button
                variant="outline"
                onClick={() => setHistoryModalLoan(null)}
                className="rounded-xl text-xs font-semibold"
              >
                Close
              </Button>
              {historyModalLoan.remaining_amount > 0 && (
                <Button
                  onClick={() => {
                    const l = historyModalLoan;
                    setHistoryModalLoan(null);
                    openRepayModal(l);
                  }}
                  className="rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Installment</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: PRINTABLE REPAYMENT VOUCHER RECEIPT */}
      {isReceiptModalOpen && selectedRepaymentReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in duration-150">
            <button
              onClick={() => setIsReceiptModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors print:hidden"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Voucher Body */}
            <div id="loan-voucher-print" className="p-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/40 text-center space-y-4">
              {/* Header */}
              <div>
                {businessSettings?.invoice_show_logo !== false && businessSettings?.logo && businessSettings?.invoice_show_name !== false ? (
                  <div className="flex items-center justify-center gap-2.5 mb-1">
                    <img src={businessSettings.logo} alt="Logo" className="h-10 w-auto max-h-12 object-contain" />
                    <div className="text-left">
                      <h2 className="text-lg font-black text-slate-900 tracking-tight leading-tight">
                        {businessSettings?.name || "Daily's Need"}
                      </h2>
                      {businessSettings?.tagline && (
                        <p className="text-[10px] text-slate-500 font-medium leading-none">{businessSettings.tagline}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    {businessSettings?.invoice_show_logo !== false && businessSettings?.logo && (
                      <img src={businessSettings.logo} alt="Logo" className="h-10 mx-auto mb-1 object-contain" />
                    )}
                    {businessSettings?.invoice_show_name !== false && (
                      <h2 className="text-lg font-black text-slate-900 tracking-tight">
                        {businessSettings?.name || "Daily's Need"}
                      </h2>
                    )}
                  </>
                )}
                {businessSettings?.address && <p className="text-xs text-slate-500">{businessSettings.address}</p>}
                {businessSettings?.invoice_show_phone !== false && businessSettings?.phone && <p className="text-xs text-slate-500">Phone: {businessSettings.phone}</p>}
                <div className="inline-block mt-2 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-900 text-white">
                  Loan Repayment Voucher
                </div>
              </div>

              {/* Info Details */}
              <div className="border-t border-b border-slate-200 py-3 text-left text-xs space-y-1.5 font-medium text-slate-600">
                <div className="flex justify-between">
                  <span>Voucher / Ref No:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedRepaymentReceipt.repayment.reference_no || selectedRepaymentReceipt.repayment.id}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span className="font-bold text-slate-900">
                    {selectedRepaymentReceipt.repayment.payment_date || format(parseISO(selectedRepaymentReceipt.repayment.created_at), 'dd MMM yyyy')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Loan Provider:</span>
                  <span className="font-bold text-slate-900">{selectedRepaymentReceipt.loan.lender_name || selectedRepaymentReceipt.loan.title}</span>
                </div>
                {selectedRepaymentReceipt.loan.contact_number && (
                  <div className="flex justify-between">
                    <span>Contact:</span>
                    <span className="text-slate-800">{selectedRepaymentReceipt.loan.contact_number}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Payment Method:</span>
                  <span className="capitalize font-bold text-slate-800">{selectedRepaymentReceipt.repayment.payment_method}</span>
                </div>
              </div>

              {/* Amount Highlight */}
              <div className="py-2">
                <span className="text-xs text-slate-500 font-bold block mb-0.5">Amount Paid</span>
                <span className="text-3xl font-black text-emerald-700 tracking-tight">
                  ৳{formatCurrency(selectedRepaymentReceipt.repayment.amount)}
                </span>
              </div>

              {/* Remaining Balance Summary */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between text-slate-500">
                  <span>Total Loan Payable:</span>
                  <span className="font-bold text-slate-800">৳{formatCurrency(selectedRepaymentReceipt.loan.total_payable)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Remaining Balance:</span>
                  <span className="font-bold text-rose-600">৳{formatCurrency(selectedRepaymentReceipt.loan.remaining_amount)}</span>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-6 grid grid-cols-2 gap-4 text-center text-[10px] font-bold text-slate-400">
                <div>
                  <div className="border-t border-slate-300 pt-1">Authorized Signature</div>
                </div>
                <div>
                  <div className="border-t border-slate-300 pt-1">Provider Signature</div>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 pt-2 border-t border-slate-100">
                Generated by {businessSettings?.name || "Daily's Need"}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 mt-5 print:hidden">
              <Button
                variant="outline"
                onClick={() => setIsReceiptModalOpen(false)}
                className="flex-1 rounded-xl text-xs font-semibold"
              >
                Close
              </Button>
              <Button
                onClick={() => window.print()}
                className="flex-1 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs inline-flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Voucher</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: DELETE CONFIRMATION MODAL */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Delete Loan Record?</h3>
            <p className="text-xs text-slate-500 mt-1">
              Are you sure you want to delete "{deleteConfirm.title}"? It will be moved to the Recycle Bin and can be restored anytime.
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
                onClick={() => deleteConfirm.id && handleDeleteLoan(deleteConfirm.id)}
                className="rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white px-4"
              >
                Yes, Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
