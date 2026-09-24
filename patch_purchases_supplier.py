import re

with open('src/pages/Purchases.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add states
state_old = """  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [purchaseSearchTerm, setPurchaseSearchTerm] = useState('');"""
state_new = """  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [purchaseSearchTerm, setPurchaseSearchTerm] = useState('');
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');"""
content = content.replace(state_old, state_new)

# Update dropdown
dropdown_old = """                    <label className="text-xs font-bold text-slate-500 uppercase">Supplier</label>
                    <select 
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      value={selectedSupplierId}
                      onChange={e => setSelectedSupplierId(e.target.value)}
                    >
                      <option value="">Walk-in Supplier</option>
                      {suppliers.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>"""

dropdown_new = """                    <label className="text-xs font-bold text-slate-500 uppercase">Supplier</label>
                    <div className="flex gap-2">
                      <select 
                        className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        value={selectedSupplierId}
                        onChange={e => setSelectedSupplierId(e.target.value)}
                      >
                        <option value="">Walk-in Supplier</option>
                        {suppliers.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <Button variant="outline" className="px-3" onClick={() => setIsAddSupplierOpen(true)}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>"""
content = content.replace(dropdown_old, dropdown_new)

# Add Handle Add Supplier
handle_add_supplier = """
  const handleAddSupplier = () => {
    if (!newSupplierName.trim()) return;
    const newSupplier = {
      id: Math.random().toString(36).substr(2, 9),
      user_id: '123',
      sl_number: `SL-${(suppliers.length + 1).toString().padStart(3, '0')}`,
      name: newSupplierName,
      created_at: new Date().toISOString(),
    };
    storageService.addSupplier(newSupplier);
    loadData();
    setSelectedSupplierId(newSupplier.id);
    setNewSupplierName('');
    setIsAddSupplierOpen(false);
  };
"""
content = content.replace("  const handleCheckout = () => {", handle_add_supplier + "\n  const handleCheckout = () => {")

# Add Add Supplier Modal
add_supplier_modal = """
      {/* Add Supplier Modal */}
      {isAddSupplierOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900">Add New Supplier</h2>
              <button onClick={() => setIsAddSupplierOpen(false)} className="text-slate-400 hover:text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Supplier Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g. Acme Corp"
                  value={newSupplierName}
                  onChange={e => setNewSupplierName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsAddSupplierOpen(false)}>Cancel</Button>
                <Button onClick={handleAddSupplier} disabled={!newSupplierName.trim()}>Save Supplier</Button>
              </div>
            </div>
          </div>
        </div>
      )}
"""
content = content.replace("    </div>\n  );\n};\n\nexport default Purchases;", add_supplier_modal + "\n    </div>\n  );\n};\n\nexport default Purchases;")

with open('src/pages/Purchases.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

