import re

with open('src/services/storageService.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Modify updateProductStock to optionally accept a supplierId, but actually, it's easier to just modify addPurchase to do it itself.
add_purchase_old = """  addPurchase: (purchase: Purchase) => {
    const purchases = get<Purchase>(STORAGE_KEYS.PURCHASES);
    save(STORAGE_KEYS.PURCHASES, [purchase, ...purchases]);
    
    // Update inventory stock
    purchase.items.forEach(item => {
      storageService.updateProductStock(item.inventory_item_id, item.quantity);
    });
  },"""

add_purchase_new = """  addPurchase: (purchase: Purchase) => {
    const purchases = get<Purchase>(STORAGE_KEYS.PURCHASES);
    save(STORAGE_KEYS.PURCHASES, [purchase, ...purchases]);
    
    // Update inventory stock and assign supplier_id
    const items = get<InventoryItem>(STORAGE_KEYS.INVENTORY);
    const updatedItems = items.map(invItem => {
      const purchasedItem = purchase.items.find(pi => pi.inventory_item_id === invItem.id);
      if (purchasedItem) {
        return {
          ...invItem,
          quantity: invItem.quantity + purchasedItem.quantity,
          supplier_id: purchase.supplier_id || invItem.supplier_id // Update supplier_id to the purchase's supplier
        };
      }
      return invItem;
    });
    save(STORAGE_KEYS.INVENTORY, updatedItems);
  },"""

content = content.replace(add_purchase_old, add_purchase_new)

# Note: deletePurchase also updates stock, let's leave its stock reversion alone for now, since addPurchase is the main issue.

with open('src/services/storageService.ts', 'w', encoding='utf-8') as f:
    f.write(content)
