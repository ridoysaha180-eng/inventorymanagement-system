import React, { useState } from 'react';
import { X, PackagePlus, Sparkles, ScanLine, Building2, FolderTree, Package, Plus, DollarSign, AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { formatCurrency, cn } from '../../utils';
import { storageService } from '../../services/storageService';
import { InventoryItem, Supplier, Brand, Category, SubCategory } from '../../types';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (product: InventoryItem) => void;
  suppliers: Supplier[];
  brands: Brand[];
  categories: Category[];
  subCategories: SubCategory[];
  onOpenScanner?: (target: 'sku') => void;
}

export const AddProductModal: React.FC<AddProductModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  suppliers,
  brands,
  categories,
  subCategories,
  onOpenScanner
}) => {
  if (!isOpen) return null;

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    item_code: '',
    company: '',
    category: '',
    sub_category: '',
    supplier_id: '',
    unit: 'pcs',
    quantity: 0,
    cost_price: 0,
    unit_price: 0,
    mrp: 0,
    dealer_price: 0,
    min_stock_level: 5
  });

  const [supplierStocks, setSupplierStocks] = useState<Array<{ supplier_id: string; quantity: number | string }>>([
    { supplier_id: '', quantity: 0 }
  ]);

  const [isAddingBrand, setIsAddingBrand] = useState(false);
  const [newBrandInput, setNewBrandInput] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [isAddingSubCategory, setIsAddingSubCategory] = useState(false);
  const [newSubCategoryInput, setNewSubCategoryInput] = useState('');
  const [localBrands, setLocalBrands] = useState<Brand[]>(brands);
  const [localCategories, setLocalCategories] = useState<Category[]>(categories);
  const [localSubCategories, setLocalSubCategories] = useState<SubCategory[]>(subCategories);

  const generateAutoSKU = () => {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    setFormData(prev => ({ ...prev, sku: `PRD-${randomNum}` }));
  };

  const handleSaveQuickBrand = () => {
    const trimmed = newBrandInput.trim();
    if (!trimmed) return;
    const existing = localBrands.find(b => b.name.toLowerCase() === trimmed.toLowerCase());
    if (!existing) {
      const brandObj: Brand = {
        id: Math.random().toString(36).substr(2, 9),
        name: trimmed,
        created_at: new Date().toISOString()
      };
      storageService.addBrand(brandObj);
      setLocalBrands(prev => [...prev, brandObj]);
    }
    setFormData(prev => ({ ...prev, company: trimmed }));
    setIsAddingBrand(false);
    setNewBrandInput('');
  };

  const handleSaveQuickCategory = () => {
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;
    const existing = localCategories.find(c => c.name.toLowerCase() === trimmed.toLowerCase());
    if (!existing) {
      const catObj: Category = {
        id: Math.random().toString(36).substr(2, 9),
        name: trimmed,
        created_at: new Date().toISOString()
      };
      storageService.addCategory(catObj);
      setLocalCategories(prev => [...prev, catObj]);
    }
    setFormData(prev => ({ ...prev, category: trimmed }));
    setIsAddingCategory(false);
    setNewCategoryInput('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const sku = formData.sku.trim() || `PRD-${Math.floor(100000 + Math.random() * 900000)}`;
    const totalQuantity = supplierStocks.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

    const newItem: InventoryItem = {
      id: `prd_${Date.now()}`,
      user_id: 'default_user',
      name: formData.name.trim(),
      sku,
      ...(formData.item_code.trim() ? { item_code: formData.item_code.trim() } : {}),
      ...(formData.company ? { company: formData.company } : {}),
      category: formData.category || 'General',
      ...(formData.sub_category ? { sub_category: formData.sub_category } : {}),
      unit: formData.unit || 'pcs',
      quantity: totalQuantity > 0 ? totalQuantity : 0,
      cost_price: Number(formData.cost_price) || 0,
      unit_price: Number(formData.unit_price) || 0,
      mrp: Number(formData.mrp) || Number(formData.unit_price) || 0,
      dealer_price: Number(formData.dealer_price) || 0,
      min_stock_level: Number(formData.min_stock_level) || 5,
      created_at: new Date().toISOString()
    };

    storageService.addProduct(newItem);

    // Save supplier stocks if any
    supplierStocks.forEach(stk => {
      if (Number(stk.quantity) > 0) {
        storageService.addPurchase({
          id: `pur_${Math.random().toString(36).substr(2, 9)}`,
          user_id: 'default_user',
          ...(stk.supplier_id ? { supplier_id: stk.supplier_id } : {}),
          subtotal: Number(stk.quantity) * newItem.cost_price,
          discount_amount: 0,
          tax_amount: 0,
          total_amount: Number(stk.quantity) * newItem.cost_price,
          payment_method: 'cash',
          status: 'completed',
          created_at: new Date().toISOString(),
          items: [{
            id: `pitm_${Math.random().toString(36).substr(2, 9)}`,
            purchase_id: `pur_${Math.random().toString(36).substr(2, 9)}`,
            inventory_item_id: newItem.id,
            item_name: newItem.name,
            sku: newItem.sku,
            quantity: Number(stk.quantity),
            unit_price: newItem.cost_price,
            default_sales_price: newItem.unit_price
          }]
        });
      }
    });

    onSuccess(newItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden relative my-8">
        <div className="h-1.5 bg-gradient-to-r from-primary-600 via-sky-500 to-emerald-500 w-full" />
        <div className="p-6 md:p-8">
          <div className="flex items-start justify-between pb-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-600 shadow-xs">
                <PackagePlus className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Add New Product</h2>
                <p className="text-xs text-slate-500 mt-0.5">Enter product identity, brand classification, and stock alert preferences.</p>
              </div>
            </div>
            <button 
              type="button"
              onClick={onClose} 
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 pt-5">
            {/* 1. Identity Section */}
            <div className="bg-slate-50/70 rounded-xl p-4 md:p-5 border border-slate-200/80 space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                <Package className="w-4 h-4 text-primary-600" />
                Product Identity
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text"
                  placeholder="e.g. Basmati Rice 5kg, Premium Cotton Shirt..." 
                  required 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full h-11 px-3.5 bg-white rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-xs"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">Barcode / SKU</label>
                    <button
                      type="button"
                      onClick={generateAutoSKU}
                      className="text-xs text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1 hover:underline"
                    >
                      <Sparkles className="w-3 h-3" />
                      Auto Generate
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <input 
                      type="text"
                      placeholder="e.g. SKU-128490 or scan barcode"
                      value={formData.sku}
                      onChange={e => setFormData({...formData, sku: e.target.value})}
                      className="w-full h-10 pl-3.5 pr-10 bg-white rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                    />
                    <button 
                      type="button"
                      onClick={() => onOpenScanner && onOpenScanner('sku')}
                      className="absolute right-2 p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
                    >
                      <ScanLine className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                    Item Code / Model No <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input 
                    type="text"
                    placeholder="e.g. ITM-042"
                    value={formData.item_code}
                    onChange={e => setFormData({...formData, item_code: e.target.value})}
                    className="w-full h-10 px-3.5 bg-white rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* 2. Brand & Categorization */}
            <div className="bg-slate-50/70 rounded-xl p-4 md:p-5 border border-slate-200/80 space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                <FolderTree className="w-4 h-4 text-primary-600" />
                Classification & Brand
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      Brand / Company
                    </label>
                    {!isAddingBrand && (
                      <button
                        type="button"
                        onClick={() => { setIsAddingBrand(true); setNewBrandInput(''); }}
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1 hover:underline"
                      >
                        <Plus className="w-3 h-3" />
                        New Brand
                      </button>
                    )}
                  </div>

                  {isAddingBrand ? (
                    <div className="p-2.5 bg-white rounded-lg border border-primary-200 shadow-xs space-y-2">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Enter brand name..."
                        value={newBrandInput}
                        onChange={e => setNewBrandInput(e.target.value)}
                        className="w-full h-9 px-3 bg-slate-50 rounded-md border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <div className="flex justify-end gap-1.5">
                        <button type="button" onClick={() => setIsAddingBrand(false)} className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-md">Cancel</button>
                        <button type="button" onClick={handleSaveQuickBrand} className="px-2.5 py-1 text-xs font-semibold bg-primary-600 text-white rounded-md hover:bg-primary-700">Save</button>
                      </div>
                    </div>
                  ) : (
                    <select
                      value={formData.company}
                      onChange={e => setFormData({...formData, company: e.target.value})}
                      className="w-full h-10 px-3 bg-white rounded-lg border border-slate-300 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                    >
                      <option value="">Select Brand / Company</option>
                      {localBrands.map(b => (
                        <option key={b.id} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <FolderTree className="w-3.5 h-3.5 text-slate-400" />
                      Category <span className="text-red-500">*</span>
                    </label>
                    {!isAddingCategory && (
                      <button
                        type="button"
                        onClick={() => { setIsAddingCategory(true); setNewCategoryInput(''); }}
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1 hover:underline"
                      >
                        <Plus className="w-3 h-3" />
                        New Category
                      </button>
                    )}
                  </div>

                  {isAddingCategory ? (
                    <div className="p-2.5 bg-white rounded-lg border border-primary-200 shadow-xs space-y-2">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Enter category name..."
                        value={newCategoryInput}
                        onChange={e => setNewCategoryInput(e.target.value)}
                        className="w-full h-9 px-3 bg-slate-50 rounded-md border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <div className="flex justify-end gap-1.5">
                        <button type="button" onClick={() => setIsAddingCategory(false)} className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-md">Cancel</button>
                        <button type="button" onClick={handleSaveQuickCategory} className="px-2.5 py-1 text-xs font-semibold bg-primary-600 text-white rounded-md hover:bg-primary-700">Save</button>
                      </div>
                    </div>
                  ) : (
                    <select
                      value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value})}
                      required
                      className="w-full h-10 px-3 bg-white rounded-lg border border-slate-300 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                    >
                      <option value="">Select Category</option>
                      {localCategories.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Unit of Measurement</label>
                <select
                  value={formData.unit}
                  onChange={e => setFormData({...formData, unit: e.target.value})}
                  className="w-full h-10 px-3 bg-white rounded-lg border border-slate-300 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                >
                  <option value="pcs">Pieces (pcs)</option>
                  <option value="kg">Kilogram (kg)</option>
                  <option value="gm">Gram (gm)</option>
                  <option value="ltr">Liter (ltr)</option>
                  <option value="ml">Milliliter (ml)</option>
                  <option value="packet">Packet</option>
                  <option value="box">Box</option>
                  <option value="dozen">Dozen</option>
                  <option value="pair">Pair</option>
                </select>
              </div>
            </div>

            {/* 3. Pricing Section */}
            <div className="bg-slate-50/70 rounded-xl p-4 md:p-5 border border-slate-200/80 space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                Pricing & Amounts
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Cost Price (৳)</label>
                  <div className="relative">
                    <input 
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      value={formData.cost_price === 0 ? '' : formData.cost_price}
                      onChange={e => setFormData({...formData, cost_price: parseFloat(e.target.value) || 0})}
                      className="w-full h-10 pl-3.5 pr-8 bg-white rounded-lg border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-xs"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">৳</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Sale Price (৳) *</label>
                  <div className="relative">
                    <input 
                      type="number"
                      min="0"
                      step="any"
                      required
                      placeholder="0.00"
                      value={formData.unit_price === 0 ? '' : formData.unit_price}
                      onChange={e => setFormData({...formData, unit_price: parseFloat(e.target.value) || 0})}
                      className="w-full h-10 pl-3.5 pr-8 bg-white rounded-lg border border-slate-300 text-sm font-bold text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-xs"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">৳</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block">MRP Price (৳)</label>
                  <div className="relative">
                    <input 
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      value={formData.mrp === 0 ? '' : formData.mrp}
                      onChange={e => setFormData({...formData, mrp: parseFloat(e.target.value) || 0})}
                      className="w-full h-10 pl-3.5 pr-8 bg-white rounded-lg border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-xs"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">৳</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Dealer Price (৳)</label>
                  <div className="relative">
                    <input 
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      value={formData.dealer_price === 0 ? '' : formData.dealer_price}
                      onChange={e => setFormData({...formData, dealer_price: parseFloat(e.target.value) || 0})}
                      className="w-full h-10 pl-3.5 pr-8 bg-white rounded-lg border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-xs"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">৳</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Low Stock Alert */}
            <div className="bg-amber-50/60 rounded-xl p-4 border border-amber-200/80 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                Low Stock Alert Setting
              </div>
              <div className="relative max-w-xs">
                <input 
                  type="number" 
                  min="0"
                  required
                  placeholder="5"
                  value={formData.min_stock_level}
                  onChange={e => setFormData({...formData, min_stock_level: parseInt(e.target.value) || 0})}
                  className="w-full h-11 px-3.5 pr-14 bg-white rounded-lg border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-xs"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase">
                  {formData.unit || 'pcs'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                Save Product
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
