import re

with open('src/types.ts', 'r', encoding='utf-8') as f:
    content = f.read()

purchase_item_old = """export type PurchaseItem = {
  id: string;
  purchase_id: string;
  inventory_item_id: string;
  quantity: number;
  unit_price: number;
  item_name?: string;
};"""

purchase_item_new = """export type PurchaseItem = {
  id: string;
  purchase_id: string;
  inventory_item_id: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  item_name?: string;
};"""

content = content.replace(purchase_item_old, purchase_item_new)

with open('src/types.ts', 'w', encoding='utf-8') as f:
    f.write(content)

