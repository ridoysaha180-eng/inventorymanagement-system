import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, X, Package, Users, Truck, ShoppingCart, 
  DollarSign, Receipt, TrendingDown, Landmark, Briefcase, 
  Settings, LayoutGrid, ArrowRight, Tag, AlertTriangle, Check
} from 'lucide-react';
import { storageService } from '../../services/storageService';
import { InventoryItem, Customer, Supplier, Sale } from '../../types';
import { formatCurrency, cn } from '../../utils';

interface SearchResultItem {
  id: string;
  type: 'product' | 'customer' | 'supplier' | 'sale' | 'page';
  title: string;
  subtitle: string;
  badge?: string;
  badgeColor?: string;
  path: string;
  searchParam?: string;
}

const STATIC_PAGES = [
  { title: 'Dashboard', subtitle: 'Overview, analytics & financial summaries', path: '/', keywords: 'home overview analytics summary statistics' },
  { title: 'Inventory List', subtitle: 'Stock balance, price management & low stock', path: '/inventory', keywords: 'stock items products catalog count units' },
  { title: 'Product Details', subtitle: 'Barcode labels, specifications & catalog', path: '/products', keywords: 'barcode details catalog images edit' },
  { title: 'Sales POS', subtitle: 'Create invoices, quick counter checkout', path: '/sales', keywords: 'sell checkout invoice pos billing receipt' },
  { title: 'Purchases & Stock In', subtitle: 'Supplier orders, procurement & bills', path: '/purchases', keywords: 'procurement bill vendor stock in buy' },
  { title: 'Expense Management', subtitle: 'Record daily shop expenditures & operational costs', path: '/expenses', keywords: 'cost spend bill electricity rent maintenance' },
  { title: 'Customers Directory', subtitle: 'Customer ledger, dues & contact info', path: '/customers', keywords: 'client buyer debtor due ledger phone' },
  { title: 'Suppliers Directory', subtitle: 'Vendor contacts, payables & stock sources', path: '/suppliers', keywords: 'vendor manufacturer payable bills' },
  { title: 'Financial Reports', subtitle: 'Profit & loss, sales ledger, stock value', path: '/reports', keywords: 'profit loss statement balance sheet summary tax' },
  { title: 'Loans & Liabilities', subtitle: 'Borrowings, installments & repayments', path: '/loans', keywords: 'debt borrow loan liability interest' },
  { title: 'Investments & Capital', subtitle: 'Owner capital, partner equity & withdrawals', path: '/investments', keywords: 'equity owner capital deposit withdrawal' },
  { title: 'Company & Categories', subtitle: 'Brand, company & category classification', path: '/company-category', keywords: 'brand category subcategory tags classification' },
  { title: 'Bulk Excel Upload', subtitle: 'Import products & inventory from spreadsheets', path: '/bulk-upload', keywords: 'import excel sheet csv bulk products' },
  { title: 'Store Settings', subtitle: 'Business profile, printer, notifications & backup', path: '/settings', keywords: 'business store logo profile backup printer notifications' },
];

export const GlobalSearch: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  // Cached data
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  // Load and subscribe to real data
  const refreshData = () => {
    setInventory(storageService.getInventory() || []);
    setCustomers(storageService.getCustomers() || []);
    setSuppliers(storageService.getSuppliers() || []);
    setSales(storageService.getSales() || []);
  };

  useEffect(() => {
    refreshData();

    const events = [
      'bizflow_inventory_updated',
      'bizflow_customers_updated',
      'bizflow_suppliers_updated',
      'bizflow_sales_updated',
    ];

    events.forEach(event => window.addEventListener(event, refreshData));
    return () => {
      events.forEach(event => window.removeEventListener(event, refreshData));
    };
  }, []);

  // Global keyboard shortcut: Ctrl+K or Cmd+K or "/"
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        setIsMobileSearchOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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

  // Compute search results
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const results: SearchResultItem[] = [];

    // 1. Static Pages
    STATIC_PAGES.forEach(page => {
      if (page.title.toLowerCase().includes(q) || page.keywords.includes(q)) {
        results.push({
          id: `page_${page.path}`,
          type: 'page',
          title: page.title,
          subtitle: page.subtitle,
          path: page.path,
          badge: 'Page',
          badgeColor: 'bg-slate-100 text-slate-700 border-slate-200'
        });
      }
    });

    // 2. Products / Inventory
    const matchedProducts = inventory.filter(item => 
      item.name.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      (item.item_code && item.item_code.toLowerCase().includes(q)) ||
      (item.category && item.category.toLowerCase().includes(q)) ||
      (item.company && item.company.toLowerCase().includes(q))
    ).slice(0, 6);

    matchedProducts.forEach(item => {
      const isLowStock = item.quantity <= (item.min_stock_level || 5);
      results.push({
        id: `prod_${item.id}`,
        type: 'product',
        title: item.name,
        subtitle: `${item.category || 'General'}${item.company ? ` • ${item.company}` : ''} • SKU: ${item.sku} • ৳${formatCurrency(item.unit_price)}`,
        badge: item.quantity <= 0 ? 'Out of Stock' : isLowStock ? `Low (${item.quantity} ${item.unit || 'pcs'})` : `${item.quantity} ${item.unit || 'pcs'}`,
        badgeColor: item.quantity <= 0 ? 'bg-red-50 text-red-600 border-red-200' : isLowStock ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
        path: '/inventory',
        searchParam: item.name
      });
    });

    // 3. Customers
    const matchedCustomers = customers.filter(cust => 
      cust.name.toLowerCase().includes(q) ||
      (cust.phone && cust.phone.toLowerCase().includes(q)) ||
      (cust.email && cust.email.toLowerCase().includes(q))
    ).slice(0, 4);

    matchedCustomers.forEach(cust => {
      // Calculate due
      const custSales = sales.filter(s => s.customer_id === cust.id);
      const totalDue = custSales
        .filter(s => s.payment_method === 'due' || s.status === 'pending')
        .reduce((sum, s) => sum + s.total_amount, 0);

      results.push({
        id: `cust_${cust.id}`,
        type: 'customer',
        title: cust.name,
        subtitle: cust.phone ? `Phone: ${cust.phone}` : (cust.email || 'Customer'),
        badge: totalDue > 0 ? `Due: ৳${formatCurrency(totalDue)}` : 'Clear',
        badgeColor: totalDue > 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-600 border-slate-200',
        path: '/customers',
        searchParam: cust.name
      });
    });

    // 4. Suppliers
    const matchedSuppliers = suppliers.filter(sup => 
      sup.name.toLowerCase().includes(q) ||
      (sup.phone && sup.phone.toLowerCase().includes(q)) ||
      (sup.sl_number && sup.sl_number.toLowerCase().includes(q)) ||
      (sup.contact_person && sup.contact_person.toLowerCase().includes(q))
    ).slice(0, 4);

    matchedSuppliers.forEach(sup => {
      results.push({
        id: `sup_${sup.id}`,
        type: 'supplier',
        title: sup.name,
        subtitle: `${sup.sl_number ? `SL: ${sup.sl_number} • ` : ''}${sup.phone || sup.contact_person || 'Supplier'}`,
        badge: 'Supplier',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
        path: '/suppliers',
        searchParam: sup.name
      });
    });

    // 5. Invoices / Sales
    const matchedSales = sales.filter(s => 
      s.id.toLowerCase().includes(q) ||
      (s.payment_method && s.payment_method.toLowerCase().includes(q))
    ).slice(0, 3);

    matchedSales.forEach(s => {
      results.push({
        id: `sale_${s.id}`,
        type: 'sale',
        title: `Invoice #${s.id.slice(-6).toUpperCase()}`,
        subtitle: `Amount: ৳${formatCurrency(s.total_amount)} • Method: ${s.payment_method.toUpperCase()}`,
        badge: s.status === 'completed' ? 'Paid' : 'Pending',
        badgeColor: s.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200',
        path: '/sales',
        searchParam: s.id
      });
    });

    return results;
  }, [query, inventory, customers, suppliers, sales]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelectResult = (item: SearchResultItem) => {
    setIsOpen(false);
    setIsMobileSearchOpen(false);
    setQuery('');

    if (item.searchParam) {
      navigate(`${item.path}?search=${encodeURIComponent(item.searchParam)}`);
    } else {
      navigate(item.path);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || searchResults.length === 0) {
      if (e.key === 'Enter' && query.trim()) {
        // Fallback: search in inventory
        navigate(`/inventory?search=${encodeURIComponent(query.trim())}`);
        setIsOpen(false);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % searchResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults[selectedIndex]) {
        handleSelectResult(searchResults[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const getResultIcon = (type: SearchResultItem['type']) => {
    switch (type) {
      case 'product':
        return <Package className="w-4 h-4 text-emerald-600" />;
      case 'customer':
        return <Users className="w-4 h-4 text-indigo-600" />;
      case 'supplier':
        return <Truck className="w-4 h-4 text-blue-600" />;
      case 'sale':
        return <ShoppingCart className="w-4 h-4 text-purple-600" />;
      case 'page':
      default:
        return <LayoutGrid className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <>
      {/* Desktop Search Bar */}
      <div ref={containerRef} className="relative hidden md:block">
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50/80 hover:bg-slate-50 rounded-xl border border-slate-200/80 w-64 lg:w-72 transition-all focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500/40 focus-within:bg-white focus-within:w-80 shadow-2xs">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input 
            ref={inputRef}
            type="text" 
            placeholder="Search products, customers, pages..." 
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            className="bg-transparent border-none outline-none text-sm w-full placeholder:text-slate-400 text-slate-800"
          />
          {query ? (
            <button 
              onClick={() => {
                setQuery('');
                setIsOpen(false);
                inputRef.current?.focus();
              }}
              className="p-0.5 text-slate-400 hover:text-slate-600 rounded-md transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded-md select-none shrink-0">
              ⌘K
            </kbd>
          )}
        </div>

        {/* Live Search Results Dropdown */}
        {isOpen && query.trim() && (
          <div className="absolute left-0 top-full mt-2 w-96 max-h-[440px] bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-50 flex flex-col animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="p-2 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs text-slate-500 font-semibold px-3.5">
              <span>{searchResults.length} Results Found</span>
              <span className="text-[11px] text-slate-400">↑↓ to navigate • ↵ to open</span>
            </div>

            <div className="overflow-y-auto divide-y divide-slate-100 max-h-[360px] p-1.5">
              {searchResults.length > 0 ? (
                searchResults.map((item, idx) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectResult(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      "w-full text-left p-2.5 rounded-xl flex items-center gap-3 transition-colors cursor-pointer group",
                      selectedIndex === idx ? "bg-emerald-50/80 text-emerald-950" : "hover:bg-slate-50 text-slate-800"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
                      item.type === 'product' && "bg-emerald-100/50 border-emerald-200/60",
                      item.type === 'customer' && "bg-indigo-100/50 border-indigo-200/60",
                      item.type === 'supplier' && "bg-blue-100/50 border-blue-200/60",
                      item.type === 'sale' && "bg-purple-100/50 border-purple-200/60",
                      item.type === 'page' && "bg-slate-100 border-slate-200",
                    )}>
                      {getResultIcon(item.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold truncate text-slate-900 group-hover:text-emerald-700 transition-colors">
                          {item.title}
                        </p>
                        {item.badge && (
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0",
                            item.badgeColor
                          )}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {item.subtitle}
                      </p>
                    </div>

                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 transition-colors shrink-0" />
                  </button>
                ))
              ) : (
                <div className="py-8 text-center px-4">
                  <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">No exact matches found for "{query}"</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Try searching by product name, SKU, customer phone, or page title
                  </p>
                  <button
                    onClick={() => {
                      navigate(`/inventory?search=${encodeURIComponent(query.trim())}`);
                      setIsOpen(false);
                    }}
                    className="mt-3 px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors cursor-pointer"
                  >
                    Search in Inventory List →
                  </button>
                </div>
              )}
            </div>

            {searchResults.length > 0 && (
              <div className="p-2 border-t border-slate-100 bg-slate-50/60 text-center">
                <button
                  onClick={() => {
                    navigate(`/inventory?search=${encodeURIComponent(query.trim())}`);
                    setIsOpen(false);
                  }}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
                >
                  View full results in Inventory →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Search Button */}
      <button 
        onClick={() => {
          setIsMobileSearchOpen(true);
          setTimeout(() => mobileInputRef.current?.focus(), 50);
        }}
        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg md:hidden cursor-pointer"
        title="Search"
      >
        <Search className="w-5 h-5" />
      </button>

      {/* Mobile Search Overlay Modal */}
      {isMobileSearchOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex flex-col p-4 md:hidden">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="p-3 border-b border-slate-200 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                ref={mobileInputRef}
                type="text"
                placeholder="Search products, customers, pages..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-sm w-full text-slate-800 placeholder:text-slate-400"
              />
              <button
                onClick={() => setIsMobileSearchOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-2 divide-y divide-slate-100">
              {query.trim() ? (
                searchResults.length > 0 ? (
                  searchResults.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleSelectResult(item)}
                      className="w-full text-left p-3 rounded-xl flex items-center gap-3 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border bg-slate-50 border-slate-200">
                        {getResultIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-bold text-slate-900 truncate">{item.title}</p>
                          {item.badge && (
                            <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0", item.badgeColor)}>
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.subtitle}</p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    </button>
                  ))
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-xs font-bold text-slate-700">No matches found</p>
                    <button
                      onClick={() => {
                        navigate(`/inventory?search=${encodeURIComponent(query.trim())}`);
                        setIsMobileSearchOpen(false);
                      }}
                      className="mt-2 text-xs font-semibold text-emerald-600"
                    >
                      Search inventory for "{query}"
                    </button>
                  </div>
                )
              ) : (
                <div className="p-3 text-xs text-slate-400 text-center">
                  Start typing to search products, customers, suppliers or pages
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
