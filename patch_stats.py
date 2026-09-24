import re

with open('src/pages/Inventory.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

stats_old = """  const getItemStats = (item: InventoryItem) => {
    let matchingItemIds = [item.id];
    if (item.supplier_id === 'multiple') {
      matchingItemIds = inventory.filter(inv => inv.sku === item.sku).map(inv => inv.id);
    }"""

stats_new = """  const getItemStats = (item: InventoryItem) => {
    // Find all underlying inventory items that this grouped item represents
    const matchingItemIds = inventory
      .filter(inv => inv.sku === item.sku)
      .filter(inv => supplierFilter === 'all' || inv.supplier_id === supplierFilter)
      .filter(inv => companyFilter === 'all' || inv.company === companyFilter)
      .filter(inv => categoryFilter === 'all' || inv.category === categoryFilter)
      .map(inv => inv.id);"""

content = content.replace(stats_old, stats_new)

with open('src/pages/Inventory.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
