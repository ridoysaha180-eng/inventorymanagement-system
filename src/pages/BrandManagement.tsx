import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { storageService } from '../services/storageService';
import { Brand, InventoryItem } from '../types';
import { Edit2, Trash2, Plus, Search, Building2, X, Check, AlertTriangle } from 'lucide-react';
import { cn } from '../utils';

export const BrandManagement: React.FC = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [newBrandName, setNewBrandName] = useState('');
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
    setBrands(storageService.getBrands() || []);
    setInventory(storageService.getInventory() || []);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newBrandName.trim();
    if (!trimmed) return;

    if (brands.some(b => b.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      alert('Company already exists');
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

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = editModal.newName.trim();
    if (!trimmed) return;

    const brand = brands.find(b => b.id === editModal.id);
    if (brand) {
      storageService.updateBrand(editModal.id, { ...brand, name: trimmed });
      // Update linked inventory
      if (editModal.oldName !== trimmed) {
        const inv = storageService.getInventory();
        let modified = false;
        const updatedInv = inv.map(p => {
          if ((p.company || (p as any).brand) === editModal.oldName) {
            modified = true;
            return { ...p, company: trimmed, brand: trimmed };
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
      await storageService.deleteBrand(deleteModal.id);
      loadData();
    } catch (error) {
      console.error('Delete brand error:', error);
    }
    setDeleteModal({ isOpen: false, id: '', name: '', productCount: 0 });
  };

  const filteredBrands = brands.filter(b => b.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Company Management</h1>
          <p className="text-slate-500">Manage your product companies / brands.</p>
        </div>
      </div>

      <Card className="p-6">
        <form onSubmit={handleCreate} className="flex gap-3 items-end mb-6">
          <div className="flex-1">
            <label className="text-xs font-semibold text-slate-700 mb-1 block">New Company Name</label>
            <input 
              type="text"
              placeholder="Enter company name..." 
              value={newBrandName}
              onChange={e => setNewBrandName(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <Button type="submit" className="bg-primary-600 hover:bg-primary-700 text-white px-6 h-10 text-xs font-semibold">
            Add Company
          </Button>
        </form>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search companies..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
          {filteredBrands.length > 0 ? filteredBrands.map(brand => {
            const count = inventory.filter(i => (i.company || (i as any).brand) === brand.name).length;
            return (
              <div key={brand.id} className="flex items-center justify-between p-3.5 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-slate-800">{brand.name}</span>
                  <span className="text-[11px] text-slate-400 font-medium">({count} products)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button 
                    type="button"
                    onClick={() => setEditModal({ isOpen: true, id: brand.id, oldName: brand.name, newName: brand.name })}
                    className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors cursor-pointer"
                    title="Edit Company"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    type="button"
                    onClick={() => setDeleteModal({ isOpen: true, id: brand.id, name: brand.name, productCount: count })}
                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Delete Company"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          }) : (
            <div className="p-8 text-center text-xs text-slate-400">No companies found.</div>
          )}
        </div>
      </Card>

      {/* Edit Modal */}
      {editModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-white p-6 rounded-2xl shadow-xl">
            <h3 className="text-base font-bold text-slate-900 mb-4">Edit Company Name</h3>
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
                <Button type="submit" className="bg-primary-600 text-white">Save Changes</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-white p-6 rounded-2xl shadow-xl">
            <h3 className="text-base font-bold text-slate-900 mb-2">Delete Company</h3>
            <p className="text-xs text-slate-600 mb-4">Are you sure you want to delete <strong>"{deleteModal.name}"</strong>? It will be moved to the Recycle Bin and can be restored anytime.</p>
            {deleteModal.productCount > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg mb-4">
                Warning: {deleteModal.productCount} product(s) use this company.
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
