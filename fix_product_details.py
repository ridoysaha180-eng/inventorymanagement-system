import re

with open('src/pages/ProductDetails.tsx', 'r') as f:
    content = f.read()

# Add imports for Brand, Category, SubCategory
content = content.replace("import { InventoryItem, Vendor } from '../types';", "import { InventoryItem, Vendor, Brand, Category, SubCategory } from '../types';")

# Add states for brands, categories, subcategories
state_repl = """  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);"""

content = content.replace("  const [inventory, setInventory] = useState<InventoryItem[]>([]);", state_repl)

# Load data function update
load_repl = """  const loadData = () => {
    setInventory(storageService.getInventory());
    setBrands(storageService.getBrands() || []);
    setCategories(storageService.getCategories() || []);
    setSubCategories(storageService.getSubCategories() || []);
  };"""

content = re.sub(r'  const loadData = \(\) => \{.*?  \};', load_repl, content, flags=re.DOTALL)

# Update form elements

brand_repl = """<select 
                        className="flex-1 h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        value={formData.company}
                        onChange={e => setFormData({...formData, company: e.target.value})}
                      >
                        <option value="">Select Brand</option>
                        {brands.map(brand => (
                          <option key={brand.id} value={brand.name}>{brand.name}</option>
                        ))}
                      </select>
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="h-10 px-3 whitespace-nowrap text-emerald-600 border-emerald-500 rounded-full hover:bg-emerald-50"
                        onClick={() => {
                          const brandName = window.prompt("Enter new Brand / Company name:");
                          if (brandName) {
                            storageService.addBrand({ id: Math.random().toString(36).substr(2, 9), name: brandName, created_at: new Date().toISOString() });
                            loadData();
                            setFormData({...formData, company: brandName});
                          }
                        }}
                      >+ Brand</Button>"""

content = re.sub(r'<select.*?value=\{formData\.company\}.*?</Button>', brand_repl, content, flags=re.DOTALL)


category_repl = """<select 
                        className="flex-1 h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        required
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value})}
                      >
                        <option value="">Select Category</option>
                        {categories.map(category => (
                          <option key={category.id} value={category.name}>{category.name}</option>
                        ))}
                      </select>
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="h-10 px-3 whitespace-nowrap text-emerald-600 border-emerald-500 rounded-full hover:bg-emerald-50"
                        onClick={() => {
                          const catName = window.prompt("Enter new Category name:");
                          if (catName) {
                            storageService.addCategory({ id: Math.random().toString(36).substr(2, 9), name: catName, created_at: new Date().toISOString() });
                            loadData();
                            setFormData({...formData, category: catName});
                          }
                        }}
                      >+ Category</Button>"""
content = re.sub(r'<select[^>]*value=\{formData\.category\}[^>]*>.*?</Button>', category_repl, content, flags=re.DOTALL)

subcategory_repl = """<select 
                        className="flex-1 h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50 disabled:text-slate-400"
                        value={formData.sub_category}
                        onChange={e => setFormData({...formData, sub_category: e.target.value})}
                        disabled={!formData.category}
                      >
                        <option value="">Select sub-category</option>
                        {subCategories
                          .filter(sub => {
                            const selectedCat = categories.find(c => c.name === formData.category);
                            return selectedCat && sub.category_id === selectedCat.id;
                          })
                          .map(sub => (
                            <option key={sub.id} value={sub.name}>{sub.name}</option>
                        ))}
                      </select>
                      <Button 
                        type="button" 
                        variant="outline" 
                        disabled={!formData.category}
                        className="h-10 px-3 whitespace-nowrap text-emerald-600 border-emerald-500 rounded-full hover:bg-emerald-50 disabled:opacity-50 disabled:border-slate-300 disabled:text-slate-400"
                        onClick={() => {
                          const subName = window.prompt("Enter new Sub-Category name:");
                          if (subName) {
                            const selectedCat = categories.find(c => c.name === formData.category);
                            if (selectedCat) {
                              storageService.addSubCategory({ id: Math.random().toString(36).substr(2, 9), category_id: selectedCat.id, name: subName, created_at: new Date().toISOString() });
                              loadData();
                              setFormData({...formData, sub_category: subName});
                            } else {
                              alert("Please save or select the category first.");
                            }
                          }
                        }}
                      >+ Sub</Button>"""
content = re.sub(r'<select[^>]*value=\{formData\.sub_category\}[^>]*>.*?</Button>', subcategory_repl, content, flags=re.DOTALL)

with open('src/pages/ProductDetails.tsx', 'w') as f:
    f.write(content)
