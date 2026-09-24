import re

with open('src/pages/Inventory.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add states for supplier filtering
state_repl = """  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSupplier, setSelectedSupplier] = useState('All');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<{id: string, name: string}[]>([]);"""

content = re.sub(r'  const \[searchTerm, setSearchTerm\] = useState\(\'\'\);\n  const \[selectedCategory, setSelectedCategory\] = useState\(\'All\'\);\n  const \[inventory, setInventory\] = useState<InventoryItem\[\]>\(\[\]\);', state_repl, content)

# Update loadData to load suppliers
load_data_repl = """  const loadData = () => {
    setInventory(storageService.getInventory());
    setSuppliers(storageService.getSuppliers());
  };"""
content = re.sub(r'  const loadData = \(\) => \{\n    setInventory\(storageService\.getInventory\(\)\);\n  \};', load_data_repl, content)

# Filter logic
filter_repl = """  const filteredInventory = inventory.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSupplier = selectedSupplier === 'All' || item.supplier_id === selectedSupplier;
    
    return matchesSearch && matchesCategory && matchesSupplier;
  });"""
content = re.sub(r'  const filteredInventory = inventory\.filter\(item => \{\n    const matchesSearch = \n      item\.name\.toLowerCase\(\)\.includes\(searchTerm\.toLowerCase\(\)\) \|\|\n      item\.sku\.toLowerCase\(\)\.includes\(searchTerm\.toLowerCase\(\)\);\n    const matchesCategory = selectedCategory === \'All\' \|\| item\.category === selectedCategory;\n    \n    return matchesSearch && matchesCategory;\n  \}\);', filter_repl, content)


# UI updates: add supplier filter
ui_repl = """            <div className="flex items-center gap-4">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Search products, SKU..."
                  className="w-full sm:w-80 h-11 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="flex gap-2">
                <select
                  className="h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20 cursor-pointer"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="All">All Categories</option>
                  {Array.from(new Set(inventory.map(i => i.category))).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                <select
                  className="h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20 cursor-pointer"
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                >
                  <option value="All">All Suppliers</option>
                  {suppliers.map(sup => (
                    <option key={sup.id} value={sup.id}>{sup.name}</option>
                  ))}
                </select>
              </div>
            </div>"""
content = re.sub(r'            <div className="relative group flex-1 max-w-md">\n              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />\n              <input\n                type="text"\n                placeholder="Search products, SKU\.\.\."\n                className="w-full h-11 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"\n                value=\{searchTerm\}\n                onChange=\{\(e\) => setSearchTerm\(e\.target\.value\)\}\n              />\n            </div>', ui_repl, content)

with open('src/pages/Inventory.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

