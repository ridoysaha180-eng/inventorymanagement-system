import re

with open('src/pages/Suppliers.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add imports for XLSX, jsPDF, autoTable, Download, FileSpreadsheet
imports_old = """import { Plus, Search, Truck, Edit2, Trash2 } from 'lucide-react';"""
imports_new = """import { Plus, Search, Truck, Edit2, Trash2, Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';"""
content = content.replace(imports_old, imports_new)

# Update form state
form_old = """  const [formData, setFormData] = useState({
    sl_number: '',
    name: '',
  });"""
form_new = """  const [formData, setFormData] = useState({
    sl_number: '',
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: ''
  });"""
content = content.replace(form_old, form_new)

# Update handleOpenAddModal
openadd_old = """    setFormData({ sl_number: '', name: '' });"""
openadd_new = """    setFormData({ sl_number: '', name: '', contact_person: '', phone: '', email: '', address: '' });"""
content = content.replace(openadd_old, openadd_new)

# Update handleOpenEditModal
edit_old = """    setFormData({ sl_number: supplier.sl_number, name: supplier.name });"""
edit_new = """    setFormData({ 
      sl_number: supplier.sl_number, 
      name: supplier.name, 
      contact_person: supplier.contact_person || '', 
      phone: supplier.phone || '', 
      email: supplier.email || '', 
      address: supplier.address || '' 
    });"""
content = content.replace(edit_old, edit_new)

# Update submit
submit_old = """        const updatedSupplier: Supplier = {
          ...supplierToUpdate,
          sl_number: formData.sl_number,
          name: formData.name,
        };"""
submit_new = """        const updatedSupplier: Supplier = {
          ...supplierToUpdate,
          sl_number: formData.sl_number,
          name: formData.name,
          contact_person: formData.contact_person,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
        };"""
content = content.replace(submit_old, submit_new)

add_old = """        sl_number: formData.sl_number,
        name: formData.name,
        created_at: new Date().toISOString(),"""
add_new = """        sl_number: formData.sl_number,
        name: formData.name,
        contact_person: formData.contact_person,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        created_at: new Date().toISOString(),"""
content = content.replace(add_old, add_new)

reset_old = """    setFormData({ sl_number: '', name: '' });"""
reset_new = """    setFormData({ sl_number: '', name: '', contact_person: '', phone: '', email: '', address: '' });"""
content = content.replace(reset_old, reset_new)

# Add Export functions
export_funcs = """
  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text('Suppliers List', 14, 15);
    const tableData = filteredSuppliers.map(s => [
      s.sl_number, s.name, s.contact_person || 'N/A', s.phone || 'N/A', s.email || 'N/A'
    ]);
    autoTable(doc, {
      startY: 20,
      head: [['SL', 'Name', 'Contact Person', 'Phone', 'Email']],
      body: tableData,
    });
    doc.save('suppliers.pdf');
  };

  const handleExportExcel = () => {
    const data = filteredSuppliers.map(s => ({
      'SL Number': s.sl_number,
      'Supplier Name': s.name,
      'Contact Person': s.contact_person || 'N/A',
      'Phone': s.phone || 'N/A',
      'Email': s.email || 'N/A',
      'Address': s.address || 'N/A',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Suppliers');
    XLSX.writeFile(wb, 'suppliers.xlsx');
  };
"""
content = content.replace("  const handleDelete", export_funcs + "  const handleDelete")

# Add Export buttons
buttons_old = """        <Button onClick={handleOpenAddModal}>
          <Plus className="w-4 h-4 mr-2" />
          Add Supplier
        </Button>"""
buttons_new = """        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleExportPDF} variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
            <Download className="w-4 h-4 mr-2" />
            PDF
          </Button>
          <Button onClick={handleExportExcel} variant="outline" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Excel
          </Button>
          <Button onClick={handleOpenAddModal}>
            <Plus className="w-4 h-4 mr-2" />
            Add Supplier
          </Button>
        </div>"""
content = content.replace(buttons_old, buttons_new)

# Add Columns to Table
thead_old = """                <th className="px-6 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider">SL Number</th>
                <th className="px-6 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider">Supplier Name</th>
                <th className="px-6 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider text-right">Actions</th>"""
thead_new = """                <th className="px-6 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider">SL Number</th>
                <th className="px-6 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider">Supplier Name</th>
                <th className="px-6 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider text-right">Actions</th>"""
content = content.replace(thead_old, thead_new)

tbody_old = """                      <span className="text-sm font-medium text-slate-900">{supplier.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">"""
tbody_new = """                      <span className="text-sm font-medium text-slate-900">{supplier.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-slate-900">{supplier.contact_person || 'N/A'}</div>
                    <div className="text-xs text-slate-500">{supplier.phone || 'No phone'}</div>
                  </td>
                  <td className="px-6 py-4 text-right">"""
content = content.replace(tbody_old, tbody_new)

colspan_old = """<td colSpan={3}"""
colspan_new = """<td colSpan={4}"""
content = content.replace(colspan_old, colspan_new)

# Add Form Fields
form_html_old = """              <Input 
                label="SL Number" 
                required 
                placeholder="e.g. SL-001"
                value={formData.sl_number}
                onChange={e => setFormData({...formData, sl_number: e.target.value})}
              />
              <Input 
                label="Supplier Name" 
                required 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
              <div className="flex justify-end gap-3 pt-4">"""
form_html_new = """              <Input 
                label="SL Number" 
                required 
                placeholder="e.g. SL-001"
                value={formData.sl_number}
                onChange={e => setFormData({...formData, sl_number: e.target.value})}
              />
              <Input 
                label="Supplier Name" 
                required 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
              <Input 
                label="Contact Person" 
                placeholder="e.g. John Doe"
                value={formData.contact_person}
                onChange={e => setFormData({...formData, contact_person: e.target.value})}
              />
              <Input 
                label="Phone Number" 
                placeholder="e.g. 01700000000"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
              />
              <Input 
                label="Email" 
                type="email"
                placeholder="e.g. supplier@example.com"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
              <Input 
                label="Address" 
                placeholder="Supplier Address"
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
              />
              <div className="flex justify-end gap-3 pt-4">"""
content = content.replace(form_html_old, form_html_new)

with open('src/pages/Suppliers.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

