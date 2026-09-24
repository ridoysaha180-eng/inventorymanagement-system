import re

with open('src/pages/Sales.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Change 'invoice-content' to 'invoice-content-wrapper' in handleDownloadPDF
content = content.replace("getElementById('invoice-content')", "getElementById('invoice-content-wrapper')")

# The wrapper has bg-slate-100, which might look bad in the PDF. We can temporarily change its background to white before capturing.
bg_fix_start = """      element.style.width = '800px'; // Fixed width for consistent high-quality capture
      element.style.maxWidth = 'none';
      element.style.margin = '0';
      element.style.backgroundColor = 'white';"""

content = content.replace("""      element.style.width = '800px'; // Fixed width for consistent high-quality capture
      element.style.maxWidth = 'none';
      element.style.margin = '0';""", bg_fix_start)


with open('src/pages/Sales.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
