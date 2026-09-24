import re

with open('src/services/storageService.ts', 'r') as f:
    content = f.read()

# Add keys
content = content.replace("  BUSINESS_SETTINGS: 'bizflow_business_settings',", "  BUSINESS_SETTINGS: 'bizflow_business_settings',\n  BRANDS: 'bizflow_brands',\n  CATEGORIES: 'bizflow_categories',\n  SUB_CATEGORIES: 'bizflow_sub_categories',")

# Add imports
content = content.replace("import { InventoryItem, Sale, Vendor, Customer, Expense, Purchase, BusinessSettings } from '../types';", "import { InventoryItem, Sale, Vendor, Customer, Expense, Purchase, BusinessSettings, Brand, Category, SubCategory } from '../types';")

methods_to_add = """
  // Brands
  getBrands: () => get<Brand>(STORAGE_KEYS.BRANDS),
  addBrand: (brand: Brand) => {
    const brands = get<Brand>(STORAGE_KEYS.BRANDS);
    save(STORAGE_KEYS.BRANDS, [...brands, brand]);
  },
  updateBrand: (id: string, updatedBrand: Brand) => {
    const brands = get<Brand>(STORAGE_KEYS.BRANDS);
    const updated = brands.map(b => b.id === id ? updatedBrand : b);
    save(STORAGE_KEYS.BRANDS, updated);
  },
  deleteBrand: (id: string) => {
    const brands = get<Brand>(STORAGE_KEYS.BRANDS);
    const updated = brands.filter(b => b.id !== id);
    save(STORAGE_KEYS.BRANDS, updated);
  },

  // Categories
  getCategories: () => get<Category>(STORAGE_KEYS.CATEGORIES),
  addCategory: (category: Category) => {
    const categories = get<Category>(STORAGE_KEYS.CATEGORIES);
    save(STORAGE_KEYS.CATEGORIES, [...categories, category]);
  },
  updateCategory: (id: string, updatedCategory: Category) => {
    const categories = get<Category>(STORAGE_KEYS.CATEGORIES);
    const updated = categories.map(c => c.id === id ? updatedCategory : c);
    save(STORAGE_KEYS.CATEGORIES, updated);
  },
  deleteCategory: (id: string) => {
    const categories = get<Category>(STORAGE_KEYS.CATEGORIES);
    const updated = categories.filter(c => c.id !== id);
    save(STORAGE_KEYS.CATEGORIES, updated);
  },

  // Sub Categories
  getSubCategories: () => get<SubCategory>(STORAGE_KEYS.SUB_CATEGORIES),
  addSubCategory: (subCategory: SubCategory) => {
    const subCategories = get<SubCategory>(STORAGE_KEYS.SUB_CATEGORIES);
    save(STORAGE_KEYS.SUB_CATEGORIES, [...subCategories, subCategory]);
  },
  updateSubCategory: (id: string, updatedSubCategory: SubCategory) => {
    const subCategories = get<SubCategory>(STORAGE_KEYS.SUB_CATEGORIES);
    const updated = subCategories.map(c => c.id === id ? updatedSubCategory : c);
    save(STORAGE_KEYS.SUB_CATEGORIES, updated);
  },
  deleteSubCategory: (id: string) => {
    const subCategories = get<SubCategory>(STORAGE_KEYS.SUB_CATEGORIES);
    const updated = subCategories.filter(c => c.id !== id);
    save(STORAGE_KEYS.SUB_CATEGORIES, updated);
  },
"""

content = content.replace("  // Inventory", methods_to_add + "\n  // Inventory")

with open('src/services/storageService.ts', 'w') as f:
    f.write(content)
