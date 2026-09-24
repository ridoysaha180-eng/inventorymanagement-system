import React, { useState, useEffect, useMemo } from 'react';
import { 
  HandCoins, Plus, Search, Calendar, Download, Trash2, 
  X, Filter, DollarSign, Wallet, TrendingDown, Tag, ArrowUpDown, 
  CheckCircle2, FileSpreadsheet, RefreshCw, AlertCircle, Eye, FileText,
  Phone, MapPin, MessageCircle, Printer, ArrowRight, Clock, CreditCard,
  Send, Check, Copy, ChevronRight, UserCheck, Truck, ShieldAlert, History
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { formatCurrency, cn } from '../utils';
import { storageService } from '../services/storageService';
import { DuePayment, Customer, Sale, Supplier, Purchase, BusinessSettings } from '../types';

export const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash' },
  { id: 'bkash', label: 'bKash' },
  { id: 'nagad', label: 'Nagad' },
  { id: 'bank', label: 'Bank Transfer' },
  { id: 'card', label: 'Card' },
  { id: 'other', label: 'Other' }
];

export const DueManagement: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Primary Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [duePayments, setDuePayments] = useState<DuePayment[]>([]);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);

  // Active View Tab
  const [activeTab, setActiveTab] = useState<'customers' | 'suppliers' | 'history'>('customers');

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [dueStatusFilter, setDueStatusFilter] = useState<'has_due' | 'all' | 'zero_due'>('has_due');
  const [sortBy, setSortBy] = useState<'due_desc' | 'due_asc' | 'name' | 'recent'>('due_desc');

  // Modals
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [isPaySupplierModalOpen, setIsPaySupplierModalOpen] = useState(false);
  const [isCustomerLedgerOpen, setIsCustomerLedgerOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);

  // Selected Items for Modals
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedDuePayment, setSelectedDuePayment] = useState<DuePayment | null>(null);
  const [reminderCustomer, setReminderCustomer] = useState<{ id: string; name: string; phone?: string; due: number } | null>(null);
  const [copiedText, setCopiedText] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    payment?: DuePayment;
    isDeleting?: boolean;
  }>({ isOpen: false });

  // Form State for Collecting Customer Due
  const [collectForm, setCollectForm] = useState({
    customerId: '',
    saleId: '',
    amount: '',
    paymentMethod: 'cash',
    date: format(new Date(), 'yyyy-MM-dd'),
    note: '',
    receiptNo: ''
  });

  // Form State for Paying Supplier Due
  const [supplierPayForm, setSupplierPayForm] = useState({
    supplierId: '',
    amount: '',
    paymentMethod: 'cash',
    date: format(new Date(), 'yyyy-MM-dd'),
    note: '',
    receiptNo: `SPAY-${Date.now().toString().slice(-6)}`
  });

  const loadAllData = () => {
    setCustomers(storageService.getCustomers());
    setSales(storageService.getSales());
    setSuppliers(storageService.getSuppliers());
    setPurchases(storageService.getPurchases());
    setDuePayments(storageService.getDuePayments());
    setBusinessSettings(storageService.getBusinessSettings());
  };

  useEffect(() => {
    loadAllData();

    const handleUpdates = () => loadAllData();
    window.addEventListener('bizflow_sales_updated', handleUpdates);
    window.addEventListener('bizflow_customers_updated', handleUpdates);
    window.addEventListener('bizflow_purchases_updated', handleUpdates);
    window.addEventListener('bizflow_suppliers_updated', handleUpdates);
    window.addEventListener('bizflow_due_payments_updated', handleUpdates);
    window.addEventListener('bizflow_business_settings_updated', handleUpdates);
    window.addEventListener('storage', handleUpdates);

    return () => {
      window.removeEventListener('bizflow_sales_updated', handleUpdates);
      window.removeEventListener('bizflow_customers_updated', handleUpdates);
      window.removeEventListener('bizflow_purchases_updated', handleUpdates);
      window.removeEventListener('bizflow_suppliers_updated', handleUpdates);
      window.removeEventListener('bizflow_due_payments_updated', handleUpdates);
      window.removeEventListener('bizflow_business_settings_updated', handleUpdates);
      window.removeEventListener('storage', handleUpdates);
    };
  }, []);

  // Handle open collect due from navigation state
  useEffect(() => {
    if (location.state && (location.state as any).openCollect) {
      const stateCustId = (location.state as any).customerId;
      if (stateCustId) {
        setSelectedCustomerId(stateCustId);
        openCollectModal(stateCustId);
      } else {
        openCollectModal();
      }
    }
  }, [location.state, customers]);

  // Compute Enriched Customer Dues
  const enrichedCustomers = useMemo(() => {
    return customers.map(cust => {
      const custSales = sales.filter(s => s.customer_id === cust.id);
      const totalOrders = custSales.length;
      const totalSalesAmount = custSales.reduce((sum, s) => sum + s.total_amount, 0);
      
      const totalDue = custSales.reduce((sum, s) => {
        if (s.due_amount !== undefined) return sum + s.due_amount;
        return (s.payment_method === 'due' || s.status === 'pending') ? sum + s.total_amount : sum;
      }, 0);

      const totalPaid = Math.max(0, totalSalesAmount - totalDue);
      const lastSaleDate = custSales.length > 0 
        ? custSales.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
        : cust.created_at;

      return {
        ...cust,
        totalOrders,
        totalSalesAmount,
        totalPaid,
        totalDue,
        lastSaleDate
      };
    });
  }, [customers, sales]);

  // Compute Enriched Supplier Dues
  const enrichedSuppliers = useMemo(() => {
    return suppliers.map(supp => {
      const suppPurchases = purchases.filter(p => p.supplier_id === supp.id);
      const totalPurchasesAmount = suppPurchases.reduce((sum, p) => sum + p.total_amount, 0);

      const totalDue = suppPurchases.reduce((sum, p) => {
        return (p.payment_method === 'due' || p.status === 'pending') ? sum + p.total_amount : sum;
      }, 0);

      const totalPaid = Math.max(0, totalPurchasesAmount - totalDue);

      return {
        ...supp,
        purchasesCount: suppPurchases.length,
        totalPurchasesAmount,
        totalPaid,
        totalDue
      };
    });
  }, [suppliers, purchases]);

  // Global KPIs
  const totalCustomerDue = useMemo(() => {
    return enrichedCustomers.reduce((sum, c) => sum + c.totalDue, 0);
  }, [enrichedCustomers]);

  const customerDueCount = useMemo(() => {
    return enrichedCustomers.filter(c => c.totalDue > 0).length;
  }, [enrichedCustomers]);

  const totalSupplierDue = useMemo(() => {
    return enrichedSuppliers.reduce((sum, s) => sum + s.totalDue, 0);
  }, [enrichedSuppliers]);

  const supplierDueCount = useMemo(() => {
    return enrichedSuppliers.filter(s => s.totalDue > 0).length;
  }, [enrichedSuppliers]);

  const totalCollectedFromDues = useMemo(() => {
    return duePayments
      .filter(p => p.type === 'customer_collection')
      .reduce((sum, p) => sum + p.amount, 0);
  }, [duePayments]);

  const netDuePosition = totalCustomerDue - totalSupplierDue;

  // Filtered and Sorted Customers
  const filteredCustomers = useMemo(() => {
    return enrichedCustomers
      .filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (c.phone && c.phone.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (c.address && c.address.toLowerCase().includes(searchTerm.toLowerCase()));

        if (!matchesSearch) return false;

        if (dueStatusFilter === 'has_due') return c.totalDue > 0;
        if (dueStatusFilter === 'zero_due') return c.totalDue === 0;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'due_desc') return b.totalDue - a.totalDue;
        if (sortBy === 'due_asc') return a.totalDue - b.totalDue;
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'recent') return new Date(b.lastSaleDate).getTime() - new Date(a.lastSaleDate).getTime();
        return 0;
      });
  }, [enrichedCustomers, searchTerm, dueStatusFilter, sortBy]);

  // Filtered and Sorted Suppliers
  const filteredSuppliers = useMemo(() => {
    return enrichedSuppliers
      .filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (s.phone && s.phone.toLowerCase().includes(searchTerm.toLowerCase()));
        if (!matchesSearch) return false;
        if (dueStatusFilter === 'has_due') return s.totalDue > 0;
        if (dueStatusFilter === 'zero_due') return s.totalDue === 0;
        return true;
      })
      .sort((a, b) => b.totalDue - a.totalDue);
  }, [enrichedSuppliers, searchTerm, dueStatusFilter]);

  // Filtered History
  const filteredHistory = useMemo(() => {
    return duePayments
      .filter(p => {
        const matchesSearch = p.party_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (p.party_phone && p.party_phone.includes(searchTerm)) ||
          (p.receipt_no && p.receipt_no.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (p.note && p.note.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesSearch;
      })
      .sort((a, b) => new Date(b.created_at || b.payment_date).getTime() - new Date(a.created_at || a.payment_date).getTime());
  }, [duePayments, searchTerm]);

  // Customer Due Invoices for Collect Modal
  const customerDueInvoices = useMemo(() => {
    if (!collectForm.customerId) return [];
    return sales
      .filter(s => {
        if (s.customer_id !== collectForm.customerId) return false;
        const dueAmt = s.due_amount !== undefined
          ? s.due_amount
          : ((s.payment_method === 'due' || s.status === 'pending') ? s.total_amount : 0);
        return dueAmt > 0;
      })
      .map(s => {
        const dueAmt = s.due_amount !== undefined
          ? s.due_amount
          : ((s.payment_method === 'due' || s.status === 'pending') ? s.total_amount : 0);
        return {
          ...s,
          dueAmt
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [sales, collectForm.customerId]);

  // Open Collect Modal Helper
  const openCollectModal = (customerId?: string, saleId?: string) => {
    const custId = customerId || (filteredCustomers.find(c => c.totalDue > 0)?.id || '');
    const cust = enrichedCustomers.find(c => c.id === custId);

    const custInvoices = custId ? sales.filter(s => {
      if (s.customer_id !== custId) return false;
      const dueAmt = s.due_amount !== undefined ? s.due_amount : ((s.payment_method === 'due' || s.status === 'pending') ? s.total_amount : 0);
      return dueAmt > 0;
    }) : [];

    const targetSale = saleId ? custInvoices.find(s => s.id === saleId) : undefined;

    let initialSaleId = '';
    let initialReceiptNo = `REC-${Date.now().toString().slice(-6)}`;
    let initialAmount = cust ? String(cust.totalDue) : '';
    let initialNote = '';

    if (targetSale) {
      const sDueAmt = targetSale.due_amount !== undefined ? targetSale.due_amount : ((targetSale.payment_method === 'due' || targetSale.status === 'pending') ? targetSale.total_amount : 0);
      initialSaleId = targetSale.id;
      initialReceiptNo = targetSale.id;
      initialAmount = String(sDueAmt);
      initialNote = `Payment for Invoice #${targetSale.id}`;
    }

    setCollectForm({
      customerId: custId,
      saleId: initialSaleId,
      amount: initialAmount,
      paymentMethod: 'cash',
      date: format(new Date(), 'yyyy-MM-dd'),
      note: initialNote,
      receiptNo: initialReceiptNo
    });
    setIsCollectModalOpen(true);
  };

  // Open Supplier Pay Modal Helper
  const openPaySupplierModal = (supplierId?: string) => {
    const suppId = supplierId || (filteredSuppliers.find(s => s.totalDue > 0)?.id || '');
    const supp = enrichedSuppliers.find(s => s.id === suppId);
    setSupplierPayForm({
      supplierId: suppId,
      amount: supp ? String(supp.totalDue) : '',
      paymentMethod: 'cash',
      date: format(new Date(), 'yyyy-MM-dd'),
      note: '',
      receiptNo: `SPAY-${Date.now().toString().slice(-6)}`
    });
    setIsPaySupplierModalOpen(true);
  };

  // Submit Collect Customer Due
  const handleCollectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(collectForm.amount);
    if (!collectForm.customerId || isNaN(amountNum) || amountNum <= 0) {
      alert('Please select a valid customer and enter a valid collection amount.');
      return;
    }

    const customer = enrichedCustomers.find(c => c.id === collectForm.customerId);
    if (!customer) return;

    const newPayment: DuePayment = {
      id: `due_pay_${Date.now()}`,
      type: 'customer_collection',
      party_type: 'customer',
      party_id: customer.id,
      party_name: customer.name,
      party_phone: customer.phone,
      amount: amountNum,
      payment_date: collectForm.date,
      payment_method: collectForm.paymentMethod as any,
      note: collectForm.note.trim() || undefined,
      receipt_no: collectForm.receiptNo,
      sale_id: collectForm.saleId || undefined,
      created_at: new Date().toISOString()
    };

    try {
      await storageService.addDuePayment(newPayment);
      setIsCollectModalOpen(false);
      setSelectedDuePayment(newPayment);
      setIsReceiptModalOpen(true);
    } catch (err) {
      console.error('Failed to collect due:', err);
      alert('Failed to save due payment. Please try again.');
    }
  };

  // Submit Pay Supplier Due
  const handleSupplierPaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(supplierPayForm.amount);
    if (!supplierPayForm.supplierId || isNaN(amountNum) || amountNum <= 0) {
      alert('Please select a valid supplier and enter a valid payment amount.');
      return;
    }

    const supplier = enrichedSuppliers.find(s => s.id === supplierPayForm.supplierId);
    if (!supplier) return;

    const newPayment: DuePayment = {
      id: `due_spay_${Date.now()}`,
      type: 'supplier_payment',
      party_type: 'supplier',
      party_id: supplier.id,
      party_name: supplier.name,
      party_phone: supplier.phone,
      amount: amountNum,
      payment_date: supplierPayForm.date,
      payment_method: supplierPayForm.paymentMethod as any,
      note: supplierPayForm.note.trim() || undefined,
      receipt_no: supplierPayForm.receiptNo,
      created_at: new Date().toISOString()
    };

    try {
      await storageService.addDuePayment(newPayment);
      setIsPaySupplierModalOpen(false);
      setSelectedDuePayment(newPayment);
      setIsReceiptModalOpen(true);
    } catch (err) {
      console.error('Failed to pay supplier due:', err);
      alert('Failed to save supplier payment. Please try again.');
    }
  };

  // Delete History Record Handlers
  const openDeleteConfirm = (e: React.MouseEvent, payment: DuePayment) => {
    e.stopPropagation();
    setDeleteConfirm({ isOpen: true, payment, isDeleting: false });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.payment) return;
    const payId = deleteConfirm.payment.id;
    setDeleteConfirm(prev => ({ ...prev, isDeleting: true }));
    try {
      // Optimistic instant removal from UI
      setDuePayments(prev => prev.filter(p => p.id !== payId));
      await storageService.deleteDuePayment(payId);
      setDeleteConfirm({ isOpen: false });
      loadAllData();
    } catch (err) {
      console.error('Failed to delete payment record:', err);
      setDeleteConfirm({ isOpen: false });
      loadAllData();
    }
  };

  // Export to Excel
  const exportToExcel = () => {
    const dataToExport = filteredCustomers.map(c => ({
      'Customer Name': c.name,
      'Phone': c.phone || 'N/A',
      'Address': c.address || 'N/A',
      'Total Orders': c.totalOrders,
      'Total Invoiced': c.totalSalesAmount,
      'Total Paid': c.totalPaid,
      'Remaining Due': c.totalDue,
      'Status': c.totalDue > 0 ? 'Due' : 'Cleared'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customer Dues');
    XLSX.writeFile(wb, `Customer_Due_Ledger_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  // Export PDF Report
  const exportToPDF = () => {
    const doc = new jsPDF();
    const storeName = businessSettings?.name || 'BizFlow Store';
    
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text(storeName, 14, 18);
    
    doc.setFontSize(12);
    doc.setTextColor(100, 116, 139);
    doc.text('Customer Due Summary Report', 14, 25);
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, 14, 31);
    doc.text(`Total Due Outstanding: BDT ${formatCurrency(totalCustomerDue)}`, 14, 37);

    const tableData = filteredCustomers.map((c, i) => [
      i + 1,
      c.name,
      c.phone || '-',
      formatCurrency(c.totalSalesAmount),
      formatCurrency(c.totalPaid),
      formatCurrency(c.totalDue)
    ]);

    autoTable(doc, {
      startY: 43,
      head: [['#', 'Customer Name', 'Phone', 'Total Invoiced', 'Paid', 'Due Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [245, 158, 11] }
    });

    doc.save(`Customer_Due_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  // Open Reminder Modal
  const openReminderModal = (cust: { id: string; name: string; phone?: string; due: number }) => {
    setReminderCustomer(cust);
    setCopiedText(false);
    setIsReminderModalOpen(true);
  };

  const getReminderMessage = (customerName: string, amount: number) => {
    const shop = businessSettings?.name || 'Our Store';
    const phone = businessSettings?.phone ? `(${businessSettings.phone})` : '';
    return `Dear ${customerName}, you have an outstanding due balance of ৳${formatCurrency(amount)} at ${shop} ${phone}. We kindly request you to clear the payment at your earliest convenience. Thank you.`;
  };

  const handleCopyReminder = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Selected customer for detailed ledger view
  const currentCustomerForLedger = useMemo(() => {
    if (!selectedCustomerId) return null;
    return enrichedCustomers.find(c => c.id === selectedCustomerId) || null;
  }, [selectedCustomerId, enrichedCustomers]);

  const customerSalesWithDue = useMemo(() => {
    if (!selectedCustomerId) return [];
    return sales
      .filter(s => s.customer_id === selectedCustomerId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [selectedCustomerId, sales]);

  const customerPaymentsHistory = useMemo(() => {
    if (!selectedCustomerId) return [];
    return duePayments
      .filter(p => p.party_id === selectedCustomerId && p.type === 'customer_collection')
      .sort((a, b) => new Date(b.created_at || b.payment_date).getTime() - new Date(a.created_at || a.payment_date).getTime());
  }, [selectedCustomerId, duePayments]);

  const customerLedgerStats = useMemo(() => {
    if (!currentCustomerForLedger) return { totalInvoiced: 0, totalDueCreated: 0, totalCollected: 0, currentDue: 0 };
    
    const totalInvoiced = customerSalesWithDue.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const totalCollected = customerPaymentsHistory.reduce((sum, p) => sum + (p.amount || 0), 0);
    const currentDue = currentCustomerForLedger.totalDue || 0;
    
    // Compute total due ever created across this customer's invoices
    let totalDueCreated = 0;
    customerSalesWithDue.forEach(s => {
      const curDue = s.due_amount !== undefined ? s.due_amount : (s.payment_method === 'due' ? s.total_amount : 0);
      const linkedPays = customerPaymentsHistory.filter(p => 
        p.sale_id === s.id || (p.note && p.note.toLowerCase().includes(s.id.slice(-6).toLowerCase()))
      );
      const collectedOnThis = linkedPays.reduce((pSum, p) => pSum + (p.amount || 0), 0);
      
      let initialDue = curDue + collectedOnThis;
      if (initialDue === 0 && s.payment_method === 'due') {
        initialDue = s.total_amount;
      }
      totalDueCreated += initialDue;
    });

    if (totalDueCreated === 0) {
      totalDueCreated = currentDue + totalCollected;
    }

    return {
      totalInvoiced,
      totalDueCreated,
      totalCollected,
      currentDue
    };
  }, [currentCustomerForLedger, customerSalesWithDue, customerPaymentsHistory]);

  return (
    <div className="space-y-6">
      {/* Top Banner matching Sales page design */}
      <div className="relative py-6 px-6 bg-gradient-to-b from-slate-50/90 via-white to-slate-50/40 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center text-center overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary-500 via-sky-500 to-emerald-500" />
        
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-wider uppercase font-['Outfit',sans-serif]">
          DUE MANAGEMENT
        </h1>
        <p className="text-sm sm:text-base font-medium text-slate-500 mt-2 max-w-lg leading-relaxed">
          Manage customer dues, supplier credits, and track cash collections.
        </p>

        {/* Header Action Buttons */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Button 
            onClick={() => openCollectModal()}
            className="bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Collect Customer Due</span>
          </Button>
          <Button 
            onClick={() => openPaySupplierModal()}
            variant="outline"
            className="bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-sm inline-flex items-center gap-2 border-slate-200"
          >
            <Truck className="w-4 h-4 text-rose-600" />
            <span>Pay Supplier Due</span>
          </Button>
        </div>
      </div>

      {/* 4 Metric KPI Cards matching Sales design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Customer Due */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer Due</p>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
              {customerDueCount} {customerDueCount === 1 ? 'Customer' : 'Customers'}
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalCustomerDue)}</p>
          <p className="text-xs text-slate-400 mt-1">Pending payments to collect</p>
        </Card>

        {/* Card 2: Dues Collected */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dues Collected</p>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              {duePayments.filter(p => p.type === 'customer_collection').length} Receipts
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalCollectedFromDues)}</p>
          <p className="text-xs text-slate-400 mt-1">Total credit recovered</p>
        </Card>

        {/* Card 3: Supplier Due */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Supplier Due</p>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
              {supplierDueCount} {supplierDueCount === 1 ? 'Supplier' : 'Suppliers'}
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalSupplierDue)}</p>
          <p className="text-xs text-slate-400 mt-1">Pending payments to suppliers</p>
        </Card>

        {/* Card 4: Net Position */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Position</p>
            <span className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 rounded border",
              netDuePosition >= 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
            )}>
              {netDuePosition >= 0 ? 'Surplus (+)' : 'Deficit (-)'}
            </span>
          </div>
          <p className={cn("text-2xl font-bold", netDuePosition >= 0 ? "text-slate-900" : "text-rose-600")}>
            {formatCurrency(Math.abs(netDuePosition))}
          </p>
          <p className="text-xs text-slate-400 mt-1">Customer Due - Supplier Due</p>
        </Card>
      </div>

      {/* Main Content Card with Comprehensive Toolbar & Data View */}
      <Card className="p-0 border-slate-200 shadow-sm bg-white overflow-hidden">
        {/* Navigation Tabs Bar */}
        <div className="border-b border-slate-200 bg-slate-50/70 px-4 pt-3 flex items-center gap-2">
          <button
            onClick={() => { setActiveTab('customers'); setDueStatusFilter('has_due'); }}
            className={cn(
              "px-4 py-2.5 text-xs font-bold transition-all relative flex items-center gap-2 border-b-2 -mb-[1px] cursor-pointer",
              activeTab === 'customers'
                ? "border-primary-600 text-primary-600 bg-white rounded-t-lg shadow-2xs"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <HandCoins className="w-4 h-4" />
            <span>Customer Due Book</span>
            <span className={cn(
              "text-[10px] px-2 py-0.5 rounded-full font-bold",
              activeTab === 'customers' ? "bg-primary-50 text-primary-700" : "bg-slate-200 text-slate-600"
            )}>
              {customerDueCount}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('suppliers'); setDueStatusFilter('has_due'); }}
            className={cn(
              "px-4 py-2.5 text-xs font-bold transition-all relative flex items-center gap-2 border-b-2 -mb-[1px] cursor-pointer",
              activeTab === 'suppliers'
                ? "border-primary-600 text-primary-600 bg-white rounded-t-lg shadow-2xs"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <Truck className="w-4 h-4" />
            <span>Supplier Due Book</span>
            <span className={cn(
              "text-[10px] px-2 py-0.5 rounded-full font-bold",
              activeTab === 'suppliers' ? "bg-primary-50 text-primary-700" : "bg-slate-200 text-slate-600"
            )}>
              {supplierDueCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              "px-4 py-2.5 text-xs font-bold transition-all relative flex items-center gap-2 border-b-2 -mb-[1px] cursor-pointer",
              activeTab === 'history'
                ? "border-primary-600 text-primary-600 bg-white rounded-t-lg shadow-2xs"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <History className="w-4 h-4" />
            <span>Payment History</span>
            <span className={cn(
              "text-[10px] px-2 py-0.5 rounded-full font-bold",
              activeTab === 'history' ? "bg-primary-50 text-primary-700" : "bg-slate-200 text-slate-600"
            )}>
              {duePayments.length}
            </span>
          </button>
        </div>

        {/* Top Control Bar matching Sales page */}
        <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={
                activeTab === 'customers' 
                  ? "Search customer by name, phone, address..." 
                  : activeTab === 'suppliers' 
                    ? "Search supplier by name or phone..." 
                    : "Search receipt #, party name, phone, note..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
            {activeTab !== 'history' && (
              <select
                value={dueStatusFilter}
                onChange={(e) => setDueStatusFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
              >
                <option value="has_due">Due Only</option>
                <option value="all">All</option>
                <option value="zero_due">Cleared</option>
              </select>
            )}

            {activeTab === 'customers' && (
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
              >
                <option value="due_desc">Highest Due First</option>
                <option value="due_asc">Lowest Due First</option>
                <option value="name">Name (A-Z)</option>
                <option value="recent">Recent Transaction</option>
              </select>
            )}

            <button
              onClick={exportToExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Excel</span>
            </button>

            <button
              onClick={exportToPDF}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-rose-600" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Customer Due Book */}
        {activeTab === 'customers' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4 text-right">Invoiced</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Due Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <HandCoins className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-sm">No customer due records found</p>
                      <p className="text-xs text-slate-400">Try adjusting your search or filters</p>
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map(cust => (
                    <tr key={cust.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs",
                            cust.totalDue > 0 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"
                          )}>
                            {cust.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{cust.name}</span>
                            <span className="text-[11px] text-slate-400">{cust.totalOrders} {cust.totalOrders === 1 ? 'sale' : 'sales'}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        <div className="space-y-0.5">
                          <div className="font-medium text-slate-800">{cust.phone || 'No phone'}</div>
                          {cust.address && <div className="text-[11px] text-slate-400 truncate max-w-[150px]">{cust.address}</div>}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right font-medium text-slate-700">
                        {formatCurrency(cust.totalSalesAmount)}
                      </td>

                      <td className="py-3 px-4 text-right font-medium text-slate-700">
                        {formatCurrency(cust.totalPaid)}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <span className={cn(
                          "font-bold",
                          cust.totalDue > 0 ? "text-amber-700" : "text-slate-400"
                        )}>
                          {formatCurrency(cust.totalDue)}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        {cust.totalDue > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            DUE
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            CLEARED
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {cust.totalDue > 0 && (
                            <button
                              onClick={() => openCollectModal(cust.id)}
                              className="px-2.5 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                              title="Collect Due"
                            >
                              <Plus className="w-3 h-3 stroke-[2.5]" />
                              <span>Collect</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedCustomerId(cust.id);
                              setIsCustomerLedgerOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="View Ledger"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {cust.totalDue > 0 && (
                            <button
                              onClick={() => openReminderModal({ id: cust.id, name: cust.name, phone: cust.phone, due: cust.totalDue })}
                              className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors cursor-pointer"
                              title="Payment Reminder"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Supplier Due Book */}
        {activeTab === 'suppliers' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4 text-right">Purchases</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Due Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Truck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-sm">No supplier due records found</p>
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map(supp => (
                    <tr key={supp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs",
                            supp.totalDue > 0 ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-700"
                          )}>
                            {supp.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{supp.name}</span>
                            <span className="text-[11px] text-slate-400">{supp.purchasesCount} bills</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        <div className="font-medium text-slate-800">{supp.phone || 'No phone'}</div>
                      </td>

                      <td className="py-3 px-4 text-right font-medium text-slate-700">
                        {formatCurrency(supp.totalPurchasesAmount)}
                      </td>

                      <td className="py-3 px-4 text-right font-medium text-slate-700">
                        {formatCurrency(supp.totalPaid)}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <span className={cn(
                          "font-bold",
                          supp.totalDue > 0 ? "text-rose-600" : "text-slate-400"
                        )}>
                          {formatCurrency(supp.totalDue)}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        {supp.totalDue > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            PAYABLE
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            CLEARED
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {supp.totalDue > 0 && (
                          <button
                            onClick={() => openPaySupplierModal(supp.id)}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Truck className="w-3 h-3" />
                            <span>Pay Due</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: History */}
        {activeTab === 'history' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Party</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Note</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <History className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-sm">No transaction records found</p>
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map(pay => (
                    <tr key={pay.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {pay.receipt_no || pay.id.slice(-8)}
                      </td>

                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {pay.payment_date || (pay.created_at ? format(parseISO(pay.created_at), 'dd-MMM-yyyy') : '-')}
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-900">
                        {pay.party_name}
                      </td>

                      <td className="py-3 px-4">
                        {pay.type === 'customer_collection' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            + Collection
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            - Payment
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 capitalize font-medium text-slate-600">
                        {pay.payment_method}
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-sm">
                        <span className={pay.type === 'customer_collection' ? 'text-emerald-700' : 'text-rose-600'}>
                          {pay.type === 'customer_collection' ? '+' : '-'} {formatCurrency(pay.amount)}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-500 text-[11px] truncate max-w-[150px]">
                        {pay.note || '-'}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedDuePayment(pay);
                              setIsReceiptModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Print Voucher"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => openDeleteConfirm(e, pay)}
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

      {/* MODAL 1: Collect Customer Due */}
      {isCollectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in duration-150">
            <button
              onClick={() => setIsCollectModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-primary-600 text-white flex items-center justify-center shadow-xs">
                <HandCoins className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Collect Customer Due</h3>
                <p className="text-xs text-slate-500">Record customer payment and reduce outstanding due</p>
              </div>
            </div>

            <form onSubmit={handleCollectSubmit} className="space-y-4">
              {/* Select Customer */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Customer *
                </label>
                <select
                  value={collectForm.customerId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const c = enrichedCustomers.find(item => item.id === id);
                    setCollectForm({
                      ...collectForm,
                      customerId: id,
                      saleId: '',
                      amount: c ? String(c.totalDue) : '',
                      receiptNo: `REC-${Date.now().toString().slice(-6)}`,
                      note: ''
                    });
                  }}
                  required
                  className="w-full px-3.5 py-2.5 text-xs font-semibold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
                >
                  <option value="">-- Choose Customer --</option>
                  {enrichedCustomers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''} — Due: ৳{formatCurrency(c.totalDue)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Due Invoice List */}
              {collectForm.customerId && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Select Due Invoice (Bill)
                    </label>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      {customerDueInvoices.length} due {customerDueInvoices.length === 1 ? 'invoice' : 'invoices'}
                    </span>
                  </div>
                  <select
                    value={collectForm.saleId}
                    onChange={(e) => {
                      const selectedSId = e.target.value;
                      const targetSale = customerDueInvoices.find(item => item.id === selectedSId);
                      if (targetSale) {
                        setCollectForm({
                          ...collectForm,
                          saleId: targetSale.id,
                          receiptNo: targetSale.id,
                          amount: String(targetSale.dueAmt),
                          note: collectForm.note || `Payment for Invoice #${targetSale.id}`
                        });
                      } else {
                        const c = enrichedCustomers.find(item => item.id === collectForm.customerId);
                        setCollectForm({
                          ...collectForm,
                          saleId: '',
                          receiptNo: `REC-${Date.now().toString().slice(-6)}`,
                          amount: c ? String(c.totalDue) : collectForm.amount,
                          note: ''
                        });
                      }
                    }}
                    className="w-full px-3.5 py-2.5 text-xs font-semibold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
                  >
                    <option value="">-- All / General Collection (Overall Due) --</option>
                    {customerDueInvoices.map(s => {
                      const sDate = s.created_at ? format(parseISO(s.created_at), 'dd MMM yyyy') : '';
                      return (
                        <option key={s.id} value={s.id}>
                          Invoice #{s.id} ({sDate}) — Due: ৳{formatCurrency(s.dueAmt)}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Customer Current Due Insight */}
              {collectForm.customerId && (
                (() => {
                  const currentCust = enrichedCustomers.find(c => c.id === collectForm.customerId);
                  const currentDue = currentCust?.totalDue || 0;
                  const payAmount = parseFloat(collectForm.amount) || 0;
                  const newRemaining = Math.max(0, currentDue - payAmount);

                  return (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-slate-600 font-medium">Current Outstanding Due:</span>
                        <span className="font-bold text-slate-900 text-sm">৳{formatCurrency(currentDue)}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                        <span className="text-slate-600 font-medium">Remaining Due After Payment:</span>
                        <span className="font-extrabold text-slate-900">৳{formatCurrency(newRemaining)}</span>
                      </div>
                    </div>
                  );
                })()
              )}

              {/* Amount to Collect */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">Amount to Collect *</label>
                  {collectForm.customerId && (
                    <button
                      type="button"
                      onClick={() => {
                        const c = enrichedCustomers.find(item => item.id === collectForm.customerId);
                        if (c) setCollectForm({ ...collectForm, amount: String(c.totalDue) });
                      }}
                      className="text-[10px] font-bold text-primary-700 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 px-2 py-0.5 rounded border border-primary-200 cursor-pointer"
                    >
                      Full Due
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">৳</span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    placeholder="0.00"
                    value={collectForm.amount}
                    onChange={(e) => setCollectForm({ ...collectForm, amount: e.target.value })}
                    className="w-full pl-8 pr-4 py-2.5 text-base font-bold text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map(m => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => setCollectForm({ ...collectForm, paymentMethod: m.id })}
                      className={cn(
                        "py-2 px-1 text-center text-xs font-bold rounded-xl border transition-all cursor-pointer",
                        collectForm.paymentMethod === m.id
                          ? "bg-primary-600 text-white border-primary-600 shadow-2xs"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      )}
                    >
                      {m.label.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date & Voucher No */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={collectForm.date}
                    onChange={(e) => setCollectForm({ ...collectForm, date: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Receipt / Voucher #</label>
                  <input
                    type="text"
                    value={collectForm.receiptNo}
                    onChange={(e) => setCollectForm({ ...collectForm, receiptNo: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Note</label>
                <input
                  type="text"
                  placeholder="Note (optional)"
                  value={collectForm.note}
                  onChange={(e) => setCollectForm({ ...collectForm, note: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCollectModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Save</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Pay Supplier Due */}
      {isPaySupplierModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in duration-150">
            <button
              onClick={() => setIsPaySupplierModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-primary-600 text-white flex items-center justify-center shadow-xs">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Pay Supplier Due</h3>
                <p className="text-xs text-slate-500">Record payments to suppliers for credit purchases</p>
              </div>
            </div>

            <form onSubmit={handleSupplierPaySubmit} className="space-y-4">
              {/* Select Supplier */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Supplier *
                </label>
                <select
                  value={supplierPayForm.supplierId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const s = enrichedSuppliers.find(item => item.id === id);
                    setSupplierPayForm({
                      ...supplierPayForm,
                      supplierId: id,
                      amount: s ? String(s.totalDue) : supplierPayForm.amount
                    });
                  }}
                  required
                  className="w-full px-3.5 py-2.5 text-xs font-semibold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
                >
                  <option value="">-- Choose Supplier --</option>
                  {enrichedSuppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.phone ? `(${s.phone})` : ''} — Due: ৳{formatCurrency(s.totalDue)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Amount to Pay *</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">৳</span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    placeholder="0.00"
                    value={supplierPayForm.amount}
                    onChange={(e) => setSupplierPayForm({ ...supplierPayForm, amount: e.target.value })}
                    className="w-full pl-8 pr-4 py-2.5 text-base font-bold text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map(m => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => setSupplierPayForm({ ...supplierPayForm, paymentMethod: m.id })}
                      className={cn(
                        "py-2 px-1 text-center text-xs font-bold rounded-xl border transition-all cursor-pointer",
                        supplierPayForm.paymentMethod === m.id
                          ? "bg-primary-600 text-white border-primary-600 shadow-2xs"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      )}
                    >
                      {m.label.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date & Ref */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={supplierPayForm.date}
                    onChange={(e) => setSupplierPayForm({ ...supplierPayForm, date: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Voucher / Ref #</label>
                  <input
                    type="text"
                    value={supplierPayForm.receiptNo}
                    onChange={(e) => setSupplierPayForm({ ...supplierPayForm, receiptNo: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Note</label>
                <input
                  type="text"
                  placeholder="Note (optional)"
                  value={supplierPayForm.note}
                  onChange={(e) => setSupplierPayForm({ ...supplierPayForm, note: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPaySupplierModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Payment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Customer Due Ledger Breakdown */}
      {isCustomerLedgerOpen && currentCustomerForLedger && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in duration-150 max-h-[90vh] flex flex-col">
            <button
              onClick={() => setIsCustomerLedgerOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-2 rounded-full hover:bg-slate-100 transition-colors z-10"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="pb-4 border-b border-slate-100 pr-10">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary-700 bg-primary-50 px-2.5 py-0.5 rounded-md border border-primary-200">
                Customer Due Ledger
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{currentCustomerForLedger.name}</h3>
              <p className="text-xs text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                {currentCustomerForLedger.phone && <span>Mobile: {currentCustomerForLedger.phone}</span>}
                {currentCustomerForLedger.address && <span>• Address: {currentCustomerForLedger.address}</span>}
              </p>
            </div>

            {/* 3 Summary KPI Boxes (Total Due Amount, Collected Total, Current Due) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
              {/* Box 1: Total Due Amount */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Total Due Amount</span>
                  <FileText className="w-4 h-4 text-slate-400" />
                </div>
                <div className="mt-2">
                  <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono block">
                    ৳{formatCurrency(customerLedgerStats.totalDueCreated)}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                    {customerSalesWithDue.length} Invoiced Bills
                  </p>
                </div>
              </div>

              {/* Box 2: Collected Total */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/90 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-emerald-800">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Collected Total</span>
                  <HandCoins className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="mt-2">
                  <span className="text-xl sm:text-2xl font-black text-emerald-700 font-mono block">
                    +৳{formatCurrency(customerLedgerStats.totalCollected)}
                  </span>
                  <p className="text-[11px] text-emerald-600 mt-0.5 font-medium">
                    {customerPaymentsHistory.length} Payments Collected
                  </p>
                </div>
              </div>

              {/* Box 3: Current Due Box */}
              <div className={cn(
                "p-3.5 rounded-2xl shadow-2xs flex flex-col justify-between border-2 transition-all",
                customerLedgerStats.currentDue > 0
                  ? "bg-amber-500/10 border-amber-400 text-amber-950"
                  : "bg-emerald-500/10 border-emerald-400 text-emerald-950"
              )}>
                <div className="flex items-center justify-between">
                  <span className={cn(
                    "text-[11px] font-extrabold uppercase tracking-wider",
                    customerLedgerStats.currentDue > 0 ? "text-amber-800" : "text-emerald-800"
                  )}>
                    Current Due
                  </span>
                  {customerLedgerStats.currentDue > 0 ? (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500 text-white shadow-2xs">
                      Pending
                    </span>
                  ) : (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-600 text-white shadow-2xs">
                      Cleared ✓
                    </span>
                  )}
                </div>
                <div className="mt-2">
                  <span className={cn(
                    "text-xl sm:text-2xl font-black font-mono tracking-tight block",
                    customerLedgerStats.currentDue > 0 ? "text-amber-800" : "text-emerald-700"
                  )}>
                    ৳{formatCurrency(customerLedgerStats.currentDue)}
                  </span>
                  <p className={cn(
                    "text-[11px] mt-0.5 font-semibold",
                    customerLedgerStats.currentDue > 0 ? "text-amber-700" : "text-emerald-600"
                  )}>
                    {customerLedgerStats.currentDue > 0 ? "Remaining Balance to Collect" : "No Due Pending ✓"}
                  </p>
                </div>
              </div>
            </div>

            {/* Content List */}
            <div className="overflow-y-auto flex-1 my-2 space-y-4 pr-1">
              {/* Invoices with Due */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 mb-2.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary-600" />
                  <span>Sales Invoices / Bills</span>
                </h4>
                <div className="space-y-2.5">
                  {customerSalesWithDue.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3 text-center">No sales recorded for this customer.</p>
                  ) : (
                    customerSalesWithDue.map(s => {
                      const curDue = s.due_amount !== undefined ? s.due_amount : (s.payment_method === 'due' ? s.total_amount : 0);
                      const linkedPayments = customerPaymentsHistory.filter(p => 
                        p.sale_id === s.id || (p.note && p.note.toLowerCase().includes(s.id.slice(-6).toLowerCase()))
                      );
                      const directCollected = linkedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

                      let initialDue = 0;
                      let collectedAmount = directCollected;

                      if (s.payment_method === 'due') {
                        initialDue = s.total_amount;
                        if (collectedAmount === 0 && curDue < s.total_amount) {
                          collectedAmount = s.total_amount - curDue;
                        }
                      } else {
                        const paidAtSale = s.paid_amount !== undefined ? s.paid_amount : (s.payment_method === 'cash' ? s.total_amount : 0);
                        initialDue = Math.max(0, s.total_amount - paidAtSale + directCollected + curDue);
                        if (initialDue === 0 && curDue > 0) {
                          initialDue = curDue;
                        }
                        if (collectedAmount === 0 && curDue < initialDue) {
                          collectedAmount = Math.max(0, initialDue - curDue);
                        }
                      }

                      if (initialDue < curDue) {
                        initialDue = curDue + collectedAmount;
                      }
                      if (initialDue === 0 && (curDue > 0 || collectedAmount > 0)) {
                        initialDue = curDue + collectedAmount;
                      }

                      return (
                        <div key={s.id} className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 shadow-2xs transition-all space-y-2.5">
                          {/* Top Row: Invoice ID, Date & Total Bill */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-xs border border-slate-200">
                                #{s.id.slice(-6)}
                              </span>
                              <span className="text-[11px] text-slate-500 font-medium">
                                {format(parseISO(s.created_at), 'dd MMM yyyy, hh:mm a')}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs text-slate-500 font-medium">Total Bill: </span>
                              <span className="text-xs font-bold text-slate-900 font-mono">৳{formatCurrency(s.total_amount)}</span>
                              <span className="text-[10px] text-slate-400 ml-1">({s.items?.length || 0} items)</span>
                            </div>
                          </div>

                          {/* 3 Metric Boxes: Total Due Amount -> Collected Total -> Current Due */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center">
                            {/* 1. Total Due Amount */}
                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                              <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block">
                                Total Due Amount
                              </span>
                              <span className="text-sm font-black text-slate-800 font-mono block mt-0.5">
                                ৳{formatCurrency(initialDue)}
                              </span>
                            </div>

                            {/* 2. Collected Total Amount */}
                            <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
                              <span className="text-[10px] font-bold uppercase text-emerald-800 tracking-wider block">
                                Collected Total
                              </span>
                              <span className="text-sm font-black text-emerald-700 font-mono block mt-0.5">
                                {collectedAmount > 0 ? `+৳${formatCurrency(collectedAmount)}` : '৳0.00'}
                              </span>
                            </div>

                            {/* 3. Current Due Box with Collect Action */}
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "p-2 rounded-xl border flex-1 text-right",
                                curDue > 0
                                  ? "bg-amber-500/10 border-amber-300 text-amber-950 shadow-2xs"
                                  : "bg-emerald-500/10 border-emerald-300 text-emerald-950"
                              )}>
                                <span className={cn(
                                  "text-[9px] font-extrabold uppercase tracking-wider block",
                                  curDue > 0 ? "text-amber-800" : "text-emerald-800"
                                  )}>
                                  Current Due
                                </span>
                                <span className={cn(
                                  "text-xs sm:text-sm font-black font-mono block",
                                  curDue > 0 ? "text-amber-800" : "text-emerald-700"
                                )}>
                                  {curDue > 0 ? `৳${formatCurrency(curDue)}` : '৳0.00 (Paid)'}
                                </span>
                              </div>

                              {curDue > 0 && (
                                <button
                                  onClick={() => {
                                    setIsCustomerLedgerOpen(false);
                                    openCollectModal(currentCustomerForLedger.id, s.id);
                                  }}
                                  className="px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer shrink-0"
                                  title="Collect this invoice due"
                                >
                                  <span>Collect</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Due Collections Received */}
              <div>
                <h4 className="text-xs font-extrabold text-slate-700 mb-2 flex items-center gap-1.5">
                  <HandCoins className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Due Payments Collected</span>
                </h4>
                <div className="space-y-2">
                  {customerPaymentsHistory.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3 text-center">No due payment records yet.</p>
                  ) : (
                    customerPaymentsHistory.map(p => (
                      <div key={p.id} className="p-3 rounded-xl border border-emerald-100 bg-emerald-50/40 flex items-center justify-between text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-800">{p.receipt_no || p.id.slice(-6)}</span>
                            <span className="text-[11px] text-slate-500">
                              {p.payment_date || format(parseISO(p.created_at), 'yyyy-MM-dd')}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase">
                              {p.payment_method}
                            </span>
                          </div>
                          {p.note && <p className="text-[11px] text-slate-500 mt-0.5 italic">{p.note}</p>}
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <span className="font-black text-emerald-700 text-sm">
                            + ৳{formatCurrency(p.amount)}
                          </span>
                          <button
                            onClick={() => {
                              setSelectedDuePayment(p);
                              setIsReceiptModalOpen(true);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors"
                            title="Print Voucher"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                onClick={() => {
                  setIsCustomerLedgerOpen(false);
                  openReminderModal({
                    id: currentCustomerForLedger.id,
                    name: currentCustomerForLedger.name,
                    phone: currentCustomerForLedger.phone,
                    due: currentCustomerForLedger.totalDue
                  });
                }}
                className="px-4 py-2 text-xs font-bold text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Send Reminder</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsCustomerLedgerOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
                {currentCustomerForLedger.totalDue > 0 && (
                  <button
                    onClick={() => {
                      setIsCustomerLedgerOpen(false);
                      openCollectModal(currentCustomerForLedger.id);
                    }}
                    className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <HandCoins className="w-3.5 h-3.5" />
                    <span>Collect Due</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Printable Due Payment Receipt Voucher */}
      {isReceiptModalOpen && selectedDuePayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in duration-150">
            <button
              onClick={() => setIsReceiptModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors print:hidden"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Receipt Body */}
            <div id="due-voucher-print" className="p-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/40 text-center space-y-4">
              {/* Header */}
              <div>
                {businessSettings?.invoice_show_logo !== false && businessSettings?.logo && businessSettings?.invoice_show_name !== false ? (
                  <div className="flex items-center justify-center gap-2.5 mb-1">
                    <img src={businessSettings.logo} alt="Logo" className="h-10 w-auto max-h-12 object-contain" />
                    <div className="text-left">
                      <h2 className="text-lg font-black text-slate-900 tracking-tight leading-tight">
                        {businessSettings?.name || 'BizFlow Store'}
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
                        {businessSettings?.name || 'BizFlow Store'}
                      </h2>
                    )}
                  </>
                )}
                {businessSettings?.address && <p className="text-xs text-slate-500">{businessSettings.address}</p>}
                {businessSettings?.invoice_show_phone !== false && businessSettings?.phone && <p className="text-xs text-slate-500">Phone: {businessSettings.phone}</p>}
                <div className="inline-block mt-2 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-900 text-white">
                  {selectedDuePayment.type === 'customer_collection' ? 'Due Collection Voucher' : 'Supplier Payment Voucher'}
                </div>
              </div>

              {/* Info Details */}
              <div className="border-t border-b border-slate-200 py-3 text-left text-xs space-y-1.5 font-medium text-slate-600">
                <div className="flex justify-between">
                  <span>Voucher No:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedDuePayment.receipt_no || selectedDuePayment.id}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span className="font-bold text-slate-900">
                    {selectedDuePayment.payment_date || format(parseISO(selectedDuePayment.created_at), 'dd MMM yyyy')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{selectedDuePayment.type === 'customer_collection' ? 'Customer:' : 'Supplier:'}</span>
                  <span className="font-bold text-slate-900">{selectedDuePayment.party_name}</span>
                </div>
                {selectedDuePayment.party_phone && (
                  <div className="flex justify-between">
                    <span>Phone:</span>
                    <span className="text-slate-800">{selectedDuePayment.party_phone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Payment Method:</span>
                  <span className="capitalize font-bold text-slate-800">{selectedDuePayment.payment_method}</span>
                </div>
              </div>

              {/* Amount Highlight */}
              <div className="py-2">
                <span className="text-xs text-slate-500 font-bold block mb-0.5">Amount Paid</span>
                <span className="text-3xl font-black text-emerald-700 tracking-tight">
                  ৳{formatCurrency(selectedDuePayment.amount)}
                </span>
              </div>

              {selectedDuePayment.note && (
                <p className="text-[11px] text-slate-500 italic bg-white p-2 rounded-lg border border-slate-100">
                  Note: {selectedDuePayment.note}
                </p>
              )}

              {/* Footer Signatures */}
              <div className="pt-6 flex justify-between text-[10px] text-slate-400">
                <div className="text-center">
                  <div className="w-20 border-t border-slate-300 mb-1"></div>
                  <span>Customer Sign</span>
                </div>
                <div className="text-center">
                  <div className="w-20 border-t border-slate-300 mb-1"></div>
                  <span>Authorized Sign</span>
                </div>
              </div>
            </div>

            {/* Print & Action Buttons */}
            <div className="flex items-center justify-end gap-3 mt-5 print:hidden">
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Friendly Payment Reminder (SMS / WhatsApp) */}
      {isReminderModalOpen && reminderCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in duration-150">
            <button
              onClick={() => setIsReminderModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-primary-600 text-white flex items-center justify-center shadow-xs">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Payment Reminder</h3>
                <p className="text-xs text-slate-500">Send friendly payment reminder to {reminderCustomer.name}</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs mb-4">
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-slate-700">Customer:</span>
                <span className="font-bold text-slate-900">{reminderCustomer.name}</span>
              </div>
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-slate-700">Phone:</span>
                <span className="font-bold text-slate-900">{reminderCustomer.phone || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                <span className="font-semibold text-slate-700">Outstanding Due:</span>
                <span className="font-bold text-slate-900 text-sm">৳{formatCurrency(reminderCustomer.due)}</span>
              </div>
            </div>

            {/* Generated Message */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Preview Message:</label>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed font-sans select-all">
                {getReminderMessage(reminderCustomer.name, reminderCustomer.due)}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-2 mt-5">
              <button
                type="button"
                onClick={() => handleCopyReminder(getReminderMessage(reminderCustomer.name, reminderCustomer.due))}
                className="w-full sm:flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {copiedText ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copiedText ? 'Copied to Clipboard!' : 'Copy Text'}</span>
              </button>

              {reminderCustomer.phone && (
                <a
                  href={`https://wa.me/${reminderCustomer.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(getReminderMessage(reminderCustomer.name, reminderCustomer.due))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Send WhatsApp</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED DELETE CONFIRMATION MODAL */}
      {deleteConfirm.isOpen && deleteConfirm.payment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <Card className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 relative">
            <button
              onClick={() => setDeleteConfirm({ isOpen: false })}
              className="absolute right-5 top-5 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Payment Record</h3>
                <p className="text-xs font-mono text-slate-500">
                  Receipt #{deleteConfirm.payment.receipt_no || deleteConfirm.payment.id}
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs mb-4 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">Party:</span>
                <span className="font-bold text-slate-900">{deleteConfirm.payment.party_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">Amount:</span>
                <span className="font-bold text-slate-900 text-sm">৳{formatCurrency(deleteConfirm.payment.amount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">Type:</span>
                <span className="font-semibold text-slate-700 capitalize">
                  {deleteConfirm.payment.type === 'customer_collection' ? '+ Customer Due Collection' : '- Supplier Due Payment'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">Payment Date:</span>
                <span className="font-medium text-slate-700">
                  {deleteConfirm.payment.payment_date || '-'}
                </span>
              </div>
              {deleteConfirm.payment.note && (
                <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                  <span className="text-slate-600 font-medium">Note:</span>
                  <span className="text-slate-800 italic">{deleteConfirm.payment.note}</span>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-5">
              Are you sure you want to permanently delete this payment transaction?
              {deleteConfirm.payment.type === 'customer_collection'
                ? " This will also restore the customer's outstanding due balance."
                : " This will restore the supplier's due payable balance."}
            </p>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                disabled={deleteConfirm.isDeleting}
                onClick={() => setDeleteConfirm({ isOpen: false })}
                className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirm.isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{deleteConfirm.isDeleting ? 'Deleting...' : 'Delete Record'}</span>
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
