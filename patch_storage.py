import re

with open('src/services/storageService.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace addPurchase logic
add_purchase_old = """  addPurchase: (purchase: Purchase) => {
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

add_purchase_new = """  addPurchase: (purchase: Purchase) => {
    const purchases = get<Purchase>(STORAGE_KEYS.PURCHASES);
    save(STORAGE_KEYS.PURCHASES, [purchase, ...purchases]);
    
    const items = get<InventoryItem>(STORAGE_KEYS.INVENTORY);
    
    purchase.items.forEach(purchasedItem => {
      const originalItem = items.find(i => i.id === purchasedItem.inventory_item_id);
      if (originalItem) {
        const targetSupplierId = purchase.supplier_id || '';
        let targetItem = items.find(i => i.sku === originalItem.sku && (i.supplier_id || '') === targetSupplierId);
        
        if (targetItem) {
          const totalQty = targetItem.quantity + purchasedItem.quantity;
          const newTotalCost = (targetItem.quantity * targetItem.cost_price) + (purchasedItem.quantity * purchasedItem.unit_price);
          
          targetItem.quantity = totalQty;
          targetItem.cost_price = totalQty > 0 ? newTotalCost / totalQty : targetItem.cost_price;
          
          purchasedItem.inventory_item_id = targetItem.id;
        } else {
          const newItem: InventoryItem = {
            ...originalItem,
            id: Math.random().toString(36).substr(2, 9),
            supplier_id: targetSupplierId,
            quantity: purchasedItem.quantity,
            cost_price: purchasedItem.unit_price
          };
          items.push(newItem);
          purchasedItem.inventory_item_id = newItem.id;
        }
      }
    });
    
    save(STORAGE_KEYS.INVENTORY, items);
    
    // Re-save purchase because inventory_item_id might have been updated
    const updatedPurchases = get<Purchase>(STORAGE_KEYS.PURCHASES);
    const pIdx = updatedPurchases.findIndex(p => p.id === purchase.id);
    if (pIdx > -1) {
      updatedPurchases[pIdx] = purchase;
      save(STORAGE_KEYS.PURCHASES, updatedPurchases);
    }
  },"""

content = content.replace(add_purchase_old, add_purchase_new)

# Replace deletePurchase logic
delete_purchase_old = """  deletePurchase: (id: string) => {
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
  },"""

delete_purchase_new = """  deletePurchase: (id: string) => {
    const purchases = get<Purchase>(STORAGE_KEYS.PURCHASES);
    const purchaseToDelete = purchases.find(p => p.id === id);
    if (purchaseToDelete) {
      const items = get<InventoryItem>(STORAGE_KEYS.INVENTORY);
      purchaseToDelete.items.forEach(item => {
        const target = items.find(i => i.id === item.inventory_item_id);
        if (target) {
          target.quantity = Math.max(0, target.quantity - item.quantity);
        }
      });
      save(STORAGE_KEYS.INVENTORY, items);
      
      const updated = purchases.filter(p => p.id !== id);
      save(STORAGE_KEYS.PURCHASES, updated);
    }
  },"""

content = content.replace(delete_purchase_old, delete_purchase_new)

# Replace updatePurchase logic
update_purchase_old = """  updatePurchase: (id: string, updatedPurchase: Purchase) => {
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

update_purchase_new = """  updatePurchase: (id: string, updatedPurchase: Purchase) => {
    const purchases = get<Purchase>(STORAGE_KEYS.PURCHASES);
    const oldPurchase = purchases.find(p => p.id === id);
    
    if (oldPurchase) {
      const items = get<InventoryItem>(STORAGE_KEYS.INVENTORY);
      
      // Revert old inventory stock
      oldPurchase.items.forEach(item => {
        const target = items.find(i => i.id === item.inventory_item_id);
        if (target) {
          target.quantity = Math.max(0, target.quantity - item.quantity);
        }
      });
      
      // Apply new inventory stock with correct supplier mapping
      updatedPurchase.items.forEach(purchasedItem => {
        const originalItem = items.find(i => i.id === purchasedItem.inventory_item_id) || items.find(i => i.sku === purchasedItem.sku); // Fallback to SKU if ID changed
        if (originalItem) {
          const targetSupplierId = updatedPurchase.supplier_id || '';
          let targetItem = items.find(i => i.sku === originalItem.sku && (i.supplier_id || '') === targetSupplierId);
          
          if (targetItem) {
            const totalQty = targetItem.quantity + purchasedItem.quantity;
            const newTotalCost = (targetItem.quantity * targetItem.cost_price) + (purchasedItem.quantity * purchasedItem.unit_price);
            
            targetItem.quantity = totalQty;
            targetItem.cost_price = totalQty > 0 ? newTotalCost / totalQty : targetItem.cost_price;
            
            purchasedItem.inventory_item_id = targetItem.id;
          } else {
            const newItem: InventoryItem = {
              ...originalItem,
              id: Math.random().toString(36).substr(2, 9),
              supplier_id: targetSupplierId,
              quantity: purchasedItem.quantity,
              cost_price: purchasedItem.unit_price
            };
            items.push(newItem);
            purchasedItem.inventory_item_id = newItem.id;
          }
        }
      });
      
      save(STORAGE_KEYS.INVENTORY, items);
      
      const updated = purchases.map(p => p.id === id ? updatedPurchase : p);
      save(STORAGE_KEYS.PURCHASES, updated);
    }
  },"""

content = content.replace(update_purchase_old, update_purchase_new)

with open('src/services/storageService.ts', 'w', encoding='utf-8') as f:
    f.write(content)

