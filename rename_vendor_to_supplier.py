import os
import re

def replace_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We want to replace Vendor -> Supplier, vendor -> supplier, VENDORS -> SUPPLIERS
    # Except in node_modules, dist, etc. But we are only doing this for specific files.
    
    new_content = content
    new_content = new_content.replace('Vendor', 'Supplier')
    new_content = new_content.replace('vendor', 'supplier')
    new_content = new_content.replace('VENDOR', 'SUPPLIER')
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

files_to_update = [
    'src/types.ts',
    'src/services/storageService.ts',
    'src/App.tsx',
    'src/components/layout/Sidebar.tsx',
    'src/pages/Vendors.tsx',
    'src/pages/Purchases.tsx',
    'src/pages/ProductDetails.tsx',
    'src/pages/Inventory.tsx',
    'src/pages/Sales.tsx'
]

for f in files_to_update:
    if os.path.exists(f):
        replace_in_file(f)

# Rename the file itself
if os.path.exists('src/pages/Vendors.tsx'):
    os.rename('src/pages/Vendors.tsx', 'src/pages/Suppliers.tsx')
    print("Renamed src/pages/Vendors.tsx to src/pages/Suppliers.tsx")

