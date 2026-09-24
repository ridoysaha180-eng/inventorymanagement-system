import re

with open('src/types.ts', 'r', encoding='utf-8') as f:
    content = f.read()

sale_item_old = """export type SaleItem = {
  id: string;
  sale_id: string;
  inventory_item_id: string;
  quantity: number;
  unit_price: number;
  item_name?: string;
};"""

sale_item_new = """export type SaleItem = {
  id: string;
  sale_id: string;
  inventory_item_id: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  item_name?: string;
};"""
content = content.replace(sale_item_old, sale_item_new)

purchase_item_old = """export type PurchaseItem = {
  id: string;
  purchase_id: string;
  inventory_item_id: string;
  item_name?: string;
  quantity: number;
  unit_price: number;
};"""

purchase_item_new = """export type PurchaseItem = {
  id: string;
  purchase_id: string;
  inventory_item_id: string;
  sku?: string;
  item_name?: string;
  quantity: number;
  unit_price: number;
};"""
content = content.replace(purchase_item_old, purchase_item_new)

with open('src/types.ts', 'w', encoding='utf-8') as f:
    f.write(content)
