import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { storageService } from '../services/storageService';
import { Category, SubCategory } from '../types';
import { Edit2, Trash2 } from 'lucide-react';

export const SubCategoryManagement: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [newSubCategoryName, setNewSubCategoryName] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setCategories(storageService.getCategories() || []);
    setSubCategories(storageService.getSubCategories() || []);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubCategoryName.trim() || !selectedCategoryId) return;
    
    storageService.addSubCategory({
      id: Math.random().toString(36).substr(2, 9),
      name: newSubCategoryName.trim(),
      category_id: selectedCategoryId,
      created_at: new Date().toISOString()
    });
    
    setNewSubCategoryName('');
    loadData();
  };

  const handleUpdate = (id: string) => {
    if (!editName.trim() || !editCategoryId) return;
    const sub = subCategories.find(s => s.id === id);
    if (sub) {
      storageService.updateSubCategory(id, { ...sub, name: editName.trim(), category_id: editCategoryId });
      setEditingId(null);
      loadData();
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this subcategory?')) {
      storageService.deleteSubCategory(id);
      loadData();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sub-Category Management</h1>
          <p className="text-slate-500">Manage product sub-categories.</p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleCreate} className="flex flex-col md:flex-row gap-4 items-end mb-6">
          <div className="flex-1">
            <label className="text-sm font-semibold text-slate-700 mb-1 block">Parent Category <span className="text-red-500">*</span></label>
            <select 
              required
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={selectedCategoryId}
              onChange={e => setSelectedCategoryId(e.target.value)}
            >
              <option value="">Select a category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-sm font-semibold text-slate-700 mb-1 block">Sub-Category Name <span className="text-red-500">*</span></label>
            <Input 
              required
              placeholder="Enter sub-category name" 
              value={newSubCategoryName}
              onChange={e => setNewSubCategoryName(e.target.value)}
            />
          </div>
          <Button type="submit" className="bg-emerald-500 hover:bg-emerald-600 text-white px-8">
            Create
          </Button>
        </form>

        <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
          {subCategories.length > 0 ? subCategories.map(sub => {
            const parentCat = categories.find(c => c.id === sub.category_id);
            return (
            <div key={sub.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
              {editingId === sub.id ? (
                <div className="flex items-center gap-3 flex-1 mr-4">
                  <select 
                    className="flex-1 h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    value={editCategoryId}
                    onChange={e => setEditCategoryId(e.target.value)}
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <Input 
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={() => handleUpdate(sub.id)} className="bg-emerald-500 text-white px-4 py-1.5 h-auto text-sm">Save</Button>
                  <Button onClick={() => setEditingId(null)} variant="outline" className="px-4 py-1.5 h-auto text-sm">Cancel</Button>
                </div>
              ) : (
                <>
                  <div>
                    <span className="font-medium text-slate-700">{sub.name}</span>
                    <span className="ml-3 text-xs text-slate-500 px-2 py-0.5 bg-slate-100 rounded-full">{parentCat?.name || 'Unknown Category'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setEditingId(sub.id);
                        setEditName(sub.name);
                        setEditCategoryId(sub.category_id);
                      }}
                      className="text-amber-500 border-amber-500 hover:bg-amber-50 px-4 py-1.5 h-auto text-sm rounded-full"
                    >
                      Edit
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => handleDelete(sub.id)}
                      className="text-red-500 border-red-500 hover:bg-red-50 px-4 py-1.5 h-auto text-sm rounded-full"
                    >
                      Delete
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}) : (
            <div className="p-8 text-center text-slate-500">No sub-categories found. Create one above.</div>
          )}
        </div>
      </Card>
    </div>
  );
};
