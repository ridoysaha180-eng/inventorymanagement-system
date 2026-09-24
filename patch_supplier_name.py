import re

with open('src/pages/Inventory.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# PDF export
pdf_old = """suppliers.find(s => s.id === item.supplier_id)?.name || 'Multiple/None',"""
pdf_new = """item.supplier_id === 'multiple' ? 'Multiple' : (suppliers.find(s => s.id === item.supplier_id)?.name || 'N/A'),"""
content = content.replace(pdf_old, pdf_new, 2)

# HTML rendering
html_old = """{suppliers.find(s => s.id === item.supplier_id)?.name || 'Multiple/None'}"""
html_new = """{item.supplier_id === 'multiple' ? 'Multiple' : (suppliers.find(s => s.id === item.supplier_id)?.name || 'N/A')}"""
content = content.replace(html_old, html_new)

with open('src/pages/Inventory.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
