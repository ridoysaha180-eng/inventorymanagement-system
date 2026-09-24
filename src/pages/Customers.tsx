import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Mail, Phone, MapPin, Edit2, Trash2, X, Eye, 
  FileSpreadsheet, Download, Printer, Users, ShoppingBag, 
  DollarSign, ArrowUpRight, Layers, CheckCircle2, AlertCircle,
  Calendar, CreditCard, Banknote, UserCheck, ChevronRight, TrendingUp,
  HandCoins
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { formatCurrency, cn, calculateSaleFinancials } from '../utils';
import { storageService } from '../services/storageService';
import { Customer, Sale, InventoryItem, Purchase, Supplier } from '../types';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useSearchParams, useNavigate } from 'react-router-dom';

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDate().toString().padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

export const Customers: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dueFilter, setDueFilter] = useState<'all' | 'has_due' | 'no_due' | 'no_orders'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'orders' | 'spent' | 'profit' | 'due' | 'recent'>('name');
  const [viewMode, setViewMode] = useState<'directory' | 'orders_ledger'>('directory');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id?: string; name?: string }>({ isOpen: false });

  // Customer Ledger Modal
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [ledgerStartDate, setLedgerStartDate] = useState('');
  const [ledgerEndDate, setLedgerEndDate] = useState('');

  // Selected Sale for Detailed Invoice Modal
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });

  const businessSettings = storageService.getBusinessSettings();

  useEffect(() => {
    loadData();

    const handleDataUpdate = () => {
      loadData();
    };

    window.addEventListener('bizflow_purchases_updated', handleDataUpdate);
    window.addEventListener('bizflow_inventory_updated', handleDataUpdate);
    window.addEventListener('bizflow_sales_updated', handleDataUpdate);
    window.addEventListener('bizflow_customers_updated', handleDataUpdate);
    window.addEventListener('storage', handleDataUpdate);

    return () => {
      window.removeEventListener('bizflow_purchases_updated', handleDataUpdate);
      window.removeEventListener('bizflow_inventory_updated', handleDataUpdate);
      window.removeEventListener('bizflow_sales_updated', handleDataUpdate);
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
    setCustomers(storageService.getCustomers() || []);
    setSales(storageService.getSales() || []);
    setInventory(storageService.getInventory() || []);
    setPurchases(storageService.getPurchases() || []);
    setSuppliers(storageService.getSuppliers() || []);
  };

  // Compute enriched customer data with financial stats (revenue, profit, due)
  const enrichedCustomers = useMemo(() => {
    return customers.map(cust => {
      const custSales = sales.filter(s => s.customer_id === cust.id);
      const totalSpent = custSales.reduce((sum, s) => sum + s.total_amount, 0);
      const totalDue = custSales
        .reduce((sum, s) => {
          if (s.due_amount !== undefined) return sum + s.due_amount;
          return (s.payment_method === 'due' || s.status === 'pending') ? sum + s.total_amount : sum;
        }, 0);
      
      let totalProfit = 0;
      custSales.forEach(s => {
        const fin = calculateSaleFinancials(s, inventory, purchases, suppliers, sales);
        totalProfit += fin.profit;
      });

      const profitMargin = totalSpent > 0 ? (totalProfit / totalSpent) * 100 : 0;
      
      const sortedSales = [...custSales].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const lastOrderDate = sortedSales.length > 0 ? sortedSales[0].created_at : null;

      return {
        ...cust,
        ordersCount: custSales.length,
        totalSpent,
        totalProfit,
        profitMargin,
        totalDue,
        lastOrderDate,
        sales: custSales
      };
    });
  }, [customers, sales, inventory, purchases, suppliers]);

  // Overall Global KPI Metrics
  const kpiStats = useMemo(() => {
    const totalCustomersCount = customers.length;
    const registeredSales = sales.filter(s => Boolean(s.customer_id));
    const totalRevenueFromCustomers = registeredSales.reduce((sum, s) => sum + s.total_amount, 0);
    const totalDueFromCustomers = registeredSales
      .reduce((sum, s) => {
        if (s.due_amount !== undefined) return sum + s.due_amount;
        return (s.payment_method === 'due' || s.status === 'pending') ? sum + s.total_amount : sum;
      }, 0);
    
    let totalProfitFromCustomers = 0;
    registeredSales.forEach(s => {
      const fin = calculateSaleFinancials(s, inventory, purchases, suppliers, sales);
      totalProfitFromCustomers += fin.profit;
    });

    const overallMargin = totalRevenueFromCustomers > 0 ? (totalProfitFromCustomers / totalRevenueFromCustomers) * 100 : 0;
    const customersWithDue = enrichedCustomers.filter(c => c.totalDue > 0);
    const activeBuyersCount = enrichedCustomers.filter(c => c.ordersCount > 0).length;
    const avgSpentPerCustomer = totalCustomersCount > 0 ? (totalRevenueFromCustomers / totalCustomersCount) : 0;

    // Top Customer
    const sortedBySpent = [...enrichedCustomers].sort((a, b) => b.totalSpent - a.totalSpent);
    const topCustomer = sortedBySpent.length > 0 && sortedBySpent[0].totalSpent > 0 ? sortedBySpent[0] : null;

    return {
      totalCustomersCount,
      totalRevenueFromCustomers,
      totalProfitFromCustomers,
      overallMargin,
      totalOrdersCount: registeredSales.length,
      totalDueFromCustomers,
      customersWithDueCount: customersWithDue.length,
      activeBuyersCount,
      avgSpentPerCustomer,
      topCustomerName: topCustomer ? topCustomer.name : 'None yet'
    };
  }, [customers, sales, inventory, enrichedCustomers]);

  // Filter and Sort Customers
  const filteredCustomers = useMemo(() => {
    return enrichedCustomers
      .filter(cust => {
        const query = searchTerm.toLowerCase();
        const matchesSearch = 
          cust.name.toLowerCase().includes(query) ||
          (cust.phone || '').includes(query) ||
          (cust.email || '').toLowerCase().includes(query) ||
          (cust.address || '').toLowerCase().includes(query);

        if (!matchesSearch) return false;

        if (dueFilter === 'has_due') return cust.totalDue > 0;
        if (dueFilter === 'no_due') return cust.totalDue === 0 && cust.ordersCount > 0;
        if (dueFilter === 'no_orders') return cust.ordersCount === 0;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'orders') return b.ordersCount - a.ordersCount;
        if (sortBy === 'spent') return b.totalSpent - a.totalSpent;
        if (sortBy === 'profit') return b.totalProfit - a.totalProfit;
        if (sortBy === 'due') return b.totalDue - a.totalDue;
        if (sortBy === 'recent') {
          const dateA = a.lastOrderDate ? new Date(a.lastOrderDate).getTime() : 0;
          const dateB = b.lastOrderDate ? new Date(b.lastOrderDate).getTime() : 0;
          return dateB - dateA;
        }
        return 0;
      });
  }, [enrichedCustomers, searchTerm, dueFilter, sortBy]);

  // Table Footers Sum for Current View
  const filteredTotals = useMemo(() => {
    let orders = 0;
    let spent = 0;
    let profit = 0;
    let due = 0;
    filteredCustomers.forEach(c => {
      orders += c.ordersCount;
      spent += c.totalSpent;
      profit += c.totalProfit;
      due += c.totalDue;
    });
    return { orders, spent, profit, due };
  }, [filteredCustomers]);

  // Orders Ledger View Data
  const customerLedgerOrders = useMemo(() => {
    const list: (Sale & { customerName: string; customerPhone: string; profit: number })[] = [];
    sales.forEach(sale => {
      const cust = customers.find(c => c.id === sale.customer_id);
      const query = searchTerm.toLowerCase();
      const name = cust ? cust.name : 'Walk-in Customer';
      const phone = cust ? (cust.phone || '') : '';
      
      const matchesSearch = 
        name.toLowerCase().includes(query) ||
        phone.includes(query) ||
        sale.id.toLowerCase().includes(query);

      if (matchesSearch) {
        const fin = calculateSaleFinancials(sale, inventory, purchases, suppliers, sales);
        list.push({
          ...sale,
          customerName: name,
          customerPhone: phone,
          profit: fin.profit
        });
      }
    });

    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [sales, customers, inventory, purchases, searchTerm]);

  // Form Handlers
  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setFormData({ name: '', email: '', phone: '', address: '' });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editingCustomer) {
      storageService.updateCustomer(editingCustomer.id, {
        ...editingCustomer,
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim()
      });
    } else {
      storageService.addCustomer({
        id: Math.random().toString(36).substr(2, 9),
        user_id: '123',
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        created_at: new Date().toISOString()
      });
    }

    setIsModalOpen(false);
    setEditingCustomer(null);
    loadData();
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      await storageService.deleteCustomer(deleteConfirm.id);
      loadData();
    } catch (error) {
      console.error('Delete customer error:', error);
    }
    setDeleteConfirm({ isOpen: false });
  };

  // Export Excel
  const handleExportExcel = () => {
    const data = filteredCustomers.map((cust, idx) => ({
      'SL': idx + 1,
      'Customer Name': cust.name,
      'Phone': cust.phone || 'N/A',
      'Email': cust.email || 'N/A',
      'Address': cust.address || 'N/A',
      'Total Orders': cust.ordersCount,
      'Total Spent (BDT)': cust.totalSpent,
      'Total Profit (BDT)': cust.totalProfit,
      'Profit Margin (%)': `${cust.profitMargin.toFixed(1)}%`,
      'Outstanding Due (BDT)': cust.totalDue,
      'Last Order Date': formatDate(cust.lastOrderDate || ''),
      'Joined Date': formatDate(cust.created_at)
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');
    XLSX.writeFile(wb, `Customers_Directory_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Export PDF Report
  const handleExportPDF = () => {
    const doc = new jsPDF('landscape');
    const pageWidth = doc.internal.pageSize.width;
    const shopName = (businessSettings?.name || 'BIZFLOW').toUpperCase();

    // Top Header Banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.roundedRect(14, 10, pageWidth - 28, 22, 2, 2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`${shopName} - CUSTOMERS REPORT`, 20, 21);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(`Generated: ${new Date().toLocaleString()} | Total Records: ${filteredCustomers.length}`, 20, 28);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`Total Billed: ${formatCurrency(filteredTotals.spent)}`, pageWidth - 110, 21);
    doc.text(`Total Profit: ${formatCurrency(filteredTotals.profit)}`, pageWidth - 110, 28);
    doc.text(`Total Due: ${formatCurrency(filteredTotals.due)}`, pageWidth - 50, 21);

    const tableData = filteredCustomers.map((c, idx) => [
      idx + 1,
      c.name,
      c.phone || '-',
      c.address || '-',
      c.ordersCount,
      formatCurrency(c.totalSpent),
      formatCurrency(c.totalProfit),
      formatCurrency(c.totalDue),
      formatDate(c.lastOrderDate || '')
    ]);

    autoTable(doc, {
      startY: 36,
      head: [['#', 'Customer Name', 'Phone', 'Address', 'Orders', 'Total Spent', 'Profit', 'Due Balance', 'Last Order']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5
      },
      styles: {
        fontSize: 8,
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 46, fontStyle: 'bold' },
        2: { cellWidth: 28 },
        3: { cellWidth: 48 },
        4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 28, halign: 'right' },
        6: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
        7: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
        8: { cellWidth: 28, halign: 'center' }
      }
    });

    doc.save(`Customers_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // Filtered Orders for the Single Customer Modal
  const currentViewingCustomerOrders = useMemo(() => {
    if (!viewingCustomer) return [];
    let custSales = sales.filter(s => s.customer_id === viewingCustomer.id);

    if (ledgerStartDate) {
      custSales = custSales.filter(s => new Date(s.created_at) >= new Date(ledgerStartDate));
    }
    if (ledgerEndDate) {
      const end = new Date(ledgerEndDate);
      end.setHours(23, 59, 59, 999);
      custSales = custSales.filter(s => new Date(s.created_at) <= end);
    }

    return custSales.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [viewingCustomer, sales, ledgerStartDate, ledgerEndDate]);

  // Download Statement for Single Customer
  const handleDownloadCustomerStatement = (customer: Customer) => {
    const doc = new jsPDF('portrait', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    const shopName = (businessSettings?.name || 'BIZFLOW').toUpperCase();

    // Top Accent Bar
    doc.setFillColor(14, 165, 233); // sky-500
    doc.rect(0, 0, pageWidth, 4, 'F');

    // Shop Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(shopName, 14, 17);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    let topY = 22;
    if (businessSettings?.address) {
      doc.text(businessSettings.address, 14, topY);
      topY += 4.5;
    }
    if (businessSettings?.phone) {
      doc.text(`Phone: ${businessSettings.phone}`, 14, topY);
      topY += 4.5;
    }

    // Right Side: Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('CUSTOMER ACCOUNT STATEMENT', pageWidth - 14, 18, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Statement Date: ${new Date().toLocaleDateString()}`, pageWidth - 14, 23.5, { align: 'right' });

    // Customer Box
    const boxY = Math.max(topY + 2, 33);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, boxY, pageWidth - 28, 22, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('CUSTOMER INFORMATION', 18, boxY + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(customer.name, 18, boxY + 11.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const details = [];
    if (customer.phone) details.push(`Phone: ${customer.phone}`);
    if (customer.email) details.push(`Email: ${customer.email}`);
    if (customer.address) details.push(`Address: ${customer.address}`);
    doc.text(details.join(' | ') || 'No additional contact details', 18, boxY + 17);

    const custSales = sales.filter(s => s.customer_id === customer.id);
    const totalSpent = custSales.reduce((sum, s) => sum + s.total_amount, 0);
    const totalDue = custSales.reduce((sum, s) => {
      if (s.due_amount !== undefined) return sum + s.due_amount;
      return (s.payment_method === 'due' || s.status === 'pending') ? sum + s.total_amount : sum;
    }, 0);

    const tableRows = custSales.map(s => [
      formatDate(s.created_at),
      `#${s.id}`,
      (s.items || []).map(i => `${i.item_name} (x${i.quantity})`).join(', '),
      s.payment_method.toUpperCase(),
      s.status.toUpperCase(),
      formatCurrency(s.total_amount)
    ]);

    autoTable(doc, {
      startY: boxY + 26,
      head: [['Date', 'Invoice #', 'Items', 'Payment', 'Status', 'Amount']],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5
      },
      styles: {
        fontSize: 8,
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 26, fontStyle: 'bold' },
        2: { cellWidth: 70 },
        3: { cellWidth: 20, halign: 'center' },
        4: { cellWidth: 20, halign: 'center' },
        5: { cellWidth: 26, halign: 'right', fontStyle: 'bold' }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 8;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(pageWidth - 80, finalY, 66, 20, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Total Invoiced:', pageWidth - 76, finalY + 6);
    doc.text(formatCurrency(totalSpent), pageWidth - 18, finalY + 6, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(totalDue > 0 ? 225 : 15, totalDue > 0 ? 29 : 23, totalDue > 0 ? 72 : 42);
    doc.text('Current Balance Due:', pageWidth - 76, finalY + 14);
    doc.text(formatCurrency(totalDue), pageWidth - 18, finalY + 14, { align: 'right' });

    doc.save(`Statement_${customer.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="relative py-6 px-6 bg-gradient-to-b from-slate-50/90 via-white to-slate-50/40 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center text-center overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary-500 via-sky-500 to-emerald-500" />
        
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-wider uppercase font-['Outfit',sans-serif]">
          CUSTOMERS
        </h1>
        <p className="text-sm sm:text-base font-medium text-slate-500 mt-2 max-w-lg leading-relaxed">
          Manage customer directories, sales ledgers, outstanding balances, and receivables.
        </p>

        {/* Dynamic Action in Header */}
        <div className="mt-4 flex items-center gap-3">
          <Button 
            onClick={handleOpenAddModal}
            className="bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Customer</span>
          </Button>
        </div>
      </div>

      {/* 5 Metric KPI Cards including Customer Revenue & Profit */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Customers */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Customers</p>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              {kpiStats.activeBuyersCount} Active
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{kpiStats.totalCustomersCount}</p>
          <p className="text-xs text-slate-400 mt-1">Registered customer profiles</p>
        </Card>

        {/* Card 2: Total Sales from Customers */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer Revenue</p>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              {kpiStats.totalOrdersCount} Orders
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900">৳{formatCurrency(kpiStats.totalRevenueFromCustomers)}</p>
          <p className="text-xs text-slate-400 mt-1">Total lifetime orders value</p>
        </Card>

        {/* Card 3: Total Profit from Customers */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer Profit</p>
            <span className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 rounded border",
              kpiStats.totalProfitFromCustomers >= 0 
                ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                : "bg-rose-50 text-rose-700 border-rose-200"
            )}>
              {kpiStats.overallMargin.toFixed(1)}% Margin
            </span>
          </div>
          <p className={cn(
            "text-2xl font-bold",
            kpiStats.totalProfitFromCustomers >= 0 ? "text-emerald-700" : "text-rose-600"
          )}>
            {kpiStats.totalProfitFromCustomers < 0 ? '-' : ''}৳{formatCurrency(Math.abs(kpiStats.totalProfitFromCustomers))}
          </p>
          <p className="text-xs text-slate-400 mt-1">Total realized gross profit</p>
        </Card>

        {/* Card 4: Total Outstanding Due */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Outstanding Due</p>
            {kpiStats.customersWithDueCount > 0 ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                {kpiStats.customersWithDueCount} Due
              </span>
            ) : (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                All Cleared
              </span>
            )}
          </div>
          <p className={cn("text-2xl font-bold", kpiStats.totalDueFromCustomers > 0 ? "text-rose-600" : "text-emerald-700")}>
            ৳{formatCurrency(kpiStats.totalDueFromCustomers)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Pending payments to collect</p>
        </Card>

        {/* Card 5: Avg Customer Value */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg. Customer Value</p>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
              Lifetime
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900">৳{formatCurrency(kpiStats.avgSpentPerCustomer)}</p>
          <p className="text-xs text-slate-400 mt-1 truncate">
            Top: <strong className="text-slate-700">{kpiStats.topCustomerName}</strong>
          </p>
        </Card>
      </div>

      {/* Main Content Card with Comprehensive Toolbar & Views matching Sales.tsx */}
      <Card className="p-0 border-slate-200 shadow-sm bg-white overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search customer name, phone, email, address..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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

          {/* Filter Options & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Due Status Filter */}
            <select 
              className="bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 h-9"
              value={dueFilter}
              onChange={(e) => setDueFilter(e.target.value as any)}
            >
              <option value="all">All Statuses</option>
              <option value="has_due">Has Outstanding Due</option>
              <option value="no_due">Cleared (No Due)</option>
              <option value="no_orders">No Orders Placed</option>
            </select>

            {/* Sort Dropdown */}
            <select 
              className="bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 h-9"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="name">Sort: Name (A-Z)</option>
              <option value="spent">Sort: Highest Spent</option>
              <option value="profit">Sort: Highest Profit</option>
              <option value="due">Sort: Highest Due</option>
              <option value="orders">Sort: Most Orders</option>
              <option value="recent">Sort: Recently Ordered</option>
            </select>

            {/* View Mode Toggle Button */}
            <Button 
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === 'directory' ? 'orders_ledger' : 'directory')}
              className={cn(
                "text-xs font-semibold h-9",
                viewMode === 'orders_ledger' ? "bg-primary-50 text-primary-700 border-primary-300" : "text-slate-700"
              )}
            >
              <Layers className="w-4 h-4 mr-1.5" />
              {viewMode === 'orders_ledger' ? 'Customers Directory' : 'Orders Ledger View'}
            </Button>

            {/* Export Excel */}
            <button 
              type="button"
              onClick={handleExportExcel} 
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 shadow-2xs transition-all duration-150 cursor-pointer h-9 active:scale-[0.98]"
              title="Download Customers Excel Report"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Excel</span>
            </button>

            {/* Export PDF */}
            <button 
              type="button"
              onClick={handleExportPDF} 
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 hover:border-primary-300 shadow-2xs transition-all duration-150 cursor-pointer h-9 active:scale-[0.98]"
              title="Download Customers PDF Report"
            >
              <Download className="w-4 h-4 text-primary-600" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* View 1: Main Customers Directory Table */}
        {viewMode === 'directory' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-left whitespace-nowrap">#</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-left whitespace-nowrap">Customer</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-left whitespace-nowrap">Contact</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-left whitespace-nowrap">Address</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">Orders</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Total Spent</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Profit</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Due Balance</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">Last Order</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map((cust, idx) => (
                    <tr 
                      key={cust.id} 
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      onClick={() => setViewingCustomer(cust)}
                    >
                      <td className="px-5 py-3.5 text-xs text-slate-400 font-mono">
                        {idx + 1}
                      </td>

                      {/* Customer Name & Initial */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-primary-50 text-primary-700 border border-primary-200 rounded-xl flex items-center justify-center font-bold text-sm shrink-0">
                            {cust.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-sm font-bold text-slate-900 block group-hover:text-primary-600 transition-colors">
                              {cust.name}
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium">
                              Joined {formatDate(cust.created_at)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="space-y-1 text-xs">
                          {cust.phone ? (
                            <div className="flex items-center text-slate-700 font-medium">
                              <Phone className="w-3.5 h-3.5 mr-1.5 text-slate-400 shrink-0" />
                              {cust.phone}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">No phone</span>
                          )}
                          {cust.email && (
                            <div className="flex items-center text-slate-500 text-[11px]">
                              <Mail className="w-3 h-3 mr-1.5 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[150px]">{cust.email}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Address */}
                      <td className="px-5 py-3.5">
                        {cust.address ? (
                          <div className="flex items-start text-xs text-slate-600 max-w-[200px]">
                            <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0 mt-0.5" />
                            <span className="truncate">{cust.address}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>

                      {/* Orders Count */}
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {cust.ordersCount}
                        </span>
                      </td>

                      {/* Total Spent */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap text-sm font-bold text-slate-900 font-mono">
                        ৳{formatCurrency(cust.totalSpent)}
                      </td>

                      {/* Profit */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex flex-col items-end">
                          <span className={cn(
                            "text-sm font-bold font-mono",
                            cust.totalProfit >= 0 ? "text-emerald-700" : "text-rose-600"
                          )}>
                            {cust.totalProfit < 0 ? '-' : ''}৳{formatCurrency(Math.abs(cust.totalProfit))}
                          </span>
                          {cust.totalSpent > 0 && (
                            <span className={cn(
                              "text-[10px] font-semibold px-1 rounded",
                              cust.totalProfit >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                            )}>
                              {cust.profitMargin.toFixed(1)}% margin
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Due Balance */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        {cust.totalDue > 0 ? (
                          <span className="inline-block px-2.5 py-1 rounded-md text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 font-mono">
                            ৳{formatCurrency(cust.totalDue)}
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Cleared
                          </span>
                        )}
                      </td>

                      {/* Last Order Date */}
                      <td className="px-5 py-3.5 text-center whitespace-nowrap text-xs text-slate-500 font-medium">
                        {formatDate(cust.lastOrderDate || '')}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {cust.totalDue > 0 && (
                            <button
                              type="button"
                              onClick={() => navigate('/dues', { state: { openCollect: true, customerId: cust.id } })}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                              title="Collect Due"
                            >
                              <HandCoins className="w-3.5 h-3.5" />
                              <span>Collect</span>
                            </button>
                          )}
                          <button 
                            type="button"
                            onClick={() => setViewingCustomer(cust)}
                            className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="View Orders & Statement"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleOpenEditModal(cust)}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Edit Customer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => setDeleteConfirm({ isOpen: true, id: cust.id, name: cust.name })}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Customer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-slate-400 text-sm">
                      No customers found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>

              {/* Table Summary Footer matching Sales.tsx */}
              {filteredCustomers.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100/80 font-bold text-slate-900 border-t border-slate-200 text-xs">
                    <td colSpan={4} className="px-5 py-3 text-slate-700 uppercase tracking-wider">
                      Total ({filteredCustomers.length} Customers)
                    </td>
                    <td className="px-5 py-3 text-center text-slate-900 font-mono">
                      {filteredTotals.orders} orders
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-slate-900">
                      ৳{formatCurrency(filteredTotals.spent)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-emerald-700">
                      ৳{formatCurrency(filteredTotals.profit)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-rose-600">
                      ৳{formatCurrency(filteredTotals.due)}
                    </td>
                    <td colSpan={2} className="px-5 py-3 text-right text-slate-400 font-normal">
                      Filtered Summary
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        ) : (
          /* View 2: Customer Orders Ledger View */
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider whitespace-nowrap">Invoice #</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider whitespace-nowrap">Customer</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">Date</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">Items</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">Payment</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Total Amount</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Profit</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">Status</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customerLedgerOrders.length > 0 ? (
                  customerLedgerOrders.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-primary-700 bg-primary-50 border border-primary-100 px-2 py-1 rounded-md">
                          #{sale.id}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="text-sm font-bold text-slate-900 block">{sale.customerName}</span>
                        {sale.customerPhone && <span className="text-xs text-slate-400 font-mono">{sale.customerPhone}</span>}
                      </td>
                      <td className="px-5 py-3.5 text-center whitespace-nowrap text-xs text-slate-500 font-medium">
                        {formatDate(sale.created_at)}
                      </td>
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                          {sale.items.length} items
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-slate-100 text-slate-700">
                          {sale.payment_method}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap text-sm font-bold text-slate-900 font-mono">
                        ৳{formatCurrency(sale.total_amount)}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <span className={cn(
                          "inline-block font-mono text-xs font-bold px-2 py-0.5 rounded",
                          sale.profit >= 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                        )}>
                          {sale.profit < 0 ? '-' : ''}৳{formatCurrency(Math.abs(sale.profit))}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase border",
                          sale.status === 'completed' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          sale.status === 'pending' ? "bg-amber-50 text-amber-700 border-amber-200" :
                          "bg-rose-50 text-rose-700 border-rose-200"
                        )}>
                          {sale.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setSelectedSale(sale)}
                          className="h-7 px-2 text-xs text-primary-600 border-primary-200 hover:bg-primary-50 inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Invoice</span>
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-400 text-sm">
                      No customer orders found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Customer Account Ledger & Order History Modal */}
      {viewingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <Card className="w-full max-w-4xl shadow-2xl my-8 relative flex flex-col max-h-[90vh] p-0 border-slate-200 overflow-hidden bg-white">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-primary-100 text-primary-700 rounded-xl flex items-center justify-center font-bold text-lg border border-primary-200 shrink-0">
                  {viewingCustomer.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{viewingCustomer.name}</h2>
                  <p className="text-xs text-slate-500">
                    {viewingCustomer.phone || 'No phone'} • {viewingCustomer.email || 'No email'} • {viewingCustomer.address || 'No address'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  onClick={() => handleDownloadCustomerStatement(viewingCustomer)}
                  className="bg-primary-600 hover:bg-primary-700 text-white text-xs inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Statement PDF</span>
                </Button>
                <button 
                  onClick={() => setViewingCustomer(null)} 
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Customer Summary Cards */}
            {(() => {
              const custSales = sales.filter(s => s.customer_id === viewingCustomer.id);
              const custTotalSpent = custSales.reduce((sum, s) => sum + s.total_amount, 0);
              const custTotalProfit = custSales.reduce((sum, s) => sum + calculateSaleFinancials(s, inventory, purchases, suppliers, sales).profit, 0);
              const custProfitMargin = custTotalSpent > 0 ? (custTotalProfit / custTotalSpent) * 100 : 0;
              const custTotalDue = custSales
                .reduce((sum, s) => {
                  if (s.due_amount !== undefined) return sum + s.due_amount;
                  return (s.payment_method === 'due' || s.status === 'pending') ? sum + s.total_amount : sum;
                }, 0);

              return (
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-b border-slate-100 bg-white">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <p className="text-xs font-semibold text-slate-500 uppercase">Total Orders</p>
                    <p className="text-xl font-bold text-slate-900 mt-0.5">
                      {custSales.length}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <p className="text-xs font-semibold text-slate-500 uppercase">Lifetime Billed</p>
                    <p className="text-xl font-bold text-slate-900 mt-0.5 font-mono">
                      ৳{formatCurrency(custTotalSpent)}
                    </p>
                  </div>
                  <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-emerald-800 uppercase">Net Profit</p>
                      {custTotalSpent > 0 && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded">
                          {custProfitMargin.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <p className={cn(
                      "text-xl font-bold mt-0.5 font-mono",
                      custTotalProfit >= 0 ? "text-emerald-700" : "text-rose-600"
                    )}>
                      {custTotalProfit < 0 ? '-' : ''}৳{formatCurrency(Math.abs(custTotalProfit))}
                    </p>
                  </div>
                  <div className="p-3 bg-rose-50/70 rounded-xl border border-rose-200">
                    <p className="text-xs font-semibold text-rose-700 uppercase">Current Due Balance</p>
                    <p className="text-xl font-bold text-rose-700 mt-0.5 font-mono">
                      ৳{formatCurrency(custTotalDue)}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Date Range Filter Toolbar inside Modal */}
            <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600">Filter Invoices:</span>
                <input 
                  type="date"
                  value={ledgerStartDate}
                  onChange={e => setLedgerStartDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none"
                />
                <span className="text-slate-400">to</span>
                <input 
                  type="date"
                  value={ledgerEndDate}
                  onChange={e => setLedgerEndDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none"
                />
                {(ledgerStartDate || ledgerEndDate) && (
                  <button 
                    onClick={() => { setLedgerStartDate(''); setLedgerEndDate(''); }}
                    className="text-primary-600 hover:underline font-semibold ml-1"
                  >
                    Reset
                  </button>
                )}
              </div>
              <span className="text-slate-500 font-medium">
                Showing {currentViewingCustomerOrders.length} records
              </span>
            </div>

            {/* Orders Table */}
            <div className="overflow-y-auto flex-1 max-h-[50vh]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 shadow-2xs">
                  <tr>
                    <th className="px-5 py-2.5 font-semibold text-slate-600 uppercase">Date</th>
                    <th className="px-5 py-2.5 font-semibold text-slate-600 uppercase">Invoice #</th>
                    <th className="px-5 py-2.5 font-semibold text-slate-600 uppercase">Items</th>
                    <th className="px-5 py-2.5 font-semibold text-slate-600 uppercase text-center">Payment</th>
                    <th className="px-5 py-2.5 font-semibold text-slate-600 uppercase text-right">Amount</th>
                    <th className="px-5 py-2.5 font-semibold text-slate-600 uppercase text-right">Profit</th>
                    <th className="px-5 py-2.5 font-semibold text-slate-600 uppercase text-center">Status</th>
                    <th className="px-5 py-2.5 font-semibold text-slate-600 uppercase text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentViewingCustomerOrders.length > 0 ? (
                    currentViewingCustomerOrders.map(sale => {
                      const saleFin = calculateSaleFinancials(sale, inventory, purchases, suppliers, sales);
                      return (
                        <tr key={sale.id} className="hover:bg-slate-50">
                          <td className="px-5 py-2.5 font-medium text-slate-600">{formatDate(sale.created_at)}</td>
                          <td className="px-5 py-2.5 font-mono font-bold text-primary-700">#{sale.id}</td>
                          <td className="px-5 py-2.5 text-slate-700 max-w-[200px] truncate">
                            {(sale.items || []).map(i => `${i.item_name} (x${i.quantity})`).join(', ')}
                          </td>
                          <td className="px-5 py-2.5 text-center">
                            <span className="px-2 py-0.5 rounded font-bold uppercase bg-slate-100 text-slate-600">
                              {sale.payment_method}
                            </span>
                          </td>
                          <td className="px-5 py-2.5 text-right font-bold font-mono text-slate-900">
                            ৳{formatCurrency(sale.total_amount)}
                          </td>
                          <td className="px-5 py-2.5 text-right font-bold font-mono text-emerald-700">
                            ৳{formatCurrency(saleFin.profit)}
                          </td>
                          <td className="px-5 py-2.5 text-center">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full font-bold uppercase text-[10px] border",
                              sale.status === 'completed' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                              sale.status === 'pending' ? "bg-amber-50 text-amber-700 border-amber-200" :
                              "bg-rose-50 text-rose-700 border-rose-200"
                            )}>
                              {sale.status}
                            </span>
                          </td>
                          <td className="px-5 py-2.5 text-right whitespace-nowrap">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => setSelectedSale(sale)}
                              className="h-6 px-2 text-[11px] text-primary-600 border-primary-200 hover:bg-primary-50 inline-flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              <span>View</span>
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                        No orders recorded for this customer in the selected range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Invoice Modal for Viewing Single Sale Invoice */}
      {selectedSale && (() => {
        const safeSubtotal = selectedSale.subtotal || selectedSale.total_amount || 0;
        const safeDiscount = selectedSale.discount_amount || 0;
        const safeTax = selectedSale.tax_amount || 0;
        const safeTotal = selectedSale.total_amount || 0;
        const safeItems = selectedSale.items || [];
        const customer = customers.find(c => c.id === selectedSale.customer_id);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <Card className="w-full max-w-2xl shadow-2xl p-0 overflow-hidden bg-white border-slate-200">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="font-bold text-slate-900 text-base">Invoice #{selectedSale.id}</h3>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => window.print()}
                    className="p-1.5 text-slate-600 hover:text-primary-600 hover:bg-white rounded-lg border border-slate-200 shadow-2xs"
                    title="Print"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setSelectedSale(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">{businessSettings?.name || 'BIZFLOW'}</h2>
                    <p className="text-xs text-slate-500 mt-1">{businessSettings?.address || 'Store Address'}</p>
                    <p className="text-xs text-slate-500">{businessSettings?.phone || 'Contact Phone'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-primary-700 bg-primary-50 px-2 py-1 rounded inline-block border border-primary-200">
                      INVOICE #{selectedSale.id}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Date: {formatDate(selectedSale.created_at)}</p>
                    <p className="text-xs text-slate-500 font-bold uppercase">Status: {selectedSale.status}</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                  <p className="font-bold text-slate-500 uppercase text-[10px] mb-1">Customer Details</p>
                  <p className="font-bold text-slate-900 text-sm">{customer?.name || 'Walk-in Customer'}</p>
                  {customer?.phone && <p className="text-slate-600">{customer.phone}</p>}
                  {customer?.address && <p className="text-slate-500">{customer.address}</p>}
                </div>

                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase">
                      <th className="py-2 text-left">Item</th>
                      <th className="py-2 text-center">Qty</th>
                      <th className="py-2 text-right">Rate</th>
                      <th className="py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(() => {
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
                      return Array.from(map.values()).map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-2.5 font-medium text-slate-800">{item.item_name}</td>
                          <td className="py-2.5 text-center font-bold">{item.quantity}</td>
                          <td className="py-2.5 text-right font-mono text-slate-600">৳{formatCurrency(item.unit_price)}</td>
                          <td className="py-2.5 text-right font-mono font-bold text-slate-900">৳{formatCurrency(item.total)}</td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>

                <div className="flex justify-end pt-3 border-t border-slate-200">
                  <div className="w-56 space-y-1.5 text-xs text-right">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal:</span>
                      <span className="font-mono">৳{formatCurrency(safeSubtotal)}</span>
                    </div>
                    {safeDiscount > 0 && (
                      <div className="flex justify-between text-emerald-600 font-medium">
                        <span>Discount:</span>
                        <span className="font-mono">-৳{formatCurrency(safeDiscount)}</span>
                      </div>
                    )}
                    {safeTax > 0 && (
                      <div className="flex justify-between text-slate-600">
                        <span>Tax:</span>
                        <span className="font-mono">+৳{formatCurrency(safeTax)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t border-slate-200">
                      <span>Total Amount:</span>
                      <span className="font-mono">৳{formatCurrency(safeTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        );
      })()}

      {/* Add / Edit Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-2xl p-6 border-slate-200 bg-white rounded-2xl">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                {editingCustomer ? 'Edit Customer Details' : 'Add New Customer'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Customer Full Name <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Rahim Ahmed"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Mobile / Phone Number
                </label>
                <input 
                  type="text"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g. 01700000000"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input 
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. customer@example.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Delivery / Billing Address
                </label>
                <textarea 
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street, City, Area details..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsModalOpen(false)}
                  className="text-xs font-semibold px-4 py-2"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-5 py-2"
                >
                  {editingCustomer ? 'Update Customer' : 'Save Customer'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-2xl p-6 border-slate-200 bg-white rounded-2xl">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">Delete Customer</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to delete <strong className="text-slate-800">{deleteConfirm.name}</strong>? It will be moved to the Recycle Bin and can be restored anytime.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-3 border-t border-slate-100">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setDeleteConfirm({ isOpen: false })}
                className="text-xs font-semibold px-4"
              >
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={handleConfirmDelete}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4"
              >
                Yes, Delete
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
