import re

with open('src/pages/Inventory.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# I need to add supplier_id to the formData state.
form_data_state_repl = """  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    item_code: '',
    company: '',
    category: '',
    sub_category: '',
    supplier_id: '',
    unit: '',"""
content = re.sub(r'  const \[formData, setFormData\] = useState\(\{\n    name: \'\',\n    sku: \'\',\n    item_code: \'\',\n    company: \'\',\n    category: \'\',\n    sub_category: \'\',\n    unit: \'\',', form_data_state_repl, content)

close_modal_repl = """    setFormData({
      name: '',
      sku: '',
      item_code: '',
      company: '',
      category: '',
      sub_category: '',
      supplier_id: '',
      unit: '',"""
content = re.sub(r'    setFormData\(\{\n      name: \'\',\n      sku: \'\',\n      item_code: \'\',\n      company: \'\',\n      category: \'\',\n      sub_category: \'\',\n      unit: \'\',', close_modal_repl, content)

handle_edit_repl = """  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      sku: item.sku,
      item_code: item.item_code || '',
      company: item.company || '',
      category: item.category,
      sub_category: item.sub_category || '',
      supplier_id: item.supplier_id || '',
      unit: item.unit || '',"""
content = re.sub(r'  const handleEdit = \(item: InventoryItem\) => \{\n    setEditingItem\(item\);\n    setFormData\(\{\n      name: item\.name,\n      sku: item\.sku,\n      item_code: item\.item_code \|\| \'\',\n      company: item\.company \|\| \'\',\n      category: item\.category,\n      sub_category: item\.sub_category \|\| \'\',\n      unit: item\.unit \|\| \'\',', handle_edit_repl, content)


supplier_dropdown_ui = """                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-slate-700 mb-1 block">Supplier</label>
                    <select
                      className="w-full h-10 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      value={formData.supplier_id}
                      onChange={e => setFormData({...formData, supplier_id: e.target.value})}
                    >
                      <option value="">Select Supplier</option>
                      {suppliers.map(sup => (
                        <option key={sup.id} value={sup.id}>{sup.name}</option>
                      ))}
                    </select>
                  </div>"""

# I need to insert it in the modal form. The modal has 4 rows. Row 2 is right place.
# Let's find Row 2 and insert it.
content = content.replace("""                {/* Row 2 - Pricing */}""", """                {/* Row 2 - Pricing */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-4">
""" + supplier_dropdown_ui + """
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-4">""")


with open('src/pages/Inventory.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
