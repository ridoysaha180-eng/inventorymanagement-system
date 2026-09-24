import re

with open('src/services/storageService.ts', 'r') as f:
    content = f.read()

# Add updatePurchase and deletePurchase
methods_to_add = """  addPurchase: (purchase: Purchase) => {
    const purchases = get<Purchase>(STORAGE_KEYS.PURCHASES);
    save(STORAGE_KEYS.PURCHASES, [purchase, ...purchases]);
    
    // Update inventory stock
    purchase.items.forEach(item => {
      storageService.updateProductStock(item.inventory_item_id, item.quantity);
    });
  },
  deletePurchase: (id: string) => {
    const purchases = get<Purchase>(STORAGE_KEYS.PURCHASES);
    const purchaseToDelete = purchases.find(p => p.id === id);
    if (purchaseToDelete) {
      // Revert inventory stock
      purchaseToDelete.items.forEach(item => {
        storageService.updateProductStock(item.inventory_item_id, -item.quantity);
      });
      const updated = purchases.filter(p => p.id !== id);
      save(STORAGE_KEYS.PURCHASES, updated);
    }
  },
  updatePurchase: (id: string, updatedPurchase: Purchase) => {
    const purchases = get<Purchase>(STORAGE_KEYS.PURCHASES);
    const oldPurchase = purchases.find(p => p.id === id);
    
    if (oldPurchase) {
      // Revert old inventory stock
      oldPurchase.items.forEach(item => {
        storageService.updateProductStock(item.inventory_item_id, -item.quantity);
      });
      // Apply new inventory stock
      updatedPurchase.items.forEach(item => {
        storageService.updateProductStock(item.inventory_item_id, item.quantity);
      });
      
      const updated = purchases.map(p => p.id === id ? updatedPurchase : p);
      save(STORAGE_KEYS.PURCHASES, updated);
    }
  },"""

content = re.sub(r'  addPurchase: \(purchase: Purchase\) => \{\s+const purchases = get<Purchase>\(STORAGE_KEYS\.PURCHASES\);\s+save\(STORAGE_KEYS\.PURCHASES, \[purchase, \.\.\.purchases\]\);\s+// Update inventory stock\s+purchase\.items\.forEach\(item => \{\s+storageService\.updateProductStock\(item\.inventory_item_id, item\.quantity\);\s+\}\);\s+\},', methods_to_add, content)

with open('src/services/storageService.ts', 'w') as f:
    f.write(content)
