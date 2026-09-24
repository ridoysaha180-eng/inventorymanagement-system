import re

with open('src/pages/Sales.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Import QRCode
if "import QRCode from 'react-qr-code';" not in content:
    content = content.replace("import { Card }", "import QRCode from 'react-qr-code';\nimport { Card }")


# 2. Update saleId generation
sale_id_old = """      let saleId = editingSaleId;
      if (!isEditMode) {
        const today = new Date();
        const dateStr = today.getFullYear().toString() + 
                        (today.getMonth() + 1).toString().padStart(2, '0') + 
                        today.getDate().toString().padStart(2, '0');
        
        const todaySales = sales.filter(s => s.id.startsWith(dateStr));
        const sequence = (todaySales.length + 1).toString().padStart(2, '0');
        saleId = `${dateStr}${sequence}`;
      }"""

sale_id_new = """      let saleId = editingSaleId;
      if (!isEditMode) {
        // Find highest existing sequence if any
        let maxSeq = 0;
        for (const s of sales) {
          if (!isNaN(Number(s.id))) {
            maxSeq = Math.max(maxSeq, Number(s.id));
          }
        }
        saleId = (maxSeq + 1).toString().padStart(6, '0');
      }"""
content = content.replace(sale_id_old, sale_id_new)


# 3. Update the Center: Shop Details
shop_details_old = """                        {/* Center: Shop Details */}
                        <div className="w-1/3 text-center flex flex-col items-center">
                          <div className="border-2 border-red-600 text-red-600 font-bold px-3 py-1 rounded-lg inline-block text-xl tracking-wider mb-2">OKY</div>
                          <h1 className="text-2xl font-black text-slate-900 mb-1 uppercase">{businessSettings.name || 'SUPPER SHOP'}</h1>
                          <p className="text-xs text-slate-600">{businessSettings.address}</p>
                          <p className="text-xs text-slate-600">Email: contact@shop.com</p>
                          <p className="text-xs text-slate-600 font-medium mt-1">Support: {businessSettings.phone}</p>
                        </div>"""

shop_details_new = """                        {/* Center: Shop Details */}
                        <div className="w-1/3 text-center flex flex-col items-center">
                          {businessSettings.logo ? (
                            <img src={businessSettings.logo} alt="Logo" className="h-12 w-auto mb-2 object-contain" />
                          ) : (
                            <div className="border-2 border-slate-800 text-slate-800 font-bold px-3 py-1 rounded-lg inline-block text-xl tracking-wider mb-2">SHOP</div>
                          )}
                          {businessSettings.name && <h1 className="text-2xl font-black text-slate-900 mb-1 uppercase">{businessSettings.name}</h1>}
                          {businessSettings.address && <p className="text-xs text-slate-600">{businessSettings.address}</p>}
                          {businessSettings.email && <p className="text-xs text-slate-600">Email: {businessSettings.email}</p>}
                          {businessSettings.phone && <p className="text-xs text-slate-600 font-medium mt-1">Support: {businessSettings.phone}</p>}
                        </div>"""
content = content.replace(shop_details_old, shop_details_new)


# 4. Remove fake barcode and use QR Code
barcode_old = """                          {/* Fake barcode using flex boxes */}
                          <div className="flex h-10 w-48 bg-white my-2 border-x-4 border-slate-900">
                             {Array.from({length: 30}).map((_, i) => (
                               <div key={i} className="h-full bg-slate-900" style={{width: (i % 2 === 0 || i % 5 === 0) ? '2px' : '4px', margin: (i % 3 === 0) ? '0 1px' : '0 2px'}}></div>
                             ))}
                          </div>"""

barcode_new = """                          {/* QR Code */}
                          <div className="my-2 p-1 bg-white border border-slate-200 rounded inline-block">
                            <QRCode value={`${window.location.origin}/invoice/${selectedSale.id}`} size={64} />
                          </div>"""
content = content.replace(barcode_old, barcode_new)


# 5. Remove SKU
sku_old = """                                  <div className="text-[10px] text-slate-500">#{invItem?.sku || 'N/A'}</div>"""
content = content.replace(sku_old, "")


# 6. Remove Total Item, Total Qty, Payment Method from Customer Copy
customer_copy_bottom_old = """                             <>
                               <div className="mb-2">
                                 <span className="font-bold text-slate-800 text-sm">In Word:</span> <span className="text-slate-600 text-sm italic capitalize">Thirty Five Taka Only.</span> {/* Hardcoded for UI demo as requested */}
                               </div>
                               <div className="flex gap-6 mb-2 text-sm">
                                 <div><span className="font-bold text-slate-800">Total Item:</span> <span className="text-slate-600">{safeItems.length}</span></div>
                                 <div><span className="font-bold text-slate-800">Total Qty:</span> <span className="text-slate-600">{safeItems.reduce((sum, item) => sum + item.quantity, 0)}</span></div>
                               </div>
                               <div className="mb-2">
                                 <span className="font-bold text-slate-800 text-sm">Payment Method:</span> <span className="text-slate-600 text-sm capitalize">{selectedSale.payment_method}</span>
                               </div>
                             </>"""

customer_copy_bottom_new = """                             <>
                               <div className="mb-2">
                                 <span className="font-bold text-slate-800 text-sm">In Word:</span> <span className="text-slate-600 text-sm italic capitalize">Thirty Five Taka Only.</span> {/* Hardcoded for UI demo as requested */}
                               </div>
                             </>"""
content = content.replace(customer_copy_bottom_old, customer_copy_bottom_new)

with open('src/pages/Sales.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
