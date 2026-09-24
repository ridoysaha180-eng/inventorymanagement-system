import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Package, 
  X, 
  ScanLine, 
  AlertTriangle, 
  Building2,
  DollarSign,
  Eye,
  Barcode,
  Tag,
  Sparkles,
  Check,
  Layers
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { formatCurrency, cn } from '../utils';
import { storageService } from '../services/storageService';
import { InventoryItem, Brand, Category, SubCategory } from '../types';
import { BarcodeScanner } from '../components/common/BarcodeScanner';

export const ProductDetails: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [viewingItem, setViewingItem] = useState<InventoryItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id?: string; name?: string }>({ isOpen: false });
  
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<'search' | 'sku' | null>(null);

  // Company & Category Management Modal & State
  const [isCompanyCategoryModalOpen, setIsCompanyCategoryModalOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [brandSearch, setBrandSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [ccEditModal, setCcEditModal] = useState<{
    isOpen: boolean;
    type: 'company' | 'category' | null;
    id: string;
    oldName: string;
    newName: string;
  }>({ isOpen: false, type: null, id: '', oldName: '', newName: '' });

  const [ccDeleteModal, setCcDeleteModal] = useState<{
    isOpen: boolean;
    type: 'company' | 'category' | null;
    id: string;
    name: string;
    productCount: number;
  }>({ isOpen: false, type: null, id: '', name: '', productCount: 0 });

  const handleCreateBrand = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newBrandName.trim();
    if (!trimmed) return;
    const exists = brands.some(b => b.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      alert('This company name already exists.');
      return;
    }
    storageService.addBrand({
      id: Math.random().toString(36).substring(2, 9),
      name: trimmed,
      created_at: new Date().toISOString()
    });
    setNewBrandName('');
    loadData();
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    const exists = categories.some(c => c.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      alert('This category name already exists.');
      return;
    }
    storageService.addCategory({
      id: Math.random().toString(36).substring(2, 9),
      name: trimmed,
      created_at: new Date().toISOString()
    });
    setNewCategoryName('');
    loadData();
  };

  const handleSaveCcEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedNew = ccEditModal.newName.trim();
    if (!trimmedNew) return;

    if (ccEditModal.type === 'company') {
      const brand = brands.find(b => b.id === ccEditModal.id);
      if (brand) {
        storageService.updateBrand(ccEditModal.id, { ...brand, name: trimmedNew });
        if (ccEditModal.oldName !== trimmedNew) {
          const currentInv = storageService.getInventory();
          let modified = false;
          const updatedInv = currentInv.map(p => {
            if ((p.company || (p as any).brand) === ccEditModal.oldName) {
              modified = true;
              return { ...p, company: trimmedNew, brand: trimmedNew };
            }
            return p;
          });
          if (modified) storageService.saveInventory(updatedInv);
        }
      }
    } else if (ccEditModal.type === 'category') {
      const cat = categories.find(c => c.id === ccEditModal.id);
      if (cat) {
        storageService.updateCategory(ccEditModal.id, { ...cat, name: trimmedNew });
        if (ccEditModal.oldName !== trimmedNew) {
          const currentInv = storageService.getInventory();
          let modified = false;
          const updatedInv = currentInv.map(p => {
            if (p.category === ccEditModal.oldName) {
              modified = true;
              return { ...p, category: trimmedNew };
            }
            return p;
          });
          if (modified) storageService.saveInventory(updatedInv);
        }
      }
    }
    setCcEditModal({ isOpen: false, type: null, id: '', oldName: '', newName: '' });
    loadData();
  };

  const handleConfirmCcDelete = () => {
    if (!ccDeleteModal.id || !ccDeleteModal.type) return;
    if (ccDeleteModal.type === 'company') {
      storageService.deleteBrand(ccDeleteModal.id);
    } else if (ccDeleteModal.type === 'category') {
      storageService.deleteCategory(ccDeleteModal.id);
    }
    setCcDeleteModal({ isOpen: false, type: null, id: '', name: '', productCount: 0 });
    loadData();
  };

  // Quick Add Sub-Modal State (for Company, Category, Unit)
  const [quickAddModal, setQuickAddModal] = useState<{
    isOpen: boolean;
    type: 'company' | 'category' | 'unit' | null;
    value: string;
  }>({
    isOpen: false,
    type: null,
    value: ''
  });

  // Master Product Information Form State
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: '',
    company: '',
    unit: 'pcs',
    unit_price: 0,
    mrp: 0,
    dealer_price: 0
  });

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
    
    // Check for 'new' action in state
    if (location.state?.action === 'new') {
      setIsModalOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  const loadData = () => {
    setInventory(storageService.getInventory());
    setBrands(storageService.getBrands() || []);
    setCategories(storageService.getCategories() || []);
    setSubCategories(storageService.getSubCategories() || []);
  };

  // Generate unique Barcode / SKU
  const handleAutoGenerateBarcode = () => {
    let newBarcode = '';
    let attempts = 0;
    while (attempts < 100) {
      // Generate a 12-digit standard barcode format: 890 + 9 random digits
      const randomNine = Math.floor(100000000 + Math.random() * 900000000);
      newBarcode = `890${randomNine}`;
      
      // Check if already taken in catalog
      const exists = inventory.some(item => item.sku === newBarcode);
      if (!exists) break;
      attempts++;
    }
    setFormData(prev => ({ ...prev, sku: newBarcode }));
  };

  // Check if a product with the same name or barcode already exists in the catalog
  const duplicateItem = useMemo(() => {
    const trimmedName = formData.name.trim().toLowerCase();
    const trimmedSku = formData.sku.trim().toLowerCase();
    if (!trimmedName && !trimmedSku) return null;

    return inventory.find(item => {
      // Ignore if currently editing the same product
      if (editingItem && item.id === editingItem.id) return false;

      const sameName = trimmedName && item.name.trim().toLowerCase() === trimmedName;
      const sameSku = trimmedSku && item.sku && item.sku.trim().toLowerCase() === trimmedSku;
      return sameName || sameSku;
    }) || null;
  }, [inventory, formData.name, formData.sku, editingItem]);

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setFormData({
      name: '',
      sku: '',
      category: '',
      company: '',
      unit: 'pcs',
      unit_price: 0,
      mrp: 0,
      dealer_price: 0
    });
  };

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Product Name is required.');
      return;
    }

    if (duplicateItem && !editingItem) {
      alert(`Product "${duplicateItem.name}" already exists in the list! Each product can only be entered once.`);
      return;
    }
    
    const finalSku = formData.sku.trim() || `PRD-${Math.floor(100000 + Math.random() * 900000)}`;
    const salePrice = Number(formData.unit_price) || 0;
    const mrpPrice = Number(formData.mrp) || salePrice || 0;
    const dealerPrice = Number(formData.dealer_price) || 0;

    if (editingItem) {
      const updatedItem: InventoryItem = {
        ...editingItem,
        name: formData.name.trim(),
        sku: finalSku,
        company: formData.company,
        category: formData.category,
        unit: formData.unit,
        unit_price: salePrice,
        mrp: mrpPrice,
        dealer_price: dealerPrice,
        cost_price: editingItem.cost_price || mrpPrice || 0
      };
      storageService.updateProduct(editingItem.id, updatedItem);
    } else {
      const newItem: InventoryItem = {
        id: Math.random().toString(36).substring(2, 9),
        user_id: '123',
        name: formData.name.trim(),
        sku: finalSku,
        company: formData.company,
        category: formData.category,
        unit: formData.unit,
        quantity: 0,
        cost_price: mrpPrice || salePrice || 0,
        mrp: mrpPrice,
        unit_price: salePrice,
        dealer_price: dealerPrice,
        min_stock_level: 5,
        manage_stock: true,
        decimal: false,
        created_at: new Date().toISOString()
      };
      storageService.addProduct(newItem);
    }
    
    closeModal();
    loadData();
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      sku: item.sku || '',
      category: item.category || '',
      company: item.company || (item as any).brand || '',
      unit: item.unit || 'pcs',
      unit_price: item.unit_price || 0,
      mrp: item.mrp || item.unit_price || item.cost_price || 0,
      dealer_price: item.dealer_price || 0
    });
    setViewingItem(null);
    setIsModalOpen(true);
  };

  const handleDelete = (item: InventoryItem) => {
    setDeleteConfirm({ isOpen: true, id: item.id, name: item.name });
  };

  const confirmDelete = async () => {
    if (deleteConfirm.id) {
      try {
        await storageService.deleteProduct(deleteConfirm.id);
        loadData();
        if (viewingItem?.id === deleteConfirm.id) {
          setViewingItem(null);
        }
      } catch (error) {
        console.error('Delete product error:', error);
      }
    }
    setDeleteConfirm({ isOpen: false });
  };

  // Quick Add submission
  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = quickAddModal.value.trim();
    if (!value) return;

    if (quickAddModal.type === 'company') {
      const newBrand: Brand = {
        id: Math.random().toString(36).substring(2, 9),
        name: value,
        created_at: new Date().toISOString()
      };
      storageService.addBrand(newBrand);
      loadData();
      setFormData(prev => ({ ...prev, company: value }));
    } else if (quickAddModal.type === 'category') {
      const newCat: Category = {
        id: Math.random().toString(36).substring(2, 9),
        name: value,
        created_at: new Date().toISOString()
      };
      storageService.addCategory(newCat);
      loadData();
      setFormData(prev => ({ ...prev, category: value }));
    } else if (quickAddModal.type === 'unit') {
      setFormData(prev => ({ ...prev, unit: value }));
    }

    setQuickAddModal({ isOpen: false, type: null, value: '' });
  };

  // Distinct brands and categories for filtering
  const allBrands = useMemo(() => {
    const list = new Set<string>();
    brands.forEach(b => list.add(b.name));
    inventory.forEach(i => {
      const comp = i.company || (i as any).brand;
      if (comp) list.add(comp);
    });
    return Array.from(list);
  }, [brands, inventory]);

  const allCategories = useMemo(() => {
    const list = new Set<string>();
    categories.forEach(c => list.add(c.name));
    inventory.forEach(i => {
      if (i.category) list.add(i.category);
    });
    return Array.from(list);
  }, [categories, inventory]);

  // Filtered Product Catalog (Sorted A-Z by Product Name)
  const filteredProducts = useMemo(() => {
    return inventory
      .filter(item => {
        // Search text
        const matchesSearch = 
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
          (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()));

        if (!matchesSearch) return false;

        // Company Filter
        const itemCompany = item.company || (item as any).brand || '';
        if (companyFilter !== 'all' && itemCompany !== companyFilter) {
          return false;
        }

        // Category Filter
        if (categoryFilter !== 'all' && item.category !== categoryFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true }));
  }, [inventory, searchTerm, companyFilter, categoryFilter]);

  // Catalog Metrics
  const totalUniqueProducts = inventory.length;
  const totalCompaniesCount = allBrands.length;
  const totalCategoriesCount = allCategories.length;
  const catalogWithPricesCount = inventory.filter(i => (i.unit_price || 0) > 0 || (i.mrp || 0) > 0).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative py-6 px-6 bg-gradient-to-b from-slate-50/90 via-white to-slate-50/40 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center text-center overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary-500 via-sky-500 to-emerald-500" />

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-wider uppercase font-['Outfit',sans-serif]">
          PRODUCT LIST & DETAILS
        </h1>

        <p className="text-sm sm:text-base font-medium text-slate-500 mt-2 max-w-xl leading-relaxed">
          Master Catalog of Unique Products, Barcodes & Pricing Information
        </p>

        {/* Dynamic Action in Header */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Button 
            onClick={() => setIsCompanyCategoryModalOpen(true)}
            className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-sm inline-flex items-center gap-2 cursor-pointer transition-all"
          >
            <Building2 className="w-4 h-4" />
            <span>Company & Category</span>
          </Button>

          <Button 
            onClick={() => {
              setEditingItem(null);
              setFormData({
                name: '',
                sku: '',
                category: '',
                company: '',
                unit: 'pcs',
                mrp: 0,
                unit_price: 0,
                dealer_price: 0
              });
              setIsModalOpen(true);
            }} 
            className="bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-sm inline-flex items-center gap-2 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product</span>
          </Button>
        </div>
      </div>

      {/* Top 4 Catalog Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Unique Products</p>
          <p className="text-2xl font-bold text-slate-900">{totalUniqueProducts}</p>
          <p className="text-xs text-slate-400 mt-1">{filteredProducts.length} products displayed</p>
        </Card>

        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Companies / Brands</p>
          <p className="text-2xl font-bold text-slate-900">{totalCompaniesCount}</p>
          <p className="text-xs text-slate-400 mt-1">Registered manufacturers</p>
        </Card>

        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Product Categories</p>
          <p className="text-2xl font-bold text-slate-900">{totalCategoriesCount}</p>
          <p className="text-xs text-slate-400 mt-1">Distinct product classifications</p>
        </Card>

        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Priced Products</p>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
              Active Catalog
            </span>
          </div>
          <p className="text-2xl font-bold text-primary-700">{catalogWithPricesCount}</p>
          <p className="text-xs text-slate-400 mt-1">Configured with MRP / Sale Price</p>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="p-0">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search product name, SKU, barcode..." 
              className="w-full pl-10 pr-12 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button 
              onClick={() => { setScannerTarget('search'); setIsScannerOpen(true); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors cursor-pointer"
              title="Scan Barcode to Search"
            >
              <ScanLine className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Company Filter */}
            <select 
              className="bg-slate-50 border border-slate-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
            >
              <option value="all">All Companies</option>
              {allBrands.map(company => (
                <option key={company} value={company}>{company}</option>
              ))}
            </select>

            {/* Category Filter */}
            <select 
              className="bg-slate-50 border border-slate-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              {allCategories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>

            {/* Company & Category Button */}
            <Button 
              onClick={() => setIsCompanyCategoryModalOpen(true)}
              className="bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs h-9 px-4 rounded-lg shadow-2xs inline-flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Building2 className="w-4 h-4" />
              <span>Company & Category</span>
            </Button>

            {/* Add New Product Button */}
            <Button 
              onClick={() => {
                setEditingItem(null);
                setFormData({
                  name: '',
                  sku: '',
                  category: '',
                  company: '',
                  unit: 'pcs',
                  mrp: 0,
                  unit_price: 0,
                  dealer_price: 0
                });
                setIsModalOpen(true);
              }} 
              className="bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs h-9 px-4 rounded-lg shadow-2xs inline-flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </Button>
          </div>
        </div>

        {/* Clean Modern Master Product Catalog Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-left whitespace-nowrap">#</th>
                <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-left whitespace-nowrap">Product Details</th>
                <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-left whitespace-nowrap">Barcode / SKU</th>
                <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-left whitespace-nowrap">Company</th>
                <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-left whitespace-nowrap">Category</th>
                <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">Unit</th>
                <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Sale Price</th>
                <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">MRP Price</th>
                <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Dealer Price</th>
                <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((item, index) => {
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 text-xs text-slate-400 font-mono">
                        {String(index + 1).padStart(3, '0')}
                      </td>
                      <td className="px-5 py-3.5 text-left whitespace-nowrap select-text">
                        <button
                          type="button"
                          onClick={() => setViewingItem(item)}
                          className="text-left font-semibold text-sm text-slate-900 hover:text-primary-600 transition-colors cursor-pointer group flex items-center gap-1.5"
                          title="Click to view full product information"
                        >
                          <span>{item.name}</span>
                          <Eye className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-left whitespace-nowrap font-mono text-xs text-slate-600 select-text">
                        {item.sku || '-'}
                      </td>
                      <td className="px-5 py-3.5 text-left whitespace-nowrap text-xs font-medium text-slate-700">
                        {item.company || (item as any).brand || '-'}
                      </td>
                      <td className="px-5 py-3.5 text-left whitespace-nowrap text-xs font-medium text-slate-700">
                        {item.category || '-'}
                      </td>
                      <td className="px-5 py-3.5 text-center whitespace-nowrap text-xs text-slate-600 font-medium">
                        {item.unit || 'pcs'}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap text-xs font-bold text-primary-700">
                        {formatCurrency(item.unit_price || 0)}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap text-xs font-semibold text-slate-900">
                        {formatCurrency(item.mrp || item.unit_price || item.cost_price || 0)}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap text-xs font-semibold text-slate-700">
                        {formatCurrency(item.dealer_price || 0)}
                      </td>
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button 
                            type="button"
                            onClick={() => setViewingItem(item)}
                            className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                            title="View Full Product Information"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleEdit(item)}
                            className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Product Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleDelete(item)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-slate-400 text-sm">
                    No products found matching your search or filters. Click "+ Add Product" to add unique product information.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* COMPREHENSIVE PRODUCT DETAILS VIEW MODAL */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl relative my-8 overflow-hidden">
            {/* Modal Header */}
            <div className="relative p-6 bg-gradient-to-b from-slate-50/90 to-white border-b border-slate-100 flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary-100 border border-primary-200 flex items-center justify-center text-primary-700 font-bold shrink-0 shadow-2xs">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-200">
                      {viewingItem.company || (viewingItem as any).brand || 'Company N/A'}
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {viewingItem.category || 'Category N/A'}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mt-2">{viewingItem.name}</h2>
                </div>
              </div>
              <button 
                onClick={() => setViewingItem(null)} 
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Details Content */}
            <div className="p-6 space-y-6">
              {/* Product Pricing Information */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-primary-600" />
                  <span>Product Pricing</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 bg-primary-50/70 rounded-xl border border-primary-200">
                    <p className="text-xs font-semibold text-primary-700">Retail Sale Price</p>
                    <p className="text-lg font-bold text-primary-900 mt-0.5">
                      {formatCurrency(viewingItem.unit_price || 0)}
                    </p>
                  </div>
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-xs font-semibold text-slate-500">MRP Price</p>
                    <p className="text-lg font-bold text-slate-900 mt-0.5">
                      {formatCurrency(viewingItem.mrp || viewingItem.unit_price || viewingItem.cost_price || 0)}
                    </p>
                  </div>
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-xs font-semibold text-slate-500">Dealer Price</p>
                    <p className="text-lg font-bold text-slate-800 mt-0.5">
                      {formatCurrency(viewingItem.dealer_price || 0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Classification & Unit */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-emerald-600" />
                  <span>Classification & Unit</span>
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-[11px] font-semibold text-slate-500">Company / Brand</p>
                    <p className="text-sm font-bold text-slate-800 mt-0.5">
                      {viewingItem.company || (viewingItem as any).brand || '-'}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-[11px] font-semibold text-slate-500">Category</p>
                    <p className="text-sm font-bold text-slate-800 mt-0.5">
                      {viewingItem.category || '-'}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-[11px] font-semibold text-slate-500">Unit</p>
                    <p className="text-sm font-bold text-slate-800 mt-0.5">
                      {viewingItem.unit || 'pcs'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Identifiers & Barcode */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <Barcode className="w-4 h-4 text-sky-600" />
                  <span>Barcode / SKU</span>
                </h3>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-500 block">Barcode / SKU:</span>
                    <span className="font-mono text-sm font-bold text-slate-900">{viewingItem.sku || 'No Barcode Assigned'}</span>
                  </div>
                  {viewingItem.created_at && (
                    <div className="text-xs text-slate-500">
                      <span>Saved on: </span>
                      <strong>{new Date(viewingItem.created_at).toLocaleDateString()}</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <span className="text-xs text-slate-400">Master Product Catalog</span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setViewingItem(null)}
                  className="h-9 px-4 text-xs font-semibold"
                >
                  Close
                </Button>
                <Button
                  type="button"
                  onClick={() => handleEdit(viewingItem)}
                  className="bg-primary-600 hover:bg-primary-700 text-white h-9 px-4 text-xs font-semibold shadow-2xs inline-flex items-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Product</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl relative my-8 overflow-hidden">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-600 font-bold">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {editingItem ? "Edit Product Information" : "Add New Unique Product"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Save unique product information, pricing, barcode, and details.
                  </p>
                </div>
              </div>
              <button 
                onClick={closeModal} 
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddProduct} className="p-6 space-y-4">
              {/* Duplicate Item Alert Banner */}
              {duplicateItem && !editingItem && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs">
                    <div className="font-bold text-amber-800">
                      Product Already Exists
                    </div>
                    <p className="text-amber-700 mt-1 leading-relaxed">
                      A product with the name "{duplicateItem.name}" or the same barcode already exists in the list.
                    </p>
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(duplicateItem)}
                        className="text-xs font-bold text-primary-700 hover:text-primary-900 underline cursor-pointer"
                      >
                        Click here to edit the existing product →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Product Name (No example placeholder) */}
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                  Product Name <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text"
                  required
                  placeholder=""
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  autoFocus
                />
              </div>

              {/* Company & Category with working + Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Company / Brand</label>
                  <div className="flex gap-1.5">
                    <select 
                      className="flex-1 h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                      value={formData.company}
                      onChange={e => setFormData({...formData, company: e.target.value})}
                    >
                      <option value="">Select Company</option>
                      {brands.map(brand => (
                        <option key={brand.id} value={brand.name}>{brand.name}</option>
                      ))}
                    </select>
                    <button 
                      type="button" 
                      onClick={() => setQuickAddModal({ isOpen: true, type: 'company', value: '' })}
                      className="h-10 px-3 rounded-lg border border-primary-200 bg-primary-50 hover:bg-primary-100 text-primary-700 text-sm font-bold transition-colors cursor-pointer inline-flex items-center justify-center gap-1 shadow-2xs"
                      title="Add New Company"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-1.5">
                    <select 
                      className="flex-1 h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                      required
                      value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value})}
                    >
                      <option value="">Select Category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                    <button 
                      type="button" 
                      onClick={() => setQuickAddModal({ isOpen: true, type: 'category', value: '' })}
                      className="h-10 px-3 rounded-lg border border-primary-200 bg-primary-50 hover:bg-primary-100 text-primary-700 text-sm font-bold transition-colors cursor-pointer inline-flex items-center justify-center gap-1 shadow-2xs"
                      title="Add New Category"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Barcode / SKU with Auto-Generate and Scan button & Unit */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="col-span-12 md:col-span-8">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 block">Barcode / SKU</label>
                    <button
                      type="button"
                      onClick={handleAutoGenerateBarcode}
                      className="text-[11px] text-primary-700 hover:text-primary-800 font-semibold inline-flex items-center gap-1 cursor-pointer hover:underline"
                      title="Automatically generate a unique barcode"
                    >
                      <Sparkles className="w-3 h-3 text-primary-600" />
                      <span>Auto Generate Barcode</span>
                    </button>
                  </div>
                  <div className="flex gap-1.5">
                    <input 
                      type="text"
                      placeholder="Scan, enter, or auto-generate"
                      className="flex-1 h-10 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                      value={formData.sku}
                      onChange={e => setFormData({...formData, sku: e.target.value})}
                    />
                    <button 
                      type="button"
                      onClick={handleAutoGenerateBarcode}
                      className="h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                      title="Auto Generate"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-primary-600" />
                      <span className="hidden sm:inline">Auto Gen</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => { setScannerTarget('sku'); setIsScannerOpen(true); }}
                      className="h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                      title="Scan with Camera"
                    >
                      <ScanLine className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                </div>

                <div className="col-span-12 md:col-span-4">
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Unit</label>
                  <div className="flex gap-1.5">
                    <select 
                      className="flex-1 h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                      value={formData.unit}
                      onChange={e => setFormData({...formData, unit: e.target.value})}
                    >
                      {Array.from(new Set(['pcs', 'box', 'kg', 'ltr', 'dozen', 'meter', 'pair', 'set', ...(formData.unit ? [formData.unit] : [])])).map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                    <button 
                      type="button" 
                      onClick={() => setQuickAddModal({ isOpen: true, type: 'unit', value: '' })}
                      className="h-10 px-2.5 rounded-lg border border-slate-200 hover:border-primary-300 hover:bg-primary-50 text-primary-600 text-xs font-bold transition-colors cursor-pointer"
                      title="Add custom unit"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Pricing Section: Sale Price, MRP Price & Dealer Price */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Sale Price <span className="text-primary-600 font-normal">(৳)</span>
                  </label>
                  <input 
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-bold text-primary-700"
                    value={formData.unit_price || ''}
                    onChange={e => setFormData({...formData, unit_price: parseFloat(e.target.value) || 0})}
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Retail selling price</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    MRP Price <span className="text-slate-400 font-normal">(৳)</span>
                  </label>
                  <input 
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-semibold text-slate-900"
                    value={formData.mrp || ''}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0;
                      setFormData({...formData, mrp: val});
                    }}
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Maximum retail price</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Dealer Price <span className="text-slate-500 font-normal">(৳)</span>
                  </label>
                  <input 
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-semibold text-slate-800"
                    value={formData.dealer_price || ''}
                    onChange={e => setFormData({...formData, dealer_price: parseFloat(e.target.value) || 0})}
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Wholesale / dealer price</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={closeModal} 
                  className="h-9 px-5 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={Boolean(duplicateItem && !editingItem)}
                  className={cn(
                    "h-9 px-6 rounded-lg text-white font-semibold text-xs shadow-2xs cursor-pointer transition-all",
                    duplicateItem && !editingItem
                      ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                      : "bg-primary-600 hover:bg-primary-700"
                  )}
                >
                  {editingItem ? "Save Changes" : duplicateItem ? "Already Exists" : "Save Product"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dedicated Quick Add Modal for Company / Category / Unit */}
      {quickAddModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <Card className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 relative">
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary-600" />
                <span>
                  {quickAddModal.type === 'company' && 'Add New Company / Brand'}
                  {quickAddModal.type === 'category' && 'Add New Category'}
                  {quickAddModal.type === 'unit' && 'Add Custom Unit'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setQuickAddModal({ isOpen: false, type: null, value: '' })}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickAddSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                  {quickAddModal.type === 'company' && 'Company / Brand Name'}
                  {quickAddModal.type === 'category' && 'Category Name'}
                  {quickAddModal.type === 'unit' && 'Unit Name (e.g. packet, roll)'}
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder={
                    quickAddModal.type === 'company' ? 'Enter company name...' :
                    quickAddModal.type === 'category' ? 'Enter category name...' :
                    'Enter unit name...'
                  }
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={quickAddModal.value}
                  onChange={e => setQuickAddModal(prev => ({ ...prev, value: e.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setQuickAddModal({ isOpen: false, type: null, value: '' })}
                  className="h-8 px-3 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="h-8 px-4 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold shadow-2xs inline-flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save & Select</span>
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md p-6 border-slate-200 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Product</h3>
                <p className="text-xs text-slate-500">Will be moved to Recycle Bin.</p>
              </div>
            </div>
            
            <p className="text-xs text-slate-600 mb-6">
              Are you sure you want to remove <strong>"{deleteConfirm.name}"</strong>? It will be moved to the Recycle Bin and can be restored anytime.
            </p>

            <div className="flex justify-end gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setDeleteConfirm({ isOpen: false })}
                className="h-9 px-4 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </Button>
              <Button 
                type="button" 
                onClick={confirmDelete} 
                className="h-9 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-2xs cursor-pointer"
              >
                Delete Product
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Company & Category Management Modal */}
      {isCompanyCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-4xl bg-white rounded-2xl border border-slate-200 shadow-2xl relative my-8 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary-50 border border-primary-200 flex items-center justify-center text-primary-700 font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Company & Category Management</h2>
                  <p className="text-xs text-slate-500">Manage all your companies and categories alongside adding products</p>
                </div>
              </div>
              <button 
                onClick={() => setIsCompanyCategoryModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[75vh] overflow-y-auto">
              {/* Companies Column */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-primary-600" />
                    <span>Companies / Brands ({brands.length})</span>
                  </h3>
                </div>

                <form onSubmit={handleCreateBrand} className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="New company name..."
                    value={newBrandName}
                    onChange={e => setNewBrandName(e.target.value)}
                    className="flex-1 h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <Button 
                    type="submit" 
                    disabled={!newBrandName.trim()}
                    className="bg-primary-600 hover:bg-primary-700 text-white h-9 px-3 text-xs font-semibold shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </Button>
                </form>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Search companies..."
                    value={brandSearch}
                    onChange={e => setBrandSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none"
                  />
                </div>

                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-60 overflow-y-auto bg-white">
                  {brands.filter(b => b.name.toLowerCase().includes(brandSearch.toLowerCase())).length > 0 ? (
                    brands.filter(b => b.name.toLowerCase().includes(brandSearch.toLowerCase())).map((brand, idx) => {
                      const count = inventory.filter(i => (i.company || (i as any).brand) === brand.name).length;
                      return (
                        <div key={brand.id} className="flex items-center justify-between p-2.5 hover:bg-slate-50">
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">{brand.name}</span>
                            <span className="text-[10px] text-slate-400">{count} products linked</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setCcEditModal({ isOpen: true, type: 'company', id: brand.id, oldName: brand.name, newName: brand.name })}
                              className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setCcDeleteModal({ isOpen: true, type: 'company', id: brand.id, name: brand.name, productCount: count })}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-6 text-center text-xs text-slate-400">No companies found.</div>
                  )}
                </div>
              </div>

              {/* Categories Column */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    <span>Categories ({categories.length})</span>
                  </h3>
                </div>

                <form onSubmit={handleCreateCategory} className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="New category name..."
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    className="flex-1 h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <Button 
                    type="submit" 
                    disabled={!newCategoryName.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 px-3 text-xs font-semibold shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </Button>
                </form>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Search categories..."
                    value={categorySearch}
                    onChange={e => setCategorySearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none"
                  />
                </div>

                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-60 overflow-y-auto bg-white">
                  {categories.filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase())).length > 0 ? (
                    categories.filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase())).map((cat, idx) => {
                      const count = inventory.filter(i => i.category === cat.name).length;
                      return (
                        <div key={cat.id} className="flex items-center justify-between p-2.5 hover:bg-slate-50">
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">{cat.name}</span>
                            <span className="text-[10px] text-slate-400">{count} products linked</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setCcEditModal({ isOpen: true, type: 'category', id: cat.id, oldName: cat.name, newName: cat.name })}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setCcDeleteModal({ isOpen: true, type: 'category', id: cat.id, name: cat.name, productCount: count })}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-6 text-center text-xs text-slate-400">No categories found.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end px-6 py-3 border-t border-slate-100 bg-slate-50">
              <Button
                type="button"
                onClick={() => setIsCompanyCategoryModalOpen(false)}
                className="h-9 px-5 bg-slate-800 text-white text-xs font-semibold"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CC Edit Modal */}
      {ccEditModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <Card className="w-full max-w-sm p-5 border-slate-200 shadow-2xl bg-white">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              Edit {ccEditModal.type === 'company' ? 'Company' : 'Category'}
            </h3>
            <form onSubmit={handleSaveCcEdit} className="space-y-3">
              <input 
                type="text"
                required
                autoFocus
                value={ccEditModal.newName}
                onChange={e => setCcEditModal(prev => ({ ...prev, newName: e.target.value }))}
                className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => setCcEditModal({ isOpen: false, type: null, id: '', oldName: '', newName: '' })}
                  className="h-8 px-3 text-xs"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  className="h-8 px-4 bg-primary-600 text-white text-xs font-semibold"
                >
                  Save
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* CC Delete Modal */}
      {ccDeleteModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <Card className="w-full max-w-sm p-5 border-slate-200 shadow-2xl bg-white">
            <h3 className="text-sm font-bold text-slate-900 mb-2">
              Delete {ccDeleteModal.type === 'company' ? 'Company' : 'Category'}
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              Are you sure you want to delete "{ccDeleteModal.name}"? {ccDeleteModal.productCount > 0 && `(${ccDeleteModal.productCount} products linked)`}
            </p>
            <div className="flex justify-end gap-2">
              <Button 
                type="button"
                variant="outline"
                onClick={() => setCcDeleteModal({ isOpen: false, type: null, id: '', name: '', productCount: 0 })}
                className="h-8 px-3 text-xs"
              >
                Cancel
              </Button>
              <Button 
                type="button"
                onClick={handleConfirmCcDelete}
                className="h-8 px-4 bg-rose-600 text-white text-xs font-semibold"
              >
                Delete
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      <BarcodeScanner 
        isOpen={isScannerOpen} 
        onClose={() => { setIsScannerOpen(false); setScannerTarget(null); }}
        onScan={(code) => {
          if (scannerTarget === 'search') {
            setSearchTerm(code);
          } else if (scannerTarget === 'sku') {
            setFormData(prev => ({ ...prev, sku: code }));
          }
          setIsScannerOpen(false);
          setScannerTarget(null);
        }}
      />
    </div>
  );
};
