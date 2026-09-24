import React, { useEffect, useState } from 'react';
import { 
  LayoutGrid, 
  Package, 
  ShoppingCart, 
  DollarSign,
  TrendingDown,
  Box,
  Users, 
  Truck,
  Settings, 
  LogOut,
  X,
  Store,
  Receipt,
  Landmark,
  Briefcase,
  HandCoins,
  Trash2,
  History
} from 'lucide-react';
import { NavLink, useNavigate, Link } from 'react-router-dom';
import { cn } from '../../utils';
import { storageService } from '../../services/storageService';
import { BusinessSettings } from '../../types';
import { BrandLogo } from '../common/BrandLogo';

import { ChevronDown, ChevronRight, Tags, Tag } from 'lucide-react';

const navItems = [
  { icon: LayoutGrid, label: 'Dashboard', path: '/' },
  { icon: Package, label: 'Inventory', path: '/inventory' },
  { icon: Box, label: 'Product', path: '/products' },
  { icon: ShoppingCart, label: 'Sales', path: '/sales' },
  { icon: DollarSign, label: 'Purchases', path: '/purchases' },
  { icon: HandCoins, label: 'Due Management', path: '/dues' },
  { icon: Receipt, label: 'Expenses', path: '/expenses' },
  { icon: Landmark, label: 'Loans', path: '/loans' },
  { icon: Briefcase, label: 'Investments', path: '/investments' },
  { icon: Users, label: 'Customers', path: '/customers' },
  { icon: Truck, label: 'Suppliers', path: '/suppliers' },
  { icon: History, label: 'Activity Log', path: '/activity-log' },
  { icon: Trash2, label: 'Recycle Bin', path: '/trash' },
  { icon: TrendingDown, label: 'Reports', path: '/reports' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export const Sidebar: React.FC<{ isOpen: boolean; toggle: () => void }> = ({ isOpen, toggle }) => {
  const navigate = useNavigate();
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['Product']);

  useEffect(() => {
    const refreshSettings = () => {
      setBusinessSettings(storageService.getBusinessSettings());
    };
    refreshSettings();
    window.addEventListener('bizflow_business_settings_updated', refreshSettings);
    window.addEventListener('storage', refreshSettings);
    return () => {
      window.removeEventListener('bizflow_business_settings_updated', refreshSettings);
      window.removeEventListener('storage', refreshSettings);
    };
  }, []);

  const handleLogout = () => {
    // Mock logout
    localStorage.removeItem('bizflow_user');
    navigate('/login');
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={toggle}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-slate-200 transition-transform duration-300 ease-in-out lg:translate-x-0 flex flex-col",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 h-20 border-b border-slate-100">
          <Link 
            to="/" 
            onClick={() => {
              if (window.innerWidth < 1024) toggle();
            }}
            className="flex-1 min-w-0 cursor-pointer transition-transform hover:opacity-90 active:scale-98"
            title="Go to Home Dashboard"
          >
            <BrandLogo 
              name={businessSettings?.name || 'Grocery Point'}
              tagline={businessSettings?.tagline || 'Fresh Products • Better Life'}
              logo={businessSettings?.logo}
              size="md"
              className="w-full"
            />
          </Link>
          <button onClick={toggle} className="lg:hidden p-1 text-slate-400 hover:bg-slate-100 rounded-lg shrink-0 ml-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav Items */}
                <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto no-scrollbar">
          {navItems.map((item) => (
            <div key={item.label}>
              <NavLink
                to={item.path}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group",
                  isActive 
                    ? "bg-primary-50 text-primary-700 font-semibold" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            </div>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-slate-100">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-red-600 font-medium transition-colors group"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};
