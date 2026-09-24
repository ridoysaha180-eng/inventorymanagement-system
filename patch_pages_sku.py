import re

with open('src/pages/Purchases.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

push_old = """          purchaseItems.push({
            id: Math.random().toString(36).substr(2, 9),
            purchase_id: purchaseId,
            inventory_item_id: invItem.id,
            item_name: cartItem.name,
            quantity: cartItem.quantity,
            unit_price: cartItem.unit_price
          });"""

push_new = """          purchaseItems.push({
            id: Math.random().toString(36).substr(2, 9),
            purchase_id: purchaseId,
            inventory_item_id: invItem.id,
            sku: cartItem.sku,
            item_name: cartItem.name,
            quantity: cartItem.quantity,
            unit_price: cartItem.unit_price
          });"""

content = content.replace(push_old, push_new)
with open('src/pages/Purchases.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

with open('src/pages/Sales.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

push_sale_old = """          saleItems.push({
            id: Math.random().toString(36).substr(2, 9),
            sale_id: saleId,
            inventory_item_id: invItem.id,
            item_name: cartItem.name,
            quantity: cartItem.quantity,
            unit_price: cartItem.unit_price
          });"""

push_sale_new = """          saleItems.push({
            id: Math.random().toString(36).substr(2, 9),
            sale_id: saleId,
            inventory_item_id: invItem.id,
            sku: cartItem.sku,
            item_name: cartItem.name,
            quantity: cartItem.quantity,
            unit_price: cartItem.unit_price
          });"""

content = content.replace(push_sale_old, push_sale_new)
with open('src/pages/Sales.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

