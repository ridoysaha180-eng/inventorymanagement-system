import React from 'react';
import QRCode from 'react-qr-code';
import { Printer, ShoppingBag, Truck, Calendar, Phone, Mail, MapPin, CheckCircle2, Clock } from 'lucide-react';
import { Sale, Purchase, Customer, Supplier, BusinessSettings } from '../../types';
import { formatCurrency } from '../../utils';

interface InvoiceViewerProps {
  sale?: Sale;
  purchase?: Purchase;
  businessSettings: BusinessSettings;
  customer?: Customer;
  supplier?: Supplier;
  isDeleted?: boolean;
  deletedAt?: string;
}

export const InvoiceViewer: React.FC<InvoiceViewerProps> = ({
  sale,
  purchase,
  businessSettings,
  customer,
  supplier,
  isDeleted = false,
  deletedAt
}) => {
  const isSale = !!sale;
  const data = sale || purchase;

  if (!data) return null;

  const invoiceId = isSale ? (sale.id || '') : (purchase?.id || '');
  const invoiceDate = data.created_at || (data as any).date || new Date().toISOString();
  
  const subtotal = isSale 
    ? (sale.subtotal || sale.total_amount || 0)
    : (purchase?.total_amount || 0);

  const discount = isSale ? (sale.discount_amount || sale.discount || 0) : 0;
  const tax = isSale ? (sale.tax_amount || sale.tax || 0) : 0;
  const grandTotal = Number(data.total_amount || 0);
  
  const paidAmount = isSale 
    ? (sale.paid_amount !== undefined ? sale.paid_amount : (sale.payment_method === 'cash' ? grandTotal : 0))
    : (purchase?.paid_amount !== undefined ? purchase.paid_amount : grandTotal);

  const dueAmount = isSale
    ? (sale.due_amount !== undefined ? sale.due_amount : Math.max(0, grandTotal - paidAmount))
    : (purchase?.due_amount !== undefined ? purchase.due_amount : Math.max(0, grandTotal - paidAmount));

  const items = (data.items || []) as any[];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Print Controls Bar */}
      <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 print:hidden">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-primary-100 text-primary-800 rounded-lg text-xs font-bold uppercase tracking-wider">
            {isSale ? 'Official Sales Invoice' : 'Purchase Voucher / Bill'}
          </span>
          {isDeleted && (
            <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-lg text-xs font-bold uppercase tracking-wider">
              Recycle Bin Copy
            </span>
          )}
        </div>
        <button
          onClick={handlePrint}
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5 text-slate-600" />
          <span>Print / Save PDF</span>
        </button>
      </div>

      {/* Invoice Document Canvas */}
      <div className="trash-invoice-print-sheet bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs text-slate-800 relative overflow-hidden">
        
        {/* Deleted Watermark Banner if in Recycle Bin */}
        {isDeleted && (
          <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center justify-between text-xs text-rose-800 print:border-slate-300">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                <strong>Note:</strong> This {isSale ? 'Sale Invoice' : 'Purchase Bill'} was moved to the Recycle Bin{deletedAt ? ` on ${new Date(deletedAt).toLocaleString()}` : ''}.
              </span>
            </div>
            <span className="font-mono text-[11px] font-bold uppercase bg-rose-200/70 px-2 py-0.5 rounded">
              Deleted Record
            </span>
          </div>
        )}

        {/* Invoice Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-slate-200">
          
          {/* Shop Branding */}
          <div className="space-y-1 max-w-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary-600 text-white flex items-center justify-center font-black text-base shadow-xs">
                {(businessSettings.name || 'B').charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">
                  {businessSettings.name || 'BIZFLOW POINT'}
                </h1>
                {businessSettings.tagline && (
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">{businessSettings.tagline}</p>
                )}
              </div>
            </div>
            
            <div className="pt-2 text-xs text-slate-600 space-y-0.5 leading-relaxed">
              {businessSettings.address && (
                <p className="flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>{businessSettings.address}</span>
                </p>
              )}
              {businessSettings.phone && (
                <p className="flex items-center gap-1.5">
                  <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>{businessSettings.phone}</span>
                </p>
              )}
              {businessSettings.email && (
                <p className="flex items-center gap-1.5">
                  <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>{businessSettings.email}</span>
                </p>
              )}
            </div>
          </div>

          {/* Invoice ID, Date & QR Code */}
          <div className="flex items-start gap-4 sm:text-right">
            <div>
              <div className="inline-block px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-black uppercase tracking-wider mb-2">
                {isSale ? 'Tax Invoice / Bill' : 'Purchase Bill'}
              </div>
              <p className="text-sm font-black text-slate-900 font-mono">
                #{isSale ? 'INV-' : 'PUR-'}{invoiceId.slice(-8).toUpperCase()}
              </p>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Date: {new Date(invoiceDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
              <p className="text-[11px] text-slate-400 font-medium">
                Time: {new Date(invoiceDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            <div className="hidden sm:block p-1.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <QRCode value={`${isSale ? 'INV' : 'PUR'}-${invoiceId}`} size={64} />
            </div>
          </div>
        </div>

        {/* Bill To / Supplier Details */}
        <div className="py-4 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              {isSale ? 'Billed To (Customer):' : 'Purchased From (Supplier):'}
            </span>
            {isSale ? (
              <div className="space-y-0.5">
                <p className="text-sm font-extrabold text-slate-900">
                  {customer?.name || (sale as any).customer_name || 'Walk-in Customer'}
                </p>
                {(customer?.phone || (sale as any).customer_phone) && (
                  <p className="text-slate-600 font-medium">
                    Phone: {customer?.phone || (sale as any).customer_phone}
                  </p>
                )}
                {customer?.address && (
                  <p className="text-slate-500">Address: {customer.address}</p>
                )}
              </div>
            ) : (
              <div className="space-y-0.5">
                <p className="text-sm font-extrabold text-slate-900">
                  {supplier?.name || (purchase as any).supplier_name || 'Supplier'}
                </p>
                {supplier?.company && (
                  <p className="text-slate-600 font-medium">Company: {supplier.company}</p>
                )}
                {(supplier?.phone || (purchase as any).supplier_phone) && (
                  <p className="text-slate-600 font-medium">
                    Phone: {supplier?.phone || (purchase as any).supplier_phone}
                  </p>
                )}
                {supplier?.address && (
                  <p className="text-slate-500">Address: {supplier.address}</p>
                )}
              </div>
            )}
          </div>

          <div className="sm:text-right space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Payment & Status:
            </span>
            <div className="inline-flex items-center gap-1.5">
              <span className="text-slate-600 font-medium">Payment Method:</span>
              <span className="font-bold text-slate-900 uppercase bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                {data.payment_method || 'Cash'}
              </span>
            </div>
            <div>
              <span className="text-slate-600 font-medium">Payment Status: </span>
              {dueAmount <= 0 ? (
                <span className="font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[11px] inline-block">
                  PAID IN FULL
                </span>
              ) : paidAmount > 0 ? (
                <span className="font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px] inline-block">
                  PARTIAL (DUE)
                </span>
              ) : (
                <span className="font-extrabold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-[11px] inline-block">
                  UNPAID / DUE
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Itemized Table */}
        <div className="py-4">
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Item Description</th>
                  <th className="py-2.5 px-3 text-center w-16">Qty</th>
                  <th className="py-2.5 px-3 text-right w-24">Unit Price</th>
                  <th className="py-2.5 px-3 text-right w-28">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400 italic">
                      No items recorded for this invoice.
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => {
                    const itemName = item.item_name || item.name || 'Product';
                    const itemQty = item.quantity || 1;
                    const itemPrice = Number(item.unit_price || item.price || 0);
                    const itemTotal = Number(item.total || (itemQty * itemPrice));

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-900 block">{itemName}</span>
                          {item.sku && (
                            <span className="text-[10px] font-mono text-slate-400">SKU: {item.sku}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                          {itemQty}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          ৳{formatCurrency(itemPrice)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold font-mono text-slate-900">
                          ৳{formatCurrency(itemTotal)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Invoice Summary & Totals */}
        <div className="pt-2 pb-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="space-y-2 max-w-sm text-xs text-slate-500">
            {data.notes && (
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-700 block mb-0.5">Notes:</span>
                <p className="text-slate-600">{data.notes}</p>
              </div>
            )}
            <p className="text-[11px] leading-relaxed text-slate-400">
              Thank you for doing business with {businessSettings.name || 'us'}! 
              Goods once sold can be exchanged within standard company return policies.
            </p>
          </div>

          <div className="w-full sm:w-72 space-y-2 text-xs">
            <div className="flex justify-between py-1 text-slate-600 border-b border-slate-100">
              <span>Subtotal:</span>
              <span className="font-mono font-semibold">৳{formatCurrency(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between py-1 text-emerald-700 border-b border-slate-100">
                <span>Discount:</span>
                <span className="font-mono font-semibold">-৳{formatCurrency(discount)}</span>
              </div>
            )}
            {tax > 0 && (
              <div className="flex justify-between py-1 text-slate-600 border-b border-slate-100">
                <span>Tax / VAT:</span>
                <span className="font-mono font-semibold">+৳{formatCurrency(tax)}</span>
              </div>
            )}
            <div className="flex justify-between py-1.5 text-sm font-black text-slate-900 border-b-2 border-slate-900">
              <span>Grand Total:</span>
              <span className="font-mono text-base text-primary-700">৳{formatCurrency(grandTotal)}</span>
            </div>
            <div className="flex justify-between py-1 text-slate-700">
              <span className="font-semibold">Paid Amount:</span>
              <span className="font-mono font-bold text-emerald-700">৳{formatCurrency(paidAmount)}</span>
            </div>
            {dueAmount > 0 && (
              <div className="flex justify-between py-1 text-rose-700 bg-rose-50 px-2 py-1 rounded-lg">
                <span className="font-bold">Due Balance:</span>
                <span className="font-mono font-black">৳{formatCurrency(dueAmount)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Invoice Footer / Signatures */}
        <div className="pt-8 flex justify-between items-end text-xs text-slate-400">
          <div className="text-center">
            <div className="w-32 border-t border-slate-300 mb-1"></div>
            <span>Customer Signature</span>
          </div>
          <div className="text-center">
            <div className="w-32 border-t border-slate-300 mb-1"></div>
            <span>Authorized Signature</span>
          </div>
        </div>

      </div>
    </div>
  );
};
