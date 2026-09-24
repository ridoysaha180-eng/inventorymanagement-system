import re

with open('src/types.ts', 'r', encoding='utf-8') as f:
    content = f.read()

supplier_old = """export type Supplier = {
  id: string;
  user_id: string;
  sl_number: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  created_at: string;
};"""

supplier_new = """export type Supplier = {
  id: string;
  user_id: string;
  sl_number: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  created_at: string;
};"""

content = content.replace(supplier_old, supplier_new)

with open('src/types.ts', 'w', encoding='utf-8') as f:
    f.write(content)
