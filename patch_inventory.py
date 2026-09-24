import re

with open('src/pages/Inventory.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add supplierFilter state
if "const [supplierFilter, setSupplierFilter] = useState('all');" not in content:
    content = content.replace("const [categoryFilter, setCategoryFilter] = useState('all');", "const [categoryFilter, setCategoryFilter] = useState('all');\n  const [supplierFilter, setSupplierFilter] = useState('all');")

# 2. Add export functions
export_funcs = """
  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text('Inventory Report', 14, 15);
    
    const tableData = inventoryWithStats.map(item => [
      item.name,
      item.sku,
      item.company || 'N/A',
      suppliers.find(s => s.id === item.supplier_id)?.name || 'Multiple/None',
      item.stats.availableStock,
      formatCurrency(item.stats.stockValue)
    ]);
    
    autoTable(doc, {
      startY: 20,
      head: [['Product', 'SKU', 'Company', 'Supplier', 'Stock', 'Value']],
      body: tableData,
    });
    
    doc.save('inventory_report.pdf');
  };

  const handleExportExcel = () => {
    const data = inventoryWithStats.map(item => ({
      Product: item.name,
      SKU: item.sku,
      Company: item.company || 'N/A',
      Supplier: suppliers.find(s => s.id === item.supplier_id)?.name || 'Multiple/None',
      Category: item.category,
      'Sale Price': item.unit_price,
      'Purchase Price': item.stats.avgPurchasePrice,
      'Available Stock': item.stats.availableStock,
      'Stock Value': item.stats.stockValue,
      'Expected Profit': item.stats.expectedProfit,
      Profit: item.stats.profit
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, 'inventory_report.xlsx');
  };
"""
if "handleExportPDF" not in content:
    content = content.replace("const toggleSelectAll = () => {", export_funcs + "\n  const toggleSelectAll = () => {")

# 3. Add to filtering logic
filter_old = """      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      
      return matchesSearch && matchesCompany && matchesCategory;"""
filter_new = """      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesSupplier = supplierFilter === 'all' || item.supplier_id === supplierFilter;
      
      return matchesSearch && matchesCompany && matchesCategory && matchesSupplier;"""
content = content.replace(filter_old, filter_new)

# 4. Add Export buttons to UI (near Bulk Upload)
buttons_old = """            <Button onClick={() => setIsBulkUploadModalOpen(true)} variant="outline" className="h-10 px-4 whitespace-nowrap text-slate-600">
              <Upload className="w-4 h-4 mr-2" />
              Bulk Upload
            </Button>
            <Button onClick={() => openModal()} className="h-10 px-4 whitespace-nowrap bg-primary-600 hover:bg-primary-700">
              <Plus className="w-4 h-4 mr-2" />
              New Item
            </Button>"""

buttons_new = """            <Button onClick={handleExportPDF} variant="outline" className="h-10 px-4 whitespace-nowrap text-red-600 border-red-200 hover:bg-red-50">
              <Download className="w-4 h-4 mr-2" />
              PDF
            </Button>
            <Button onClick={handleExportExcel} variant="outline" className="h-10 px-4 whitespace-nowrap text-emerald-600 border-emerald-200 hover:bg-emerald-50">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Excel
            </Button>
            <Button onClick={() => setIsBulkUploadModalOpen(true)} variant="outline" className="h-10 px-4 whitespace-nowrap text-slate-600">
              <Upload className="w-4 h-4 mr-2" />
              Bulk Upload
            </Button>
            <Button onClick={() => openModal()} className="h-10 px-4 whitespace-nowrap bg-primary-600 hover:bg-primary-700">
              <Plus className="w-4 h-4 mr-2" />
              New Item
            </Button>"""
content = content.replace(buttons_old, buttons_new)

# 5. Add Supplier Dropdown in filters
dropdown_old = """            <select 
              className="bg-slate-50 border border-slate-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              {Array.from(new Set(inventory.map(item => item.category).filter(Boolean))).map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <Button variant="outline" size="sm">"""

dropdown_new = """            <select 
              className="bg-slate-50 border border-slate-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              {Array.from(new Set(inventory.map(item => item.category).filter(Boolean))).map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <select 
              className="bg-slate-50 border border-slate-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
            >
              <option value="all">All Suppliers</option>
              {suppliers.map(supplier => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
            <Button variant="outline" size="sm">"""
content = content.replace(dropdown_old, dropdown_new)

# 6. Add Supplier column to table
thead_old = """                <th className="px-6 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider">Company</th>"""
thead_new = """                <th className="px-6 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider">Company</th>
                <th className="px-6 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider">Supplier</th>"""
content = content.replace(thead_old, thead_new)

tbody_old = """                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">
                      {item.company || 'N/A'}
                    </span>
                  </td>"""
tbody_new = """                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">
                      {item.company || 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {suppliers.find(s => s.id === item.supplier_id)?.name || 'Multiple/None'}
                  </td>"""
content = content.replace(tbody_old, tbody_new)

with open('src/pages/Inventory.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
