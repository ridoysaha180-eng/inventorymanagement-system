import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Dashboard } from './pages/Dashboard';
import { Inventory } from './pages/Inventory';
import { ProductDetails } from './pages/ProductDetails';
import { Sales } from './pages/Sales';
import { Purchases } from './pages/Purchases';
import { Expenses } from './pages/Expenses';
import { Loans } from './pages/Loans';
import { Investments } from './pages/Investments';
import { Customers } from './pages/Customers';
import { Suppliers } from './pages/Suppliers';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Trash } from './pages/Trash';
import { ActivityLog } from './pages/ActivityLog';
import { BrandManagement } from './pages/BrandManagement';
import { CategoryManagement } from './pages/CategoryManagement';
import { CompanyCategoryManagement } from './pages/CompanyCategoryManagement';
import { SubCategoryManagement } from './pages/SubCategoryManagement';
import { DueManagement } from './pages/DueManagement';
import { BulkUpload } from './pages/BulkUpload';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Protected Dashboard Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="products" element={<ProductDetails />} />
            <Route path="bulk-upload" element={<BulkUpload />} />
            <Route path="brand" element={<CompanyCategoryManagement />} />
            <Route path="company" element={<CompanyCategoryManagement />} />
            <Route path="category" element={<CompanyCategoryManagement />} />
            <Route path="company-category" element={<CompanyCategoryManagement />} />
            <Route path="sub-category" element={<SubCategoryManagement />} />
            <Route path="sales" element={<Sales />} />
            <Route path="purchases" element={<Purchases />} />
            <Route path="dues" element={<DueManagement />} />
            <Route path="due-management" element={<Navigate to="/dues" replace />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="loans" element={<Loans />} />
            <Route path="investments" element={<Investments />} />
            <Route path="customers" element={<Customers />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="activity-log" element={<ActivityLog />} />
            <Route path="activities" element={<Navigate to="/activity-log" replace />} />
            <Route path="trash" element={<Trash />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
