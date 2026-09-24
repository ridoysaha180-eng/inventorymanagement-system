import re

with open('src/pages/Purchases.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Change the column header in the table
content = content.replace('<th className="border border-[#1e293b] p-2 text-left w-32 text-[#1e293b]">ভেন্ডর/সরবরাহকারী</th>', '<th className="border border-[#1e293b] p-2 text-left w-32 text-[#1e293b]">কোম্পানি/ব্র্যান্ড</th>')

# Change the mapped value
mapped_repl = """                      {safeItems.map((item, i) => {
                        const invItem = inventory.find(inv => inv.id === item.inventory_item_id);
                        const companyName = invItem?.company || '';
                        return (
                          <tr key={i}>
                            <td className="border border-[#1e293b] p-2 text-center text-[#334155]">{i + 1}</td>
                            <td className="border border-[#1e293b] p-2 text-[#334155]">{item.item_name || 'Product'}</td>
                            <td className="border border-[#1e293b] p-2 text-[#334155]">{companyName}</td>"""

content = re.sub(r'                      \{safeItems\.map\(\(item, i\) => \{\n                        const invItem = inventory\.find\(inv => inv\.id === item\.inventory_item_id\);\n                        const supplier = suppliers\.find\(v => v\.id === invItem\?\.supplier_id\);\n                        const supplierName = supplier \? supplier\.name : \'\';\n                        return \(\n                          <tr key=\{i\}>\n                            <td className="border border-\[\#1e293b\] p-2 text-center text-\[\#334155\]">\{i \+ 1\}</td>\n                            <td className="border border-\[\#1e293b\] p-2 text-\[\#334155\]">\{item\.item_name \|\| \'Product\'\}</td>\n                            <td className="border border-\[\#1e293b\] p-2 text-\[\#334155\]">\{supplierName\}</td>', mapped_repl, content)

with open('src/pages/Purchases.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
