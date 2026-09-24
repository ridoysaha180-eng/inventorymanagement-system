import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, Plus, Search, Calendar, Download, Trash2, Edit2, 
  X, Briefcase, DollarSign, Wallet, FileSpreadsheet, Building2,
  Users, HandCoins, ArrowRight, Eye, CheckCircle2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { format, parseISO } from 'date-fns';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { formatCurrency, cn } from '../utils';
import { storageService } from '../services/storageService';
import { Investment } from '../types';

export const INVESTMENT_TYPES = [
  { id: 'capital', label: 'Cash Capital', color: 'blue' },
  { id: 'equity', label: 'Equity Partner', color: 'emerald' },
  { id: 'loan', label: 'Business Loan (Capital)', color: 'purple' },
  { id: 'asset', label: 'Asset/Equipment', color: 'amber' },
  { id: 'other', label: 'Other', color: 'slate' },
];

export const Investments: React.FC = () => {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [currency, setCurrency] = useState('BDT');

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id?: string; source?: string }>({ isOpen: false });

  // Form State
  const [formData, setFormData] = useState({
    source: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'capital',
    notes: ''
  });

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('bizflow_investments_updated', handleUpdate);
    return () => window.removeEventListener('bizflow_investments_updated', handleUpdate);
  }, []);

  const loadData = () => {
    setInvestments(storageService.getInvestments() || []);
    const settings = storageService.getBusinessSettings();
    if (settings?.currency) setCurrency(settings.currency);
  };

  const resetForm = () => {
    setFormData({
      source: '',
      amount: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      type: 'capital',
      notes: ''
    });
    setEditingInvestment(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (inv: Investment) => {
    setEditingInvestment(inv);
    setFormData({
      source: inv.source,
      amount: inv.amount.toString(),
      date: inv.date,
      type: inv.type || 'capital',
      notes: inv.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.source.trim() || !formData.amount) {
      alert('Source and Amount are required.');
      return;
    }

    const amount = parseFloat(formData.amount);
    
    const investmentData: Investment = {
      id: editingInvestment ? editingInvestment.id : `inv_${Date.now()}`,
      source: formData.source,
      amount,
      date: formData.date,
      type: formData.type,
      notes: formData.notes,
      created_at: editingInvestment ? editingInvestment.created_at : new Date().toISOString()
    };

    if (editingInvestment) {
      storageService.updateInvestment(investmentData.id, investmentData);
    } else {
      storageService.addInvestment(investmentData);
    }

    setIsModalOpen(false);
    resetForm();
  };

  const handleDelete = async () => {
    if (deleteConfirm.id) {
      try {
        await storageService.deleteInvestment(deleteConfirm.id);
      } catch (error) {
        console.error('Delete investment error:', error);
      }
      setDeleteConfirm({ isOpen: false });
    }
  };

  const exportToExcel = () => {
    if (investments.length === 0) return alert("No data to export");
    
    const exportData = investments.map(inv => ({
      'Date': format(parseISO(inv.date), 'dd MMM, yyyy'),
      'Source / Investor': inv.source,
      'Amount': inv.amount,
      'Investment Type': INVESTMENT_TYPES.find(t => t.id === inv.type)?.label || inv.type,
      'Notes': inv.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Investments');
    XLSX.writeFile(wb, `Business_Investments_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  // Filter Data
  const filteredInvestments = useMemo(() => {
    return investments.filter(inv => {
      const matchesSearch = 
        inv.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.notes && inv.notes.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesType = typeFilter === 'all' || inv.type === typeFilter;
      
      return matchesSearch && matchesType;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [investments, searchTerm, typeFilter]);

  // Stats
  const totalInvestment = investments.reduce((sum, inv) => sum + inv.amount, 0);
  const thisMonthInvestment = investments
    .filter(inv => inv.date.startsWith(format(new Date(), 'yyyy-MM')))
    .reduce((sum, inv) => sum + inv.amount, 0);
  const totalSources = new Set(investments.map(i => i.source.toLowerCase())).size;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Investment Management</h1>
          </div>
          <p className="text-sm text-slate-500 font-medium ml-13">Track business capital, equity, and asset investments</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto ml-13 sm:ml-0">
          <Button variant="outline" onClick={exportToExcel} className="gap-2 bg-white flex-1 sm:flex-none justify-center">
            <Download className="w-4 h-4" /> Export Excel
          </Button>
          <Button onClick={handleOpenAdd} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white flex-1 sm:flex-none justify-center shadow-md shadow-blue-500/20">
            <Plus className="w-4 h-4" /> Add New Investment
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Investment Card */}
        <div className="bg-gradient-to-br from-[#eff6ff] to-white p-5 rounded-2xl border border-blue-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center">
                <Briefcase className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-700">Total Investment</span>
            </div>
            <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">Lifetime</span>
          </div>
          <div className="relative z-10">
            <h3 className="text-3xl font-black text-slate-900 mb-1 flex items-baseline gap-1">
              <span className="text-xl text-slate-500 font-semibold">{currency}</span>
              {formatCurrency(totalInvestment)}
            </h3>
            <p className="text-xs text-slate-500 font-medium">Total capital injected into business</p>
          </div>
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-blue-50 rounded-full blur-2xl"></div>
        </div>

        {/* This Month Card */}
        <div className="bg-gradient-to-br from-[#f0fdf4] to-white p-5 rounded-2xl border border-emerald-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-700">This Month</span>
            </div>
            <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">+{formatCurrency(thisMonthInvestment)}</span>
          </div>
          <div className="relative z-10">
            <h3 className="text-3xl font-black text-slate-900 mb-1 flex items-baseline gap-1">
              <span className="text-xl text-slate-500 font-semibold">{currency}</span>
              {formatCurrency(thisMonthInvestment)}
            </h3>
            <p className="text-xs text-slate-500 font-medium">Investments added this month</p>
          </div>
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-emerald-50 rounded-full blur-2xl"></div>
        </div>

        {/* Sources Card */}
        <div className="bg-gradient-to-br from-[#f8fafc] to-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-700 text-white flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-700">Total Sources</span>
            </div>
          </div>
          <div className="relative z-10">
            <h3 className="text-3xl font-black text-slate-900 mb-1">
              {totalSources}
            </h3>
            <p className="text-xs text-slate-500 font-medium">Distinct investors / capital sources</p>
          </div>
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-slate-100 rounded-full blur-2xl"></div>
        </div>
      </div>

      {/* Filters and Search */}
      <Card className="p-2 border-slate-200/60 shadow-sm rounded-2xl bg-white/50 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by source, investor, or notes..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          <div className="flex gap-2">
            <select 
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium min-w-[160px]"
            >
              <option value="all">All Types</option>
              {INVESTMENT_TYPES.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden border-slate-200/60 shadow-sm rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200">
                <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Source / Investor</th>
                <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Amount</th>
                <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvestments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                        <Briefcase className="w-8 h-8 text-slate-300" />
                      </div>
                      <p className="font-medium text-slate-600 text-sm">No investments found</p>
                      <p className="text-xs mt-1">Add your first investment to track capital.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvestments.map(inv => {
                  const typeObj = INVESTMENT_TYPES.find(t => t.id === inv.type);
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-sm">{inv.source}</span>
                          {inv.notes && (
                            <span className="text-xs text-slate-500 line-clamp-1 max-w-[250px] mt-0.5">{inv.notes}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm font-medium text-slate-700">{format(parseISO(inv.date), 'dd MMM yyyy')}</span>
                      </td>
                      <td className="px-5 py-4">
                        {typeObj ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-${typeObj.color}-100 text-${typeObj.color}-700`}>
                            {typeObj.label}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                            {inv.type || 'N/A'}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="font-bold text-slate-900 text-sm">
                          {currency} {formatCurrency(inv.amount)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleOpenEdit(inv)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setDeleteConfirm({ isOpen: true, id: inv.id, source: inv.source })}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {filteredInvestments.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 font-bold border-t border-slate-200">
                  <td colSpan={3} className="px-5 py-4 text-right text-sm text-slate-700">Total Selection:</td>
                  <td className="px-5 py-4 text-right text-sm text-slate-900">
                    {currency} {formatCurrency(filteredInvestments.reduce((acc, curr) => acc + curr.amount, 0))}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">{editingInvestment ? 'Edit Investment' : 'Add New Investment'}</h3>
                  <p className="text-xs font-semibold text-slate-500">Record capital injection</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto no-scrollbar">
              <form id="inv-form" onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Source / Investor Name <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={formData.source}
                      onChange={e => setFormData({...formData, source: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                      placeholder="e.g. Self, Bank, John Doe"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Amount <span className="text-rose-500">*</span></label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">{currency}</span>
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={formData.amount}
                        onChange={e => setFormData({...formData, amount: e.target.value})}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Date <span className="text-rose-500">*</span></label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={e => setFormData({...formData, date: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Investment Type</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {INVESTMENT_TYPES.filter(t => t.id !== 'all').map(type => (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => setFormData({...formData, type: type.id})}
                          className={cn(
                            "px-3 py-2 border rounded-xl text-xs font-bold transition-all text-center",
                            formData.type === type.id 
                              ? `bg-${type.color}-50 border-${type.color}-200 text-${type.color}-700 ring-1 ring-${type.color}-500/20` 
                              : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                          )}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Notes / Details</label>
                    <textarea
                      rows={3}
                      value={formData.notes}
                      onChange={e => setFormData({...formData, notes: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                      placeholder="Optional details about this investment..."
                    />
                  </div>
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3 mt-auto">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="px-6 rounded-xl font-bold">
                Cancel
              </Button>
              <Button type="submit" form="inv-form" className="px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20">
                {editingInvestment ? 'Update Investment' : 'Save Investment'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">Delete Investment</h3>
            <p className="text-sm text-slate-500 mb-6">
              Are you sure you want to delete the investment from <span className="font-bold text-slate-700">{deleteConfirm.source}</span>? It will be moved to the Recycle Bin and can be restored anytime.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setDeleteConfirm({ isOpen: false })} className="flex-1 rounded-xl font-bold">Cancel</Button>
              <Button onClick={handleDelete} className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md shadow-rose-500/20">Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
