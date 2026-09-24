import re

with open('src/pages/Inventory.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add supplier selection to the form (Row 1)
row1_old = """                  <div className="relative">
                    <label className="text-sm font-semibold text-slate-700 mb-1 block">Product Brand (Company) <span className="text-red-500">*</span></label>
                    <div className="flex gap-2">
                      <select 
                        className="flex-1 h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        value={formData.company}
                        onChange={e => setFormData({...formData, company: e.target.value})}
                      >
                        <option value="">Select Brand</option>
                        {Array.from(new Set([...inventory.map(item => item.company), ...(formData.company ? [formData.company] : [])].filter(Boolean))).map(company => (
                          <option key={company} value={company}>{company}</option>
                        ))}
                      </select>"""

row1_new = """                  <div className="relative">
                    <label className="text-sm font-semibold text-slate-700 mb-1 block">Supplier</label>
                    <div className="flex gap-2">
                      <select 
                        className="flex-1 h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        value={formData.supplier_id}
                        onChange={e => setFormData({...formData, supplier_id: e.target.value})}
                      >
                        <option value="">Select Supplier</option>
                        {suppliers.map(supplier => (
                          <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <label className="text-sm font-semibold text-slate-700 mb-1 block">Product Brand (Company) <span className="text-red-500">*</span></label>
                    <div className="flex gap-2">
                      <select 
                        className="flex-1 h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        value={formData.company}
                        onChange={e => setFormData({...formData, company: e.target.value})}
                      >
                        <option value="">Select Brand</option>
                        {Array.from(new Set([...inventory.map(item => item.company), ...(formData.company ? [formData.company] : [])].filter(Boolean))).map(company => (
                          <option key={company} value={company}>{company}</option>
                        ))}
                      </select>"""

content = content.replace(row1_old, row1_new)

# Update grid layout of Row 1 from grid-cols-1 md:grid-cols-2 lg:grid-cols-4 to lg:grid-cols-5 if needed, or adjust
row1_grid_old = """<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">"""
row1_grid_new = """<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">"""
content = content.replace(row1_grid_old, row1_grid_new)

with open('src/pages/Inventory.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
