import re

with open('src/services/storageService.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Let's change the getter for Suppliers to migrate data if bizflow_vendors exists
migrate_logic = """  getSuppliers: () => {
    // Migration from old vendors key
    const oldVendors = localStorage.getItem('bizflow_vendors');
    if (oldVendors) {
      localStorage.setItem(STORAGE_KEYS.SUPPLIERS, oldVendors);
      localStorage.removeItem('bizflow_vendors');
    }
    
    const suppliers = get<Supplier>(STORAGE_KEYS.SUPPLIERS);"""

content = re.sub(r'  getSuppliers: \(\) => \{\n    const suppliers = get<Supplier>\(STORAGE_KEYS\.SUPPLIERS\);', migrate_logic, content)

with open('src/services/storageService.ts', 'w', encoding='utf-8') as f:
    f.write(content)
