import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BarChart3, AlertCircle, Mail, Lock, Eye, EyeOff, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { motion } from 'motion/react';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { storageService } from '../services/storageService';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleEmailPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Firebase Auth Email/Password
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);

      // Initialize user's Firestore database connection
      await storageService.initUser(userCredential.user.uid);

      localStorage.setItem('bizflow_user', JSON.stringify({ 
        email: userCredential.user.email, 
        name: userCredential.user.displayName || email.split('@')[0], 
        id: userCredential.user.uid 
      }));
      navigate('/');
    } catch (err: any) {
      console.error('Firebase Auth email sign in failed:', err?.code, err?.message);

      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password. Please try again.');
      } else if (err.code === 'auth/user-not-found') {
        setError('No account found with this email. Please sign up first.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please wait a moment and retry.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError(err.message || 'Failed to sign in. Please verify your credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        await storageService.initUser(result.user.uid);

        localStorage.setItem('bizflow_user', JSON.stringify({
          email: result.user.email,
          name: result.user.displayName || 'Google User',
          id: result.user.uid
        }));
      }
      navigate('/');
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      if (err.code === 'auth/popup-blocked') {
        setError('Google popup was blocked by your browser. Please allow popups or use Email & Password below.');
      } else if (err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user') {
        setError('Sign in with Google was closed. You can also sign in with Email & Password.');
      } else {
        setError(err.message || 'Google sign-in encountered an issue. Please sign in with Email and Password.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setEmail('admin@bizflow.com');
    setPassword('admin123');
    setError(null);
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
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Welcome Back</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in with your Email & Password to access BizFlow POS</p>
        </div>

        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50">
          {error && (
            <div className="mb-5 p-3.5 bg-red-50 text-red-700 border border-red-200 rounded-xl flex items-start gap-3 text-xs sm:text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
              <div className="flex-1">
                <p className="font-medium">{error}</p>
              </div>
            </div>
          )}

          {/* Email & Password Form */}
          <form onSubmit={handleEmailPasswordLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@business.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
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

            <Button
              type="submit"
              className="w-full py-2.5 font-bold text-sm shadow-md shadow-primary-500/20"
              isLoading={isLoading}
            >
              Sign In with Email
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-slate-400 font-medium">Or continue with</span>
            </div>
          </div>

          {/* Google Sign In Button */}
          <Button 
            type="button" 
            variant="outline"
            className="w-full flex items-center justify-center gap-3 bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:text-slate-900 py-2.5" 
            onClick={handleGoogleLogin} 
            isLoading={isGoogleLoading}
          >
            {!isGoogleLoading && (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            Sign in with Google
          </Button>

          {/* Footer Register Link */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs sm:text-sm text-slate-500">
              Don't have an account?{' '}
              <Link to="/signup" className="font-bold text-primary-600 hover:text-primary-700 underline">
                Create an Account
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
