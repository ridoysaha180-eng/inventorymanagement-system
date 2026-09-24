import re

with open('src/pages/Purchases.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

imports_old = """import { Plus, Search, Edit2, Calendar, Download, ShoppingBag, X, Trash2, Printer, CheckCircle2, ScanLine } from 'lucide-react';"""
imports_new = """import { Plus, Search, Edit2, Calendar, Download, ShoppingBag, X, Trash2, Printer, CheckCircle2, ScanLine, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';"""
content = content.replace(imports_old, imports_new)

# Add search term state
state_old = """  const [isScannerOpen, setIsScannerOpen] = useState(false);"""
state_new = """  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [purchaseSearchTerm, setPurchaseSearchTerm] = useState('');"""
content = content.replace(state_old, state_new)

# Add exports
export_funcs = """
  const filteredPurchases = purchases.filter(p => {
    const search = purchaseSearchTerm.toLowerCase();
    const sName = (suppliers.find(s => s.id === p.supplier_id)?.name || 'Walk-in Supplier').toLowerCase();
    return p.id.toLowerCase().includes(search) || sName.includes(search);
  });

  const handleExportExcel = () => {
    const data = filteredPurchases.map(p => ({
      Invoice: p.id,
      Supplier: suppliers.find(s => s.id === p.supplier_id)?.name || 'Walk-in Supplier',
      Date: new Date(p.created_at).toLocaleDateString(),
      Method: p.payment_method,
      Amount: p.total_amount,
      Status: p.status
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Purchases');
    XLSX.writeFile(wb, 'purchases.xlsx');
  };
"""
content = content.replace("  const handleDownloadPDF = async (purchaseId: string)", export_funcs + "  const handleDownloadPDF = async (purchaseId: string)")

# Update rendering of items
search_input_old = """            <input 
              type="text" 
              placeholder="Search invoice, supplier..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />"""
search_input_new = """            <input 
              type="text" 
              placeholder="Search invoice, supplier..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={purchaseSearchTerm}
              onChange={e => setPurchaseSearchTerm(e.target.value)}
            />"""
content = content.replace(search_input_old, search_input_new)

export_buttons_old = """            <Button variant="outline" size="sm">
              <Calendar className="w-4 h-4 mr-2" />
              Date Range
            </Button>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>"""
export_buttons_new = """            <Button variant="outline" size="sm">
              <Calendar className="w-4 h-4 mr-2" />
              Date Range
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Excel
            </Button>"""
content = content.replace(export_buttons_old, export_buttons_new)

render_loop_old = """{purchases.length > 0 ? purchases.map((purchase) => ("""
render_loop_new = """{filteredPurchases.length > 0 ? filteredPurchases.map((purchase) => ("""
content = content.replace(render_loop_old, render_loop_new)

with open('src/pages/Purchases.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
