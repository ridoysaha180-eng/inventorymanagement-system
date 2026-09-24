import re

with open('src/pages/Sales.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add the state
if 'const [invoiceCopyType, setInvoiceCopyType]' not in content:
    content = content.replace("const [isScannerOpen, setIsScannerOpen] = useState(false);",
                              "const [isScannerOpen, setIsScannerOpen] = useState(false);\n  const [invoiceCopyType, setInvoiceCopyType] = useState<'customer' | 'office' | 'both'>('customer');")

# Find the start and end of the modal
start_marker = '<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-100 print:static print:p-0 print:bg-white print:block">'
# We will replace everything from start_marker to just before {/* Barcode Scanner Modal */}
end_marker = '{/* Barcode Scanner Modal */}'

# Wait, the closing tags are:
#         </div>
#         );
#       })()}
end_part_pattern = r'</Card>\s*</div>\s*</div>\s*\);\s*\}\)\(\)\}'

new_modal_content = """        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-100 print:static print:p-0 print:bg-white print:block">
          <style>{`
            @media print {
              @page { margin: 10mm; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
              body > *:not(#root) { display: none; }
              #root > *:not(.print-modal-container) { display: none; }
              .page-break { page-break-before: always; }
            }
          `}</style>
          <div className="print-modal-container w-full h-full flex flex-col print:block print:w-full print:max-w-none print:h-auto">
            <Card className="w-full h-full p-0 overflow-hidden shadow-none rounded-none border-none flex flex-col print:shadow-none print:border-none print:rounded-none print:overflow-visible">
              <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-b border-slate-200 bg-white print:hidden gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-700">Select Invoice Copy Type:</span>
                  <div className="flex bg-slate-100 rounded-lg p-1">
                    <button 
                      onClick={() => setInvoiceCopyType('customer')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${invoiceCopyType === 'customer' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      Customer Copy
                    </button>
                    <button 
                      onClick={() => setInvoiceCopyType('office')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${invoiceCopyType === 'office' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      Office Copy (Supplier SL & Profit)
                    </button>
                    <button 
                      onClick={() => setInvoiceCopyType('both')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${invoiceCopyType === 'both' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      Both Copies
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => handleDownloadPDF(selectedSale.id)}
                    className="bg-slate-100 text-slate-700 font-bold px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2 text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className="bg-primary-600 text-white font-bold px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2 text-sm"
                  >
                    <Printer className="w-4 h-4" />
                    Print (selected)
                  </button>
                  <button onClick={() => setSelectedSale(null)} className="text-slate-400 hover:text-slate-600 ml-2">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100 print:bg-white print:p-0 print:overflow-visible flex flex-col items-center gap-8" id="invoice-content-wrapper">
                
                {['customer', 'office'].map((type, index) => {
                  if (invoiceCopyType !== 'both' && invoiceCopyType !== type) return null;
                  
                  const isOffice = type === 'office';
                  let totalCOGS = 0;
                  if (isOffice) {
                    safeItems.forEach(item => {
                      const invItem = inventory.find(i => i.id === item.inventory_item_id);
                      const cost = invItem ? invItem.cost_price : 0;
                      totalCOGS += (cost * item.quantity);
                    });
                  }
                  const grossProfit = safeSubtotal - totalCOGS;
                  const netProfit = safeTotal - totalCOGS; // total after discount/tax minus COGS
                  
                  return (
                    <div key={type} className={`border border-slate-200 shadow-sm p-8 rounded-lg relative bg-white w-full max-w-[210mm] min-h-[148mm] print:border-none print:shadow-none print:p-0 print:max-w-none print:min-h-0 ${index > 0 ? 'page-break' : ''}`}>
                      
                      {/* Top Row: Customer Info, Shop Info, Invoice Info */}
                      <div className="flex justify-between items-start mb-8">
                        {/* Left: Customer */}
                        <div className="w-1/3">
                          <h3 className="font-bold text-slate-800 text-sm mb-1 uppercase">Customer: {customers.find(c => c.id === selectedSale.customer_id)?.name || 'Walking Customer'}</h3>
                          <p className="text-slate-600 text-xs mb-0.5">Mobile: {customers.find(c => c.id === selectedSale.customer_id)?.phone || '01700000000'}</p>
                          <p className="text-slate-600 text-xs">Address: {customers.find(c => c.id === selectedSale.customer_id)?.address || 'Counter / Cash'}</p>
                        </div>
                        
                        {/* Center: Shop Details */}
                        <div className="w-1/3 text-center flex flex-col items-center">
                          <div className="border-2 border-red-600 text-red-600 font-bold px-3 py-1 rounded-lg inline-block text-xl tracking-wider mb-2">OKY</div>
                          <h1 className="text-2xl font-black text-slate-900 mb-1 uppercase">{businessSettings.name || 'SUPPER SHOP'}</h1>
                          <p className="text-xs text-slate-600">{businessSettings.address}</p>
                          <p className="text-xs text-slate-600">Email: contact@shop.com</p>
                          <p className="text-xs text-slate-600 font-medium mt-1">Support: {businessSettings.phone}</p>
                        </div>
                        
                        {/* Right: Invoice Info */}
                        <div className="w-1/3 flex flex-col items-end">
                          <div className={`px-4 py-1 border-2 text-sm font-bold uppercase tracking-wider mb-3 inline-block ${isOffice ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-800 text-slate-800'}`}>
                            {isOffice ? 'Office Copy' : 'Customer Copy'}
                          </div>
                          <p className="text-slate-800 text-xs font-bold mb-1 uppercase">Invoice No: {selectedSale.id}</p>
                          {/* Fake barcode using flex boxes */}
                          <div className="flex h-10 w-48 bg-white my-2 border-x-4 border-slate-900">
                             {Array.from({length: 30}).map((_, i) => (
                               <div key={i} className="h-full bg-slate-900" style={{width: Math.random() > 0.5 ? '2px' : '4px', margin: Math.random() > 0.5 ? '0 1px' : '0 2px'}}></div>
                             ))}
                          </div>
                          <p className="text-slate-500 text-[10px]">Date: {new Date(selectedSale.created_at).toLocaleString()}</p>
                        </div>
                      </div>

                      {isOffice && (
                         <div className="bg-slate-800 text-white text-xs font-bold px-2 py-1 mb-2 uppercase tracking-wider text-center">
                           Products & Supplier SL Breakdown (FIFO Allocation)
                         </div>
                      )}

                      {/* Table */}
                      <table className="w-full mb-6 border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-100 border-y border-slate-300">
                            <th className="py-2 px-2 text-left text-slate-800 font-bold w-12 border-r border-slate-300">SL</th>
                            <th className="py-2 px-2 text-left text-slate-800 font-bold border-r border-slate-300">PRODUCT</th>
                            {isOffice && <th className="py-2 px-2 text-left text-slate-800 font-bold border-r border-slate-300 text-xs">SUPPLIER</th>}
                            <th className="py-2 px-2 text-center text-slate-800 font-bold w-16 border-r border-slate-300">QTY</th>
                            <th className="py-2 px-2 text-right text-slate-800 font-bold w-24 border-r border-slate-300">PRICE</th>
                            <th className="py-2 px-2 text-right text-slate-800 font-bold w-24">TOTAL</th>
                          </tr>
                        </thead>
                        <tbody className="border-b border-slate-300">
                          {safeItems.map((item, i) => {
                            const invItem = inventory.find(inv => inv.id === item.inventory_item_id);
                            return (
                              <tr key={i} className="border-b border-slate-200 last:border-b-0">
                                <td className="py-2 px-2 text-left text-slate-700 border-r border-slate-200">{i + 1}</td>
                                <td className="py-2 px-2 text-left text-slate-700 border-r border-slate-200">
                                  <div className="font-bold">{item.item_name}</div>
                                  <div className="text-[10px] text-slate-500">#{invItem?.sku || 'N/A'}</div>
                                </td>
                                {isOffice && (
                                  <td className="py-2 px-2 text-left text-slate-700 border-r border-slate-200 text-xs">
                                    {suppliers.find(s => s.id === invItem?.supplier_id)?.name || '-'}
                                  </td>
                                )}
                                <td className="py-2 px-2 text-center text-slate-700 border-r border-slate-200">{item.quantity}</td>
                                <td className="py-2 px-2 text-right text-slate-700 border-r border-slate-200">{item.unit_price.toFixed(2)}</td>
                                <td className="py-2 px-2 text-right text-slate-700 font-medium">{(item.quantity * item.unit_price).toFixed(2)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      <div className="flex justify-between">
                        {/* Bottom Left: Info */}
                        <div className="w-1/2 pr-4 space-y-4">
                           {isOffice ? (
                             <div className="border border-slate-300 rounded p-4">
                               <div className="flex justify-between items-center mb-2 border-b border-slate-200 pb-2">
                                 <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2"><span className="text-emerald-500">📈</span> Invoice Net Profit Breakdown</h4>
                                 <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Net Margin: {safeSubtotal > 0 ? ((netProfit / safeSubtotal) * 100).toFixed(1) : 0}%</span>
                               </div>
                               <div className="flex justify-between items-center">
                                 <div className="w-1/3">
                                   <p className="text-[10px] text-slate-500 uppercase">Total Sales</p>
                                   <p className="text-sm font-bold text-slate-800">{safeSubtotal.toFixed(2)}</p>
                                 </div>
                                 <div className="w-1/3 text-center">
                                   <p className="text-[10px] text-slate-500 uppercase">Total Cost (COGS)</p>
                                   <p className="text-sm font-bold text-red-600">-{totalCOGS.toFixed(2)}</p>
                                 </div>
                                 <div className="w-1/3 text-right">
                                   <p className="text-[10px] text-slate-500 uppercase">Net Profit</p>
                                   <p className={`text-lg font-black ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                     {netProfit >= 0 ? '+' : ''}{netProfit.toFixed(2)}
                                   </p>
                                 </div>
                               </div>
                             </div>
                           ) : (
                             <>
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
                             </>
                           )}
                        </div>

                        {/* Bottom Right: Summary */}
                        <div className="w-1/3">
                          {isOffice ? (
                            <div className="space-y-1 text-sm border border-slate-300 rounded p-3">
                              <div className="flex justify-between text-slate-600">
                                <span>Gross Subtotal:</span>
                                <span>{safeSubtotal.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-slate-600">
                                <span>Cost of Goods (COGS):</span>
                                <span className="text-red-600">-{totalCOGS.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between font-bold text-slate-800 pt-1 border-t border-slate-200">
                                <span>Gross Profit:</span>
                                <span>{(safeSubtotal - totalCOGS).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-slate-600 pt-1">
                                <span>Discount Given:</span>
                                <span className="text-red-600">-{safeDiscount.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-slate-600">
                                <span>Tax/VAT Collected:</span>
                                <span>+{safeTax.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between font-black text-emerald-700 text-base py-1 my-1 border-y border-slate-200 bg-emerald-50 px-1">
                                <span>INVOICE NET PROFIT:</span>
                                <span>+{netProfit.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between font-bold text-slate-800">
                                <span>Invoice Bill to Customer:</span>
                                <span>{safeTotal.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between font-bold text-slate-800">
                                <span>Cash Received:</span>
                                <span>{safeTotal.toFixed(2)}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between text-slate-600">
                                <span>Subtotal:</span>
                                <span>{safeSubtotal.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-slate-600">
                                <span>Discount:</span>
                                <span>{safeDiscount.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-slate-600">
                                <span>Tax/VAT:</span>
                                <span>{safeTax.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between font-bold text-slate-900 text-base pt-2 border-t border-slate-300">
                                <span>Invoice Total:</span>
                                <span>{safeTotal.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-slate-600 pt-2">
                                <span>Paid Amount:</span>
                                <span>{safeTotal.toFixed(2)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Footer Signatures */}
                      <div className="mt-16 flex justify-between px-8 text-xs text-slate-800 font-bold uppercase">
                         <div className="border-t border-slate-800 pt-2 w-48 text-center">{isOffice ? 'Prepared By (Cashier)' : 'Customer Signature'}</div>
                         <div className="border-t border-slate-800 pt-2 w-48 text-center">{isOffice ? 'Store Keeper / Dispatch' : 'Authorization Signature'}</div>
                         {isOffice && <div className="border-t border-slate-800 pt-2 w-48 text-center">Accounts & Audit Approved</div>}
                      </div>

                      {/* Footer text */}
                      {!isOffice && (
                        <div className="mt-8 text-center text-xs text-slate-500 italic">
                          "Thank you for shopping with us! Please come again."
                        </div>
                      )}
                      
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>"""

# Replace
pattern = re.compile(r'<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-100 print:static print:p-0 print:bg-white print:block">.*?</Card>\s*</div>\s*</div>', re.DOTALL)
content = pattern.sub(new_modal_content, content)

with open('src/pages/Sales.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
