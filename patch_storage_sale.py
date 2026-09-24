import re

with open('src/services/storageService.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace addSale logic
add_sale_old = """  addSale: (sale: Sale) => {
    const sales = get<Sale>(STORAGE_KEYS.SALES);
    save(STORAGE_KEYS.SALES, [sale, ...sales]);
    
    // Update inventory stock
    sale.items.forEach(item => {
      storageService.updateProductStock(item.inventory_item_id, -item.quantity);
    });
  },"""

add_sale_new = """  addSale: (sale: Sale) => {
    const sales = get<Sale>(STORAGE_KEYS.SALES);
    save(STORAGE_KEYS.SALES, [sale, ...sales]);
    
    // Update inventory stock across multiple suppliers if needed
    const items = get<InventoryItem>(STORAGE_KEYS.INVENTORY);
    sale.items.forEach(saleItem => {
      const originalItem = items.find(i => i.id === saleItem.inventory_item_id) || items.find(i => i.sku === saleItem.sku);
      if (originalItem) {
        // Find all items with this SKU
        const matchingItems = items.filter(i => i.sku === originalItem.sku);
        let remainingToDeduct = saleItem.quantity;
        
        // First try to deduct from the exact match
        if (originalItem.quantity > 0) {
           const deduct = Math.min(originalItem.quantity, remainingToDeduct);
           originalItem.quantity -= deduct;
           remainingToDeduct -= deduct;
        }
        
        // If still remaining, deduct from others with same SKU
        for (const mItem of matchingItems) {
           if (remainingToDeduct <= 0) break;
           if (mItem.id === originalItem.id) continue;
           
           if (mItem.quantity > 0) {
              const deduct = Math.min(mItem.quantity, remainingToDeduct);
              mItem.quantity -= deduct;
              remainingToDeduct -= deduct;
           }
        }
        
        // If still remaining (selling more than we have), just deduct from the original to let it go negative
        if (remainingToDeduct > 0) {
           originalItem.quantity -= remainingToDeduct;
        }
      }
    });
    save(STORAGE_KEYS.INVENTORY, items);
  },"""

content = content.replace(add_sale_old, add_sale_new)

# Replace deleteSale logic
delete_sale_old = """  deleteSale: (id: string) => {
    const sales = get<Sale>(STORAGE_KEYS.SALES);
    const saleToDelete = sales.find(s => s.id === id);
    if (saleToDelete) {
      // Restore inventory stock
      saleToDelete.items.forEach(item => {
        storageService.updateProductStock(item.inventory_item_id, item.quantity);
      });
      const updated = sales.filter(s => s.id !== id);
      save(STORAGE_KEYS.SALES, updated);
    }
  },"""

delete_sale_new = """  deleteSale: (id: string) => {
    const sales = get<Sale>(STORAGE_KEYS.SALES);
    const saleToDelete = sales.find(s => s.id === id);
    if (saleToDelete) {
      // Restore inventory stock
      const items = get<InventoryItem>(STORAGE_KEYS.INVENTORY);
      saleToDelete.items.forEach(saleItem => {
         const originalItem = items.find(i => i.id === saleItem.inventory_item_id) || items.find(i => i.sku === saleItem.sku);
         if (originalItem) {
            originalItem.quantity += saleItem.quantity;
         }
      });
      save(STORAGE_KEYS.INVENTORY, items);
      
      const updated = sales.filter(s => s.id !== id);
      save(STORAGE_KEYS.SALES, updated);
    }
  },"""

content = content.replace(delete_sale_old, delete_sale_new)

# Replace updateSale logic
update_sale_old = """  updateSale: (id: string, updatedSale: Sale) => {
    const sales = get<Sale>(STORAGE_KEYS.SALES);
    const oldSale = sales.find(s => s.id === id);
    
    if (oldSale) {
      // Restore old inventory stock
      oldSale.items.forEach(item => {
        storageService.updateProductStock(item.inventory_item_id, item.quantity);
      });
      
      // Apply new inventory stock
      updatedSale.items.forEach(item => {
        storageService.updateProductStock(item.inventory_item_id, -item.quantity);
      });
      
      const updated = sales.map(s => s.id === id ? updatedSale : s);
      save(STORAGE_KEYS.SALES, updated);
    }
  },"""

update_sale_new = """  updateSale: (id: string, updatedSale: Sale) => {
    const sales = get<Sale>(STORAGE_KEYS.SALES);
    const oldSale = sales.find(s => s.id === id);
    
    if (oldSale) {
      const items = get<InventoryItem>(STORAGE_KEYS.INVENTORY);
      
      // Restore old inventory stock
      oldSale.items.forEach(saleItem => {
         const originalItem = items.find(i => i.id === saleItem.inventory_item_id) || items.find(i => i.sku === saleItem.sku);
         if (originalItem) {
            originalItem.quantity += saleItem.quantity;
         }
      });
      
      // Apply new inventory stock
      updatedSale.items.forEach(saleItem => {
        const originalItem = items.find(i => i.id === saleItem.inventory_item_id) || items.find(i => i.sku === saleItem.sku);
        if (originalItem) {
          const matchingItems = items.filter(i => i.sku === originalItem.sku);
          let remainingToDeduct = saleItem.quantity;
          
          if (originalItem.quantity > 0) {
             const deduct = Math.min(originalItem.quantity, remainingToDeduct);
             originalItem.quantity -= deduct;
             remainingToDeduct -= deduct;
          }
          
          for (const mItem of matchingItems) {
             if (remainingToDeduct <= 0) break;
             if (mItem.id === originalItem.id) continue;
             if (mItem.quantity > 0) {
                const deduct = Math.min(mItem.quantity, remainingToDeduct);
                mItem.quantity -= deduct;
                remainingToDeduct -= deduct;
             }
          }
          
          if (remainingToDeduct > 0) {
             originalItem.quantity -= remainingToDeduct;
          }
        }
      });
      
      save(STORAGE_KEYS.INVENTORY, items);
      
      const updated = sales.map(s => s.id === id ? updatedSale : s);
      save(STORAGE_KEYS.SALES, updated);
    }
  },"""

content = content.replace(update_sale_old, update_sale_new)

with open('src/services/storageService.ts', 'w', encoding='utf-8') as f:
    f.write(content)

