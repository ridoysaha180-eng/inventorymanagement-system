import re

with open('src/pages/ProductDetails.tsx', 'r') as f:
    content = f.read()

missing_code = """<select className="bg-slate-50 border border-slate-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="20">20 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-240px)] rounded-lg border-t border-slate-200">
          <table className="w-full text-left border-collapse border border-slate-200">
            <thead className="bg-blue-500 text-white sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider border border-blue-400">#</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider border border-blue-400">Name</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider border border-blue-400">Barcode</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider border border-blue-400">Brand</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider border border-blue-400">Category</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-center border border-blue-400">Stock</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-center border border-blue-400">Unit</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-right border border-blue-400">Purchase (Unit/Cost)</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-right border border-blue-400">Sell Price (Retail)</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-right border border-blue-400">Dealer Price</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider border border-blue-400">Date</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-center border border-blue-400">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInventory.length > 0 ? filteredInventory.map((item, index) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors bg-white">
                  <td className="px-4 py-3 text-sm text-slate-600 border border-slate-200">{String(index + 1).padStart(3, '0')}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 border border-slate-200">{item.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 border border-slate-200">{item.sku || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 border border-slate-200">{item.company || 'N/A'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 border border-slate-200">{item.category || 'N/A'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 text-center border border-slate-200">{item.quantity || 0}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 text-center border border-slate-200">{item.unit || '-'}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 text-right border border-slate-200">{Number(item.cost_price || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 text-right border border-slate-200">{Number(item.unit_price || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 text-right border border-slate-200">{Number(item.dealer_price || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 border border-slate-200">{new Date(item.created_at).toLocaleDateString('en-GB')}</td>
                  <td className="px-4 py-3 text-center border border-slate-200">
                    <div className="flex items-center justify-center gap-2">
                      <Button 
                        variant="outline"
                        onClick={() => handleEdit(item)}
                        className="text-amber-500 border-amber-500 hover:bg-amber-50 px-3 py-1 h-8 text-xs font-medium rounded-md"
                      >
                        Edit
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600 border-red-500 hover:bg-red-50 px-3 py-1 h-8 text-xs font-medium rounded-md"
                      >
                        Delete
                      </Button>
                      <Button 
                        variant="outline"
                        className="text-emerald-600 border-emerald-500 hover:bg-emerald-50 px-3 py-1 h-8 text-xs font-medium rounded-md"
                      >
                        Analyze
                      </Button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-slate-400 text-sm border border-slate-200">
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add/Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-5xl bg-white rounded-2xl border-2 border-blue-500 shadow-2xl relative my-8">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800">{editingItem ? "Edit Product" : "Add New Product"}</h2>
                <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleAddProduct}>
                {/* Row 1 */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6">
                  <div className="col-span-12 md:col-span-6">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-sm font-semibold text-slate-700">Product Name <span className="text-red-500">*</span></label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-500">Manage Stock?</span>
                        <div 
                          className={cn("w-8 h-4 rounded-full relative cursor-pointer transition-colors", formData.manage_stock ? "bg-emerald-500" : "bg-slate-300")}
                          onClick={() => setFormData({...formData, manage_stock: !formData.manage_stock})}
                        >
                          <div className={cn("absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all", formData.manage_stock ? "right-0.5" : "left-0.5")}></div>
                        </div>
                        <span className="text-xs text-slate-500">{formData.manage_stock ? "Yes" : "No"}</span>
                      </div>
                    </div>
                    <input 
                      type="text"
                      required
                      placeholder="Enter product name"
                      className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  
                  <div className="col-span-12 md:col-span-3">
                    <label className="text-sm font-semibold text-slate-700 mb-1 block">Brand / Company</label>
                    <div className="flex gap-2">
"""

# Replace the broken select part
content = content.replace('<select \n                        className="flex-1 h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"\n                        value={formData.company}', missing_code + '<select \n                        className="flex-1 h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"\n                        value={formData.company}')

with open('src/pages/ProductDetails.tsx', 'w') as f:
    f.write(content)
