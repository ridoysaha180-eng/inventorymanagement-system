import re

with open('src/services/storageService.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Migration for purchases
purchases_migration = """  getPurchases: () => {
    let purchases = get<Purchase>(STORAGE_KEYS.PURCHASES);
    // Migrate vendor_id to supplier_id
    let modified = false;
    purchases = purchases.map(p => {
      const anyP = p as any;
      if (anyP.vendor_id) {
        anyP.supplier_id = anyP.vendor_id;
        delete anyP.vendor_id;
        modified = true;
      }
      return anyP;
    });
    if (modified) save(STORAGE_KEYS.PURCHASES, purchases);
    return purchases;
  },"""

content = re.sub(r'  getPurchases: \(\) => get<Purchase>\(STORAGE_KEYS\.PURCHASES\),', purchases_migration, content)

# Migration for inventory
inventory_migration = """  getInventory: () => {
    let inventory = get<InventoryItem>(STORAGE_KEYS.INVENTORY);
    // Migrate vendor_id to supplier_id
    let modified = false;
    inventory = inventory.map(item => {
      const anyI = item as any;
      if (anyI.vendor_id) {
        anyI.supplier_id = anyI.vendor_id;
        delete anyI.vendor_id;
        modified = true;
      }
      return anyI;
    });
    if (modified) save(STORAGE_KEYS.INVENTORY, inventory);
    return inventory;
  },"""

content = re.sub(r'  getInventory: \(\) => get<InventoryItem>\(STORAGE_KEYS\.INVENTORY\),', inventory_migration, content)

with open('src/services/storageService.ts', 'w', encoding='utf-8') as f:
    f.write(content)
