import fs from 'fs';
let content = fs.readFileSync('src/pages/Sales.tsx', 'utf8');

content = content.replace(/Sales/g, 'Purchases');
content = content.replace(/Sale/g, 'Purchase');
content = content.replace(/sales/g, 'purchases');
content = content.replace(/sale/g, 'purchase');
content = content.replace(/customer/g, 'vendor');
content = content.replace(/Customer/g, 'Vendor');
content = content.replace(/CUSTOMERS/g, 'VENDORS');
content = content.replace(/customers/g, 'vendors');

// Fix specific things
content = content.replace(/export const Purchases: React.FC = \(\) => \{/, 'export const Purchases: React.FC = () => {');

// Fix the imports
content = content.replace(/import \{ InventoryItem, Purchase, PurchaseItem, Vendor, Vendor \} from '\.\.\/types';/, "import { InventoryItem, Purchase, PurchaseItem, Vendor } from '../types';");

// Fix the loadData
content = content.replace(/setVendors\(storageService\.getVendors\(\)\);\n    setVendors\(storageService\.getVendors\(\)\);/, "setVendors(storageService.getVendors());");

// Fix the inventory deduction to addition
content = content.replace(/let remainingToDeduct = cartItem\.quantity;/g, 'let remainingToAdd = cartItem.quantity;');
content = content.replace(/const deductAmount = Math\.min\(invItem\.quantity, remainingToDeduct\);/g, 'const addAmount = remainingToAdd;');
content = content.replace(/remainingToDeduct -= deductAmount;/g, 'remainingToAdd -= addAmount;');
content = content.replace(/deductAmount/g, 'addAmount');

fs.writeFileSync('src/pages/Purchases.tsx', content);
