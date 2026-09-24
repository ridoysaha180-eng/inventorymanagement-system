import re

with open('src/pages/Inventory.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

cast_old = """    return Object.values(grouped);"""
cast_new = """    return Object.values(grouped) as InventoryItem[];"""

content = content.replace(cast_old, cast_new)

with open('src/pages/Inventory.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
