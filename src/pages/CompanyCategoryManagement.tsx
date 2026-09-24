import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { storageService } from '../services/storageService';
import { Brand, Category, InventoryItem } from '../types';
import { cn } from '../utils';
import { 
  Edit2, 
  Trash2, 
  Plus, 
  Search, 
  Building2, 
  Layers, 
  Check, 
  X, 
  AlertTriangle,
  Package,
  Sparkles
} from 'lucide-react';

export const CompanyCategoryManagement: React.FC = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  // Company states
  const [newBrandName, setNewBrandName] = useState('');
  const [brandSearch, setBrandSearch] = useState('');

  // Category states
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categorySearch, setCategorySearch] = useState('');

  // Edit Modal State (for both Company & Category)
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    type: 'company' | 'category' | null;
    id: string;
    oldName: string;
    newName: string;
  }>({
    isOpen: false,
    type: null,
    id: '',
    oldName: '',
    newName: ''
  });

  // Delete Confirmation Modal State
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'company' | 'category' | null;
    id: string;
    name: string;
    productCount: number;
  }>({
    isOpen: false,
    type: null,
    id: '',
    name: '',
    productCount: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setBrands(storageService.getBrands() || []);
    setCategories(storageService.getCategories() || []);
    setInventory(storageService.getInventory() || []);
  };

  // --- Company Handlers ---
  const handleCreateBrand = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newBrandName.trim();
    if (!trimmed) return;

    const exists = brands.some(b => b.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      alert('This company name already exists in the list.');
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

  const openEditBrand = (brand: Brand) => {
    setEditModal({
      isOpen: true,
      type: 'company',
      id: brand.id,
      oldName: brand.name,
      newName: brand.name
    });
  };

  const openDeleteBrand = (brand: Brand) => {
    const count = inventory.filter(item => (item.company || (item as any).brand) === brand.name).length;
    setDeleteModal({
      isOpen: true,
      type: 'company',
      id: brand.id,
      name: brand.name,
      productCount: count
    });
  };

  // --- Category Handlers ---
  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;

    const exists = categories.some(c => c.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      alert('This category name already exists in the list.');
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

  const openEditCategory = (category: Category) => {
    setEditModal({
      isOpen: true,
      type: 'category',
      id: category.id,
      oldName: category.name,
      newName: category.name
    });
  };

  const openDeleteCategory = (category: Category) => {
    const count = inventory.filter(item => item.category === category.name).length;
    setDeleteModal({
      isOpen: true,
      type: 'category',
      id: category.id,
      name: category.name,
      productCount: count
    });
  };

  // --- Submit Edit (Company / Category) ---
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedNew = editModal.newName.trim();
    if (!trimmedNew) return;

    if (editModal.type === 'company') {
      const brand = brands.find(b => b.id === editModal.id);
      if (brand) {
        // Update brand in storage
        storageService.updateBrand(editModal.id, { ...brand, name: trimmedNew });

        // Update all associated products in inventory to preserve relationships
        if (editModal.oldName !== trimmedNew) {
          const currentInv = storageService.getInventory();
          let modified = false;
          const updatedInv = currentInv.map(p => {
            if ((p.company || (p as any).brand) === editModal.oldName) {
              modified = true;
              return { ...p, company: trimmedNew, brand: trimmedNew };
            }
            return p;
          });
          if (modified) {
            storageService.saveInventory(updatedInv);
          }
        }
      }
    } else if (editModal.type === 'category') {
      const cat = categories.find(c => c.id === editModal.id);
      if (cat) {
        // Update category in storage
        storageService.updateCategory(editModal.id, { ...cat, name: trimmedNew });

        // Update all associated products in inventory to preserve relationships
        if (editModal.oldName !== trimmedNew) {
          const currentInv = storageService.getInventory();
          let modified = false;
          const updatedInv = currentInv.map(p => {
            if (p.category === editModal.oldName) {
              modified = true;
              return { ...p, category: trimmedNew };
            }
            return p;
          });
          if (modified) {
            storageService.saveInventory(updatedInv);
          }
        }
      }
    }

    setEditModal({ isOpen: false, type: null, id: '', oldName: '', newName: '' });
    loadData();
  };

  // --- Confirm Delete (Company / Category) ---
  const handleConfirmDelete = async () => {
    if (!deleteModal.id || !deleteModal.type) return;

    try {
      if (deleteModal.type === 'company') {
        await storageService.deleteBrand(deleteModal.id);
      } else if (deleteModal.type === 'category') {
        await storageService.deleteCategory(deleteModal.id);
      }
      loadData();
    } catch (error) {
      console.error('Delete error:', error);
    }

    setDeleteModal({ isOpen: false, type: null, id: '', name: '', productCount: 0 });
  };

  // Filtered lists
  const filteredBrands = useMemo(() => {
    return brands.filter(b => b.name.toLowerCase().includes(brandSearch.toLowerCase()));
  }, [brands, brandSearch]);

  const filteredCategories = useMemo(() => {
    return categories.filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase()));
  }, [categories, categorySearch]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative py-6 px-6 bg-gradient-to-b from-slate-50/90 via-white to-slate-50/40 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center text-center overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary-500 via-sky-500 to-emerald-500" />
        
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-wider uppercase font-['Outfit',sans-serif]">
          COMPANY & CATEGORY MANAGEMENT
        </h1>
        <p className="text-sm font-medium text-slate-500 mt-1.5 max-w-lg">
          Add, edit, rename, and manage all your product companies and categories in one central hub.
        </p>

        {/* Counts summary */}
        <div className="flex items-center gap-3 mt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
            <Building2 className="w-4 h-4 text-primary-600" />
            <span>Total Companies: <strong className="text-primary-700 text-sm ml-1">{brands.length}</strong></span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
            <Layers className="w-4 h-4 text-emerald-600" />
            <span>Total Categories: <strong className="text-emerald-700 text-sm ml-1">{categories.length}</strong></span>
          </div>
        </div>
      </div>

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Company Management */}
        <Card className="p-5 border-slate-200 shadow-sm flex flex-col h-full bg-white">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-600 font-bold shadow-2xs">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Company / Brand List</h2>
                <p className="text-xs text-slate-500">Create, edit, and delete product companies</p>
              </div>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 border border-primary-100">
              {filteredBrands.length} {filteredBrands.length === 1 ? 'Company' : 'Companies'}
            </span>
          </div>

          {/* Add Company Form */}
          <form onSubmit={handleCreateBrand} className="flex gap-2 mt-4">
            <input 
              type="text"
              placeholder="Enter new company / brand name..." 
              value={newBrandName}
              onChange={e => setNewBrandName(e.target.value)}
              className="flex-1 h-10 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <Button 
              type="submit" 
              disabled={!newBrandName.trim()}
              className="bg-primary-600 hover:bg-primary-700 text-white px-4 h-10 shrink-0 font-semibold text-xs inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Add Company</span>
            </Button>
          </form>

          {/* Search Filter */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search companies..." 
              value={brandSearch}
              onChange={e => setBrandSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Company Items List */}
          <div className="mt-4 border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden flex-1 bg-white">
            {filteredBrands.length > 0 ? (
              filteredBrands.map((brand, index) => {
                const productCount = inventory.filter(i => (i.company || (i as any).brand) === brand.name).length;

                return (
                  <div key={brand.id} className="flex items-center justify-between p-3 hover:bg-slate-50/80 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-400 w-5 text-right">{index + 1}.</span>
                      <div>
                        <span className="text-xs sm:text-sm font-bold text-slate-800 block">{brand.name}</span>
                        <span className="text-[11px] font-medium text-slate-400">
                          {productCount} {productCount === 1 ? 'product' : 'products'} linked
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                      <button 
                        type="button"
                        onClick={() => openEditBrand(brand)}
                        className="p-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-primary-100"
                        title="Edit / Rename Company"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        type="button"
                        onClick={() => openDeleteBrand(brand)}
                        className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-100"
                        title="Delete Company"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                {brandSearch ? 'No companies matching your search.' : 'No companies added yet. Create one using the form above.'}
              </div>
            )}
          </div>
        </Card>

        {/* Right Column: Category Management */}
        <Card className="p-5 border-slate-200 shadow-sm flex flex-col h-full bg-white">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-bold shadow-2xs">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Category List</h2>
                <p className="text-xs text-slate-500">Create, edit, and delete product categories</p>
              </div>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
              {filteredCategories.length} {filteredCategories.length === 1 ? 'Category' : 'Categories'}
            </span>
          </div>

          {/* Add Category Form */}
          <form onSubmit={handleCreateCategory} className="flex gap-2 mt-4">
            <input 
              type="text"
              placeholder="Enter new category name..." 
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              className="flex-1 h-10 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <Button 
              type="submit" 
              disabled={!newCategoryName.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 h-10 shrink-0 font-semibold text-xs inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Add Category</span>
            </Button>
          </form>

          {/* Search Filter */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search categories..." 
              value={categorySearch}
              onChange={e => setCategorySearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Category Items List */}
          <div className="mt-4 border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden flex-1 bg-white">
            {filteredCategories.length > 0 ? (
              filteredCategories.map((category, index) => {
                const productCount = inventory.filter(i => i.category === category.name).length;

                return (
                  <div key={category.id} className="flex items-center justify-between p-3 hover:bg-slate-50/80 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-400 w-5 text-right">{index + 1}.</span>
                      <div>
                        <span className="text-xs sm:text-sm font-bold text-slate-800 block">{category.name}</span>
                        <span className="text-[11px] font-medium text-slate-400">
                          {productCount} {productCount === 1 ? 'product' : 'products'} linked
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                      <button 
                        type="button"
                        onClick={() => openEditCategory(category)}
                        className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-emerald-100"
                        title="Edit / Rename Category"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        type="button"
                        onClick={() => openDeleteCategory(category)}
                        className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-100"
                        title="Delete Category"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                {categorySearch ? 'No categories matching your search.' : 'No categories added yet. Create one using the form above.'}
              </div>
            )}
          </div>
        </Card>

      </div>

      {/* DEDICATED EDIT MODAL (FOR COMPANY OR CATEGORY) */}
      {editModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <Card className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 relative">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-2xs",
                  editModal.type === 'company' ? "bg-primary-600" : "bg-emerald-600"
                )}>
                  {editModal.type === 'company' ? <Building2 className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editModal.type === 'company' ? 'Edit Company / Brand' : 'Edit Category'}
                  </h3>
                  <p className="text-xs text-slate-500">Update and rename this entry</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditModal({ isOpen: false, type: null, id: '', oldName: '', newName: '' })}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                  {editModal.type === 'company' ? 'Company Name' : 'Category Name'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={editModal.newName}
                  onChange={e => setEditModal(prev => ({ ...prev, newName: e.target.value }))}
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                <p>
                  <strong>Note:</strong> Updating this name will also automatically update all linked products currently in your catalog.
                </p>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditModal({ isOpen: false, type: null, id: '', oldName: '', newName: '' })}
                  className="h-9 px-4 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!editModal.newName.trim() || editModal.newName.trim() === editModal.oldName}
                  className={cn(
                    "h-9 px-5 text-white text-xs font-semibold shadow-2xs inline-flex items-center gap-1.5",
                    editModal.type === 'company' ? "bg-primary-600 hover:bg-primary-700" : "bg-emerald-600 hover:bg-emerald-700"
                  )}
                >
                  <Check className="w-4 h-4" />
                  <span>Save Changes</span>
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* DEDICATED DELETE CONFIRMATION MODAL */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <Card className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 relative">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Delete {deleteModal.type === 'company' ? 'Company' : 'Category'}
                </h3>
                <p className="text-xs text-slate-500">This action will remove the item permanently.</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <p className="text-xs text-slate-700 leading-relaxed">
                Are you sure you want to delete <strong>"{deleteModal.name}"</strong>? It will be moved to the Recycle Bin and can be restored anytime.
              </p>

              {deleteModal.productCount > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Warning:</strong> {deleteModal.productCount} product(s) are currently associated with this {deleteModal.type}.
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteModal({ isOpen: false, type: null, id: '', name: '', productCount: 0 })}
                className="h-9 px-4 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirmDelete}
                className="h-9 px-5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete {deleteModal.type === 'company' ? 'Company' : 'Category'}</span>
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
