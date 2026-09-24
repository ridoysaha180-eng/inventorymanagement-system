import re
with open('src/types.ts', 'r') as f:
    content = f.read()
    
content = content.replace('export type Vendor', 'export type Supplier')
content = content.replace('vendor_id?', 'supplier_id?')
# Let's keep `vendor_id` on the database level or just change to `supplier_id`.
# Wait, changing the field name might lose existing data unless I migrate data.
# Let's migrate it in `storageService` or just change the UI terminology.
