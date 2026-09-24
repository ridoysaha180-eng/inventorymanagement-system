import re

with open('src/components/layout/Sidebar.tsx', 'r') as f:
    content = f.read()

# We need to change the nav items and add a submenu for Product
# Specifically, looking at the video, Product has a submenu. But the user just wants the items to be accessible. Let's just add them.
nav_items_repl = """import { ChevronDown, ChevronRight, Tags, Tag } from 'lucide-react';

const navItems = [
  { icon: LayoutGrid, label: 'Dashboard', path: '/' },
  { icon: Package, label: 'Inventory', path: '/inventory' },
  {
    icon: Box, 
    label: 'Product', 
    submenu: [
      { label: 'New Product', path: '/products', action: 'new' },
      { label: 'Bulk Upload', path: '/bulk-upload' },
      { label: 'Product List', path: '/products' },
      { label: 'Brand', path: '/brand' },
      { label: 'Category', path: '/category' },
      { label: 'Sub Category', path: '/sub-category' },
    ]
  },
  { icon: ShoppingCart, label: 'Sales', path: '/sales' },
  { icon: DollarSign, label: 'Purchases', path: '/purchases' },
  { icon: Users, label: 'Customers', path: '/customers' },
  { icon: Users, label: 'Vendors', path: '/vendors' },
  { icon: TrendingDown, label: 'Reports', path: '/reports' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];"""

content = re.sub(r'const navItems = \[.*?\];', nav_items_repl, content, flags=re.DOTALL)

# Add state for expanded menus
sidebar_component_start = """export const Sidebar: React.FC<{ isOpen: boolean; toggle: () => void }> = ({ isOpen, toggle }) => {
  const navigate = useNavigate();
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['Product']);"""

content = content.replace("""export const Sidebar: React.FC<{ isOpen: boolean; toggle: () => void }> = ({ isOpen, toggle }) => {
  const navigate = useNavigate();
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);""", sidebar_component_start)

# Update nav render logic
nav_render_repl = """        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto no-scrollbar">
          {navItems.map((item) => (
            <div key={item.label}>
              {item.submenu ? (
                <>
                  <div 
                    className={cn(
                      "flex items-center justify-between px-3 py-3 rounded-xl transition-all duration-200 cursor-pointer group hover:bg-slate-50",
                      expandedMenus.includes(item.label) ? "text-primary-700 bg-primary-50/50" : "text-slate-600"
                    )}
                    onClick={() => setExpandedMenus(prev => prev.includes(item.label) ? prev.filter(m => m !== item.label) : [...prev, item.label])}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className={cn("w-5 h-5", expandedMenus.includes(item.label) && "text-primary-600")} />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    {expandedMenus.includes(item.label) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                  {expandedMenus.includes(item.label) && (
                    <div className="mt-1 space-y-1 pl-11 pr-2">
                      {item.submenu.map(sub => (
                        <NavLink
                          key={sub.label}
                          to={sub.path}
                          className={({ isActive }) => cn(
                            "flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 text-sm",
                            isActive && !sub.action
                              ? "bg-primary-50 text-primary-700 font-semibold"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium"
                          )}
                        >
                          <span>{sub.label}</span>
                          {sub.action === 'new' && <span className="text-[10px] font-bold text-white bg-primary-500 px-1.5 py-0.5 rounded uppercase tracking-wider">New</span>}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <NavLink
                  to={item.path}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group",
                    isActive 
                      ? "bg-primary-50 text-primary-700 font-semibold" 
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </NavLink>
              )}
            </div>
          ))}
        </nav>"""

content = re.sub(r'<nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto no-scrollbar">.*?</nav>', nav_render_repl, content, flags=re.DOTALL)

with open('src/components/layout/Sidebar.tsx', 'w') as f:
    f.write(content)
