import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BarChart3, AlertCircle, ArrowRight, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { motion } from 'motion/react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { storageService } from '../services/storageService';

export const Signup: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    businessName: '',
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      // 1. Firebase Auth user creation
      let userCred;
      try {
        userCred = await createUserWithEmailAndPassword(auth, formData.email.trim(), formData.password);
        if (userCred.user) {
          await updateProfile(userCred.user, {
            displayName: formData.name.trim()
          });
        }
      } catch (fbErr: any) {
        console.error('Firebase createUser error:', fbErr?.code, fbErr?.message);
        if (fbErr.code === 'auth/email-already-in-use') {
          setError('This email address is already in use. Please use a different email or log in.');
          setIsLoading(false);
          return;
        } else if (fbErr.code === 'auth/weak-password') {
          setError('The password is too weak. Please use a stronger password (at least 6 characters).');
          setIsLoading(false);
          return;
        } else if (fbErr.code === 'auth/invalid-email') {
          setError('The email address is invalid.');
          setIsLoading(false);
          return;
        } else {
          setError(fbErr.message || 'Failed to create account in Firebase. Please try again.');
          setIsLoading(false);
          return;
        }
      }

      if (userCred && userCred.user) {
        // Initialize user in Firestore
        await storageService.initUser(userCred.user.uid);

        // Save customized business settings and profile in Firestore
        if (formData.businessName.trim()) {
          const currentSettings = storageService.getBusinessSettings();
          await storageService.saveBusinessSettings({
            ...currentSettings,
            name: formData.businessName.trim()
          });
        }

        await storageService.saveUserProfile({
          name: formData.name.trim(),
          email: formData.email.trim(),
          role: 'Owner & Super Admin',
          designation: 'Business Manager'
        });

        localStorage.setItem('bizflow_user', JSON.stringify({
          id: userCred.user.uid,
          name: formData.name.trim(),
          email: formData.email.trim(),
          businessName: formData.businessName.trim()
        }));
      }

      navigate('/');
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl shadow-lg shadow-primary-200 mb-3">
            <BarChart3 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Create Your Account</h1>
          <p className="text-slate-500 text-sm mt-1">Start managing sales, inventory & purchases with BizFlow</p>
        </div>

        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50">
          {error && (
            <div className="mb-5 p-3.5 bg-red-50 text-red-700 border border-red-200 rounded-xl flex items-start gap-3 text-xs sm:text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            <Input 
              label="Owner / Full Name"
              placeholder="e.g. Ridoy Saha"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            
            <Input 
              label="Shop / Business Name"
              placeholder="e.g. Grocery Point"
              value={formData.businessName}
              onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
            />

            <Input 
              label="Email Address"
              type="email"
              placeholder="name@company.com"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password (min 6 characters)
              </label>
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-3">
              <Button type="submit" className="w-full py-2.5 font-bold text-sm shadow-md shadow-primary-500/20" isLoading={isLoading}>
                Create Account & Sign In
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs sm:text-sm text-slate-500">
              Already have an account?{' '}
              <Link to="/login" className="font-bold text-primary-600 hover:text-primary-700 underline">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
