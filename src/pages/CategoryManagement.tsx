import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { storageService } from '../services/storageService';
import { Category, InventoryItem } from '../types';
import { Edit2, Trash2, Plus, Search, Layers, X, Check, AlertTriangle } from 'lucide-react';
import { cn } from '../utils';

export const CategoryManagement: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [search, setSearch] = useState('');

  const [editModal, setEditModal] = useState<{ isOpen: boolean; id: string; oldName: string; newName: string }>({
    isOpen: false,
    id: '',
    oldName: '',
    newName: ''
  });

  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string; name: string; productCount: number }>({
    isOpen: false,
    id: '',
    name: '',
    productCount: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setCategories(storageService.getCategories() || []);
    setInventory(storageService.getInventory() || []);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;

    if (categories.some(c => c.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      alert('Category already exists');
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

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = editModal.newName.trim();
    if (!trimmed) return;

    const cat = categories.find(c => c.id === editModal.id);
    if (cat) {
      storageService.updateCategory(editModal.id, { ...cat, name: trimmed });
      // Update linked inventory
      if (editModal.oldName !== trimmed) {
        const inv = storageService.getInventory();
        let modified = false;
        const updatedInv = inv.map(p => {
          if (p.category === editModal.oldName) {
            modified = true;
            return { ...p, category: trimmed };
          }
          return p;
        });
        if (modified) storageService.saveInventory(updatedInv);
      }
    }

    setEditModal({ isOpen: false, id: '', oldName: '', newName: '' });
    loadData();
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.id) return;
    try {
      await storageService.deleteCategory(deleteModal.id);
      loadData();
    } catch (error) {
      console.error('Delete category error:', error);
    }
    setDeleteModal({ isOpen: false, id: '', name: '', productCount: 0 });
  };

  const filteredCategories = categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Category Management</h1>
          <p className="text-slate-500">Manage your product categories.</p>
        </div>
      </div>

      <Card className="p-6">
        <form onSubmit={handleCreate} className="flex gap-3 items-end mb-6">
          <div className="flex-1">
            <label className="text-xs font-semibold text-slate-700 mb-1 block">New Category Name</label>
            <input 
              type="text"
              placeholder="Enter category name..." 
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 h-10 text-xs font-semibold">
            Add Category
          </Button>
        </form>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search categories..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
          {filteredCategories.length > 0 ? filteredCategories.map(cat => {
            const count = inventory.filter(i => i.category === cat.name).length;
            return (
              <div key={cat.id} className="flex items-center justify-between p-3.5 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-slate-800">{cat.name}</span>
                  <span className="text-[11px] text-slate-400 font-medium">({count} products)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button 
                    type="button"
                    onClick={() => setEditModal({ isOpen: true, id: cat.id, oldName: cat.name, newName: cat.name })}
                    className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                    title="Edit Category"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    type="button"
                    onClick={() => setDeleteModal({ isOpen: true, id: cat.id, name: cat.name, productCount: count })}
                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Delete Category"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          }) : (
            <div className="p-8 text-center text-xs text-slate-400">No categories found.</div>
          )}
        </div>
      </Card>

      {/* Edit Modal */}
      {editModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-white p-6 rounded-2xl shadow-xl">
            <h3 className="text-base font-bold text-slate-900 mb-4">Edit Category Name</h3>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <input 
                type="text" 
                required 
                autoFocus 
                value={editModal.newName} 
                onChange={e => setEditModal(prev => ({ ...prev, newName: e.target.value }))}
                className="w-full h-10 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditModal({ isOpen: false, id: '', oldName: '', newName: '' })}>Cancel</Button>
                <Button type="submit" className="bg-emerald-600 text-white">Save Changes</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-white p-6 rounded-2xl shadow-xl">
            <h3 className="text-base font-bold text-slate-900 mb-2">Delete Category</h3>
            <p className="text-xs text-slate-600 mb-4">Are you sure you want to delete <strong>"{deleteModal.name}"</strong>? It will be moved to the Recycle Bin and can be restored anytime.</p>
            {deleteModal.productCount > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg mb-4">
                Warning: {deleteModal.productCount} product(s) use this category.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDeleteModal({ isOpen: false, id: '', name: '', productCount: 0 })}>Cancel</Button>
              <Button type="button" onClick={handleConfirmDelete} className="bg-rose-600 text-white">Delete</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
