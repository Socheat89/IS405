import React, { useState } from 'react';
import { User, Lock, ArrowRight, Info, Eye, EyeOff, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const LoginPage = () => {
  const { login, loading, error, setError } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter your username and password.');
      return;
    }
    try { 
      await login(username, password); 
    } catch (err) {}
  };

  return (
    <div className="auth-page">
      {/* Decorative blobs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-100/60 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-teal-100/50 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl pointer-events-none" />

      <div className="auth-card w-full max-w-md relative z-10 shadow-2xl rounded-3xl overflow-hidden border border-slate-200/80">
        {/* Header */}
        <div className="auth-card-header pb-6">
          <div className="relative z-10 text-center">
            <div className="inline-flex p-3.5 bg-white/15 rounded-2xl mb-3 border border-white/20 shadow-inner">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Mekong Stock ERP</h1>
            <p className="text-emerald-100 text-xs mt-1.5 font-medium">
              Inventory · Purchase Orders · Sales · Microservices
            </p>
          </div>
        </div>

        {/* Form body */}
        <div className="p-8 bg-white">
          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="form-label">Username</label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none flex items-center">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="form-input !pl-11 h-11 text-sm rounded-xl"
                  style={{ paddingLeft: '2.75rem' }}
                />
              </div>
            </div>

            <div>
              <label className="form-label">Password</label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none flex items-center">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="form-input !pl-11 !pr-11 h-11 text-sm rounded-xl font-mono"
                  style={{ paddingLeft: '2.75rem', paddingRight: '2.75rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3.5 text-sm font-bold shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 transition-all rounded-xl cursor-pointer flex items-center justify-center gap-2 border-0"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="spinner !w-4 !h-4 border-white/30 !border-t-white" />
                  Authenticating...
                </span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="bg-gray-50/80 border-t border-gray-100 px-6 py-3.5 text-center text-[11px] text-gray-400 font-medium">
          Mekong Stock Microservices · Inventory &amp; Sales Management System
        </div>
      </div>
    </div>
  );
};
