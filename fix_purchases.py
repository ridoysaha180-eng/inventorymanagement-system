import re

with open('src/pages/Purchases.tsx', 'r') as f:
    content = f.read()

# Add states
states_repl = """  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id?: string }>({ isOpen: false });"""
content = content.replace("  const [isScannerOpen, setIsScannerOpen] = useState(false);", states_repl)

# Add confirmDelete & edit
functions_add = """  const confirmDelete = () => {
    if (deleteConfirm.id) {
      storageService.deletePurchase(deleteConfirm.id);
      loadData();
    }
    setDeleteConfirm({ isOpen: false });
  };

  const handleEditPurchase = (purchase: Purchase) => {
    setEditingPurchaseId(purchase.id);
    setSelectedVendorId(purchase.vendor_id || '');
    setPaymentMethod(purchase.payment_method);
    setDiscount(purchase.discount_amount);
    
    // Reverse calculate tax rate
    const subtotalAfterDiscount = purchase.subtotal - purchase.discount_amount;
    const taxRate = subtotalAfterDiscount > 0 ? (purchase.tax_amount / subtotalAfterDiscount) * 100 : 0;
    setTaxRate(taxRate);
    
    const loadedCart = purchase.items.map(item => {
      const invItem = inventory.find(i => i.id === item.inventory_item_id);
      return {
        ...item,
        name: item.item_name || invItem?.name || 'Unknown',
        sku: invItem?.sku || '',
        total_quantity: 0,
        total_amount_input: (item.quantity * item.unit_price).toString()
      };
    });
    setCart(loadedCart);
    setIsModalOpen(true);
  };

  const handleCheckout"""
content = content.replace("  const handleCheckout", functions_add)

# Modify handleCheckout
checkout_repl = """  const handleCheckout = () => {
    if (cart.length === 0) {
      alert('Please add items to the cart first.');
      return;
    }

    try {
      let finalPurchaseId = editingPurchaseId;
      if (!finalPurchaseId) {
        const today = new Date();
        const dateStr = today.getFullYear().toString() + 
                        (today.getMonth() + 1).toString().padStart(2, '0') + 
                        today.getDate().toString().padStart(2, '0');
        
        const todayPurchases = purchases.filter(s => s.id.startsWith(dateStr));
        const sequence = (todayPurchases.length + 1).toString().padStart(2, '0');
        finalPurchaseId = `${dateStr}${sequence}`;
      }
      
      const purchaseItems: PurchaseItem[] = [];
      
      cart.forEach(cartItem => {
        const invItem = inventory.find(i => i.sku === cartItem.sku);
        
        if (invItem) {
          purchaseItems.push({
            id: cartItem.id && cartItem.id.length > 5 ? cartItem.id : Math.random().toString(36).substr(2, 9),
            purchase_id: finalPurchaseId,
            inventory_item_id: invItem.id,
            item_name: cartItem.name,
            quantity: cartItem.quantity,
            unit_price: cartItem.unit_price
          });
        }
      });

      const newPurchase: Purchase = {
        id: finalPurchaseId,
        user_id: '123',
        vendor_id: selectedVendorId || undefined,
        subtotal,
        discount_amount: discount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        status: 'completed',
        created_at: new Date().toISOString(),
        items: purchaseItems
      };

      if (editingPurchaseId) {
        // preserve created_at from old purchase if editing
        const oldPurchase = purchases.find(p => p.id === editingPurchaseId);
        if (oldPurchase) newPurchase.created_at = oldPurchase.created_at;
        storageService.updatePurchase(editingPurchaseId, newPurchase);
      } else {
        storageService.addPurchase(newPurchase);
      }
      
      // Reset states
      setCart([]);
      setSelectedVendorId('');
      setDiscount(0);
      setTaxRate(0);
      setPaymentMethod('cash');
      setIsModalOpen(false);
      setEditingPurchaseId(null);
      
      // Reload purchases
      loadData();
      
      alert(`Purchase ${editingPurchaseId ? 'updated' : 'completed'} successfully!`);
    } catch (error) {
      console.error('Checkout failed:', error);
      alert('Failed to process purchase. Please try again.');
    }
  };"""

content = re.sub(r'  const handleCheckout = \(\) => \{.*?\n      alert\(`Purchase completed successfully!`\);\n    \} catch \(error\) \{\n      console\.error\(\'Checkout failed:\', error\);\n      alert\(\'Failed to process purchase\. Please try again\.\'\);\n    \}\n  \};', checkout_repl, content, flags=re.DOTALL)

# Modal close fix
modal_close_repl = """setIsModalOpen(true)} className="bg-primary-600 hover:bg-primary-700 text-white rounded-lg px-4 sm:px-6 py-2 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Purchase</span>
          </Button>"""
content = content.replace("""setIsModalOpen(true)} className="bg-primary-600 hover:bg-primary-700 text-white rounded-lg px-4 sm:px-6 py-2 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Purchase</span>
          </Button>""", """setIsModalOpen(true); setEditingPurchaseId(null); setCart([]);} className="bg-primary-600 hover:bg-primary-700 text-white rounded-lg px-4 sm:px-6 py-2 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Purchase</span>
          </Button>""")

# Modal close action
close_modal_button_repl = """onClick={() => setIsModalOpen(false)}"""
content = content.replace(close_modal_button_repl, """onClick={() => { setIsModalOpen(false); setEditingPurchaseId(null); setCart([]); }}""")

# Actions in the table
actions_repl = """                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditPurchase(purchase);
                        }}
                        className="p-1.5 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                        title="Edit Purchase"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm({ isOpen: true, id: purchase.id });
                        }}
                        className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete Purchase"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPurchase(purchase);
                          setTimeout(() => window.print(), 300);
                        }}
                        className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                        title="Print Invoice"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPurchase(purchase);
                          setTimeout(() => handleDownloadPDF(purchase.id), 300);
                        }}
                        className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                        title="Download PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>"""

content = re.sub(r'<div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">.*?</div>', actions_repl, content, flags=re.DOTALL, count=1)

# Add Edit2 import if missing
if 'Edit2' not in content:
    content = content.replace("Trash2, Printer, CheckCircle2", "Edit2, Trash2, Printer, CheckCircle2")

# Delete modal code
delete_modal = """      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Delete Purchase</h3>
            <p className="text-slate-600 mb-6">
              Are you sure you want to delete this purchase? This will update the inventory stock. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeleteConfirm({ isOpen: false })}>
                Cancel
              </Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={confirmDelete}>
                Delete
              </Button>
            </div>
          </Card>
        </div>
      )}
      
      {/* Barcode Scanner Modal */}"""
content = content.replace("{/* Barcode Scanner Modal */}", delete_modal)

with open('src/pages/Purchases.tsx', 'w') as f:
    f.write(content)
