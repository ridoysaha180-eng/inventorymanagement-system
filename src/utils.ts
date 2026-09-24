import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { InventoryItem, Sale, SaleItem, Purchase, Supplier } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Accurately resolve item purchase cost from authoritative inventory item, purchase orders, or sale lot (supplier-aware)
export const resolveItemCost = (
  item: { cost_price?: number; inventory_item_id?: string; sku?: string; item_name?: string; unit_price?: number; supplier_id?: string },
  inventoryList: InventoryItem[],
  purchasesList?: Purchase[]
): number => {
  // 1. Try match inventory item:
  let invItem = item.inventory_item_id ? inventoryList.find(i => i.id === item.inventory_item_id) : undefined;

  if (!invItem && item.sku && item.supplier_id) {
    invItem = inventoryList.find(i => i.sku && i.sku.trim().toLowerCase() === item.sku!.trim().toLowerCase() && (i.supplier_id || '') === item.supplier_id);
  }
  if (!invItem && item.sku) {
    invItem = inventoryList.find(i => i.sku && i.sku.trim().toLowerCase() === item.sku!.trim().toLowerCase());
  }
  if (!invItem && item.item_name) {
    invItem = inventoryList.find(i => i.name && i.name.trim().toLowerCase() === item.item_name!.trim().toLowerCase());
  }

  const targetSupplierId = item.supplier_id || invItem?.supplier_id || '';

  // Priority 1: Specific Supplier's weighted average purchase unit cost from purchasesList
  if (purchasesList && purchasesList.length > 0 && targetSupplierId) {
    let suppPoQty = 0;
    let suppPoAmount = 0;
    purchasesList.forEach(p => {
      if ((p.supplier_id || '') === targetSupplierId) {
        (p.items || []).forEach(pi => {
          const matches = (pi.inventory_item_id && invItem?.id && pi.inventory_item_id === invItem.id) ||
                          (pi.inventory_item_id && item.inventory_item_id && pi.inventory_item_id === item.inventory_item_id) ||
                          (pi.sku && item.sku && pi.sku.trim().toLowerCase() === item.sku.trim().toLowerCase()) ||
                          (pi.item_name && item.item_name && pi.item_name.trim().toLowerCase() === item.item_name.trim().toLowerCase()) ||
                          (invItem?.name && pi.item_name && pi.item_name.trim().toLowerCase() === invItem.name.trim().toLowerCase());
          if (matches) {
            suppPoQty += (pi.quantity || 0);
            suppPoAmount += ((pi.quantity || 0) * (pi.unit_price || 0));
          }
        });
      }
    });
    if (suppPoQty > 0) {
      return suppPoAmount / suppPoQty;
    }
  }

  // Priority 2: Specific Supplier's inventory item cost_price
  if (invItem && targetSupplierId && invItem.supplier_id === targetSupplierId && typeof invItem.cost_price === 'number' && !isNaN(invItem.cost_price) && invItem.cost_price > 0) {
    return invItem.cost_price;
  }

  // Priority 3: Fallback - Overall weighted average purchase unit cost across all purchases for this item
  if (purchasesList && purchasesList.length > 0) {
    let poPurchaseQty = 0;
    let poPurchaseAmount = 0;
    purchasesList.forEach(p => {
      (p.items || []).forEach(pi => {
        const matches = (pi.inventory_item_id && invItem?.id && pi.inventory_item_id === invItem.id) ||
                        (pi.inventory_item_id && item.inventory_item_id && pi.inventory_item_id === item.inventory_item_id) ||
                        (pi.sku && item.sku && pi.sku.trim().toLowerCase() === item.sku.trim().toLowerCase()) ||
                        (pi.item_name && item.item_name && pi.item_name.trim().toLowerCase() === item.item_name.trim().toLowerCase()) ||
                        (invItem?.name && pi.item_name && pi.item_name.trim().toLowerCase() === invItem.name.trim().toLowerCase());
        if (matches) {
          poPurchaseQty += (pi.quantity || 0);
          poPurchaseAmount += ((pi.quantity || 0) * (pi.unit_price || 0));
        }
      });
    });
    if (poPurchaseQty > 0) {
      return poPurchaseAmount / poPurchaseQty;
    }
  }

  // Priority 4: Inventory item cost_price fallback
  if (invItem && typeof invItem.cost_price === 'number' && !isNaN(invItem.cost_price) && invItem.cost_price > 0) {
    return invItem.cost_price;
  }

  // Priority 5: Direct explicit cost_price on item if recorded
  if (typeof item.cost_price === 'number' && !isNaN(item.cost_price) && item.cost_price > 0) {
    return item.cost_price;
  }

  // Priority 6: Fallbacks
  if (invItem && typeof invItem.dealer_price === 'number' && !isNaN(invItem.dealer_price) && invItem.dealer_price > 0) {
    return invItem.dealer_price;
  }
  return 0;
};

export interface SaleFinancials {
  subtotal: number;
  discount: number;
  netRevenue: number;
  taxAmount: number;
  totalAmount: number;
  totalCost: number; // COGS
  profit: number; // Net Revenue - COGS
  margin: number; // (profit / netRevenue) * 100
  isProfit: boolean;
  isLoss: boolean;
}

export const calculateSaleFinancials = (
  sale: Sale,
  inventoryList: InventoryItem[],
  purchasesList: Purchase[] = [],
  suppliersList: Supplier[] = [],
  salesList: Sale[] = []
): SaleFinancials => {
  const subtotal = (sale.subtotal !== undefined && sale.subtotal !== null)
    ? sale.subtotal
    : (sale.items || []).reduce((sum, i) => sum + (i.quantity * i.unit_price), 0);
  
  const discount = sale.discount_amount || 0;
  const netRevenue = Math.max(0, subtotal - discount);
  const taxAmount = sale.tax_amount || 0;
  const totalAmount = sale.total_amount !== undefined ? sale.total_amount : (netRevenue + taxAmount);

  let totalCost = 0;
  const officeLots = resolveSaleOfficeAuditLots(sale, inventoryList, purchasesList, suppliersList, salesList);
  if (officeLots && officeLots.length > 0) {
    totalCost = officeLots.reduce((sum, lot) => sum + lot.total_cost, 0);
  } else {
    (sale.items || []).forEach(item => {
      const cost = resolveItemCost(item, inventoryList, purchasesList);
      totalCost += (cost * item.quantity);
    });
  }

  const profit = netRevenue - totalCost;
  const margin = netRevenue > 0 ? (profit / netRevenue) * 100 : 0;

  return {
    subtotal,
    discount,
    netRevenue,
    taxAmount,
    totalAmount,
    totalCost,
    profit,
    margin,
    isProfit: profit >= 0,
    isLoss: profit < 0
  };
};

export const calculateInventoryProfitLoss = (
  salesList: Sale[],
  inventoryList: InventoryItem[],
  purchasesList: Purchase[] = [],
  suppliersList: Supplier[] = []
): { totalProfit: number; totalLoss: number } => {
  if (!salesList || salesList.length === 0) {
    return { totalProfit: 0, totalLoss: 0 };
  }

  let totalProfit = 0;
  let totalLoss = 0;

  salesList.forEach(sale => {
    const fin = calculateSaleFinancials(sale, inventoryList, purchasesList, suppliersList, salesList);
    if (fin.profit > 0) {
      totalProfit += fin.profit;
    } else if (fin.profit < 0) {
      totalLoss += Math.abs(fin.profit);
    }
  });

  return { totalProfit, totalLoss };
};

export interface SupplierBreakdownEntry {
  supplierId: string;
  supplierName: string;
  supplier_sl: string;
  purchasePrice: number;
  purchaseQty: number;
  purchaseAmount: number;
  saleQty: number;
  salesAmount: number;
  availableStock: number;
  stockValue: number;
  expectedProfit: number;
  profit: number;
  loss: number;
  avgRate: number;
  costPrice: number;
  currentStock: number;
  totalPurchasedQty: number;
  totalPurchasedAmount: number;
  soldQty: number;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface ItemProductStats {
  purchaseQty: number;
  purchaseAmount: number;
  saleQty: number;
  salesAmount: number;
  availableStock: number;
  stockValue: number;
  cogs: number;
  profitLoss: number;
  profitMargin: number;
  expectedProfit: number;
  profit: number;
  loss: number;
  earn: number;
  avgPurchasePrice: number;
}

export const groupInventoryByProduct = (items: InventoryItem[]): InventoryItem[] => {
  const map = new Map<string, InventoryItem[]>();

  items.forEach(item => {
    const key = (item.sku && item.sku.trim() !== '') 
      ? `sku_${item.sku.trim().toLowerCase()}` 
      : (item.name ? `name_${item.name.trim().toLowerCase()}` : `id_${item.id}`);
    
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(item);
  });

  return Array.from(map.values()).map(group => {
    if (group.length === 1) return group[0];

    const primary = group[0];
    const totalQty = group.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
    const supplierIds = Array.from(new Set(group.map(i => i.supplier_id).filter(Boolean)));
    const resolvedSupplierId = supplierIds.length === 1 ? supplierIds[0] : (supplierIds.length > 1 ? 'multiple' : '');

    return {
      ...primary,
      quantity: totalQty,
      supplier_id: resolvedSupplierId
    };
  });
};

export const getProductSupplierBreakdown = (
  product: InventoryItem,
  inventory: InventoryItem[],
  sales: Sale[],
  purchases: Purchase[],
  suppliers: Supplier[]
): SupplierBreakdownEntry[] => {
  // 1. All raw inventory records matching SKU or ID or Name
  const matchingInv = inventory.filter(inv => 
    (product.sku && inv.sku === product.sku) || 
    inv.id === product.id ||
    (product.name && inv.name && inv.name.trim().toLowerCase() === product.name.trim().toLowerCase())
  );
  const matchingInvIds = matchingInv.map(i => i.id);

  // 2. Find total actual sales and collect individual sale items for this product
  let totalSoldQty = 0;
  const matchingSaleItems: { quantity: number; unitPrice: number; supplierId: string }[] = [];
  sales.forEach(sale => {
    (sale.items || []).forEach(si => {
      const matches = (si.inventory_item_id && matchingInvIds.includes(si.inventory_item_id)) ||
                      (si.sku && product.sku && si.sku === product.sku) ||
                      (si.item_name && product.name && si.item_name.trim().toLowerCase() === product.name.trim().toLowerCase());
      if (matches) {
        const qty = si.quantity || 0;
        totalSoldQty += qty;
        matchingSaleItems.push({
          quantity: qty,
          unitPrice: (typeof si.unit_price === 'number' && si.unit_price > 0) ? si.unit_price : (product.unit_price || product.mrp || 0),
          supplierId: si.supplier_id || ''
        });
      }
    });
  });

  // 3. Find all purchase records for this product
  const poEntries: {
    supplierId: string;
    quantity: number;
    unitPrice: number;
    createdAt: string;
  }[] = [];

  purchases.forEach(p => {
    const pSuppId = p.supplier_id || '';
    (p.items || []).forEach(pi => {
      const matches = (pi.inventory_item_id && matchingInvIds.includes(pi.inventory_item_id)) ||
                      (pi.sku && product.sku && pi.sku === product.sku) ||
                      (pi.item_name && product.name && pi.item_name.trim().toLowerCase() === product.name.trim().toLowerCase());
      if (matches) {
        poEntries.push({
          supplierId: pSuppId,
          quantity: pi.quantity || 0,
          unitPrice: pi.unit_price || 0,
          createdAt: p.created_at || ''
        });
      }
    });
  });

  const totalPurchasedFromPOs = poEntries.reduce((sum, p) => sum + p.quantity, 0);
  const rawInvStock = matchingInv.reduce((sum, i) => sum + (i.quantity || 0), 0);

  // Initial opening stock
  const initialOpeningStock = Math.max(0, (rawInvStock + totalSoldQty) - totalPurchasedFromPOs);

  const initialInvWithSupplier = matchingInv.find(i => i.supplier_id && i.supplier_id !== 'multiple' && i.supplier_id !== '');
  const initialSupplierId = initialInvWithSupplier?.supplier_id || (product.supplier_id && product.supplier_id !== 'multiple' ? product.supplier_id : '');

  type StockBatch = {
    supplierId: string;
    quantity: number;
    unitPrice: number;
    date: string;
  };

  const batches: StockBatch[] = [];

  if (matchingInv.length > 1) {
    matchingInv.forEach(invItem => {
      const invSuppId = invItem.supplier_id && invItem.supplier_id !== 'multiple' ? invItem.supplier_id : initialSupplierId;
      const invPoQty = poEntries.filter(p => p.supplierId === invSuppId).reduce((s, p) => s + p.quantity, 0);
      const invQty = Math.max(0, invItem.quantity || 0);
      const invOpening = Math.max(0, invQty - invPoQty);
      if (invOpening > 0) {
        batches.push({
          supplierId: invSuppId,
          quantity: invOpening,
          unitPrice: invItem.cost_price || product.cost_price || 0,
          date: invItem.created_at || '1970-01-01'
        });
      }
    });
  }

  if (batches.length === 0 && initialOpeningStock > 0) {
    batches.push({
      supplierId: initialSupplierId,
      quantity: initialOpeningStock,
      unitPrice: product.cost_price || 0,
      date: matchingInv[0]?.created_at || '1970-01-01'
    });
  }

  const sortedPOs = [...poEntries].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  sortedPOs.forEach(po => {
    batches.push({
      supplierId: po.supplierId,
      quantity: po.quantity,
      unitPrice: po.unitPrice,
      date: po.createdAt
    });
  });

  // Sort batches by Supplier SL number (e.g. SL-001 before SL-002) and then date
  batches.sort((a, b) => {
    const suppA = suppliers.find(s => s.id === a.supplierId);
    const suppB = suppliers.find(s => s.id === b.supplierId);
    const slA = suppA?.sl_number || 'SL-999';
    const slB = suppB?.sl_number || 'SL-999';
    const slCmp = slA.localeCompare(slB, undefined, { numeric: true });
    if (slCmp !== 0) return slCmp;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  // Deduct sales from stock batches and calculate actual historical sales revenue per supplier
  const supplierSalesMap = new Map<string, number>();
  const supplierRevenueMap = new Map<string, number>();

  const tempBatches = batches.map(b => ({ ...b, available: b.quantity, soldQty: 0, remainingQty: b.quantity }));

  matchingSaleItems.forEach(sItem => {
    let remaining = sItem.quantity;
    const price = sItem.unitPrice;

    // First priority: if item explicitly specifies supplierId
    if (sItem.supplierId) {
      for (const b of tempBatches) {
        if (remaining <= 0) break;
        if (b.supplierId === sItem.supplierId && b.available > 0) {
          const deduct = Math.min(b.available, remaining);
          b.available -= deduct;
          b.soldQty += deduct;
          b.remainingQty = b.available;
          remaining -= deduct;
          supplierSalesMap.set(b.supplierId, (supplierSalesMap.get(b.supplierId) || 0) + deduct);
          supplierRevenueMap.set(b.supplierId, (supplierRevenueMap.get(b.supplierId) || 0) + (deduct * price));
        }
      }
    }

    // Second priority: deduct remaining from available batches in FIFO sequence
    if (remaining > 0) {
      for (const b of tempBatches) {
        if (remaining <= 0) break;
        if (b.available > 0) {
          const deduct = Math.min(b.available, remaining);
          b.available -= deduct;
          b.soldQty += deduct;
          b.remainingQty = b.available;
          remaining -= deduct;
          supplierSalesMap.set(b.supplierId, (supplierSalesMap.get(b.supplierId) || 0) + deduct);
          supplierRevenueMap.set(b.supplierId, (supplierRevenueMap.get(b.supplierId) || 0) + (deduct * price));
        }
      }
    }

    // Third priority: if stock batches run out, assign remaining sales & revenue to target supplier
    if (remaining > 0) {
      const targetSuppId = sItem.supplierId || initialSupplierId || (batches[0]?.supplierId || '');
      supplierSalesMap.set(targetSuppId, (supplierSalesMap.get(targetSuppId) || 0) + remaining);
      supplierRevenueMap.set(targetSuppId, (supplierRevenueMap.get(targetSuppId) || 0) + (remaining * price));
    }
  });

  // Aggregate supplier stats
  const supplierMap = new Map<string, {
    supplierId: string;
    supplierName: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: string;
    currentStock: number;
    costPrice: number;
    totalPurchasedQty: number;
    totalPurchasedAmount: number;
    soldQty: number;
  }>();

  tempBatches.forEach(b => {
    const supp = suppliers.find(s => s.id === b.supplierId);
    const suppName = supp?.name || (b.supplierId ? 'Direct Supplier' : 'Opening / Unassigned Stock');
    const existing = supplierMap.get(b.supplierId) || {
      supplierId: b.supplierId,
      supplierName: suppName,
      contactPerson: supp?.contact_person,
      phone: supp?.phone,
      email: supp?.email,
      address: supp?.address,
      currentStock: 0,
      costPrice: b.unitPrice,
      totalPurchasedQty: 0,
      totalPurchasedAmount: 0,
      soldQty: 0
    };

    existing.totalPurchasedQty += b.quantity;
    existing.totalPurchasedAmount += (b.quantity * b.unitPrice);
    existing.currentStock += b.remainingQty;
    supplierMap.set(b.supplierId, existing);
  });

  // Ensure all suppliers with sales are present in map
  supplierSalesMap.forEach((soldQty, sId) => {
    if (!supplierMap.has(sId)) {
      const supp = suppliers.find(s => s.id === sId);
      supplierMap.set(sId, {
        supplierId: sId,
        supplierName: supp?.name || (sId ? 'Supplier' : 'Direct Stock'),
        currentStock: 0,
        costPrice: product.cost_price || 0,
        totalPurchasedQty: 0,
        totalPurchasedAmount: 0,
        soldQty: 0
      });
    }
    const existing = supplierMap.get(sId)!;
    existing.soldQty = soldQty;
  });

  const salePrice = product.unit_price || product.mrp || 0;

  return Array.from(supplierMap.values()).map(supp => {
    const suppInfo = suppliers.find(s => s.id === supp.supplierId);
    const avgRate = supp.totalPurchasedQty > 0 ? (supp.totalPurchasedAmount / supp.totalPurchasedQty) : supp.costPrice;
    const purchasePrice = avgRate > 0 ? avgRate : supp.costPrice;
    const purchaseQty = supp.totalPurchasedQty;
    const purchaseAmount = supp.totalPurchasedAmount;
    const saleQty = supp.soldQty;
    const salesAmount = supplierRevenueMap.get(supp.supplierId) || (saleQty * salePrice);
    const availableStock = supp.currentStock;
    const stockValue = availableStock * purchasePrice;
    const expectedProfit = (salePrice - purchasePrice) * availableStock;
    const cogs = saleQty * purchasePrice;
    const profitLoss = salesAmount - cogs;
    const profit = profitLoss > 0 ? profitLoss : 0;
    const loss = profitLoss < 0 ? Math.abs(profitLoss) : 0;

    return {
      ...supp,
      supplier_sl: suppInfo?.sl_number || '-',
      avgRate,
      purchasePrice,
      purchaseQty,
      purchaseAmount,
      saleQty,
      salesAmount,
      availableStock,
      stockValue,
      expectedProfit,
      profit,
      loss
    };
  });
};

export const getProductStats = (
  product: InventoryItem,
  inventory: InventoryItem[],
  sales: Sale[],
  purchases: Purchase[],
  suppliers: Supplier[],
  supplierFilter: string = 'all'
): ItemProductStats => {
  const breakdown = getProductSupplierBreakdown(product, inventory, sales, purchases, suppliers);

  if (supplierFilter !== 'all') {
    const suppEntry = breakdown.find(b => b.supplierId === supplierFilter);
    if (!suppEntry) {
      return {
        purchaseQty: 0,
        purchaseAmount: 0,
        saleQty: 0,
        salesAmount: 0,
        availableStock: 0,
        stockValue: 0,
        cogs: 0,
        profitLoss: 0,
        profitMargin: 0,
        expectedProfit: 0,
        profit: 0,
        loss: 0,
        earn: 0,
        avgPurchasePrice: 0
      };
    }

    return {
      purchaseQty: suppEntry.purchaseQty,
      purchaseAmount: suppEntry.purchaseAmount,
      saleQty: suppEntry.saleQty,
      salesAmount: suppEntry.salesAmount,
      availableStock: suppEntry.availableStock,
      stockValue: suppEntry.stockValue,
      cogs: suppEntry.saleQty * suppEntry.purchasePrice,
      profitLoss: suppEntry.profit - suppEntry.loss,
      profitMargin: suppEntry.salesAmount > 0 ? ((suppEntry.profit - suppEntry.loss) / suppEntry.salesAmount) * 100 : 0,
      expectedProfit: suppEntry.expectedProfit,
      profit: suppEntry.profit,
      loss: suppEntry.loss,
      earn: suppEntry.profit,
      avgPurchasePrice: suppEntry.purchasePrice
    };
  }

  if (breakdown.length === 0) {
    const rawStock = Math.max(0, product.quantity || 0);
    const unitCost = product.cost_price || 0;
    const salePrice = product.unit_price || product.mrp || 0;
    return {
      purchaseQty: rawStock,
      purchaseAmount: rawStock * unitCost,
      saleQty: 0,
      salesAmount: 0,
      availableStock: rawStock,
      stockValue: rawStock * unitCost,
      cogs: 0,
      profitLoss: 0,
      profitMargin: 0,
      expectedProfit: (salePrice - unitCost) * rawStock,
      profit: 0,
      loss: 0,
      earn: 0,
      avgPurchasePrice: unitCost
    };
  }

  const purchaseQty = breakdown.reduce((sum, e) => sum + e.purchaseQty, 0);
  const purchaseAmount = breakdown.reduce((sum, e) => sum + e.purchaseAmount, 0);
  const saleQty = breakdown.reduce((sum, e) => sum + e.saleQty, 0);
  const salesAmount = breakdown.reduce((sum, e) => sum + e.salesAmount, 0);
  const availableStock = breakdown.reduce((sum, e) => sum + e.availableStock, 0);
  const stockValue = breakdown.reduce((sum, e) => sum + e.stockValue, 0);
  const expectedProfit = breakdown.reduce((sum, e) => sum + e.expectedProfit, 0);
  const profit = breakdown.reduce((sum, e) => sum + e.profit, 0);
  const loss = breakdown.reduce((sum, e) => sum + e.loss, 0);
  const cogs = breakdown.reduce((sum, e) => sum + (e.saleQty * e.purchasePrice), 0);
  const profitLoss = profit - loss;
  const profitMargin = salesAmount > 0 ? (profitLoss / salesAmount) * 100 : 0;
  const avgPurchasePrice = purchaseQty > 0 ? (purchaseAmount / purchaseQty) : (product.cost_price || 0);

  return {
    purchaseQty,
    purchaseAmount,
    saleQty,
    salesAmount,
    availableStock,
    stockValue,
    cogs,
    profitLoss,
    profitMargin,
    expectedProfit,
    profit,
    loss,
    earn: profit,
    avgPurchasePrice
  };
};

export interface InventoryOverviewStats {
  totalProducts: number;
  totalStockQuantity: number;
  stockCostValue: number;
  stockRetailValue: number;
  expectedProfit: number;
  expectedMarginPercent: string;
  totalPurchasesQty: number;
  totalPurchasesAmount: number;
  totalSaleQty: number;
  totalSalesAmount: number;
  totalProfit: number;
  totalLoss: number;
  itemsWithStats: (InventoryItem & { stats: ItemProductStats })[];
}

export const getInventoryOverviewStats = (
  inventory: InventoryItem[],
  sales: Sale[],
  purchases: Purchase[],
  suppliers: Supplier[]
): InventoryOverviewStats => {
  const grouped = groupInventoryByProduct(inventory);
  const itemsWithStats = grouped.map(item => ({
    ...item,
    stats: getProductStats(item, inventory, sales, purchases, suppliers, 'all')
  }));

  const totalProducts = itemsWithStats.length;
  const totalStockQuantity = itemsWithStats.reduce((sum, i) => sum + i.stats.availableStock, 0);
  const stockCostValue = itemsWithStats.reduce((sum, i) => sum + i.stats.stockValue, 0);
  const stockRetailValue = itemsWithStats.reduce((sum, i) => {
    const price = (typeof i.unit_price === 'number' && i.unit_price > 0) ? i.unit_price : (i.mrp || i.cost_price || 0);
    return sum + (i.stats.availableStock * price);
  }, 0);
  const expectedProfit = itemsWithStats.reduce((sum, i) => sum + i.stats.expectedProfit, 0);
  const expectedMarginPercent = stockRetailValue > 0 ? ((expectedProfit / stockRetailValue) * 100).toFixed(1) : '0';
  const totalPurchasesQty = itemsWithStats.reduce((sum, i) => sum + i.stats.purchaseQty, 0);
  const totalPurchasesAmount = itemsWithStats.reduce((sum, i) => sum + i.stats.purchaseAmount, 0);
  const totalSaleQty = itemsWithStats.reduce((sum, i) => sum + i.stats.saleQty, 0);
  const totalSalesAmount = itemsWithStats.reduce((sum, i) => sum + i.stats.salesAmount, 0);
  const totalProfit = itemsWithStats.reduce((sum, i) => sum + i.stats.profit, 0);
  const totalLoss = itemsWithStats.reduce((sum, i) => sum + i.stats.loss, 0);

  return {
    totalProducts,
    totalStockQuantity,
    stockCostValue,
    stockRetailValue,
    expectedProfit,
    expectedMarginPercent,
    totalPurchasesQty,
    totalPurchasesAmount,
    totalSaleQty,
    totalSalesAmount,
    totalProfit,
    totalLoss,
    itemsWithStats
  };
};

export interface SupplierOverallStats {
  supplierId: string;
  totalPurchasedQty: number;
  totalPurchasedAmount: number;
  totalSoldQty: number;
  totalSalesAmount: number;
  currentStockUnits: number;
  currentStockValue: number;
  totalProfit: number;
  totalLoss: number;
  netProfit: number;
  expectedProfit: number;
}

export const getSupplierOverallStats = (
  supplierId: string,
  inventory: InventoryItem[],
  sales: Sale[],
  purchases: Purchase[],
  suppliers: Supplier[]
): SupplierOverallStats => {
  const groupedProducts = groupInventoryByProduct(inventory);
  let totalPurchasedQty = 0;
  let totalPurchasedAmount = 0;
  let totalSoldQty = 0;
  let totalSalesAmount = 0;
  let currentStockUnits = 0;
  let currentStockValue = 0;
  let totalProfit = 0;
  let totalLoss = 0;
  let expectedProfit = 0;

  groupedProducts.forEach(product => {
    const breakdown = getProductSupplierBreakdown(product, inventory, sales, purchases, suppliers);
    const suppEntry = breakdown.find(b => b.supplierId === supplierId);
    if (suppEntry) {
      totalPurchasedQty += suppEntry.purchaseQty;
      totalPurchasedAmount += suppEntry.purchaseAmount;
      totalSoldQty += suppEntry.saleQty;
      totalSalesAmount += suppEntry.salesAmount;
      currentStockUnits += suppEntry.availableStock;
      currentStockValue += suppEntry.stockValue;
      totalProfit += suppEntry.profit;
      totalLoss += suppEntry.loss;
      expectedProfit += suppEntry.expectedProfit;
    }
  });

  return {
    supplierId,
    totalPurchasedQty,
    totalPurchasedAmount,
    totalSoldQty,
    totalSalesAmount,
    currentStockUnits,
    currentStockValue,
    totalProfit,
    totalLoss,
    netProfit: totalProfit - totalLoss,
    expectedProfit
  };
};

export const getProductImage = (item: { name?: string; category?: string; image_url?: string }): string => {
  if (item?.image_url && item.image_url.trim().length > 5) {
    return item.image_url;
  }
  const name = (item?.name || '').toLowerCase();
  const category = (item?.category || '').toLowerCase();

  // Soybean / Mustard / Cooking Oil
  if (name.includes('oil') || name.includes('soyabean') || name.includes('rupchanda') || name.includes('teel') || category.includes('oil')) {
    return 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=160&auto=format&fit=crop&q=80';
  }
  // Atta / Flour / Maida / Suji / Wheat
  if (name.includes('atta') || name.includes('flour') || name.includes('maida') || name.includes('suji') || name.includes('fresh atta') || category.includes('grain')) {
    return 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=160&auto=format&fit=crop&q=80';
  }
  // Salt / Tata Salt / Lobon
  if (name.includes('salt') || name.includes('tata') || name.includes('lobon') || category.includes('spice')) {
    return 'https://images.unsplash.com/photo-1518110925495-5fe2fda0442c?w=160&auto=format&fit=crop&q=80';
  }
  // Rice / Miniket / Nazirshail / Chal
  if (name.includes('rice') || name.includes('chal') || name.includes('chawal') || name.includes('miniket')) {
    return 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=160&auto=format&fit=crop&q=80';
  }
  // Sugar / Chini
  if (name.includes('sugar') || name.includes('chini')) {
    return 'https://images.unsplash.com/photo-1622484214470-7603c401aaef?w=160&auto=format&fit=crop&q=80';
  }
  // Tea / Ispahani / Taaza / Coffee
  if (name.includes('tea') || name.includes('cha') || name.includes('coffee') || name.includes('ispahani')) {
    return 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=160&auto=format&fit=crop&q=80';
  }
  // Biscuits / Cookies / Bakery
  if (name.includes('biscuit') || name.includes('cookie') || name.includes('cake') || category.includes('bakery')) {
    return 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=160&auto=format&fit=crop&q=80';
  }
  // Soap / Detergent / Cleaners
  if (name.includes('soap') || name.includes('shampoo') || name.includes('wheel') || name.includes('rin') || name.includes('detergent')) {
    return 'https://images.unsplash.com/photo-1607006314144-8833b3d1ff3d?w=160&auto=format&fit=crop&q=80';
  }
  // Default grocery package
  return 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=160&auto=format&fit=crop&q=80';
};

export interface OfficeAuditLot {
  id: string;
  item_name: string;
  sku?: string;
  supplier_id: string;
  supplier_name: string;
  supplier_sl: string;
  quantity: number;
  cost_price: number;
  unit_price: number;
  total_cost: number;
  total_sale: number;
  profit: number;
}

// Accurately resolve supplier lots and FIFO lot deductions for Office Copy Audit & PDF
export const resolveSaleOfficeAuditLots = (
  sale: Sale,
  inventoryList: InventoryItem[],
  purchasesList: Purchase[] = [],
  suppliersList: Supplier[] = [],
  salesList: Sale[] = []
): OfficeAuditLot[] => {
  const result: OfficeAuditLot[] = [];
  const items = sale.items || [];
  if (items.length === 0) return result;

  // Helper to identify same product
  const getProductKey = (sku?: string, name?: string, invId?: string) => {
    if (sku && sku.trim()) return `sku:${sku.trim().toLowerCase()}`;
    if (name && name.trim()) return `name:${name.trim().toLowerCase()}`;
    return `id:${invId || 'unknown'}`;
  };

  // Group sale items by product key so that line items of the same product are reconciled together
  const productGroups: { [key: string]: SaleItem[] } = {};
  items.forEach(item => {
    const key = getProductKey(item.sku, item.item_name, item.inventory_item_id);
    if (!productGroups[key]) productGroups[key] = [];
    productGroups[key].push(item);
  });

  Object.keys(productGroups).forEach(prodKey => {
    const groupItems = productGroups[prodKey];
    const firstItem = groupItems[0];
    const totalGroupQty = groupItems.reduce((sum, it) => sum + (it.quantity || 0), 0);
    const avgUnitPrice = groupItems.reduce((sum, it) => sum + ((it.quantity || 0) * (it.unit_price || 0)), 0) / (totalGroupQty || 1);

    // Find all matching inventory items for this product
    const matchingInv = inventoryList.filter(inv =>
      (firstItem.inventory_item_id && inv.id === firstItem.inventory_item_id) ||
      (firstItem.sku && inv.sku && inv.sku.trim().toLowerCase() === firstItem.sku.trim().toLowerCase()) ||
      (firstItem.item_name && inv.name && inv.name.trim().toLowerCase() === firstItem.item_name.trim().toLowerCase())
    );

    // Resolve intended supplier for this line item (e.g. SL-001)
    const intendedSupplier = suppliersList.find(s =>
      (firstItem.supplier_id && s.id === firstItem.supplier_id) ||
      (firstItem.supplier_sl && s.sl_number === firstItem.supplier_sl) ||
      (firstItem.supplier_name && s.name && s.name.trim().toLowerCase() === firstItem.supplier_name.trim().toLowerCase())
    ) || suppliersList.find(s =>
      matchingInv.some(i => i.supplier_id === s.id)
    ) || suppliersList.find(s => s.sl_number === 'SL-001') || suppliersList[0];

    const intendedSuppId = intendedSupplier?.id || firstItem.supplier_id || '';
    const intendedSuppName = intendedSupplier?.name || firstItem.supplier_name || (intendedSuppId ? 'Supplier' : 'Direct Stock');
    const intendedSuppSL = intendedSupplier?.sl_number || firstItem.supplier_sl || 'SL-001';

    interface BatchItem {
      supplierId: string;
      supplierName: string;
      supplierSL: string;
      quantity: number;
      costPrice: number;
      createdAt: number;
    }

    const batches: BatchItem[] = [];

    // 1. Gather purchase batches from purchase orders history
    purchasesList.forEach(p => {
      (p.items || []).forEach(pi => {
        const matches = (firstItem.sku && pi.sku && pi.sku.trim().toLowerCase() === firstItem.sku.trim().toLowerCase()) ||
          (firstItem.item_name && pi.item_name && pi.item_name.trim().toLowerCase() === firstItem.item_name.trim().toLowerCase()) ||
          (matchingInv.some(inv => inv.id === pi.inventory_item_id));

        if (matches) {
          const supp = suppliersList.find(s => s.id === p.supplier_id);
          const suppId = p.supplier_id || '';
          const suppAvgCost = resolveItemCost(
            { ...firstItem, supplier_id: suppId, inventory_item_id: pi.inventory_item_id || firstItem.inventory_item_id },
            inventoryList,
            purchasesList
          );
          batches.push({
            supplierId: suppId,
            supplierName: supp?.name || (suppId ? 'Supplier' : 'Direct Stock'),
            supplierSL: supp?.sl_number || (suppId ? 'SL-999' : '-'),
            quantity: pi.quantity || 0,
            costPrice: suppAvgCost > 0 ? suppAvgCost : (pi.unit_price || 0),
            createdAt: new Date(p.created_at || 0).getTime()
          });
        }
      });
    });

    // 2. Gather opening/direct stock from inventory items with assigned suppliers
    matchingInv.forEach(inv => {
      const supp = suppliersList.find(s => s.id === inv.supplier_id);
      const suppId = inv.supplier_id || '';
      const existsInBatches = batches.some(b => b.supplierId && suppId && b.supplierId === suppId);
      if (!existsInBatches) {
        const suppAvgCost = resolveItemCost(
          { ...firstItem, supplier_id: suppId, inventory_item_id: inv.id },
          inventoryList,
          purchasesList
        );
        // Calculate prior sales assigned to this supplier item to reconstruct original initial stock
        let suppPriorSales = 0;
        salesList.forEach(s => {
          (s.items || []).forEach(si => {
            if (si.inventory_item_id === inv.id || (si.supplier_id && suppId && si.supplier_id === suppId)) {
              suppPriorSales += (si.quantity || 0);
            }
          });
        });

        batches.push({
          supplierId: suppId,
          supplierName: supp?.name || (suppId ? 'Supplier' : 'Direct Stock'),
          supplierSL: supp?.sl_number || (suppId ? 'SL-999' : '-'),
          quantity: (inv.quantity || 0) + suppPriorSales,
          costPrice: suppAvgCost > 0 ? suppAvgCost : (inv.cost_price || 0),
          createdAt: new Date(inv.created_at || 0).getTime()
        });
      }
    });

    // 3. Fallback batch if no PO or inventory batch existed
    if (batches.length === 0) {
      const suppAvgCost = resolveItemCost(
        { ...firstItem, supplier_id: intendedSuppId, inventory_item_id: matchingInv[0]?.id },
        inventoryList,
        purchasesList
      );
      batches.push({
        supplierId: intendedSuppId,
        supplierName: intendedSuppName,
        supplierSL: intendedSuppSL,
        quantity: 999999,
        costPrice: suppAvgCost > 0 ? suppAvgCost : (matchingInv[0]?.cost_price || firstItem.cost_price || 0),
        createdAt: 0
      });
    }

    // Sort all batches strictly by Supplier SL number (e.g. SL-001 first, then SL-002), then createdAt (FIFO)
    batches.sort((a, b) => {
      const slA = (a.supplierSL && a.supplierSL !== '-') ? a.supplierSL : 'SL-9999';
      const slB = (b.supplierSL && b.supplierSL !== '-') ? b.supplierSL : 'SL-9999';
      if (slA !== slB) {
        return slA.localeCompare(slB, undefined, { numeric: true });
      }
      return a.createdAt - b.createdAt;
    });

    // 4. Calculate total quantity sold across all PRIOR sales for this product
    let priorSoldQty = 0;
    const currentSaleDate = new Date(sale.created_at || 0).getTime();

    salesList.forEach(s => {
      const sDate = new Date(s.created_at || 0).getTime();
      const isPrior = (sDate < currentSaleDate) || (sDate === currentSaleDate && s.id < sale.id);
      if (isPrior) {
        (s.items || []).forEach(si => {
          const matches = (firstItem.sku && si.sku && si.sku.trim().toLowerCase() === firstItem.sku.trim().toLowerCase()) ||
            (firstItem.item_name && si.item_name && si.item_name.trim().toLowerCase() === firstItem.item_name.trim().toLowerCase()) ||
            (matchingInv.some(inv => inv.id === si.inventory_item_id));
          if (matches) {
            priorSoldQty += (si.quantity || 0);
          }
        });
      }
    });

    // 5. Deduct prior sold quantity sequentially from batches
    let priorDeduct = priorSoldQty;
    const activeBatches = batches.map(b => {
      const d = Math.min(b.quantity, priorDeduct);
      priorDeduct -= d;
      return {
        ...b,
        remainingQty: Math.max(0, b.quantity - d)
      };
    });

    // 6. Allocate this sale's quantity sequentially from available batches
    let needed = totalGroupQty;
    const available = activeBatches.filter(b => b.remainingQty > 0);

    for (const b of available) {
      if (needed <= 0) break;
      const takeQty = Math.min(b.remainingQty, needed);
      b.remainingQty -= takeQty;
      needed -= takeQty;

      const suppAvgCost = resolveItemCost(
        { ...firstItem, supplier_id: b.supplierId, inventory_item_id: matchingInv.find(i => i.supplier_id === b.supplierId)?.id || firstItem.inventory_item_id },
        inventoryList,
        purchasesList
      );
      const unitCost = suppAvgCost > 0 ? suppAvgCost : (b.costPrice > 0 ? b.costPrice : 0);
      const unitSale = avgUnitPrice;
      const totalCost = takeQty * unitCost;
      const totalSale = takeQty * unitSale;
      const profit = totalSale - totalCost;

      result.push({
        id: `${sale.id}_${prodKey}_${b.supplierId}_${b.supplierSL}_${result.length}`,
        item_name: firstItem.item_name || matchingInv[0]?.name || 'Product',
        sku: firstItem.sku || matchingInv[0]?.sku || '',
        supplier_id: b.supplierId,
        supplier_name: b.supplierName,
        supplier_sl: b.supplierSL,
        quantity: takeQty,
        cost_price: unitCost,
        unit_price: unitSale,
        total_cost: totalCost,
        total_sale: totalSale,
        profit: profit
      });
    }

    // 7. If still needed (batches exhausted or oversold), assign to intended supplier
    if (needed > 0) {
      const suppAvgCost = resolveItemCost(
        { ...firstItem, supplier_id: intendedSuppId, inventory_item_id: matchingInv[0]?.id || firstItem.inventory_item_id },
        inventoryList,
        purchasesList
      );
      const unitCost = suppAvgCost > 0 ? suppAvgCost : (matchingInv[0]?.cost_price || firstItem.cost_price || 0);
      const totalCost = needed * unitCost;
      const totalSale = needed * avgUnitPrice;
      result.push({
        id: `${sale.id}_${prodKey}_fallback_${result.length}`,
        item_name: firstItem.item_name || matchingInv[0]?.name || 'Product',
        sku: firstItem.sku || matchingInv[0]?.sku || '',
        supplier_id: intendedSuppId,
        supplier_name: intendedSuppName,
        supplier_sl: intendedSuppSL,
        quantity: needed,
        cost_price: unitCost,
        unit_price: avgUnitPrice,
        total_cost: totalCost,
        total_sale: totalSale,
        profit: totalSale - totalCost
      });
    }
  });

  // Group and merge lots of the same product, supplier, cost price, and unit price
  const mergedResult: OfficeAuditLot[] = [];
  const resultMap = new Map<string, OfficeAuditLot>();

  result.forEach(lot => {
    // Generate a unique key based on item, supplier, cost price, and unit price
    const key = `${lot.sku || ''}_${lot.item_name || ''}_${lot.supplier_id || ''}_${lot.supplier_sl || ''}_${lot.cost_price}_${lot.unit_price}`;
    
    if (resultMap.has(key)) {
      const existingLot = resultMap.get(key)!;
      existingLot.quantity += lot.quantity;
      existingLot.total_cost += lot.total_cost;
      existingLot.total_sale += lot.total_sale;
      existingLot.profit += lot.profit;
    } else {
      resultMap.set(key, { ...lot });
    }
  });

  return Array.from(resultMap.values());
};

