import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { motion, AnimatePresence } from 'motion/react';
import { storageService } from '../../services/storageService';
import { applyThemeAndFont } from '../../utils/themeHelper';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../lib/firebase';
import { Loader2 } from 'lucide-react';

export const Layout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(!storageService.isReady());
  const [firebaseUser, loading] = useAuthState(auth);
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (!firebaseUser) {
      navigate('/login');
      return;
    }

    let isCancelled = false;

    // Initialize user cloud database connection
    storageService.initUser(firebaseUser.uid)
      .then(() => {
        if (!isCancelled) {
          setIsSyncing(false);
          const settings = storageService.getBusinessSettings();
          applyThemeAndFont(settings);
        }
      })
      .catch((err) => {
        console.error('Failed to initialize cloud database:', err);
        if (!isCancelled) {
          setIsSyncing(false);
        }
      });

    // Listen for theme & business changes
    const onSettingsUpdate = () => {
      const updated = storageService.getBusinessSettings();
      applyThemeAndFont(updated);
    };

    window.addEventListener('bizflow_business_settings_updated', onSettingsUpdate);

    return () => {
      isCancelled = true;
      window.removeEventListener('bizflow_business_settings_updated', onSettingsUpdate);
    };
  }, [navigate, firebaseUser, loading]);

  if (isSyncing || loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] p-4">
        <div className="flex flex-col items-center gap-5 p-8 bg-white rounded-3xl border border-slate-100 shadow-xl max-w-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shadow-inner relative animate-pulse">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">Cloud Sync Active</h3>
            <p className="text-sm text-slate-500 mt-1">Retrieving your inventory, transactions, and preferences from Firestore...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar isOpen={isSidebarOpen} toggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      <div className="lg:pl-64 flex flex-col min-h-screen">
        <Navbar onMenuClick={() => setIsSidebarOpen(true)} />
        
        <main className="flex-1 p-4 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};
