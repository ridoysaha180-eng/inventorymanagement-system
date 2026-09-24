import React, { useState, useEffect } from 'react';
import { 
  Trash2, 
  RotateCcw, 
  Trash as TrashIcon, 
  Search, 
  AlertCircle, 
  AlertTriangle,
  Package, 
  Users, 
  Truck, 
  Receipt, 
  Landmark, 
  Briefcase,
  CheckCircle2,
  ShoppingCart,
  ShoppingBag,
  Building2,
  Tag,
  Eye,
  X,
  Calendar,
  DollarSign,
  FileText,
  Phone,
  Mail,
  MapPin,
  ChevronDown,
  ChevronUp,
  Hash,
  Layers,
  Clock,
  Printer
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { TrashItem, Customer, Supplier, BusinessSettings } from '../types';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { InvoiceViewer } from '../components/invoice/InvoiceViewer';

export const Trash: React.FC = () => {
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Modals & tabs state
  const [viewingItem, setViewingItem] = useState<TrashItem | null>(null);
  const [activeTab, setActiveTab] = useState<'invoice' | 'summary'>('invoice');
  const [itemToDelete, setItemToDelete] = useState<TrashItem | null>(null);
  const [showEmptyTrashModal, setShowEmptyTrashModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Business & entity metadata
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings>(() => storageService.getBusinessSettings());
  const [customers, setCustomers] = useState<Customer[]>(() => storageService.getCustomers());
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => storageService.getSuppliers());

  const loadData = () => {
    setTrashItems(storageService.getTrashItems());
    setBusinessSettings(storageService.getBusinessSettings());
    setCustomers(storageService.getCustomers());
    setSuppliers(storageService.getSuppliers());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('bizflow_trash_updated', loadData);
    window.addEventListener('bizflow_sales_updated', loadData);
    window.addEventListener('bizflow_purchases_updated', loadData);
    window.addEventListener('bizflow_settings_updated', loadData);
    window.addEventListener('storage', loadData);
    return () => {
      window.removeEventListener('bizflow_trash_updated', loadData);
      window.removeEventListener('bizflow_sales_updated', loadData);
      window.removeEventListener('bizflow_purchases_updated', loadData);
      window.removeEventListener('bizflow_settings_updated', loadData);
      window.removeEventListener('storage', loadData);
    };
  }, []);

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  const handleOpenViewModal = (item: TrashItem) => {
    setViewingItem(item);
    if (item.item_type === 'sale' || item.item_type === 'purchase') {
      setActiveTab('invoice');
    } else {
      setActiveTab('summary');
    }
  };

  const handleRestore = async (item: TrashItem) => {
    setIsProcessing(true);
    try {
      await storageService.restoreTrashItem(item.id);
      loadData();
      if (viewingItem?.id === item.id) {
        setViewingItem(null);
      }
      showNotification(`Successfully restored "${item.title}" to active records.`);
    } catch (error) {
      console.error('Error restoring item:', error);
      showNotification('Failed to restore item. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmPermanentDelete = async () => {
    if (!itemToDelete) return;
    setIsProcessing(true);
    try {
      await storageService.deleteTrashItemPermanently(itemToDelete.id);
      loadData();
      if (viewingItem?.id === itemToDelete.id) {
        setViewingItem(null);
      }
      showNotification(`Permanently deleted "${itemToDelete.title}".`);
    } catch (error) {
      console.error('Error deleting item permanently:', error);
      showNotification('Failed to permanently delete item.');
    } finally {
      setIsProcessing(false);
      setItemToDelete(null);
    }
  };

  const handleConfirmEmptyTrash = async () => {
    setIsProcessing(true);
    try {
      await storageService.emptyTrash();
      loadData();
      setViewingItem(null);
      showNotification('Recycle bin emptied completely.');
    } catch (error) {
      console.error('Error emptying recycle bin:', error);
      showNotification('Failed to empty recycle bin.');
    } finally {
      setIsProcessing(false);
      setShowEmptyTrashModal(false);
    }
  };

  const filteredItems = trashItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.subtitle && item.subtitle.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = selectedType === 'all' || item.item_type === selectedType;
    return matchesSearch && matchesType;
  });

  const getTypeIcon = (type: TrashItem['item_type']) => {
    switch (type) {
      case 'product': return <Package className="w-4 h-4 text-sky-600" />;
      case 'customer': return <Users className="w-4 h-4 text-emerald-600" />;
      case 'supplier': return <Truck className="w-4 h-4 text-purple-600" />;
      case 'sale': return <ShoppingCart className="w-4 h-4 text-indigo-600" />;
      case 'purchase': return <ShoppingBag className="w-4 h-4 text-cyan-600" />;
      case 'expense': return <Receipt className="w-4 h-4 text-rose-600" />;
      case 'loan': return <Landmark className="w-4 h-4 text-amber-600" />;
      case 'investment': return <Briefcase className="w-4 h-4 text-blue-600" />;
      case 'brand': return <Building2 className="w-4 h-4 text-teal-600" />;
      case 'category': return <Tag className="w-4 h-4 text-orange-600" />;
      default: return <Trash2 className="w-4 h-4 text-slate-600" />;
    }
  };

  const getTypeLabel = (type: TrashItem['item_type']) => {
    switch (type) {
      case 'product': return 'Product';
      case 'customer': return 'Customer';
      case 'supplier': return 'Supplier';
      case 'sale': return 'Sale Invoice';
      case 'purchase': return 'Purchase Invoice';
      case 'expense': return 'Expense';
      case 'loan': return 'Loan';
      case 'investment': return 'Investment';
      case 'brand': return 'Company';
      case 'category': return 'Category';
      default: return type;
    }
  };

  const getTypeColorClasses = (type: TrashItem['item_type']) => {
    switch (type) {
      case 'product': return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'customer': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'supplier': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'sale': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'purchase': return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'expense': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'loan': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'investment': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'brand': return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'category': return 'bg-orange-50 text-orange-700 border-orange-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  // Render structured summary for viewing modal
  const renderItemSummaryDetails = (item: TrashItem) => {
    const data = item.original_data || {};

    switch (item.item_type) {
      case 'product':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">Selling Price</span>
                <span className="text-sm font-extrabold text-slate-900">৳{Number(data.selling_price || 0).toLocaleString()}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">Cost Price</span>
                <span className="text-sm font-extrabold text-slate-900">৳{Number(data.cost_price || 0).toLocaleString()}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">Stock Quantity</span>
                <span className="text-sm font-extrabold text-slate-900">{data.quantity ?? 0} {data.unit || 'units'}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">SKU Code</span>
                <span className="text-xs font-mono font-bold text-slate-800">{data.sku || 'N/A'}</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Brand / Company:</span>
                <span className="font-semibold text-slate-800">{data.brand || 'Unbranded'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Category:</span>
                <span className="font-semibold text-slate-800">{data.category || 'General'}</span>
              </div>
              {data.barcode && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Barcode:</span>
                  <span className="font-mono text-slate-800">{data.barcode}</span>
                </div>
              )}
              {data.description && (
                <div className="pt-1">
                  <span className="text-slate-500 font-medium block mb-1">Description:</span>
                  <p className="text-slate-700 bg-slate-50 p-2.5 rounded-lg">{data.description}</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'customer':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100">
                <span className="text-[11px] font-semibold text-rose-700 uppercase block">Total Due</span>
                <span className="text-sm font-extrabold text-rose-900">৳{Number(data.total_due || 0).toLocaleString()}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">Phone Number</span>
                <span className="text-xs font-bold text-slate-800">{data.phone || 'N/A'}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">Opening Balance</span>
                <span className="text-xs font-bold text-slate-800">৳{Number(data.opening_balance || 0).toLocaleString()}</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
              {data.email && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Email Address:</span>
                  <span className="font-medium text-slate-800">{data.email}</span>
                </div>
              )}
              {data.address && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Address:</span>
                  <span className="font-medium text-slate-800">{data.address}</span>
                </div>
              )}
              {data.notes && (
                <div className="pt-1">
                  <span className="text-slate-500 font-medium block mb-1">Notes:</span>
                  <p className="text-slate-700 bg-slate-50 p-2 rounded">{data.notes}</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'supplier':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-100">
                <span className="text-[11px] font-semibold text-purple-700 uppercase block">Due to Supplier</span>
                <span className="text-sm font-extrabold text-purple-900">৳{Number(data.due_amount || 0).toLocaleString()}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">Phone</span>
                <span className="text-xs font-bold text-slate-800">{data.phone || 'N/A'}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">Company</span>
                <span className="text-xs font-bold text-slate-800">{data.company || 'N/A'}</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
              {data.contact_person && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Contact Person:</span>
                  <span className="font-semibold text-slate-800">{data.contact_person}</span>
                </div>
              )}
              {data.address && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Address:</span>
                  <span className="font-medium text-slate-800">{data.address}</span>
                </div>
              )}
            </div>
          </div>
        );

      case 'expense':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100">
                <span className="text-[11px] font-semibold text-rose-700 uppercase block">Expense Amount</span>
                <span className="text-sm font-extrabold text-rose-900">৳{Number(data.amount || 0).toLocaleString()}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">Category</span>
                <span className="text-xs font-bold text-slate-800">{data.category || 'General'}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">Payment Method</span>
                <span className="text-xs font-bold text-slate-800 uppercase">{data.payment_method || 'Cash'}</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Date:</span>
                <span className="font-medium text-slate-800">{data.date ? new Date(data.date).toLocaleDateString() : 'N/A'}</span>
              </div>
              {data.reference && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Reference:</span>
                  <span className="font-mono text-slate-800">{data.reference}</span>
                </div>
              )}
              {data.note && (
                <div className="pt-1">
                  <span className="text-slate-500 font-medium block mb-1">Notes:</span>
                  <p className="text-slate-700 bg-slate-50 p-2 rounded">{data.note}</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'loan':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-100">
                <span className="text-[11px] font-semibold text-amber-700 uppercase block">Loan Amount</span>
                <span className="text-sm font-extrabold text-amber-900">৳{Number(data.principal_amount || data.amount || 0).toLocaleString()}</span>
              </div>
              <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100">
                <span className="text-[11px] font-semibold text-rose-700 uppercase block">Remaining Balance</span>
                <span className="text-sm font-extrabold text-rose-900">৳{Number(data.remaining_balance || 0).toLocaleString()}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">Type</span>
                <span className="text-xs font-bold text-slate-800 capitalize">{data.type || 'Standard'}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">Lender / Borrower</span>
                <span className="text-xs font-bold text-slate-800">{data.lender_borrower || 'N/A'}</span>
              </div>
            </div>

            {Array.isArray(data.repayments) && data.repayments.length > 0 && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <span className="font-bold text-slate-700 block mb-1">Repayment History ({data.repayments.length} payments):</span>
                <div className="space-y-1">
                  {data.repayments.map((r: any, idx: number) => (
                    <div key={idx} className="flex justify-between py-1 border-b border-slate-200 last:border-0">
                      <span className="text-slate-600">{r.date || 'Payment'}</span>
                      <span className="font-bold text-emerald-700">৳{Number(r.amount || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'investment':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                <span className="text-[11px] font-semibold text-blue-700 uppercase block">Invested Amount</span>
                <span className="text-sm font-extrabold text-blue-900">৳{Number(data.amount || 0).toLocaleString()}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">Source / Investor</span>
                <span className="text-xs font-bold text-slate-800">{data.source || 'N/A'}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">Expected Return</span>
                <span className="text-xs font-bold text-emerald-700">{data.expected_return ? `${data.expected_return}%` : 'N/A'}</span>
              </div>
            </div>
            {data.description && (
              <div className="bg-white border border-slate-200 rounded-xl p-3 text-xs">
                <span className="text-slate-500 font-medium block mb-1">Description:</span>
                <p className="text-slate-700">{data.description}</p>
              </div>
            )}
          </div>
        );

      case 'brand':
      case 'category':
        return (
          <div className="space-y-3 bg-white border border-slate-200 rounded-xl p-4 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Name:</span>
              <span className="font-bold text-slate-900">{data.name || item.title}</span>
            </div>
            {data.description && (
              <div>
                <span className="text-slate-500 font-medium block mb-1">Description:</span>
                <p className="text-slate-700 bg-slate-50 p-2.5 rounded-lg">{data.description}</p>
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="bg-slate-50 p-4 rounded-xl text-xs text-slate-700">
            <p>Title: <strong>{item.title}</strong></p>
            {item.subtitle && <p className="mt-1">Details: {item.subtitle}</p>}
          </div>
        );
    }
  };

  const hasInvoiceView = viewingItem?.item_type === 'sale' || viewingItem?.item_type === 'purchase';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Media Print Global Style for Clean Invoice Output */}
      <style>{`
        @media print {
          @page { 
            size: A4 portrait; 
            margin: 10mm 10mm 10mm 10mm; 
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-rose-50 rounded-xl text-rose-600">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Recycle Bin</h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                View complete invoices and summaries of deleted items before restoring or permanently deleting.
              </p>
            </div>
          </div>
        </div>
        {trashItems.length > 0 && (
          <Button 
            variant="outline" 
            onClick={() => setShowEmptyTrashModal(true)}
            className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 flex items-center gap-2 cursor-pointer text-xs font-bold"
          >
            <TrashIcon className="w-4 h-4" />
            <span>Empty Recycle Bin</span>
          </Button>
        )}
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search deleted items, invoices, customers..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Items' },
            { id: 'sale', label: 'Sales Invoices' },
            { id: 'purchase', label: 'Purchases' },
            { id: 'product', label: 'Products' },
            { id: 'customer', label: 'Customers' },
            { id: 'supplier', label: 'Suppliers' },
            { id: 'expense', label: 'Expenses' },
            { id: 'loan', label: 'Loans' },
            { id: 'investment', label: 'Investments' },
            { id: 'brand', label: 'Companies' },
            { id: 'category', label: 'Categories' }
          ].map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedType(type.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                selectedType === type.id
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Items List */}
      <Card className="p-0 overflow-hidden border-slate-200 bg-white">
        {filteredItems.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Recycle Bin is Empty</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Deleted sales invoices, purchases, products, customers, and expenses will appear here. You can preview their full invoices and restore them anytime.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase bg-slate-50/80">
                  <th className="py-3 px-4">Item Type</th>
                  <th className="py-3 px-4">Invoice / Item Title</th>
                  <th className="py-3 px-4">Summary</th>
                  <th className="py-3 px-4">Deleted At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold text-xs border ${getTypeColorClasses(item.item_type)}`}>
                        {getTypeIcon(item.item_type)}
                        <span>{getTypeLabel(item.item_type)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <button
                        onClick={() => handleOpenViewModal(item)}
                        className="hover:text-primary-600 hover:underline text-left cursor-pointer transition-colors flex items-center gap-1.5"
                        title="Click to view full invoice or details"
                      >
                        <span>{item.title}</span>
                        {(item.item_type === 'sale' || item.item_type === 'purchase') && (
                          <span className="px-1.5 py-0.2 bg-primary-50 text-primary-700 text-[10px] font-mono rounded border border-primary-200">
                            Invoice
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {item.subtitle || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {new Date(item.deleted_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      {/* View Invoice / Summary Button */}
                      <button
                        onClick={() => handleOpenViewModal(item)}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                          item.item_type === 'sale' || item.item_type === 'purchase'
                            ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                            : 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200'
                        }`}
                        title={item.item_type === 'sale' ? 'View Full Invoice' : 'View Summary'}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{item.item_type === 'sale' ? 'View Invoice' : item.item_type === 'purchase' ? 'View Bill' : 'View'}</span>
                      </button>

                      {/* Restore Button */}
                      <button
                        onClick={() => handleRestore(item)}
                        disabled={isProcessing}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-bold text-xs transition-colors cursor-pointer border border-emerald-200 disabled:opacity-50"
                        title="Restore to active records"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore</span>
                      </button>

                      {/* Delete Permanently Button */}
                      <button
                        onClick={() => setItemToDelete(item)}
                        disabled={isProcessing}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg font-bold text-xs transition-colors cursor-pointer border border-rose-200 disabled:opacity-50"
                        title="Delete permanently from database"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ======================================================== */}
      {/* VIEW INVOICE & DATA SUMMARY MODAL */}
      {/* ======================================================== */}
      {viewingItem && (
        <div className="trash-modal-container fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            
            {/* Modal Header & Copy Tabs */}
            <div className="trash-modal-non-printable p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border ${getTypeColorClasses(viewingItem.item_type)}`}>
                  {getTypeIcon(viewingItem.item_type)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider border ${getTypeColorClasses(viewingItem.item_type)}`}>
                      {getTypeLabel(viewingItem.item_type)}
                    </span>
                    <span className="text-slate-400 text-xs">•</span>
                    <span className="text-slate-500 text-xs font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      Deleted {new Date(viewingItem.deleted_at).toLocaleString()}
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                    {viewingItem.title}
                  </h2>
                </div>
              </div>

              {/* View Switcher Tabs (Only shown when Invoice View is available) & Close Button */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                {hasInvoiceView && (
                  <div className="flex bg-slate-200/70 p-1 rounded-xl text-xs font-bold border border-slate-300/60">
                    <button
                      onClick={() => setActiveTab('invoice')}
                      className={`px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                        activeTab === 'invoice'
                          ? 'bg-white text-primary-700 shadow-2xs font-extrabold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>Invoice View</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('summary')}
                      className={`px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                        activeTab === 'summary'
                          ? 'bg-white text-primary-700 shadow-2xs font-extrabold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Summary</span>
                    </button>
                  </div>
                )}

                <button 
                  onClick={() => setViewingItem(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body Content */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 bg-slate-50/30">
              {activeTab === 'invoice' && hasInvoiceView ? (
                /* OFFICIAL INVOICE VIEW */
                <InvoiceViewer
                  sale={viewingItem.item_type === 'sale' ? viewingItem.original_data : undefined}
                  purchase={viewingItem.item_type === 'purchase' ? viewingItem.original_data : undefined}
                  businessSettings={businessSettings}
                  customer={customers.find(c => c.id === viewingItem.original_data?.customer_id)}
                  supplier={suppliers.find(s => s.id === viewingItem.original_data?.supplier_id)}
                  isDeleted={true}
                  deletedAt={viewingItem.deleted_at}
                />
              ) : (
                /* DETAILED STRUCTURED SUMMARY */
                renderItemSummaryDetails(viewingItem)
              )}
            </div>

            {/* Modal Footer with Actions */}
            <div className="trash-modal-non-printable p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <button
                onClick={() => setItemToDelete(viewingItem)}
                disabled={isProcessing}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-rose-200 disabled:opacity-50"
              >
                <TrashIcon className="w-4 h-4" />
                <span>Delete Permanently</span>
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {hasInvoiceView && activeTab === 'invoice' && (
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Invoice</span>
                  </button>
                )}
                <Button 
                  variant="outline" 
                  onClick={() => setViewingItem(null)}
                  className="flex-1 sm:flex-initial text-xs font-bold cursor-pointer"
                >
                  Close
                </Button>
                <button
                  onClick={() => handleRestore(viewingItem)}
                  disabled={isProcessing}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Restore {hasInvoiceView ? 'Invoice' : 'Item'}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PERMANENT DELETE CONFIRMATION MODAL */}
      {/* ======================================================== */}
      {itemToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <Card className="w-full max-w-md bg-white p-6 rounded-2xl shadow-2xl border border-slate-200">
            <div className="flex items-start gap-3.5 mb-4">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Permanently Delete Item?</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Are you sure you want to permanently delete <strong className="text-slate-800">"{itemToDelete.title}"</strong>? 
                  This will completely remove it from the database and <strong>cannot be restored</strong>.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button 
                variant="outline" 
                onClick={() => setItemToDelete(null)}
                disabled={isProcessing}
                className="text-xs font-bold cursor-pointer"
              >
                Cancel
              </Button>
              <button
                onClick={handleConfirmPermanentDelete}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                <TrashIcon className="w-4 h-4" />
                <span>{isProcessing ? 'Deleting...' : 'Yes, Delete Permanently'}</span>
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* ======================================================== */}
      {/* EMPTY TRASH CONFIRMATION MODAL */}
      {/* ======================================================== */}
      {showEmptyTrashModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <Card className="w-full max-w-md bg-white p-6 rounded-2xl shadow-2xl border border-slate-200">
            <div className="flex items-start gap-3.5 mb-4">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-xl shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Empty Recycle Bin?</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Are you sure you want to empty the entire recycle bin? All <strong className="text-slate-800">{trashItems.length} deleted items</strong> will be purged permanently from the cloud database.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button 
                variant="outline" 
                onClick={() => setShowEmptyTrashModal(false)}
                disabled={isProcessing}
                className="text-xs font-bold cursor-pointer"
              >
                Cancel
              </Button>
              <button
                onClick={handleConfirmEmptyTrash}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                <TrashIcon className="w-4 h-4" />
                <span>{isProcessing ? 'Purging...' : 'Yes, Empty Everything'}</span>
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
