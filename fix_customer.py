import re

with open('src/pages/Sales.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

customer_old = """                        {/* Left: Customer */}
                        <div className="w-1/3">
                          <h3 className="font-bold text-slate-800 text-sm mb-1 uppercase">Customer: {customers.find(c => c.id === selectedSale.customer_id)?.name || 'Walking Customer'}</h3>
                          <p className="text-slate-600 text-xs mb-0.5">Mobile: {customers.find(c => c.id === selectedSale.customer_id)?.phone || '01700000000'}</p>
                          <p className="text-slate-600 text-xs">Address: {customers.find(c => c.id === selectedSale.customer_id)?.address || 'Counter / Cash'}</p>
                        </div>"""

customer_new = """                        {/* Left: Customer */}
                        <div className="w-1/3">
                          {(() => {
                            const customer = customers.find(c => c.id === selectedSale.customer_id);
                            return (
                              <>
                                <h3 className="font-bold text-slate-800 text-sm mb-1 uppercase">
                                  Customer: {customer?.name || 'Walking Customer'}
                                </h3>
                                {customer?.phone && (
                                  <p className="text-slate-600 text-xs mb-0.5">Mobile: {customer.phone}</p>
                                )}
                                {customer?.address && (
                                  <p className="text-slate-600 text-xs">Address: {customer.address}</p>
                                )}
                              </>
                            );
                          })()}
                        </div>"""

content = content.replace(customer_old, customer_new)

with open('src/pages/Sales.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
