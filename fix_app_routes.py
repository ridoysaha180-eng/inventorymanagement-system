import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# imports
imports = """import { BrandManagement } from './pages/BrandManagement';
import { CategoryManagement } from './pages/CategoryManagement';
import { SubCategoryManagement } from './pages/SubCategoryManagement';"""

content = content.replace("import { Settings } from './pages/Settings';", "import { Settings } from './pages/Settings';\n" + imports)

# routes
routes = """          <Route path="inventory" element={<Inventory />} />
          <Route path="products" element={<ProductDetails />} />
          <Route path="brand" element={<BrandManagement />} />
          <Route path="category" element={<CategoryManagement />} />
          <Route path="sub-category" element={<SubCategoryManagement />} />"""

content = content.replace("          <Route path=\"inventory\" element={<Inventory />} />\n          <Route path=\"products\" element={<ProductDetails />} />", routes)

with open('src/App.tsx', 'w') as f:
    f.write(content)
