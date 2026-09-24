import React, { useState, useEffect, useMemo } from 'react';
import { 
  History, 
  Search, 
  Calendar, 
  Filter, 
  RefreshCw, 
  Trash2, 
  ShoppingCart, 
  DollarSign, 
  Package, 
  Users, 
  Truck, 
  Receipt, 
  HandCoins, 
  Landmark, 
  Briefcase, 
  Layers, 
  Clock, 
  ArrowUpRight, 
  ArrowDownLeft, 
  CheckCircle2, 
  X, 
  Eye, 
  Download, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  Printer,
  FileText
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { ActivityLog as ActivityLogType, ActivityCategory, Sale, Purchase } from '../types';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { InvoiceViewer } from '../components/invoice/InvoiceViewer';

export const ActivityLog: React.FC = () => {
  const [activities, setActivities] = useState<ActivityLogType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'>('all');
  const [customDate, setCustomDate] = useState<string>('');
  
  // Modals and UI state
  const [viewingActivity, setViewingActivity] = useState<ActivityLogType | null>(null);
  const [linkedSale, setLinkedSale] = useState<Sale | null>(null);
  const [linkedPurchase, setLinkedPurchase] = useState<Purchase | null>(null);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const loadActivities = () => {
    setIsRefreshing(true);
    try {
      const data = storageService.getAllActivities();
      setActivities(data);
    } catch (err) {
      console.error('Failed to load activities', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  };

  useEffect(() => {
    loadActivities();

    const handleUpdate = () => loadActivities();
    window.addEventListener('bizflow_activities_updated', handleUpdate);
    window.addEventListener('bizflow_sales_updated', handleUpdate);
    window.addEventListener('bizflow_purchases_updated', handleUpdate);
    window.addEventListener('bizflow_inventory_updated', handleUpdate);
    window.addEventListener('bizflow_customers_updated', handleUpdate);
    window.addEventListener('bizflow_suppliers_updated', handleUpdate);
    window.addEventListener('bizflow_expenses_updated', handleUpdate);
    window.addEventListener('bizflow_due_payments_updated', handleUpdate);
    window.addEventListener('bizflow_trash_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('bizflow_activities_updated', handleUpdate);
      window.removeEventListener('bizflow_sales_updated', handleUpdate);
      window.removeEventListener('bizflow_purchases_updated', handleUpdate);
      window.removeEventListener('bizflow_inventory_updated', handleUpdate);
      window.removeEventListener('bizflow_customers_updated', handleUpdate);
      window.removeEventListener('bizflow_suppliers_updated', handleUpdate);
      window.removeEventListener('bizflow_expenses_updated', handleUpdate);
      window.removeEventListener('bizflow_due_payments_updated', handleUpdate);
      window.removeEventListener('bizflow_trash_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // Helper date calculators
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);

  // Filter activities
  const filteredActivities = useMemo(() => {
    return activities.filter(act => {
      // Category filter
      if (selectedCategory !== 'all' && act.category !== selectedCategory) {
        return false;
      }

      // Date filter
      if (dateFilter === 'today') {
        if (act.date !== todayStr) return false;
      } else if (dateFilter === 'yesterday') {
        if (act.date !== yesterdayStr) return false;
      } else if (dateFilter === 'week') {
        const actTime = new Date(act.timestamp).getTime();
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        if (actTime < weekAgo) return false;
      } else if (dateFilter === 'month') {
        const actTime = new Date(act.timestamp).getTime();
        const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        if (actTime < monthAgo) return false;
      } else if (dateFilter === 'custom' && customDate) {
        if (act.date !== customDate) return false;
      }

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = act.title?.toLowerCase().includes(q);
        const matchDesc = act.description?.toLowerCase().includes(q);
        const matchEntity = act.entity_name?.toLowerCase().includes(q);
        const matchCategory = act.category?.toLowerCase().includes(q);
        const matchAmount = act.amount ? act.amount.toString().includes(q) : false;
        if (!matchTitle && !matchDesc && !matchEntity && !matchCategory && !matchAmount) {
          return false;
        }
      }

      return true;
    });
  }, [activities, selectedCategory, dateFilter, customDate, searchQuery, todayStr, yesterdayStr]);

  // Group activities by date
  const groupedByDate = useMemo(() => {
    const groups: { [dateStr: string]: ActivityLogType[] } = {};
    filteredActivities.forEach(item => {
      const d = item.date || item.timestamp.split('T')[0];
      if (!groups[d]) groups[d] = [];
      groups[d].push(item);
    });

    // Sort dates descending
    const sortedDates = Object.keys(groups).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    return sortedDates.map(dateKey => ({
      date: dateKey,
      items: groups[dateKey]
    }));
  }, [filteredActivities]);

  // Summary statistics
  const stats = useMemo(() => {
    const totalCount = activities.length;
    const todayCount = activities.filter(a => a.date === todayStr).length;
    
    let salesCount = 0;
    let salesTotal = 0;
    let collectionsTotal = 0;

    activities.forEach(a => {
      if (a.category === 'sales') {
        salesCount++;
        if (a.amount) salesTotal += a.amount;
      } else if (a.action_type === 'due_collected' && a.amount) {
        collectionsTotal += a.amount;
      }
    });

    return { totalCount, todayCount, salesCount, salesTotal, collectionsTotal };
  }, [activities, todayStr]);

  const toggleDateCollapse = (dateStr: string) => {
    setCollapsedDates(prev => ({
      ...prev,
      [dateStr]: !prev[dateStr]
    }));
  };

  const handleClearLogs = async () => {
    try {
      await storageService.clearAllActivityLogs();
      loadActivities();
      setShowClearConfirmModal(false);
      showToast('Activity logs have been successfully cleared.');
    } catch (err) {
      console.error(err);
      showToast('Failed to clear logs.');
    }
  };

  const openActivityDetail = (activity: ActivityLogType) => {
    setViewingActivity(activity);
    if (activity.category === 'sales' && activity.entity_id) {
      const sale = storageService.getSales().find(s => s.id === activity.entity_id);
      setLinkedSale(sale || null);
      setLinkedPurchase(null);
    } else if (activity.category === 'purchases' && activity.entity_id) {
      const purchase = storageService.getPurchases().find(p => p.id === activity.entity_id);
      setLinkedPurchase(purchase || null);
      setLinkedSale(null);
    } else {
      setLinkedSale(null);
      setLinkedPurchase(null);
    }
  };

  const getCategoryTheme = (category: ActivityCategory) => {
    switch (category) {
      case 'sales':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          iconBg: 'bg-emerald-600 text-white',
          label: 'Sales',
          icon: ShoppingCart
        };
      case 'purchases':
        return {
          bg: 'bg-sky-50 text-sky-700 border-sky-200',
          iconBg: 'bg-sky-600 text-white',
          label: 'Purchase',
          icon: DollarSign
        };
      case 'dues':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          iconBg: 'bg-amber-600 text-white',
          label: 'Due / Collection',
          icon: HandCoins
        };
      case 'inventory':
        return {
          bg: 'bg-purple-50 text-purple-700 border-purple-200',
          iconBg: 'bg-purple-600 text-white',
          label: 'Inventory',
          icon: Package
        };
      case 'expenses':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          iconBg: 'bg-rose-600 text-white',
          label: 'Expense',
          icon: Receipt
        };
      case 'customers':
        return {
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          iconBg: 'bg-indigo-600 text-white',
          label: 'Customer',
          icon: Users
        };
      case 'suppliers':
        return {
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          iconBg: 'bg-blue-600 text-white',
          label: 'Supplier',
          icon: Truck
        };
      case 'trash':
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-300',
          iconBg: 'bg-slate-600 text-white',
          label: 'Recycle Bin',
          icon: Trash2
        };
      case 'finance':
        return {
          bg: 'bg-teal-50 text-teal-700 border-teal-200',
          iconBg: 'bg-teal-600 text-white',
          label: 'Finance',
          icon: Landmark
        };
      default:
        return {
          bg: 'bg-slate-50 text-slate-700 border-slate-200',
          iconBg: 'bg-slate-500 text-white',
          label: 'Activity',
          icon: Clock
        };
    }
  };

  const formatDateTitle = (dateStr: string) => {
    if (!dateStr) return 'Recent Actions';
    if (dateStr === todayStr) {
      return 'Today';
    }
    if (dateStr === yesterdayStr) {
      return 'Yesterday';
    }
    try {
      const d = new Date(dateStr + 'T12:00:00');
      return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl text-sm border border-slate-800 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary-50 text-primary-700 rounded-xl border border-primary-100">
              <History className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Activity Log
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Track and review everything you did day-by-day: sales, purchases, payments, and updates.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadActivities}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary-600' : ''}`} />
            Refresh
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-xs font-semibold"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Log
          </Button>

          {activities.length > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowClearConfirmModal(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 border-rose-200"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Logs
            </Button>
          )}
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border border-slate-200/80 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Total Recorded Actions</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.totalCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
              <History className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-500 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Complete audit history</span>
          </div>
        </Card>

        <Card className="p-4 border border-slate-200/80 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Today's Actions</p>
              <h3 className="text-2xl font-bold text-primary-700 mt-1">{stats.todayCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Recorded since morning
          </div>
        </Card>

        <Card className="p-4 border border-slate-200/80 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Sales Invoices</p>
              <h3 className="text-2xl font-bold text-emerald-700 mt-1">{stats.salesCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-xs font-semibold text-emerald-600">
            ৳{stats.salesTotal.toLocaleString()} total volume
          </div>
        </Card>

        <Card className="p-4 border border-slate-200/80 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Due Collected</p>
              <h3 className="text-2xl font-bold text-amber-700 mt-1">৳{stats.collectionsTotal.toLocaleString()}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <HandCoins className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Customer collections logged
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 border border-slate-200 bg-white space-y-4 shadow-2xs">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Search by title, invoice #, customer, supplier, or amount..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Date Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 md:pb-0">
            {(['all', 'today', 'yesterday', 'week', 'month', 'custom'] as const).map((filter) => {
              const labels = {
                all: 'All Time',
                today: 'Today',
                yesterday: 'Yesterday',
                week: 'Last 7 Days',
                month: 'Last 30 Days',
                custom: 'Custom Date'
              };
              const isSelected = dateFilter === filter;
              return (
                <button
                  key={filter}
                  onClick={() => setDateFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border ${
                    isSelected 
                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs' 
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {labels[filter]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Date Picker if selected */}
        {dateFilter === 'custom' && (
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-700">Select Date:</span>
            <input 
              type="date"
              value={customDate}
              onChange={e => setCustomDate(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {customDate && (
              <span className="text-xs text-slate-500">
                Filtered on {formatDateTitle(customDate)}
              </span>
            )}
          </div>
        )}

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          <span className="text-xs font-semibold text-slate-400 mr-1.5 shrink-0 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filter:
          </span>
          {[
            { id: 'all', label: 'All Activities' },
            { id: 'sales', label: 'Sales' },
            { id: 'purchases', label: 'Purchases' },
            { id: 'dues', label: 'Dues & Collections' },
            { id: 'inventory', label: 'Inventory' },
            { id: 'expenses', label: 'Expenses' },
            { id: 'customers', label: 'Customers' },
            { id: 'suppliers', label: 'Suppliers' },
            { id: 'trash', label: 'Recycle Bin' },
          ].map(cat => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  isSelected 
                    ? 'bg-primary-600 text-white font-semibold shadow-2xs' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Main Day-by-Day Activities List */}
      {groupedByDate.length === 0 ? (
        <Card className="p-12 text-center border border-slate-200 bg-white">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <History className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">No Activity Logs Found</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            No actions match your search query or selected date/category filters.
          </p>
          {(searchQuery || selectedCategory !== 'all' || dateFilter !== 'all') && (
            <div className="mt-5">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setDateFilter('all');
                  setCustomDate('');
                }}
              >
                Reset All Filters
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedByDate.map(({ date, items }) => {
            const isCollapsed = collapsedDates[date] || false;
            
            // Calculate day metrics
            let daySales = 0;
            let dayPurchases = 0;
            let dayExpenses = 0;
            let dayCollections = 0;

            items.forEach(it => {
              if (it.category === 'sales' && it.amount) daySales += it.amount;
              if (it.category === 'purchases' && it.amount) dayPurchases += it.amount;
              if (it.category === 'expenses' && it.amount) dayExpenses += it.amount;
              if (it.action_type === 'due_collected' && it.amount) dayCollections += it.amount;
            });

            return (
              <div key={date} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                {/* Date Header Accordion Bar */}
                <div 
                  onClick={() => toggleDateCollapse(date)}
                  className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-100/70 transition-colors select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-2xs">
                      <Calendar className="w-4 h-4 text-primary-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm md:text-base font-bold text-slate-900">
                          {formatDateTitle(date)}
                        </h2>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700 font-semibold">
                          {items.length} {items.length === 1 ? 'action' : 'actions'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {date}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Mini Day Summary Badges */}
                    <div className="hidden sm:flex items-center gap-3 text-xs font-semibold">
                      {daySales > 0 && (
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                          Sales: ৳{daySales.toLocaleString()}
                        </span>
                      )}
                      {dayPurchases > 0 && (
                        <span className="text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md">
                          Purchase: ৳{dayPurchases.toLocaleString()}
                        </span>
                      )}
                      {dayCollections > 0 && (
                        <span className="text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                          Collection: ৳{dayCollections.toLocaleString()}
                        </span>
                      )}
                      {dayExpenses > 0 && (
                        <span className="text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                          Expense: ৳{dayExpenses.toLocaleString()}
                        </span>
                      )}
                    </div>

                    <button 
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
                      title={isCollapsed ? 'Expand Day' : 'Collapse Day'}
                    >
                      {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Day's Activities List */}
                {!isCollapsed && (
                  <div className="divide-y divide-slate-100">
                    {items.map((activity) => {
                      const theme = getCategoryTheme(activity.category);
                      const IconComponent = theme.icon;

                      return (
                        <div 
                          key={activity.id}
                          onClick={() => openActivityDetail(activity)}
                          className="px-5 py-4 hover:bg-slate-50/70 transition-colors flex items-start gap-4 cursor-pointer group"
                        >
                          {/* Time & Category Badge */}
                          <div className="shrink-0 flex flex-col items-center w-16 pt-0.5">
                            <span className="text-xs font-mono font-bold text-slate-700">
                              {activity.time || 'N/A'}
                            </span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded mt-1 border text-center ${theme.bg}`}>
                              {theme.label}
                            </span>
                          </div>

                          {/* Icon Circle */}
                          <div className={`w-9 h-9 rounded-xl ${theme.iconBg} flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform`}>
                            <IconComponent className="w-4 h-4" />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <h3 className="text-sm font-bold text-slate-900 group-hover:text-primary-600 transition-colors truncate">
                                {activity.title}
                              </h3>
                              {activity.amount !== undefined && activity.amount !== null && (
                                <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
                                  activity.category === 'sales' || activity.action_type === 'due_collected'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : activity.category === 'expenses' || activity.category === 'purchases'
                                    ? 'bg-slate-100 text-slate-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  ৳{activity.amount.toLocaleString()}
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                              {activity.description}
                            </p>

                            {/* Additional metadata tags if available */}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {activity.entity_name && (
                                <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                                  {activity.entity_name}
                                </span>
                              )}
                              {activity.metadata?.payment_method && (
                                <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium uppercase">
                                  {activity.metadata.payment_method}
                                </span>
                              )}
                              {activity.metadata?.customer_name && (
                                <span className="text-[11px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium">
                                  👤 {activity.metadata.customer_name}
                                </span>
                              )}
                              {activity.metadata?.supplier_name && (
                                <span className="text-[11px] bg-sky-50 text-sky-700 px-2 py-0.5 rounded font-medium">
                                  🏢 {activity.metadata.supplier_name}
                                </span>
                              )}
                              <span className="text-[11px] text-primary-600 font-semibold flex items-center gap-0.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                <Eye className="w-3 h-3" /> View Details
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Activity Detail Modal */}
      {viewingActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg ${getCategoryTheme(viewingActivity.category).iconBg} flex items-center justify-center text-white`}>
                  {React.createElement(getCategoryTheme(viewingActivity.category).icon, { className: 'w-4 h-4' })}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Activity Details</h3>
                  <p className="text-xs text-slate-500 font-mono">ID: {viewingActivity.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setViewingActivity(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Primary Card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getCategoryTheme(viewingActivity.category).bg}`}>
                      {viewingActivity.category}
                    </span>
                    <h4 className="text-lg font-bold text-slate-900 mt-2">
                      {viewingActivity.title}
                    </h4>
                  </div>
                  {viewingActivity.amount !== undefined && (
                    <div className="text-right">
                      <p className="text-xs text-slate-500 font-medium">Transaction Amount</p>
                      <p className="text-xl font-extrabold text-primary-700">
                        ৳{viewingActivity.amount.toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                <p className="text-sm text-slate-700 mt-3 bg-white p-3 rounded-lg border border-slate-200/80">
                  {viewingActivity.description}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-3 border-t border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 font-medium block">Date:</span>
                    <span className="font-semibold text-slate-800">{formatDateTitle(viewingActivity.date)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium block">Time:</span>
                    <span className="font-semibold text-slate-800">{viewingActivity.time}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium block">Action Type:</span>
                    <span className="font-mono font-semibold text-slate-800">{viewingActivity.action_type}</span>
                  </div>
                </div>
              </div>

              {/* Extended Metadata if available */}
              {viewingActivity.metadata && Object.keys(viewingActivity.metadata).length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Associated Properties
                  </h5>
                  <div className="grid grid-cols-2 gap-2 bg-white rounded-xl border border-slate-200 p-3 text-xs">
                    {Object.entries(viewingActivity.metadata).map(([key, val]) => (
                      <div key={key} className="p-2 rounded bg-slate-50">
                        <span className="text-slate-400 capitalize block">{key.replace(/_/g, ' ')}:</span>
                        <span className="font-semibold text-slate-800 truncate block">
                          {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* If Linked Sale, show full invoice breakdown */}
              {linkedSale && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-primary-600" />
                      Sales Invoice Preview
                    </h5>
                    <span className="text-xs font-semibold text-primary-600">
                      Invoice #{linkedSale.id.slice(-6).toUpperCase()}
                    </span>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-2xs overflow-hidden max-h-72 overflow-y-auto">
                    <InvoiceViewer 
                      sale={linkedSale} 
                      settings={storageService.getBusinessSettings()}
                      customer={storageService.getCustomers().find(c => c.id === linkedSale.customer_id)}
                      onClose={() => {}}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setViewingActivity(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Logs Confirmation Modal */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6">
            <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Clear Activity Logs?</h3>
            <p className="text-sm text-slate-600 mt-2">
              Are you sure you want to clear your recorded activity logs? Active business records (products, sales, purchases) will remain untouched.
            </p>

            <div className="flex items-center justify-end gap-3 mt-6">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowClearConfirmModal(false)}
              >
                Cancel
              </Button>
              <Button 
                variant="primary" 
                size="sm" 
                onClick={handleClearLogs}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                Yes, Clear Logs
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
