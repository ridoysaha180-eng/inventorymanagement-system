import React, { useState, useEffect } from 'react';
import { Menu, LogOut, Settings as SettingsIcon, History } from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../lib/firebase';
import { signOut } from 'firebase/auth';
import { useNavigate, Link } from 'react-router-dom';
import { storageService } from '../../services/storageService';
import { UserProfileSettings, BusinessSettings } from '../../types';
import { BrandLogo } from '../common/BrandLogo';
import { GlobalSearch } from './GlobalSearch';
import { NotificationCenter } from './NotificationCenter';

export const Navbar: React.FC<{ onMenuClick: () => void }> = ({ onMenuClick }) => {
  const [user] = useAuthState(auth);
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfileSettings>(() => storageService.getUserProfile());
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings>(() => storageService.getBusinessSettings());

  useEffect(() => {
    const refreshProfile = () => {
      setProfile(storageService.getUserProfile());
    };

    const refreshBusiness = () => {
      setBusinessSettings(storageService.getBusinessSettings());
    };

    window.addEventListener('bizflow_user_profile_updated', refreshProfile);
    window.addEventListener('bizflow_business_settings_updated', refreshBusiness);
    window.addEventListener('storage', refreshProfile);
    window.addEventListener('storage', refreshBusiness);

    return () => {
      window.removeEventListener('bizflow_user_profile_updated', refreshProfile);
      window.removeEventListener('bizflow_business_settings_updated', refreshBusiness);
      window.removeEventListener('storage', refreshProfile);
      window.removeEventListener('storage', refreshBusiness);
    };
  }, []);

  const localUserStr = localStorage.getItem('bizflow_user');
  const localUser = localUserStr ? JSON.parse(localUserStr) : null;
  const displayName = profile?.name || user?.displayName || localUser?.name || 'Ridoy Saha';
  const displayEmail = profile?.email || user?.email || localUser?.email || 'ridoysaha440@gmail.com';
  const displayAvatar = profile?.avatar || user?.photoURL || localUser?.avatar || '';

  const handleLogout = async () => {
    try {
      storageService.clearUser();
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('bizflow_')) {
          localStorage.removeItem(key);
        }
      });
      sessionStorage.clear();
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out', error);
      navigate('/login');
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-100 bg-white/90 px-4 backdrop-blur-xl lg:px-8 shadow-[0_1px_2px_0_rgba(0,0,0,0.02)]">
      <div className="flex items-center gap-3">
        <button 
          onClick={onMenuClick}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Mobile Logo on smaller screens - Clicking navigates to Home Dashboard */}
        <Link 
          to="/" 
          className="flex lg:hidden items-center cursor-pointer transition-transform hover:opacity-90 active:scale-95"
          title="Go to Home Dashboard"
        >
          <BrandLogo 
            name={businessSettings?.name || 'Grocery Point'}
            tagline={businessSettings?.tagline || 'Fresh Products • Better Life'}
            logo={businessSettings?.logo}
            size="sm"
          />
        </Link>
        
        {/* Global Live Search Bar */}
        <GlobalSearch />
      </div>

      {/* Center Brand - Clicking navigates to Home Dashboard from any page */}
      <Link 
        to="/" 
        className="hidden lg:flex items-center cursor-pointer transition-transform hover:opacity-90 active:scale-95"
        title="Go to Home Dashboard"
      >
        <BrandLogo 
          name={businessSettings?.name || 'Grocery Point'}
          tagline={businessSettings?.tagline || 'Fresh Products • Better Life'}
          logo={businessSettings?.logo}
          size="md"
        />
      </Link>

      <div className="flex items-center gap-2 md:gap-4">
        {/* Real-time Dynamic Notification Center */}
        <NotificationCenter />
        
        <div className="h-8 w-px bg-slate-200 mx-1"></div>
        
        <div className="flex items-center gap-3 pl-1 group relative cursor-pointer">
          <div className="hidden md:block text-right">
            <p className="text-sm font-bold text-slate-900 leading-tight">{displayName}</p>
            <p className="text-xs text-slate-500">{profile?.designation || displayEmail}</p>
          </div>
          {displayAvatar ? (
            <img 
              src={displayAvatar} 
              alt="Profile" 
              className="w-10 h-10 rounded-full border-2 border-emerald-200 object-cover shadow-2xs" 
            />
          ) : (
            <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center border border-emerald-200 shadow-2xs font-bold text-sm">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Logout Dropdown (hover) */}
          <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 py-1.5 z-50">
            <div className="px-4 py-2 border-b border-slate-100">
              <p className="text-xs font-bold text-slate-900">{displayName}</p>
              <p className="text-[11px] text-slate-500 truncate">{displayEmail}</p>
            </div>
            <button 
              onClick={() => navigate('/activity-log')}
              className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <History className="w-4 h-4 text-slate-500" />
              Activity Log
            </button>
            <button 
              onClick={() => navigate('/settings')}
              className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <SettingsIcon className="w-4 h-4 text-slate-500" />
              Settings & Profile
            </button>
            <button 
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
