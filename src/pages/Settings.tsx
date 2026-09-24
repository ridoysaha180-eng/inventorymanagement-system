import React, { useState, useEffect, useRef } from 'react';
import { 
  User, 
  Building2, 
  Bell, 
  Shield, 
  Palette, 
  Upload, 
  Save, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  FileText, 
  Database, 
  KeyRound, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Phone, 
  Mail, 
  Globe, 
  MapPin, 
  Percent, 
  RefreshCw,
  Trash2,
  Lock,
  Volume2,
  Check,
  Type,
  Sliders,
  Pipette,
  Layers,
  Image as ImageIcon
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { cn } from '../utils';
import { storageService } from '../services/storageService';
import { BusinessSettings, UserProfileSettings, NotificationSettings } from '../types';
import { BrandLogo } from '../components/common/BrandLogo';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';
import { updatePassword, updateProfile } from 'firebase/auth';
import { 
  AVAILABLE_FONTS, 
  THEME_PRESETS, 
  generatePaletteFromRgb, 
  hexToRgb, 
  rgbToHex, 
  applyThemeAndFont,
  FontOption 
} from '../utils/themeHelper';

const PRESET_AVATARS = [
  { id: 'male_1', label: 'Male Admin', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' },
  { id: 'male_2', label: 'Executive', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' },
  { id: 'female_1', label: 'Female Manager', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80' },
  { id: 'female_2', label: 'Business Lady', url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80' },
  { id: 'store_owner', label: 'Store Owner', url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80' }
];

export const Settings: React.FC = () => {
  const [firebaseUser] = useAuthState(auth);
  const [activeTab, setActiveTab] = useState<'Profile' | 'Business' | 'Theme & Branding' | 'Notifications' | 'Security'>('Profile');
  
  const logoInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Status feedback toast/banner
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Business Settings State
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings>(() => storageService.getBusinessSettings());

  // RGB Sliders state
  const [rgb, setRgb] = useState<{ r: number; g: number; b: number }>({ r: 20, g: 184, b: 166 });
  const [hexInput, setHexInput] = useState<string>('#14b8a6');

  // User Profile State
  const [userProfile, setUserProfile] = useState<UserProfileSettings>({
    name: 'Ridoy Saha',
    email: 'ridoysaha440@gmail.com',
    phone: '01318087631',
    role: 'Owner & Super Admin',
    designation: 'Business Manager',
    avatar: ''
  });

  // Notification Preferences State
  const [notifications, setNotifications] = useState<NotificationSettings>({
    low_stock_alerts: true,
    due_payment_reminders: true,
    daily_sales_summary: true,
    purchase_updates: false,
    sound_effects: true,
    email_notifications: true
  });

  // Security / Password State
  const [passwordState, setPasswordState] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    showCurrent: false,
    showNew: false,
    showConfirm: false
  });

  // Reset confirmation modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');

  // Live Stats
  const [systemStats, setSystemStats] = useState({
    totalProducts: 0,
    totalSales: 0,
    totalPurchases: 0,
    totalCustomers: 0,
    totalSuppliers: 0
  });

  useEffect(() => {
    // Load from storage
    const loadedBusiness = storageService.getBusinessSettings();
    if (loadedBusiness) {
      setBusinessSettings(loadedBusiness);
      if (loadedBusiness.customRgb) {
        setRgb(loadedBusiness.customRgb);
        setHexInput(rgbToHex(loadedBusiness.customRgb.r, loadedBusiness.customRgb.g, loadedBusiness.customRgb.b));
      } else if (loadedBusiness.themeColor) {
        const preset = THEME_PRESETS.find(p => p.id === loadedBusiness.themeColor);
        if (preset) {
          setRgb(preset.rgb);
          setHexInput(rgbToHex(preset.rgb.r, preset.rgb.g, preset.rgb.b));
        }
      }
    }

    const loadedProfile = storageService.getUserProfile();
    if (loadedProfile) {
      setUserProfile({
        name: loadedProfile.name || firebaseUser?.displayName || 'Ridoy Saha',
        email: loadedProfile.email || firebaseUser?.email || 'ridoysaha440@gmail.com',
        phone: loadedProfile.phone || '01318087631',
        role: loadedProfile.role || 'Owner & Super Admin',
        designation: loadedProfile.designation || 'Business Manager',
        avatar: loadedProfile.avatar || firebaseUser?.photoURL || ''
      });
    }

    const loadedNotifications = storageService.getNotificationSettings();
    if (loadedNotifications) setNotifications(loadedNotifications);

    // Get system data counts
    const inv = storageService.getInventory();
    const sls = storageService.getSales();
    const pur = storageService.getPurchases();
    const cust = storageService.getCustomers();
    const sup = storageService.getSuppliers();

    setSystemStats({
      totalProducts: inv.length,
      totalSales: sls.length,
      totalPurchases: pur.length,
      totalCustomers: cust.length,
      totalSuppliers: sup.length
    });
  }, [firebaseUser]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  };

  // 1. Save Business Settings
  const handleSaveBusinessSettings = () => {
    try {
      storageService.saveBusinessSettings(businessSettings);
      applyThemeAndFont(businessSettings);
      showToast('Business & Invoice preferences saved successfully!');
    } catch (err: any) {
      showToast(err.message || 'Failed to save business settings', 'error');
    }
  };

  // 2. Save User Profile
  const handleSaveUserProfile = async () => {
    try {
      if (!userProfile.name.trim()) {
        showToast('Name cannot be empty', 'error');
        return;
      }
      
      // Save locally and broadcast
      storageService.saveUserProfile(userProfile);
      
      // If Firebase auth user exists, attempt to update profile
      if (firebaseUser && auth.currentUser) {
        try {
          await updateProfile(auth.currentUser, {
            displayName: userProfile.name,
            photoURL: userProfile.avatar || undefined
          });
        } catch (authErr) {
          console.warn('Firebase profile sync:', authErr);
        }
      }
      showToast('Profile & Avatar updated successfully!');
    } catch (err: any) {
      showToast(err.message || 'Failed to save profile', 'error');
    }
  };

  // 3. Save Theme & Font Settings
  const handleSaveThemeSettings = () => {
    try {
      const updatedSettings = {
        ...businessSettings,
        customRgb: rgb,
        themeColor: 'custom'
      };
      setBusinessSettings(updatedSettings);
      storageService.saveBusinessSettings(updatedSettings);
      applyThemeAndFont(updatedSettings);
      showToast('Theme colors & Font styles saved and applied!');
    } catch (err: any) {
      showToast(err.message || 'Failed to save theme settings', 'error');
    }
  };

  // Handle RGB Slider changes
  const handleRgbChange = (channel: 'r' | 'g' | 'b', value: number) => {
    const val = Math.max(0, Math.min(255, value));
    const newRgb = { ...rgb, [channel]: val };
    setRgb(newRgb);
    const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    setHexInput(newHex);

    const previewSettings: BusinessSettings = {
      ...businessSettings,
      themeColor: 'custom',
      customRgb: newRgb
    };
    setBusinessSettings(previewSettings);
    applyThemeAndFont(previewSettings);
  };

  // Handle Hex Color Input change
  const handleHexChange = (hex: string) => {
    setHexInput(hex);
    const parsed = hexToRgb(hex);
    if (parsed) {
      setRgb(parsed);
      const previewSettings: BusinessSettings = {
        ...businessSettings,
        themeColor: 'custom',
        customRgb: parsed
      };
      setBusinessSettings(previewSettings);
      applyThemeAndFont(previewSettings);
    }
  };

  // Handle Preset Theme Selection
  const handlePresetSelect = (preset: typeof THEME_PRESETS[0]) => {
    setRgb(preset.rgb);
    setHexInput(rgbToHex(preset.rgb.r, preset.rgb.g, preset.rgb.b));
    const previewSettings: BusinessSettings = {
      ...businessSettings,
      themeColor: preset.id,
      customRgb: preset.rgb
    };
    setBusinessSettings(previewSettings);
    applyThemeAndFont(previewSettings);
  };

  // Handle Font selection
  const handleFontSelect = (font: FontOption) => {
    const previewSettings: BusinessSettings = {
      ...businessSettings,
      fontFamily: font.id
    };
    setBusinessSettings(previewSettings);
    applyThemeAndFont(previewSettings);
  };

  // 4. Save Notification Preferences
  const handleSaveNotifications = () => {
    try {
      storageService.saveNotificationSettings(notifications);
      showToast('Notification preferences updated!');
    } catch (err: any) {
      showToast(err.message || 'Failed to save notifications', 'error');
    }
  };

  // 5. Change Password Handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordState.newPassword) {
      showToast('Please enter a new password', 'error');
      return;
    }
    if (passwordState.newPassword !== passwordState.confirmPassword) {
      showToast('New passwords do not match', 'error');
      return;
    }
    if (passwordState.newPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }

    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, passwordState.newPassword);
        showToast('Password changed successfully in your account!');
      } else {
        showToast('Password updated successfully for local login!');
      }
      setPasswordState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        showCurrent: false,
        showNew: false,
        showConfirm: false
      });
    } catch (err: any) {
      showToast(err.message || 'Failed to update password. You may need to log in again.', 'error');
    }
  };

  // 6. Upload Logo / Avatar Handlers
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast('Logo file size must be less than 2MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const logoStr = reader.result as string;
        const updated = { ...businessSettings, logo: logoStr };
        setBusinessSettings(updated);
        storageService.saveBusinessSettings(updated);
        showToast('Business logo updated!');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast('Avatar file size must be less than 2MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const avatarStr = reader.result as string;
        setUserProfile(prev => ({ ...prev, avatar: avatarStr }));
      };
      reader.readAsDataURL(file);
    }
  };

  // 7. Data Backup (Export JSON)
  const handleExportBackup = () => {
    try {
      const data = storageService.exportAllData();
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
      const downloadAnchor = document.createElement('a');
      const safeName = (businessSettings.name || 'BizFlow').replace(/[^a-zA-Z0-9]/g, '_');
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `${safeName}_Full_Backup_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('Database backup downloaded successfully!');
    } catch (err: any) {
      showToast('Failed to export backup: ' + err.message, 'error');
    }
  };

  // 8. Data Restore (Import JSON)
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json || typeof json !== 'object') {
          throw new Error('Invalid JSON structure');
        }
        storageService.importAllData(json);
        showToast('Backup restored successfully! Refreshing view...');
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } catch (err: any) {
        showToast('Failed to restore backup: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  };

  // 9. Reset Data Handler
  const handleResetData = () => {
    if (resetConfirmText.trim().toLowerCase() !== 'delete all') {
      showToast('Please type "DELETE ALL" to confirm data reset', 'error');
      return;
    }
    storageService.resetAllData();
    setShowResetModal(false);
    showToast('Transaction and Inventory data cleared successfully!');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  // Palette shades preview calculated from current rgb
  const currentPalette = generatePaletteFromRgb(rgb.r, rgb.g, rgb.b);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Banner matching Due Management page design */}
      <div className="relative py-6 px-6 bg-gradient-to-b from-slate-50/90 via-white to-slate-50/40 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center text-center overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary-500 via-sky-500 to-emerald-500" />
        
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-wider uppercase font-['Outfit',sans-serif]">
          SETTINGS & CUSTOMIZATIONS
        </h1>
        <p className="text-sm sm:text-base font-medium text-slate-500 mt-2 max-w-xl leading-relaxed">
          Manage your personal profile, RGB themes, fonts, store info, invoice branding, and system backups.
        </p>

        {/* Header Action Buttons */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Button 
            onClick={handleExportBackup}
            className="bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-sm inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Export Backup</span>
          </Button>
          <Button 
            onClick={() => importFileRef.current?.click()}
            variant="outline"
            className="bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-sm inline-flex items-center gap-2 border-slate-200"
          >
            <Upload className="w-4 h-4 text-emerald-600" />
            <span>Restore Data</span>
          </Button>
          <input 
            type="file" 
            ref={importFileRef} 
            className="hidden" 
            accept=".json,application/json" 
            onChange={handleImportBackup} 
          />
        </div>
      </div>

      {/* 4 Metric KPI Overview Cards matching Due Management design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: User Profile */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Profile Status</p>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary-50 text-primary-700 border border-primary-200">
              {userProfile.role || 'Super Admin'}
            </span>
          </div>
          <p className="text-xl font-bold text-slate-900 truncate">{userProfile.name || 'Store Owner'}</p>
          <p className="text-xs text-slate-400 mt-1 truncate">{userProfile.email}</p>
        </Card>

        {/* Card 2: Active Theme */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">System Theme</p>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` }}></span>
              RGB Custom
            </span>
          </div>
          <p className="text-xl font-bold text-slate-900 font-mono">rgb({rgb.r}, {rgb.g}, {rgb.b})</p>
          <p className="text-xs text-slate-400 mt-1 uppercase font-medium">Font: {businessSettings.fontFamily || 'Plus Jakarta'}</p>
        </Card>

        {/* Card 3: Business Details */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Store Info</p>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              VAT: {businessSettings.tax_rate ?? 0}%
            </span>
          </div>
          <p className="text-xl font-bold text-slate-900 truncate">{businessSettings.name || 'BizFlow Store'}</p>
          <p className="text-xs text-slate-400 mt-1 truncate">{businessSettings.address || 'Bangladesh'}</p>
        </Card>

        {/* Card 4: System Data Overview */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Database Records</p>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
              System Synced
            </span>
          </div>
          <p className="text-xl font-bold text-slate-900">
            {systemStats.totalProducts + systemStats.totalSales + systemStats.totalPurchases + systemStats.totalCustomers + systemStats.totalSuppliers} Records
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {systemStats.totalProducts} Products • {systemStats.totalSales} Sales • {systemStats.totalCustomers + systemStats.totalSuppliers} Parties
          </p>
        </Card>
      </div>

      {/* Toast Feedback Notification */}
      {feedback && (
        <div className={cn(
          "p-4 rounded-xl flex items-center gap-3 transition-all duration-300 shadow-sm border",
          feedback.type === 'success' 
            ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
            : "bg-rose-50 border-rose-200 text-rose-800"
        )}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span className="text-sm font-medium">{feedback.message}</span>
        </div>
      )}

      {/* Horizontal Navigation Tab Bar matching Due Management design */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 shadow-2xs">
        {[
          { id: 'Profile', icon: User, label: 'Profile & Avatar' },
          { id: 'Theme & Branding', icon: Palette, label: 'Theme, Fonts & RGB' },
          { id: 'Business', icon: Building2, label: 'Business & Invoice' },
          { id: 'Notifications', icon: Bell, label: 'Notifications & Alerts' },
          { id: 'Security', icon: Shield, label: 'Security & Backup' },
        ].map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 flex-1 min-w-[150px]",
                isActive
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              )}
            >
              <item.icon className={cn("w-4 h-4", isActive ? "text-primary-400" : "text-slate-500")} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Tab Content Container */}
      <div className="space-y-6">
          {/* TAB 1: USER PROFILE & AVATAR */}
          {activeTab === 'Profile' && (
            <Card 
              title="Profile & Personal Information" 
              subtitle="Update your name, contact info, and profile avatar photo."
            >
              <div className="space-y-6 pt-2">
                {/* Avatar Section */}
                <div className="p-5 bg-slate-50/90 rounded-2xl border border-slate-200/70 space-y-4">
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="relative group shrink-0">
                      <div className="w-24 h-24 rounded-full bg-white border-4 border-primary-200 shadow-md overflow-hidden flex items-center justify-center">
                        {userProfile.avatar ? (
                          <img src={userProfile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-2xl">
                            {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2 text-center sm:text-left flex-1">
                      <h4 className="text-sm font-bold text-slate-900">Profile Photo & Avatar</h4>
                      <p className="text-xs text-slate-500">
                        Upload custom picture from your computer or pick from the avatar presets below.
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center sm:justify-start pt-1">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => avatarInputRef.current?.click()}
                          className="bg-white border-slate-200"
                        >
                          <Upload className="w-3.5 h-3.5 mr-1.5 text-primary-600" />
                          Upload Custom Photo
                        </Button>
                        {userProfile.avatar && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setUserProfile(p => ({ ...p, avatar: '' }))}
                            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                      <input 
                        type="file" 
                        ref={avatarInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleAvatarUpload}
                      />
                    </div>
                  </div>

                  {/* Preset Avatars Selection */}
                  <div className="pt-3 border-t border-slate-200/60">
                    <label className="text-xs font-bold text-slate-700 mb-2 block">
                      Or Choose a Quick Avatar Preset:
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {PRESET_AVATARS.map((av) => (
                        <button
                          key={av.id}
                          type="button"
                          onClick={() => setUserProfile(p => ({ ...p, avatar: av.url }))}
                          className={cn(
                            "flex items-center gap-2 p-1.5 pr-3 rounded-full border transition-all",
                            userProfile.avatar === av.url
                              ? "border-primary-500 bg-primary-50 ring-2 ring-primary-500/30"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          )}
                        >
                          <img src={av.url} alt={av.label} className="w-7 h-7 rounded-full object-cover" />
                          <span className="text-xs font-semibold text-slate-700">{av.label}</span>
                          {userProfile.avatar === av.url && (
                            <Check className="w-3.5 h-3.5 text-primary-600 ml-1" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input 
                    label="Full Name *" 
                    value={userProfile.name}
                    onChange={(e) => setUserProfile(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Ridoy Saha"
                  />
                  <Input 
                    label="Email Address *" 
                    value={userProfile.email}
                    onChange={(e) => setUserProfile(p => ({ ...p, email: e.target.value }))}
                    placeholder="ridoysaha440@gmail.com"
                    type="email"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input 
                    label="Phone Number" 
                    value={userProfile.phone || ''}
                    onChange={(e) => setUserProfile(p => ({ ...p, phone: e.target.value }))}
                    placeholder="e.g. 01318087631"
                  />
                  <Input 
                    label="Designation / Job Title" 
                    value={userProfile.designation || ''}
                    onChange={(e) => setUserProfile(p => ({ ...p, designation: e.target.value }))}
                    placeholder="e.g. Business Owner / Manager"
                  />
                </div>

                <div className="p-4 bg-primary-50/70 rounded-xl border border-primary-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-primary-900">User Role & Privileges</p>
                    <p className="text-sm font-bold text-primary-700 mt-0.5">{userProfile.role || 'Owner & Super Admin'}</p>
                  </div>
                  <span className="px-3 py-1 bg-primary-600 text-white text-xs font-semibold rounded-full shadow-2xs">
                    Full Administrative Access
                  </span>
                </div>

                <div className="pt-4 flex justify-end border-t border-slate-100">
                  <Button onClick={handleSaveUserProfile} className="bg-primary-600 hover:bg-primary-700 flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    Save Profile Changes
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* TAB 2: THEME, FONTS & RGB COLOR SYSTEM */}
          {activeTab === 'Theme & Branding' && (
            <div className="space-y-6">
              {/* RGB Color Customizer Card */}
              <Card 
                title="Theme Colors & RGB Color System" 
                subtitle="Choose presets or use the RGB color sliders and hex picker to customize your entire system theme."
              >
                <div className="space-y-6 pt-2">
                  {/* Color Preset Palette */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 mb-2.5 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary-600" />
                      Instant Preset Palettes:
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      {THEME_PRESETS.map((preset) => {
                        const isSelected = rgb.r === preset.rgb.r && rgb.g === preset.rgb.g && rgb.b === preset.rgb.b;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => handlePresetSelect(preset)}
                            className={cn(
                              "flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all",
                              isSelected 
                                ? "border-primary-500 bg-primary-50 shadow-xs ring-2 ring-primary-500/20 font-bold" 
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                            )}
                          >
                            <div className={cn("w-5 h-5 rounded-full shadow-xs shrink-0 flex items-center justify-center text-white", preset.colorClass)}>
                              {isSelected && <Check className="w-3 h-3" />}
                            </div>
                            <span className="text-xs text-slate-800 truncate">{preset.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* RGB Controls & Sliders */}
                  <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 pb-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-12 h-12 rounded-2xl shadow-sm border-2 border-white shrink-0 transition-transform duration-150 hover:scale-105"
                          style={{ backgroundColor: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` }}
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Color Value</p>
                          <p className="text-sm font-extrabold text-slate-900">
                            rgb({rgb.r}, {rgb.g}, {rgb.b})
                          </p>
                        </div>
                      </div>

                      {/* Hex and HTML Color Input */}
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                          <input 
                            type="color"
                            value={hexInput.length === 7 ? hexInput : '#14b8a6'}
                            onChange={(e) => handleHexChange(e.target.value)}
                            className="w-7 h-7 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
                            title="Open Color Picker"
                          />
                          <input 
                            type="text"
                            value={hexInput}
                            onChange={(e) => handleHexChange(e.target.value)}
                            placeholder="#14b8a6"
                            className="w-20 text-xs font-mono font-bold text-slate-800 uppercase focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 3 RGB Sliders */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {/* Red Slider */}
                      <div className="space-y-2 bg-white p-3.5 rounded-xl border border-slate-200/60 shadow-2xs">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-red-600 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                            Red (R)
                          </span>
                          <span className="font-mono font-bold text-slate-800 bg-red-50 px-2 py-0.5 rounded text-red-700">
                            {rgb.r}
                          </span>
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="255" 
                          value={rgb.r}
                          onChange={(e) => handleRgbChange('r', parseInt(e.target.value) || 0)}
                          className="w-full accent-red-500 cursor-pointer h-2 bg-slate-100 rounded-lg"
                        />
                      </div>

                      {/* Green Slider */}
                      <div className="space-y-2 bg-white p-3.5 rounded-xl border border-slate-200/60 shadow-2xs">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-green-600 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                            Green (G)
                          </span>
                          <span className="font-mono font-bold text-slate-800 bg-green-50 px-2 py-0.5 rounded text-green-700">
                            {rgb.g}
                          </span>
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="255" 
                          value={rgb.g}
                          onChange={(e) => handleRgbChange('g', parseInt(e.target.value) || 0)}
                          className="w-full accent-green-500 cursor-pointer h-2 bg-slate-100 rounded-lg"
                        />
                      </div>

                      {/* Blue Slider */}
                      <div className="space-y-2 bg-white p-3.5 rounded-xl border border-slate-200/60 shadow-2xs">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-blue-600 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                            Blue (B)
                          </span>
                          <span className="font-mono font-bold text-slate-800 bg-blue-50 px-2 py-0.5 rounded text-blue-700">
                            {rgb.b}
                          </span>
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="255" 
                          value={rgb.b}
                          onChange={(e) => handleRgbChange('b', parseInt(e.target.value) || 0)}
                          className="w-full accent-blue-500 cursor-pointer h-2 bg-slate-100 rounded-lg"
                        />
                      </div>
                    </div>

                    {/* Generated 10-Shades Preview */}
                    <div className="space-y-2 pt-2">
                      <div className="flex justify-between text-[11px] font-bold text-slate-500">
                        <span>Auto Generated Theme Palette Spectrum:</span>
                        <span>50 ➔ 900 Shades</span>
                      </div>
                      <div className="grid grid-cols-10 h-7 rounded-xl overflow-hidden border border-slate-300/60 shadow-2xs">
                        {Object.entries(currentPalette).map(([shadeName, colorVal], idx) => (
                          <div 
                            key={shadeName} 
                            style={{ backgroundColor: colorVal }}
                            className="h-full flex items-center justify-center text-[9px] font-bold select-none"
                            title={`${shadeName}: ${colorVal}`}
                          >
                            <span className={idx > 4 ? 'text-white' : 'text-slate-800'}>
                              {shadeName.replace('--theme-', '')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Logo Upload Section */}
                  <div className="pt-2">
                    <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-primary-600" />
                      Shop Branding & Sidebar Logo
                    </h4>
                    <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-slate-50/80 rounded-2xl border border-slate-200/60">
                      <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-300 overflow-hidden shrink-0 shadow-xs">
                        {businessSettings.logo ? (
                          <img src={businessSettings.logo} alt="Business Logo" className="w-full h-full object-contain p-1" />
                        ) : (
                          <Building2 className="w-8 h-8 text-slate-400" />
                        )}
                      </div>
                      <div className="space-y-2 text-center sm:text-left">
                        <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => logoInputRef.current?.click()}
                            className="bg-white"
                          >
                            <Upload className="w-3.5 h-3.5 mr-1.5 text-primary-600" />
                            Upload Store Logo
                          </Button>
                          <input 
                            type="file" 
                            ref={logoInputRef} 
                            className="hidden" 
                            accept="image/*" 
                            onChange={handleLogoUpload}
                          />
                          {businessSettings.logo && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => {
                                const updated = { ...businessSettings, logo: '' };
                                setBusinessSettings(updated);
                                storageService.saveBusinessSettings(updated);
                              }}
                              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            >
                              Remove Logo
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          Appears on invoice receipts and top sidebar (PNG/JPG, Max: 2MB).
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Font Styles Customizer Card */}
              <Card 
                title="Font Styles & Typography" 
                subtitle="Select your preferred application typeface with full Bengali & English language rendering."
              >
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {AVAILABLE_FONTS.map((font) => {
                      const isSelected = (businessSettings.fontFamily || 'plus-jakarta') === font.id;
                      return (
                        <div
                          key={font.id}
                          onClick={() => handleFontSelect(font)}
                          className={cn(
                            "p-4 rounded-2xl border-2 text-left cursor-pointer transition-all relative group flex flex-col justify-between",
                            isSelected 
                              ? "border-primary-500 bg-primary-50/40 shadow-xs ring-2 ring-primary-500/20" 
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                          )}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="text-sm font-bold text-slate-900">{font.name}</span>
                              {isSelected ? (
                                <span className="p-1 rounded-full bg-primary-500 text-white shadow-2xs">
                                  <Check className="w-3.5 h-3.5" />
                                </span>
                              ) : (
                                <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                                  Select
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium mb-3">{font.category}</p>
                          </div>
                          <div 
                            style={{ fontFamily: font.family }} 
                            className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/60 text-xs font-semibold text-slate-800 leading-relaxed"
                          >
                            {font.preview}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-4 flex justify-end border-t border-slate-100">
                    <Button onClick={handleSaveThemeSettings} className="bg-primary-600 hover:bg-primary-700 flex items-center gap-2 shadow-sm">
                      <Save className="w-4 h-4" />
                      Save & Apply All Branding
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* TAB 3: BUSINESS & INVOICE SETTINGS */}
          {activeTab === 'Business' && (
            <Card 
              title="Business Information & Invoice Setup" 
              subtitle="Details used in receipts, POS invoices, purchasing records, and header reports."
            >
              <div className="space-y-6 pt-2">
                {/* Live Brand Preview Card */}
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Live Brand Preview</span>
                    <p className="text-xs text-slate-400 mt-0.5">How your business name and tagline appear in Sidebar and Navbar:</p>
                  </div>
                  <div className="bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-2xs">
                    <BrandLogo 
                      name={businessSettings.name}
                      tagline={businessSettings.tagline}
                      logo={businessSettings.logo}
                      size="md"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input 
                    label="Business / Shop Name *" 
                    value={businessSettings.name}
                    onChange={(e) => setBusinessSettings(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Grocery Point"
                  />
                  <Input 
                    label="Tagline / Slogan (Under Logo)" 
                    value={businessSettings.tagline || ''}
                    onChange={(e) => setBusinessSettings(p => ({ ...p, tagline: e.target.value }))}
                    placeholder="e.g. Fresh Products • Better Life"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input 
                    label="Official Phone Number *" 
                    value={businessSettings.phone}
                    onChange={(e) => setBusinessSettings(p => ({ ...p, phone: e.target.value }))}
                    placeholder="e.g. 01318087631"
                  />
                  <Input 
                    label="Official Email Address" 
                    value={businessSettings.email}
                    onChange={(e) => setBusinessSettings(p => ({ ...p, email: e.target.value }))}
                    placeholder="shop@bizflow.com"
                    type="email"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <Input 
                    label="Website / Social Page" 
                    value={businessSettings.website}
                    onChange={(e) => setBusinessSettings(p => ({ ...p, website: e.target.value }))}
                    placeholder="https://facebook.com/yourshop"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Business Address (Printed on Invoices)</label>
                  <textarea 
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all placeholder:text-slate-400"
                    rows={2}
                    value={businessSettings.address}
                    onChange={(e) => setBusinessSettings(p => ({ ...p, address: e.target.value }))}
                    placeholder="House/Shop no, Road, Area, City, Post Code"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
                  <Input 
                    label="Currency Symbol" 
                    value={businessSettings.currency || 'BDT'}
                    onChange={(e) => setBusinessSettings(p => ({ ...p, currency: e.target.value }))}
                    placeholder="BDT or ৳"
                  />
                  <Input 
                    label="Opening Cash Balance (৳)" 
                    type="number"
                    value={businessSettings.opening_balance ?? 0}
                    onChange={(e) => setBusinessSettings(p => ({ ...p, opening_balance: parseFloat(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                  <Input 
                    label="Capital Investment (৳)" 
                    type="number"
                    value={businessSettings.total_investment ?? 0}
                    onChange={(e) => setBusinessSettings(p => ({ ...p, total_investment: parseFloat(e.target.value) || 0 }))}
                    placeholder="e.g. Shop setup"
                  />
                  <Input 
                    label="Default VAT / Tax (%)" 
                    type="number"
                    value={businessSettings.tax_rate ?? 0}
                    onChange={(e) => setBusinessSettings(p => ({ ...p, tax_rate: parseFloat(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                </div>

                {/* Invoice Customization Options */}
                <div className="space-y-4 pt-3 border-t border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary-600" />
                      Printed Invoice Header & Layout Controls
                    </h4>
                    <span className="text-xs text-slate-500 font-medium">Control what appears on top of your invoices</span>
                  </div>

                  {/* Header Branding Preset Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 block">
                      Select Invoice Header Branding Display:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { 
                          id: 'both', 
                          label: 'Both Logo & Shop Name', 
                          desc: 'Displays business logo and name together',
                          showLogo: true,
                          showName: true
                        },
                        { 
                          id: 'logo_only', 
                          label: 'Business Logo Only', 
                          desc: 'Displays only your store logo',
                          showLogo: true,
                          showName: false
                        },
                        { 
                          id: 'name_only', 
                          label: 'Shop Name Only (Text)', 
                          desc: 'Displays only the shop name in bold text',
                          showLogo: false,
                          showName: true
                        },
                      ].map(mode => {
                        const currentMode = businessSettings.invoice_header_mode || (
                          businessSettings.invoice_show_logo === false ? 'name_only' :
                          businessSettings.invoice_show_name === false ? 'logo_only' : 'both'
                        );
                        const isSelected = currentMode === mode.id;

                        return (
                          <div
                            key={mode.id}
                            onClick={() => {
                              setBusinessSettings(p => ({
                                ...p,
                                invoice_header_mode: mode.id as any,
                                invoice_show_logo: mode.showLogo,
                                invoice_show_name: mode.showName
                              }));
                            }}
                            className={cn(
                              "p-3.5 rounded-xl border-2 text-left cursor-pointer transition-all flex flex-col justify-between",
                              isSelected
                                ? "border-primary-600 bg-primary-50/50 shadow-2xs ring-2 ring-primary-500/20"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
                            )}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-slate-900">{mode.label}</span>
                              {isSelected ? (
                                <span className="w-2 h-2 rounded-full bg-primary-600 ring-2 ring-primary-200" />
                              ) : (
                                <span className="w-2 h-2 rounded-full bg-slate-300" />
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium leading-tight">{mode.desc}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Individual Checkbox Toggles */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
                    <label className="flex items-center gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200/70 cursor-pointer hover:bg-slate-100/80 transition-colors">
                      <input 
                        type="checkbox"
                        checked={businessSettings.invoice_show_logo !== false}
                        onChange={(e) => {
                          const showLogo = e.target.checked;
                          const showName = businessSettings.invoice_show_name !== false;
                          const mode = showLogo && showName ? 'both' : showLogo ? 'logo_only' : 'name_only';
                          setBusinessSettings(p => ({ ...p, invoice_show_logo: showLogo, invoice_header_mode: mode }));
                        }}
                        className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-xs font-semibold text-slate-700">Show Shop Logo</span>
                    </label>

                    <label className="flex items-center gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200/70 cursor-pointer hover:bg-slate-100/80 transition-colors">
                      <input 
                        type="checkbox"
                        checked={businessSettings.invoice_show_name !== false}
                        onChange={(e) => {
                          const showName = e.target.checked;
                          const showLogo = businessSettings.invoice_show_logo !== false;
                          const mode = showLogo && showName ? 'both' : showLogo ? 'logo_only' : 'name_only';
                          setBusinessSettings(p => ({ ...p, invoice_show_name: showName, invoice_header_mode: mode }));
                        }}
                        className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-xs font-semibold text-slate-700">Show Shop Name</span>
                    </label>

                    <label className="flex items-center gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200/70 cursor-pointer hover:bg-slate-100/80 transition-colors">
                      <input 
                        type="checkbox"
                        checked={businessSettings.invoice_show_phone !== false}
                        onChange={(e) => setBusinessSettings(p => ({ ...p, invoice_show_phone: e.target.checked }))}
                        className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-xs font-semibold text-slate-700">Show Contact Phone</span>
                    </label>

                    <label className="flex items-center gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200/70 cursor-pointer hover:bg-slate-100/80 transition-colors">
                      <input 
                        type="checkbox"
                        checked={Boolean(businessSettings.invoice_show_tax)}
                        onChange={(e) => setBusinessSettings(p => ({ ...p, invoice_show_tax: e.target.checked }))}
                        className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-xs font-semibold text-slate-700">Show Tax Breakdown</span>
                    </label>
                  </div>

                  {/* Live Mini Preview of Invoice Header */}
                  <div className="p-4 bg-slate-100/90 rounded-2xl border border-slate-200/80 space-y-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Live Sample Invoice Header Preview:
                    </span>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs text-center max-w-md mx-auto">
                      {/* Logo & Name Rendering according to settings */}
                      {businessSettings.invoice_show_logo !== false && businessSettings.logo && businessSettings.invoice_show_name !== false ? (
                        <div className="flex items-center justify-center gap-3 mb-2">
                          <img 
                            src={businessSettings.logo} 
                            alt="Logo Preview" 
                            className="h-10 w-auto max-h-12 object-contain" 
                          />
                          <div className="text-left">
                            <h3 className="font-extrabold text-base tracking-wider text-slate-900 uppercase leading-tight">
                              {businessSettings.name || "DAILY'S NEED"}
                            </h3>
                            {businessSettings.tagline && (
                              <p className="text-[10px] text-slate-500 font-medium leading-tight">{businessSettings.tagline}</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <>
                          {businessSettings.invoice_show_logo !== false && businessSettings.logo && (
                            <img 
                              src={businessSettings.logo} 
                              alt="Logo Preview" 
                              className="h-10 mx-auto mb-1.5 object-contain" 
                            />
                          )}
                          {businessSettings.invoice_show_name !== false && (
                            <h3 className="font-extrabold text-base tracking-wider text-slate-900 uppercase">
                              {businessSettings.name || "DAILY'S NEED"}
                            </h3>
                          )}
                        </>
                      )}
                      {businessSettings.address && (
                        <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{businessSettings.address}</p>
                      )}
                      {businessSettings.invoice_show_phone !== false && businessSettings.phone && (
                        <p className="text-[11px] text-slate-500 font-medium">Tel: {businessSettings.phone}</p>
                      )}
                      <div className="mt-2 text-[10px] text-indigo-600 font-bold tracking-widest border-t border-b border-dashed border-slate-200 py-1 uppercase">
                        *** CASH SALES RECEIPT ***
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <label className="text-sm font-medium text-slate-700">Invoice Footer Note / Greeting</label>
                    <input 
                      type="text"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                      value={businessSettings.invoice_footer_note || ''}
                      onChange={(e) => setBusinessSettings(p => ({ ...p, invoice_footer_note: e.target.value }))}
                      placeholder="e.g. Thank you, visit again!"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end border-t border-slate-100">
                  <Button onClick={handleSaveBusinessSettings} className="bg-primary-600 hover:bg-primary-700 flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    Save Business Info
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* TAB 4: NOTIFICATIONS & ALERTS */}
          {activeTab === 'Notifications' && (
            <Card 
              title="Notifications & Smart Alerts" 
              subtitle="Configure real-time alerts for low stock levels, pending payments, and summaries."
            >
              <div className="space-y-6 pt-2">
                <div className="space-y-4">
                  {/* Toggle 1: Low Stock Alerts */}
                  <div className="flex items-start justify-between p-4 bg-slate-50/80 rounded-2xl border border-slate-200/60 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start gap-3.5">
                      <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700 mt-0.5">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Low Stock Warning Alert</h4>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                          Show visual notification badges when product quantity reaches or falls below the minimum stock limit.
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4 mt-1">
                      <input 
                        type="checkbox" 
                        checked={notifications.low_stock_alerts}
                        onChange={(e) => setNotifications(p => ({ ...p, low_stock_alerts: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>

                  {/* Toggle 2: Customer Due Reminders */}
                  <div className="flex items-start justify-between p-4 bg-slate-50/80 rounded-2xl border border-slate-200/60 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start gap-3.5">
                      <div className="p-2.5 rounded-xl bg-purple-100 text-purple-700 mt-0.5">
                        <Bell className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Due & Credit Payment Reminders</h4>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                          Track pending receivables from credit customers and highlight overdue payments.
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4 mt-1">
                      <input 
                        type="checkbox" 
                        checked={notifications.due_payment_reminders}
                        onChange={(e) => setNotifications(p => ({ ...p, due_payment_reminders: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>

                  {/* Toggle 3: Daily Summary */}
                  <div className="flex items-start justify-between p-4 bg-slate-50/80 rounded-2xl border border-slate-200/60 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start gap-3.5">
                      <div className="p-2.5 rounded-xl bg-teal-100 text-teal-700 mt-0.5">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Daily Sales Summary Reports</h4>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                          Enable automatic end-of-day sales, revenue, and profit calculations on the analytics dashboard.
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4 mt-1">
                      <input 
                        type="checkbox" 
                        checked={notifications.daily_sales_summary}
                        onChange={(e) => setNotifications(p => ({ ...p, daily_sales_summary: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>

                  {/* Toggle 4: Sound Effects */}
                  <div className="flex items-start justify-between p-4 bg-slate-50/80 rounded-2xl border border-slate-200/60 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start gap-3.5">
                      <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700 mt-0.5">
                        <Volume2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">POS & Checkout Sound Feedback</h4>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                          Play audio notification chime when barcode scanning and invoice checkout completes.
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4 mt-1">
                      <input 
                        type="checkbox" 
                        checked={notifications.sound_effects}
                        onChange={(e) => setNotifications(p => ({ ...p, sound_effects: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                </div>

                <div className="pt-4 flex justify-end border-t border-slate-100">
                  <Button onClick={handleSaveNotifications} className="bg-primary-600 hover:bg-primary-700 flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    Save Notification Preferences
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* TAB 5: SECURITY & DATA BACKUP */}
          {activeTab === 'Security' && (
            <div className="space-y-6">
              {/* Change Password Card */}
              <Card 
                title="Account Security & Password" 
                subtitle="Ensure your shop account is protected with a secure password."
              >
                <form onSubmit={handleChangePassword} className="space-y-4 pt-2">
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <Lock className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Authenticated User</p>
                        <p className="text-sm font-bold text-slate-900">{firebaseUser?.email || userProfile.email}</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-full">
                      Protected
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">New Password</label>
                      <div className="relative">
                        <input
                          type={passwordState.showNew ? "text" : "password"}
                          value={passwordState.newPassword}
                          onChange={(e) => setPasswordState(p => ({ ...p, newPassword: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                          placeholder="Min 6 characters"
                        />
                        <button
                          type="button"
                          onClick={() => setPasswordState(p => ({ ...p, showNew: !p.showNew }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {passwordState.showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Confirm New Password</label>
                      <div className="relative">
                        <input
                          type={passwordState.showConfirm ? "text" : "password"}
                          value={passwordState.confirmPassword}
                          onChange={(e) => setPasswordState(p => ({ ...p, confirmPassword: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                          placeholder="Confirm password"
                        />
                        <button
                          type="button"
                          onClick={() => setPasswordState(p => ({ ...p, showConfirm: !p.showConfirm }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {passwordState.showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button type="submit" className="bg-primary-600 hover:bg-primary-700 flex items-center gap-2">
                      <KeyRound className="w-4 h-4" />
                      Update Password
                    </Button>
                  </div>
                </form>
              </Card>

              {/* Data Backup & Restore Card */}
              <Card 
                title="Data Backup & Disaster Recovery" 
                subtitle="Export complete business data for safe offline storage or restore from previous backup files."
              >
                <div className="space-y-6 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Export Card */}
                    <div className="p-5 rounded-2xl border border-slate-200/80 bg-slate-50/60 space-y-3">
                      <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center">
                        <Download className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">Export All Data (JSON)</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Downloads all items, categories, sales records, purchases, suppliers, customers, and business configuration in a single secure JSON file.
                      </p>
                      <Button 
                        onClick={handleExportBackup} 
                        className="w-full bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 shadow-2xs font-semibold"
                      >
                        <Download className="w-4 h-4 mr-2 text-primary-600" />
                        Download Full Backup (.json)
                      </Button>
                    </div>

                    {/* Import Card */}
                    <div className="p-5 rounded-2xl border border-slate-200/80 bg-slate-50/60 space-y-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                        <Upload className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">Restore Backup File</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Restore your previously exported JSON backup file. All database records will be synced with the backup content.
                      </p>
                      <Button 
                        onClick={() => importFileRef.current?.click()} 
                        className="w-full bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 shadow-2xs font-semibold"
                      >
                        <Upload className="w-4 h-4 mr-2 text-purple-600" />
                        Select Backup File to Restore
                      </Button>
                      <input 
                        type="file" 
                        ref={importFileRef} 
                        className="hidden" 
                        accept=".json,application/json" 
                        onChange={handleImportBackup} 
                      />
                    </div>
                  </div>

                  {/* Danger Zone: Reset Data */}
                  <div className="p-5 rounded-2xl border border-rose-200 bg-rose-50/50 space-y-3">
                    <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>Danger Zone: Clear Store Records</span>
                    </div>
                    <p className="text-xs text-rose-700 leading-relaxed">
                      This action will permanently delete all sales invoices, purchases, and products stored locally. Business configuration and user credentials will be preserved.
                    </p>
                    <Button 
                      variant="outline"
                      onClick={() => setShowResetModal(true)}
                      className="border-rose-300 text-rose-700 hover:bg-rose-100 font-semibold text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      Clear Inventory & Transactions
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}
      </div>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Are you absolutely sure?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                This will delete all sales, purchase records, inventory items, and transaction logs. To confirm, please type <span className="font-bold text-rose-600">DELETE ALL</span> below:
              </p>
            </div>
            <input 
              type="text"
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder="Type DELETE ALL to confirm"
              className="w-full px-3.5 py-2.5 rounded-xl border border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20 text-sm font-bold text-rose-900 uppercase"
            />
            <div className="flex gap-3 justify-end pt-2">
              <Button 
                variant="outline" 
                onClick={() => { setShowResetModal(false); setResetConfirmText(''); }}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleResetData}
                className="bg-rose-600 hover:bg-rose-700 text-white"
                disabled={resetConfirmText.trim().toLowerCase() !== 'delete all'}
              >
                Permanently Clear Data
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
