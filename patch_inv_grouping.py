import re

with open('src/pages/Inventory.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

grouping_old = """    const grouped = filtered.reduce((acc, item) => {
      if (!acc[item.sku]) {
        acc[item.sku] = { ...item, supplier_id: 'multiple' };
      } else {
        const existing = acc[item.sku];
        const totalQuantity = existing.quantity + item.quantity;
        
        // Calculate weighted average for cost price
        const totalCost = (existing.quantity * existing.cost_price) + (item.quantity * item.cost_price);
        const avgCost = totalQuantity > 0 ? totalCost / totalQuantity : 0;

        acc[item.sku] = {
          ...existing,
          quantity: totalQuantity,
          cost_price: avgCost,
          // Keep the highest MRP and Unit Price
          mrp: Math.max(existing.mrp || 0, item.mrp || 0),
          unit_price: Math.max(existing.unit_price, item.unit_price),
        };
      }
      return acc;
    }, {} as Record<string, InventoryItem>);"""

grouping_new = """    const grouped = filtered.reduce((acc, item) => {
      if (!acc[item.sku]) {
        acc[item.sku] = { ...item };
      } else {
        const existing = acc[item.sku];
        const totalQuantity = existing.quantity + item.quantity;
        
        // Calculate weighted average for cost price
        const totalCost = (existing.quantity * existing.cost_price) + (item.quantity * item.cost_price);
        const avgCost = totalQuantity > 0 ? totalCost / totalQuantity : 0;

        acc[item.sku] = {
          ...existing,
          quantity: totalQuantity,
          cost_price: avgCost,
          supplier_id: existing.supplier_id && existing.supplier_id !== item.supplier_id ? 'multiple' : (existing.supplier_id || item.supplier_id),
          // Keep the highest MRP and Unit Price
          mrp: Math.max(existing.mrp || 0, item.mrp || 0),
          unit_price: Math.max(existing.unit_price, item.unit_price),
        };
      }
      return acc;
    }, {} as Record<string, InventoryItem>);"""

content = content.replace(grouping_old, grouping_new)

with open('src/pages/Inventory.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
