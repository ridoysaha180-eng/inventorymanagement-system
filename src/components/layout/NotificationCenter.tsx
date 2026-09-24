import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, AlertTriangle, AlertCircle, CheckCircle2, TrendingUp, 
  X, Check, Settings, ExternalLink, Package, Users, Truck, ShoppingCart
} from 'lucide-react';
import { storageService } from '../../services/storageService';
import { InventoryItem, Customer, Supplier, Sale } from '../../types';
import { formatCurrency, cn } from '../../utils';

export interface NotificationItem {
  id: string;
  category: 'low_stock' | 'customer_due' | 'supplier_due' | 'sales' | 'system';
  title: string;
  message: string;
  time: string;
  link: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
}

export const NotificationCenter: React.FC = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'stock' | 'dues' | 'sales'>('all');
  const containerRef = useRef<HTMLDivElement>(null);

  // Data states
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  // Persistent read and dismissed tracking
  const [readIds, setReadIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('bizflow_read_notifications') || '[]');
    } catch {
      return [];
    }
  });

  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('bizflow_dismissed_notifications') || '[]');
    } catch {
      return [];
    }
  });

  // Load and subscribe to real-time events
  const loadData = () => {
    setInventory(storageService.getInventory() || []);
    setCustomers(storageService.getCustomers() || []);
    setSuppliers(storageService.getSuppliers() || []);
    setSales(storageService.getSales() || []);
  };

  useEffect(() => {
    loadData();

    const events = [
      'bizflow_inventory_updated',
      'bizflow_customers_updated',
      'bizflow_suppliers_updated',
      'bizflow_sales_updated',
    ];

    events.forEach(evt => window.addEventListener(evt, loadData));
    return () => {
      events.forEach(evt => window.removeEventListener(evt, loadData));
    };
  }, []);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute all active notifications
  const allNotifications = useMemo(() => {
    const notifs: NotificationItem[] = [];
    const notifSettings = storageService.getNotificationSettings();

    // 1. Low Stock Alerts
    if (notifSettings.low_stock_alerts !== false) {
      const lowStockItems = inventory.filter(item => {
        const threshold = item.min_stock_level ?? 5;
        return (item.quantity ?? 0) <= threshold;
      });

      lowStockItems.slice(0, 10).forEach(item => {
        const isOutOfStock = (item.quantity ?? 0) <= 0;
        notifs.push({
          id: `stock_${item.id}`,
          category: 'low_stock',
          title: isOutOfStock ? `Out of Stock: ${item.name}` : `Low Stock: ${item.name}`,
          message: isOutOfStock 
            ? `Stock reached 0 ${item.unit || 'units'}. Urgent replenishment needed.`
            : `Only ${item.quantity} ${item.unit || 'units'} left (Min: ${item.min_stock_level ?? 5}).`,
          time: 'Stock Alert',
          link: `/inventory?search=${encodeURIComponent(item.name)}`,
          severity: isOutOfStock ? 'critical' : 'warning',
        });
      });
    }

    // 2. Customer Due Reminders
    if (notifSettings.due_payment_reminders !== false) {
      customers.forEach(cust => {
        const custSales = sales.filter(s => s.customer_id === cust.id);
        const totalDue = custSales
          .filter(s => s.payment_method === 'due' || s.status === 'pending')
          .reduce((sum, s) => sum + s.total_amount, 0);

        if (totalDue > 0) {
          notifs.push({
            id: `cust_due_${cust.id}`,
            category: 'customer_due',
            title: `Payment Due: ${cust.name}`,
            message: `Outstanding balance ৳${formatCurrency(totalDue)}${cust.phone ? ` • Tel: ${cust.phone}` : ''}`,
            time: 'Payment Due',
            link: `/customers?search=${encodeURIComponent(cust.name)}`,
            severity: 'warning',
          });
        }
      });
    }

    // 3. Supplier Payable Reminders
    suppliers.forEach(sup => {
      // Find purchases by supplier_id
      const purchases = storageService.getPurchases();
      const supPurchases = purchases.filter(p => p.supplier_id === sup.id);
      const totalDueAmount = supPurchases
        .filter(p => p.payment_method === 'due' || p.status === 'pending')
        .reduce((sum, p) => sum + p.total_amount, 0);

      if (totalDueAmount > 0) {
        notifs.push({
          id: `sup_due_${sup.id}`,
          category: 'supplier_due',
          title: `Supplier Payable: ${sup.name}`,
          message: `Pending payable bill of ৳${formatCurrency(totalDueAmount)}`,
          time: 'Payable Due',
          link: `/suppliers?search=${encodeURIComponent(sup.name)}`,
          severity: 'info',
        });
      }
    });

    // 4. Daily Sales Summary
    if (notifSettings.daily_sales_summary !== false && sales.length > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      const todaySales = sales.filter(s => (s.created_at || '').startsWith(todayStr));
      const todayTotal = todaySales.reduce((sum, s) => sum + (s.total_amount || 0), 0);

      if (todaySales.length > 0) {
        notifs.push({
          id: `daily_sales_${todayStr}`,
          category: 'sales',
          title: "Today's Sales Summary",
          message: `${todaySales.length} orders recorded today totaling ৳${formatCurrency(todayTotal)}.`,
          time: 'Today',
          link: '/sales',
          severity: 'success',
        });
      }
    }

    // Filter out dismissed
    return notifs.filter(n => !dismissedIds.includes(n.id));
  }, [inventory, customers, suppliers, sales, dismissedIds]);

  // Filter by tab
  const filteredNotifications = useMemo(() => {
    if (activeTab === 'stock') {
      return allNotifications.filter(n => n.category === 'low_stock');
    }
    if (activeTab === 'dues') {
      return allNotifications.filter(n => n.category === 'customer_due' || n.category === 'supplier_due');
    }
    if (activeTab === 'sales') {
      return allNotifications.filter(n => n.category === 'sales');
    }
    return allNotifications;
  }, [allNotifications, activeTab]);

  // Unread count
  const unreadCount = useMemo(() => {
    return allNotifications.filter(n => !readIds.includes(n.id)).length;
  }, [allNotifications, readIds]);

  const markAsRead = (id: string) => {
    if (!readIds.includes(id)) {
      const next = [...readIds, id];
      setReadIds(next);
      localStorage.setItem('bizflow_read_notifications', JSON.stringify(next));
    }
  };

  const markAllAsRead = () => {
    const allIds = allNotifications.map(n => n.id);
    const updated = Array.from(new Set([...readIds, ...allIds]));
    setReadIds(updated);
    localStorage.setItem('bizflow_read_notifications', JSON.stringify(updated));
  };

  const dismissNotification = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const next = [...dismissedIds, id];
    setDismissedIds(next);
    localStorage.setItem('bizflow_dismissed_notifications', JSON.stringify(next));
  };

  const clearAll = () => {
    const allIds = allNotifications.map(n => n.id);
    const updated = Array.from(new Set([...dismissedIds, ...allIds]));
    setDismissedIds(updated);
    localStorage.setItem('bizflow_dismissed_notifications', JSON.stringify(updated));
  };

  const handleNotificationClick = (item: NotificationItem) => {
    markAsRead(item.id);
    setIsOpen(false);
    navigate(item.link);
  };

  const getNotificationIcon = (category: NotificationItem['category'], severity: NotificationItem['severity']) => {
    switch (category) {
      case 'low_stock':
        return severity === 'critical' ? (
          <AlertCircle className="w-4 h-4 text-red-600" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-amber-600" />
        );
      case 'customer_due':
        return <Users className="w-4 h-4 text-rose-600" />;
      case 'supplier_due':
        return <Truck className="w-4 h-4 text-blue-600" />;
      case 'sales':
        return <TrendingUp className="w-4 h-4 text-emerald-600" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Bell Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications"
        className={cn(
          "p-2 text-slate-600 hover:bg-slate-100 rounded-xl relative transition-colors cursor-pointer",
          isOpen && "bg-slate-100 text-slate-900"
        )}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white flex items-center justify-center px-1 shadow-xs animate-in zoom-in-75 duration-150">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
              {unreadCount > 0 ? (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full border border-red-200">
                  {unreadCount} new
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full border border-slate-200">
                  All caught up
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center px-3 py-1.5 border-b border-slate-100 bg-white gap-1 text-[11px] font-semibold text-slate-600 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('all')}
              className={cn(
                "px-2.5 py-1 rounded-lg transition-colors shrink-0 cursor-pointer",
                activeTab === 'all' ? "bg-slate-900 text-white font-bold" : "hover:bg-slate-100 text-slate-600"
              )}
            >
              All ({allNotifications.length})
            </button>
            <button
              onClick={() => setActiveTab('stock')}
              className={cn(
                "px-2.5 py-1 rounded-lg transition-colors shrink-0 cursor-pointer",
                activeTab === 'stock' ? "bg-slate-900 text-white font-bold" : "hover:bg-slate-100 text-slate-600"
              )}
            >
              Stock Alerts
            </button>
            <button
              onClick={() => setActiveTab('dues')}
              className={cn(
                "px-2.5 py-1 rounded-lg transition-colors shrink-0 cursor-pointer",
                activeTab === 'dues' ? "bg-slate-900 text-white font-bold" : "hover:bg-slate-100 text-slate-600"
              )}
            >
              Dues & Payables
            </button>
            <button
              onClick={() => setActiveTab('sales')}
              className={cn(
                "px-2.5 py-1 rounded-lg transition-colors shrink-0 cursor-pointer",
                activeTab === 'sales' ? "bg-slate-900 text-white font-bold" : "hover:bg-slate-100 text-slate-600"
              )}
            >
              Sales
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
            {filteredNotifications.length > 0 ? (
              filteredNotifications.map(item => {
                const isRead = readIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={cn(
                      "p-3.5 flex items-start gap-3 transition-colors cursor-pointer group hover:bg-slate-50 relative",
                      !isRead && "bg-emerald-50/30"
                    )}
                  >
                    {/* Icon */}
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border mt-0.5",
                      item.severity === 'critical' && "bg-red-50 border-red-200",
                      item.severity === 'warning' && "bg-amber-50 border-amber-200",
                      item.severity === 'info' && "bg-blue-50 border-blue-200",
                      item.severity === 'success' && "bg-emerald-50 border-emerald-200",
                    )}>
                      {getNotificationIcon(item.category, item.severity)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-6">
                      <div className="flex items-center gap-1.5">
                        <h4 className={cn(
                          "text-xs font-bold truncate text-slate-900",
                          !isRead && "text-slate-950 font-black"
                        )}>
                          {item.title}
                        </h4>
                        {!isRead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">
                        {item.message}
                      </p>
                      <span className="text-[10px] font-semibold text-slate-400 mt-1 inline-block">
                        {item.time}
                      </span>
                    </div>

                    {/* Dismiss Button */}
                    <button
                      onClick={(e) => dismissNotification(e, item.id)}
                      title="Dismiss"
                      className="absolute right-3 top-3 p-1 text-slate-300 hover:text-slate-600 rounded-md transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="py-10 text-center px-4">
                <CheckCircle2 className="w-9 h-9 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="text-xs font-bold text-slate-700">No active notifications</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  You're completely updated with stock, dues, and sales
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs px-3">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/settings');
              }}
              className="font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              Settings
            </button>

            {allNotifications.length > 0 && (
              <button
                onClick={clearAll}
                className="font-semibold text-slate-400 hover:text-red-600 transition-colors cursor-pointer text-[11px]"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
