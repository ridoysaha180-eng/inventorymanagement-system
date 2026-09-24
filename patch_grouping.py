import re

with open('src/pages/Inventory.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

grouping_old = """    // Group by SKU when no specific company filter is applied (similar to old 'all suppliers' behavior)
    if (companyFilter !== 'all') {
      return filtered;
    }"""

grouping_new = """    // Always group by SKU based on the current filters"""

content = content.replace(grouping_old, grouping_new)

with open('src/pages/Inventory.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
