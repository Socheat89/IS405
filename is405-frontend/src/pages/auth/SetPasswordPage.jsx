import React, { useState, useEffect, useMemo } from 'react';
import { 
  Lock, Eye, EyeOff, ShieldCheck, CheckCircle2, XCircle, 
  AlertCircle, ArrowRight, UserCheck, Sparkles, KeyRound, Mail, Check
} from 'lucide-react';
import { authService } from '../../services/auth/authService';
import { checkPasswordStrength } from '../../utils/passwordPolicy';

export const SetPasswordPage = ({ onNavigateLogin }) => {
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [validatingToken, setValidatingToken] = useState(true);
  const [tokenError, setTokenError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Extract query parameters from window.location (supports both standard search and hash-based query)
  useEffect(() => {
    let tokenParam = '';
    let emailParam = '';

    // Check window.location.search
    const searchParams = new URLSearchParams(window.location.search);
    tokenParam = searchParams.get('token') || '';
    emailParam = searchParams.get('email') || '';

    // If not in search, check in hash (e.g., #set-password?token=...&email=...)
    if (!tokenParam || !emailParam) {
      const hash = window.location.hash;
      const qIndex = hash.indexOf('?');
      if (qIndex !== -1) {
        const hashParams = new URLSearchParams(hash.substring(qIndex));
        tokenParam = tokenParam || hashParams.get('token') || '';
        emailParam = emailParam || hashParams.get('email') || '';
      }
    }

    setToken(tokenParam);
    setEmail(emailParam);

    if (!tokenParam || !emailParam) {
      setTokenError('Invitation link is invalid or incomplete. Please check your invitation email.');
      setValidatingToken(false);
      return;
    }

    // Validate token with backend
    async function validate() {
      try {
        const res = await authService.validateInvitation(tokenParam, emailParam);
        if (res && res.isValid) {
          setUsername(res.username || '');
        } else {
          setTokenError(res?.message || 'This invitation link is invalid or has expired.');
        }
      } catch (err) {
        setTokenError(typeof err === 'string' ? err : err?.message || 'Failed to validate invitation link.');
      } finally {
        setValidatingToken(false);
      }
    }

    validate();
  }, []);

  const strength = useMemo(() => {
    return checkPasswordStrength(password);
  }, [password]);

  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!strength.isStrong) {
      setSubmitError('Please ensure your password satisfies all security requirements.');
      return;
    }

    if (!passwordsMatch) {
      setSubmitError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      await authService.setPassword(token, email, password, confirmPassword);
      setIsSuccess(true);
    } catch (err) {
      setSubmitError(typeof err === 'string' ? err : err?.message || 'Error setting password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoToLogin = () => {
    window.location.hash = '';
    if (onNavigateLogin) {
      onNavigateLogin();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="auth-page min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-teal-950 to-emerald-950 relative overflow-hidden">
      {/* Decorative ambient blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg relative z-10 bg-white shadow-2xl rounded-3xl overflow-hidden border border-slate-200/80 my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 px-8 py-6 text-white text-center relative overflow-hidden">
          <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/20 shadow-inner">
            <KeyRound className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">Set Your Strong Password</h1>
          <p className="text-emerald-200 text-xs mt-1 font-medium">
            Mekong Stock ERP · Account Activation &amp; Security Setup
          </p>
        </div>

        {/* Form Body */}
        <div className="p-8 bg-white">
          {validatingToken ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-gray-500 font-medium">Validating invitation token...</p>
            </div>
          ) : tokenError ? (
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto border border-rose-100 shadow-sm">
                <XCircle className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-gray-900">Invalid or Expired Link</h3>
                <p className="text-xs text-rose-600 max-w-sm mx-auto leading-relaxed font-medium">
                  {tokenError}
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleGoToLogin}
                  className="btn-secondary py-2.5 px-6 text-xs inline-flex items-center gap-2 cursor-pointer font-bold"
                >
                  <span>Return to Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : isSuccess ? (
            <div className="space-y-6 text-center py-4 animate-fade-in">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto border border-emerald-100 shadow-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-extrabold text-gray-900">Account Activated Successfully!</h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
                  Your password has been configured and saved securely. You can now sign in to access your Mekong Stock ERP dashboard.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleGoToLogin}
                  className="btn-primary w-full py-3.5 text-sm font-bold shadow-lg shadow-emerald-600/25 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Proceed to Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Account Info Pill */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-emerald-950 truncate">
                    Welcome, {username || 'New User'}
                  </p>
                  <p className="text-[10px] text-emerald-700 truncate font-mono">
                    {email}
                  </p>
                </div>
              </div>

              {submitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span className="font-semibold">{submitError}</span>
                </div>
              )}

              {/* Password Input */}
              <div>
                <label className="form-label flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Lock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Create Password</span>
                  </span>
                  <span className={`text-[11px] font-bold font-mono ${
                    strength.isStrong ? 'text-emerald-700' : strength.metCount >= 3 ? 'text-amber-700' : 'text-rose-600'
                  }`}>
                    {strength.strengthLabel} ({strength.metCount}/5)
                  </span>
                </label>

                <div className="relative flex items-center mt-1">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new strong password"
                    className="form-input !pr-11 h-11 text-sm rounded-xl font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Strength Meter Bar */}
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mt-2">
                  <div 
                    className={`h-full transition-all duration-300 ${
                      strength.isStrong 
                        ? 'bg-emerald-500' 
                        : strength.metCount >= 3 
                          ? 'bg-amber-500' 
                          : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.max(5, strength.percentage)}%` }}
                  />
                </div>
              </div>

              {/* Strong Password Criteria Checklist */}
              <div className="p-3.5 bg-gray-50/80 border border-gray-200 rounded-2xl space-y-2">
                <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Strong Password Checklist:</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {strength.criteria.map((c) => (
                    <div 
                      key={c.id} 
                      className={`flex items-center gap-2 text-[11px] transition-colors ${
                        c.met ? 'text-emerald-700 font-bold' : 'text-gray-400'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                        c.met ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-400'
                      }`}>
                        {c.met ? <Check className="w-2.5 h-2.5" /> : <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />}
                      </div>
                      <span className="truncate">{c.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Confirm Password Input */}
              <div>
                <label className="form-label flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Lock className="w-3.5 h-3.5 text-gray-400" />
                    <span>Confirm Password</span>
                  </span>
                  {confirmPassword && (
                    <span className={`text-[11px] font-bold ${
                      passwordsMatch ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {passwordsMatch ? '✓ Passwords match' : '✗ Does not match'}
                    </span>
                  )}
                </label>

                <div className="relative flex items-center mt-1">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className={`form-input !pr-11 h-11 text-sm rounded-xl font-mono ${
                      confirmPassword && !passwordsMatch ? 'border-rose-300 ring-1 ring-rose-200' : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting || !strength.isStrong || !passwordsMatch}
                className="btn-primary w-full py-3.5 text-sm font-bold shadow-lg shadow-emerald-600/25 hover:shadow-xl hover:shadow-emerald-600/35 transition-all rounded-xl cursor-pointer flex items-center justify-center gap-2 border-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="spinner !w-4 !h-4 border-white/30 !border-t-white" />
                    Securing Account...
                  </span>
                ) : (
                  <>
                    <span>Activate Account &amp; Set Password</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50/80 border-t border-gray-100 px-6 py-3.5 text-center text-[11px] text-gray-400 font-medium">
          Mekong Stock Microservices System · 24-Hour Token Security
        </div>
      </div>
    </div>
  );
};
