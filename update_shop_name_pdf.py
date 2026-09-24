import re

with open('src/pages/Inventory.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update handleExportExcel
excel_old = """    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, 'inventory_report.xlsx');"""

excel_new = """    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    const bSettings = storageService.getBusinessSettings();
    const safeShop = (bSettings?.name || 'Inventory').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'Inventory';
    XLSX.writeFile(wb, `${safeShop}_Inventory_Report.xlsx`);"""

content = content.replace(excel_old, excel_new)

# 2. Update downloadPDF header & title logic
pdf_old = """    // Header Background
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 3, pageWidth, 34, 'F');

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('BIZFLOW INVENTORY REPORT', 14, 18);

    // Subtitle & Status
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // slate-400
    const activeSupplierText = supplierFilter === 'all' 
      ? 'Supplier: All Suppliers (Grouped View)' 
      : `Supplier: ${suppliers.find(s => s.id === supplierFilter)?.name || 'Filtered'}`;
    const activeCompanyText = companyFilter === 'all' ? '' : ` • Brand: ${companyFilter}`;
    doc.text(`Live Stock, Sales & Valuation Overview • ${activeSupplierText}${activeCompanyText}`, 14, 26);"""

pdf_new = """    // Fetch current business settings (Shop Name, phone, address)
    const businessSettings = storageService.getBusinessSettings();
    const shopName = (businessSettings?.name || '').trim() || 'BIZFLOW';
    const reportTitle = `${shopName.toUpperCase()} - INVENTORY REPORT`;

    // Helper to render text supporting both ASCII and Unicode (Bangla, etc.)
    const renderHeaderTitle = (text: string, x: number, y: number) => {
      const isAscii = /^[\x00-\x7F]*$/.test(text);
      if (isAscii) {
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(17);
        doc.setFont('helvetica', 'bold');
        doc.text(text, x, y);
      } else {
        try {
          const scale = 3;
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(17);
            doc.text(text, x, y);
            return;
          }
          const fontPx = 22 * scale;
          ctx.font = `bold ${fontPx}px "Segoe UI", Roboto, "Kalpurush", "SolaimanLipi", sans-serif`;
          const metrics = ctx.measureText(text);
          canvas.width = Math.ceil(metrics.width + 20 * scale);
          canvas.height = Math.ceil(34 * scale);
          ctx.font = `bold ${fontPx}px "Segoe UI", Roboto, "Kalpurush", "SolaimanLipi", sans-serif`;
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(text, 4 * scale, canvas.height / 2);
          const imgData = canvas.toDataURL('image/png');
          const mmWidth = (canvas.width / scale) * 0.264583;
          const mmHeight = (canvas.height / scale) * 0.264583;
          doc.addImage(imgData, 'PNG', x, y - 6, mmWidth, mmHeight);
        } catch {
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(17);
          doc.setFont('helvetica', 'bold');
          doc.text(text, x, y);
        }
      }
    };

    // Header Background
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 3, pageWidth, 34, 'F');

    // Title (Dynamic Shop Name)
    renderHeaderTitle(reportTitle, 14, 18);

    // Subtitle & Status
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // slate-400
    const activeSupplierText = supplierFilter === 'all' 
      ? 'Supplier: All Suppliers (Grouped View)' 
      : `Supplier: ${suppliers.find(s => s.id === supplierFilter)?.name || 'Filtered'}`;
    const activeCompanyText = companyFilter === 'all' ? '' : ` • Brand: ${companyFilter}`;
    const shopMeta = [businessSettings.address, businessSettings.phone].filter(Boolean).join(' • ');
    const subtitlePrefix = shopMeta ? `${shopMeta}  |  ` : '';
    doc.text(`${subtitlePrefix}${activeSupplierText}${activeCompanyText}`, 14, 26);"""

content = content.replace(pdf_old, pdf_new)

# 3. Update Footer & filename
footer_old = """        doc.text(
          'BizFlow • Inventory Management System',
          data.settings.margin.left,
          pageHeight - 6
        );"""

footer_new = """        doc.text(
          `${shopName} • Inventory Management System`,
          data.settings.margin.left,
          pageHeight - 6
        );"""

content = content.replace(footer_old, footer_new)

file_old = """    // Save PDF directly to trigger clean download in browser
    doc.save(`Inventory_Report_${new Date().toISOString().slice(0, 10)}.pdf`);"""

file_new = """    // Save PDF directly with shop name
    const safeShopFileName = shopName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'Inventory';
    doc.save(`${safeShopFileName}_Report_${new Date().toISOString().slice(0, 10)}.pdf`);"""

content = content.replace(file_old, file_new)

with open('src/pages/Inventory.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated Inventory.tsx successfully")
