import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Mail, Phone, MapPin, Edit2, Trash2, X, Eye, 
  FileSpreadsheet, Download, Printer, Truck, ShoppingBag, 
  DollarSign, ArrowUpRight, Layers, CheckCircle2, AlertCircle,
  Calendar, CreditCard, Banknote, UserCheck, ChevronRight, TrendingUp,
  HandCoins, Coins
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { formatCurrency, cn, getSupplierOverallStats } from '../utils';
import { storageService } from '../services/storageService';
import { Supplier, Purchase, InventoryItem, Sale } from '../types';
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

export const Suppliers: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'sl' | 'name' | 'purchased' | 'profit' | 'units' | 'stock_value' | 'orders'>('sl');
  const [viewMode, setViewMode] = useState<'directory' | 'purchases_ledger'>('directory');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id?: string; name?: string }>({ isOpen: false });

  // Supplier Ledger Modal
  const [viewingSupplier, setViewingSupplier] = useState<Supplier & { totalProfit?: number; currentStockValue?: number } | null>(null);
  const [ledgerStartDate, setLedgerStartDate] = useState('');
  const [ledgerEndDate, setLedgerEndDate] = useState('');

  const [formData, setFormData] = useState({
    sl_number: '',
    name: '',
    contact_person: '',
    phone: '',
    email: '',
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
    window.addEventListener('bizflow_suppliers_updated', handleDataUpdate);
    window.addEventListener('storage', handleDataUpdate);

    return () => {
      window.removeEventListener('bizflow_purchases_updated', handleDataUpdate);
      window.removeEventListener('bizflow_inventory_updated', handleDataUpdate);
      window.removeEventListener('bizflow_sales_updated', handleDataUpdate);
      window.removeEventListener('bizflow_suppliers_updated', handleDataUpdate);
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
    setSuppliers(storageService.getSuppliers() || []);
    setPurchases(storageService.getPurchases() || []);
    setInventory(storageService.getInventory() || []);
    setSales(storageService.getSales() || []);
  };

  // Compute enriched supplier stats (incorporating supplier FIFO batches, stock value, and profit)
  const enrichedSuppliers = useMemo(() => {
    const invList = inventory || [];
    const purList = purchases || [];
    const salesList = sales || [];

    return suppliers.map(sup => {
      const supPurchases = purList.filter(p => p.supplier_id === sup.id);
      const totalPurchasedAmount = supPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
      const totalPaidAmount = supPurchases.reduce((sum, p) => sum + (p.paid_amount || 0), 0);
      const openingDue = sup.opening_due || 0;
      const totalDueAmount = Math.max(0, (totalPurchasedAmount - totalPaidAmount) + openingDue);

      const stats = getSupplierOverallStats(sup.id, invList, salesList, purList, suppliers);
      const displayPurchasedAmount = totalPurchasedAmount > 0 ? totalPurchasedAmount : stats.totalPurchasedAmount;

      return {
        ...sup,
        purchasesCount: supPurchases.length,
        totalPurchasedAmount: displayPurchasedAmount,
        totalPaidAmount,
        totalDueAmount,
        totalProfit: stats.totalProfit,
        totalLoss: stats.totalLoss,
        netProfit: stats.netProfit,
        currentStockUnits: stats.currentStockUnits,
        currentStockValue: stats.currentStockValue,
        expectedProfit: stats.expectedProfit,
        purchasesList: supPurchases
      };
    });
  }, [suppliers, purchases, inventory, sales]);

  // Filter & Sort suppliers
  const filteredSuppliers = useMemo(() => {
    let list = enrichedSuppliers.filter(sup => {
      const term = searchTerm.toLowerCase();
      return (
        sup.name.toLowerCase().includes(term) ||
        (sup.sl_number && sup.sl_number.toLowerCase().includes(term)) ||
        (sup.phone && sup.phone.toLowerCase().includes(term)) ||
        (sup.contact_person && sup.contact_person.toLowerCase().includes(term))
      );
    });

    list.sort((a, b) => {
      if (sortBy === 'sl') {
        return (a.sl_number || '').localeCompare(b.sl_number || '', undefined, { numeric: true });
      } else if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'purchased') {
        return b.totalPurchasedAmount - a.totalPurchasedAmount;
      } else if (sortBy === 'profit') {
        return b.totalProfit - a.totalProfit;
      } else if (sortBy === 'units') {
        return b.currentStockUnits - a.currentStockUnits;
      } else if (sortBy === 'stock_value') {
        return b.currentStockValue - a.currentStockValue;
      } else if (sortBy === 'orders') {
        return b.purchasesCount - a.purchasesCount;
      }
      return 0;
    });

    return list;
  }, [enrichedSuppliers, searchTerm, sortBy]);

  // Filtered Totals
  const filteredTotals = useMemo(() => {
    const purchasesCount = filteredSuppliers.reduce((sum, s) => sum + s.purchasesCount, 0);
    const purchasedAmount = filteredSuppliers.reduce((sum, s) => sum + s.totalPurchasedAmount, 0);
    const totalProfit = filteredSuppliers.reduce((sum, s) => sum + (s.totalProfit || 0), 0);
    const stockUnits = filteredSuppliers.reduce((sum, s) => sum + s.currentStockUnits, 0);
    const stockValue = filteredSuppliers.reduce((sum, s) => sum + (s.currentStockValue || 0), 0);
    return { purchasesCount, purchasedAmount, totalProfit, stockUnits, stockValue };
  }, [filteredSuppliers]);

  const handleOpenAddModal = () => {
    const nextSl = `SL-${String(suppliers.length + 1).padStart(3, '0')}`;
    setFormData({
      sl_number: nextSl,
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: ''
    });
    setEditingSupplier(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (sup: Supplier) => {
    setEditingSupplier(sup);
    setFormData({
      sl_number: sup.sl_number || '',
      name: sup.name || '',
      contact_person: sup.contact_person || '',
      phone: sup.phone || '',
      email: sup.email || '',
      address: sup.address || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editingSupplier) {
      storageService.updateSupplier(editingSupplier.id, {
        ...editingSupplier,
        sl_number: formData.sl_number.trim(),
        name: formData.name.trim(),
        contact_person: formData.contact_person.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        address: formData.address.trim()
      });
    } else {
      const newSup: Supplier = {
        id: 'sup_' + Date.now(),
        user_id: 'default_user',
        sl_number: formData.sl_number.trim() || `SL-${Date.now().toString().slice(-4)}`,
        name: formData.name.trim(),
        contact_person: formData.contact_person.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        address: formData.address.trim(),
        created_at: new Date().toISOString()
      };
      storageService.addSupplier(newSup);
    }

    setIsModalOpen(false);
    setEditingSupplier(null);
    loadData();
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirm.id) {
      try {
        await storageService.deleteSupplier(deleteConfirm.id);
        loadData();
      } catch (error) {
        console.error('Delete supplier error:', error);
      }
      setDeleteConfirm({ isOpen: false });
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text(businessSettings?.name || 'Suppliers Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);

    const tableData = filteredSuppliers.map((s, idx) => [
      s.sl_number || `SL-${idx+1}`,
      s.name,
      s.contact_person || 'N/A',
      s.phone || 'N/A',
      s.purchasesCount,
      `BDT ${formatCurrency(s.totalPurchasedAmount)}`,
      `BDT ${formatCurrency(s.totalProfit || 0)}`,
      `${s.currentStockUnits} pcs`,
      `BDT ${formatCurrency(s.currentStockValue || 0)}`
    ]);

    autoTable(doc, {
      startY: 28,
      head: [['SL #', 'Supplier Name', 'Contact Person', 'Phone', 'Orders', 'Total Purchased', 'Profit', 'Stock Units', 'Stock Value']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save('suppliers_report.pdf');
  };

  const handleExportExcel = () => {
    const data = filteredSuppliers.map((s, idx) => ({
      'SL Number': s.sl_number || `SL-${idx+1}`,
      'Supplier Name': s.name,
      'Contact Person': s.contact_person || 'N/A',
      'Phone': s.phone || 'N/A',
      'Email': s.email || 'N/A',
      'Address': s.address || 'N/A',
      'Total Orders': s.purchasesCount,
      'Total Purchased (BDT)': s.totalPurchasedAmount,
      'Profit (BDT)': s.totalProfit || 0,
      'Stock Units': s.currentStockUnits,
      'Stock Value (BDT)': s.currentStockValue || 0
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Suppliers');
    XLSX.writeFile(wb, 'suppliers_report.xlsx');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 text-primary-600" />
            Suppliers & Purchase Directory
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage vendor profiles, track purchase bills, stock units, stock value, and supplier profit.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setViewMode(viewMode === 'directory' ? 'purchases_ledger' : 'directory')}
            className={cn(
              "text-xs font-semibold h-9",
              viewMode === 'purchases_ledger' ? "bg-primary-50 text-primary-700 border-primary-300" : "text-slate-700"
            )}
          >
            <Layers className="w-4 h-4 mr-1.5" />
            {viewMode === 'purchases_ledger' ? 'Suppliers Directory' : 'Purchases Ledger View'}
          </Button>

          <button 
            type="button"
            onClick={handleExportExcel} 
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 h-9 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Excel</span>
          </button>

          <button 
            type="button"
            onClick={handleExportPDF} 
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 h-9 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-primary-600" />
            <span>Export PDF</span>
          </button>

          <Button 
            onClick={handleOpenAddModal}
            className="text-xs font-bold gap-1.5 bg-primary-600 hover:bg-primary-700 text-white h-9 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Supplier</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search supplier by name, phone, or SL #..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Sort By:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="sl">SL Number</option>
              <option value="name">Supplier Name</option>
              <option value="purchased">Total Purchased</option>
              <option value="profit">Profit</option>
              <option value="units">Stock Units</option>
              <option value="stock_value">Stock Value</option>
              <option value="orders">Orders Count</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <Card className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
        {viewMode === 'directory' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3.5">SL #</th>
                  <th className="px-5 py-3.5">Supplier Name</th>
                  <th className="px-5 py-3.5">Contact Person</th>
                  <th className="px-5 py-3.5">Contact & Address</th>
                  <th className="px-5 py-3.5 text-center">Orders</th>
                  <th className="px-5 py-3.5 text-right">Total Purchased</th>
                  <th className="px-5 py-3.5 text-right">Profit</th>
                  <th className="px-5 py-3.5 text-center">Stock Units</th>
                  <th className="px-5 py-3.5 text-right">Stock Value</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredSuppliers.length > 0 ? (
                  filteredSuppliers.map((sup) => (
                    <tr 
                      key={sup.id} 
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      onClick={() => setViewingSupplier(sup)}
                    >
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-primary-700 bg-primary-50 border border-primary-100 px-2 py-1 rounded-md">
                          {sup.sl_number}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl flex items-center justify-center font-bold text-sm shrink-0">
                            <Truck className="w-4 h-4 text-primary-600" />
                          </div>
                          <div>
                            <span className="text-sm font-bold text-slate-900 block group-hover:text-primary-600 transition-colors">
                              {sup.name}
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium">
                              Joined {formatDate(sup.created_at)}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="text-xs font-semibold text-slate-800 block">
                          {sup.contact_person || 'N/A'}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="space-y-0.5 text-xs max-w-[220px]">
                          {sup.phone ? (
                            <div className="flex items-center text-slate-700 font-medium">
                              <Phone className="w-3 h-3 mr-1 text-slate-400 shrink-0" />
                              <span>{sup.phone}</span>
                            </div>
                          ) : null}
                          {sup.email && (
                            <div className="flex items-center text-slate-500 text-[11px] truncate">
                              <Mail className="w-3 h-3 mr-1 text-slate-400 shrink-0" />
                              <span className="truncate">{sup.email}</span>
                            </div>
                          )}
                          {sup.address && (
                            <div className="flex items-center text-slate-500 text-[11px] truncate">
                              <MapPin className="w-3 h-3 mr-1 text-slate-400 shrink-0" />
                              <span className="truncate">{sup.address}</span>
                            </div>
                          )}
                          {!sup.phone && !sup.email && !sup.address && (
                            <span className="text-slate-400 text-xs">No details</span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {sup.purchasesCount}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-right whitespace-nowrap text-sm font-bold text-slate-900 font-mono">
                        ৳{formatCurrency(sup.totalPurchasedAmount)}
                      </td>

                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <span className={cn(
                          "inline-block px-2.5 py-1 rounded-md text-xs font-bold font-mono",
                          (sup.totalProfit || 0) > 0 
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                            : "bg-slate-100 text-slate-500 border border-slate-200"
                        )}>
                          {(sup.totalProfit || 0) > 0 ? `+৳${formatCurrency(sup.totalProfit || 0)}` : `৳${formatCurrency(sup.totalProfit || 0)}`}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        <span className={cn(
                          "inline-block px-2.5 py-1 rounded-md text-xs font-bold font-mono",
                          sup.currentStockUnits > 0 ? "bg-purple-50 text-purple-700 border border-purple-200" : "text-slate-400"
                        )}>
                          {sup.currentStockUnits} pcs
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <span className={cn(
                          "inline-block px-2.5 py-1 rounded-md text-xs font-bold font-mono",
                          (sup.currentStockValue || 0) > 0 ? "bg-blue-50 text-blue-700 border border-blue-200" : "text-slate-400"
                        )}>
                          ৳{formatCurrency(sup.currentStockValue || 0)}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button 
                            type="button"
                            onClick={() => setViewingSupplier(sup)}
                            className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors cursor-pointer"
                            title="View Purchases Ledger & Statement"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleOpenEditModal(sup)}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Supplier"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => setDeleteConfirm({ isOpen: true, id: sup.id, name: sup.name })}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Supplier"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-slate-400 text-xs">
                      No suppliers found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>

              {filteredSuppliers.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100/80 font-bold text-slate-900 border-t border-slate-200 text-xs">
                    <td colSpan={4} className="px-5 py-3 text-slate-700 uppercase tracking-wider">
                      Total ({filteredSuppliers.length} Suppliers)
                    </td>
                    <td className="px-5 py-3 text-center text-slate-900 font-mono">
                      {filteredTotals.purchasesCount} orders
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-slate-900">
                      ৳{formatCurrency(filteredTotals.purchasedAmount)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-emerald-700">
                      ৳{formatCurrency(filteredTotals.totalProfit)}
                    </td>
                    <td className="px-5 py-3 text-center font-mono text-purple-700">
                      {filteredTotals.stockUnits} pcs
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-blue-700">
                      ৳{formatCurrency(filteredTotals.stockValue)}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-400 font-normal">
                      Filtered Summary
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        ) : (
          /* Purchases Ledger View */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Purchase ID / Date</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Items Count</th>
                  <th className="px-4 py-3 text-right">Total Amount</th>
                  <th className="px-4 py-3 text-right">Paid Amount</th>
                  <th className="px-4 py-3 text-right">Due Amount</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.map(p => {
                  const sup = suppliers.find(s => s.id === p.supplier_id);
                  const due = Math.max(0, (p.total_amount || 0) - (p.paid_amount || 0));
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        #{p.id.slice(-6)}
                        <span className="block text-[10px] text-slate-400 font-normal">{formatDate(p.date)}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {sup ? sup.name : 'Direct Supplier / Walk-in'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                          {p.items?.length || 0} items
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        ৳{formatCurrency(p.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-700">
                        ৳{formatCurrency(p.paid_amount)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-rose-600 font-bold">
                        ৳{formatCurrency(due)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold",
                          due === 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                        )}>
                          {due === 0 ? 'Paid' : 'Due'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {purchases.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                      No purchase records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add / Edit Supplier Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <Card className="w-full max-w-lg shadow-2xl p-6 border-slate-200 bg-white rounded-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingSupplier ? 'Edit Supplier Profile' : 'Add New Supplier'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    SL Number
                  </label>
                  <input 
                    type="text"
                    required
                    value={formData.sl_number}
                    onChange={e => setFormData({ ...formData, sl_number: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Supplier / Company Name *
                  </label>
                  <input 
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Acme Corporation"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Contact Person
                  </label>
                  <input 
                    type="text"
                    value={formData.contact_person}
                    onChange={e => setFormData({ ...formData, contact_person: e.target.value })}
                    placeholder="e.g. Mr. Rahim"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <input 
                    type="text"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. 01700000000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input 
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. supplier@company.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Address
                </label>
                <textarea 
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Warehouse or office location..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  className="text-xs font-semibold px-4"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  size="sm"
                  className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-5"
                >
                  {editingSupplier ? 'Update Supplier' : 'Save Supplier'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-2xl p-6 border-slate-200 bg-white rounded-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Supplier</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Are you sure you want to delete <strong className="text-slate-800 font-bold">{deleteConfirm.name}</strong>? It will be moved to the Recycle Bin and can be restored anytime.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
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

      {/* Supplier Ledger / Detail Modal */}
      {viewingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <Card className="w-full max-w-3xl shadow-2xl p-6 border-slate-200 bg-white rounded-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-600 font-bold">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{viewingSupplier.name}</h3>
                  <p className="text-xs text-slate-500">
                    SL: <span className="font-mono font-semibold text-primary-700">{viewingSupplier.sl_number}</span> • Joined {formatDate(viewingSupplier.created_at)}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setViewingSupplier(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-shrink-0">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <span className="text-slate-500 block text-[10px]">Total Purchases</span>
                <span className="text-sm font-bold font-mono text-slate-900">৳{formatCurrency(viewingSupplier.totalPurchasedAmount)}</span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs">
                <span className="text-emerald-700 block text-[10px] font-semibold">Profit Earned</span>
                <span className="text-sm font-bold font-mono text-emerald-800">৳{formatCurrency(viewingSupplier.totalProfit || 0)}</span>
              </div>
              <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200 text-xs">
                <span className="text-purple-700 block text-[10px] font-semibold">Current Stock Units</span>
                <span className="text-sm font-bold font-mono text-purple-800">{viewingSupplier.currentStockUnits} pcs</span>
              </div>
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs">
                <span className="text-blue-700 block text-[10px] font-semibold">Stock Value</span>
                <span className="text-sm font-bold font-mono text-blue-800">৳{formatCurrency(viewingSupplier.currentStockValue || 0)}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Purchase History</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100 font-bold text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5">Date</th>
                      <th className="px-3 py-2.5">Purchase ID</th>
                      <th className="px-3 py-2.5 text-right">Total</th>
                      <th className="px-3 py-2.5 text-right">Paid</th>
                      <th className="px-3 py-2.5 text-right">Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingSupplier.purchasesList?.map(p => {
                      const due = Math.max(0, (p.total_amount || 0) - (p.paid_amount || 0));
                      return (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 text-slate-600">{formatDate(p.date)}</td>
                          <td className="px-3 py-2.5 font-mono font-bold text-slate-900">#{p.id.slice(-6)}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold">৳{formatCurrency(p.total_amount)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-emerald-700">৳{formatCurrency(p.paid_amount)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-rose-600">৳{formatCurrency(due)}</td>
                        </tr>
                      );
                    })}
                    {(!viewingSupplier.purchasesList || viewingSupplier.purchasesList.length === 0) && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                          No purchase orders recorded for this supplier.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 flex-shrink-0">
              <Button 
                onClick={() => setViewingSupplier(null)}
                size="sm"
                className="text-xs font-bold px-5"
              >
                Close Statement
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
