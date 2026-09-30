import React, { useState, useRef, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, ArrowRight, LogOut, KeyRound, Lock, Sparkles, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const VerifyTwoFactorPage = () => {
  const { verify2FA, loading, error, setError, logout, pendingTwoFactor } = useAuth();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleDigitChange = (index, value) => {
    // Handle paste of 6 digits
    if (value.length > 1) {
      const pasted = value.replace(/[^0-9]/g, '').slice(0, 6).split('');
      if (pasted.length > 0) {
        const newDigits = [...digits];
        pasted.forEach((d, i) => {
          if (index + i < 6) newDigits[index + i] = d;
        });
        setDigits(newDigits);
        const nextFocus = Math.min(index + pasted.length, 5);
        inputRefs.current[nextFocus]?.focus();

        if (newDigits.every(d => d !== '') && newDigits.length === 6) {
          submitCode(newDigits.join(''));
        }
      }
      return;
    }

    const numVal = value.replace(/[^0-9]/g, '');
    const newDigits = [...digits];
    newDigits[index] = numVal;
    setDigits(newDigits);

    // Auto-advance
    if (numVal && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when last digit is filled
    if (numVal && index === 5 && newDigits.every(d => d !== '')) {
      submitCode(newDigits.join(''));
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const fullCode = digits.join('');

  const submitCode = async (codeToSubmit) => {
    const code = codeToSubmit || fullCode;
    if (code.length !== 6) {
      setError('សូមបញ្ចូលលេខកូដសម្ងាត់ ៦ ខ្ទង់ពី Authenticator App');
      return;
    }
    try {
      await verify2FA(code);
    } catch (err) {
      // Error handled in AuthContext
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submitCode();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/40 to-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans relative overflow-hidden">
      {/* Decorative Branding Background Blobs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#2089C8]/10 rounded-full -translate-y-1/3 translate-x-1/3 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-400/10 rounded-full translate-y-1/3 -translate-x-1/3 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-slate-900/10 overflow-hidden border border-slate-200/90 z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#155e89] via-[#2089C8] to-[#2aa2e8] p-6 sm:p-7 text-white text-center relative overflow-hidden shadow-sm">
          {/* Light radial effect */}
          <div className="absolute inset-0 bg-radial from-white/20 to-transparent opacity-60 pointer-events-none" />

          {/* Logout Button */}
          <button
            onClick={logout}
            className="absolute top-4 right-4 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all backdrop-blur-md border border-white/20 shadow-sm cursor-pointer"
            title="Logout"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>

          <div className="relative z-10">
            <div className="inline-flex p-3 bg-white/15 rounded-2xl mb-2.5 backdrop-blur-md border border-white/25 shadow-inner">
              <ShieldCheck className="w-7 h-7 text-emerald-300" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white drop-shadow-sm">
              Two-Factor Verification
            </h1>
            <p className="text-sky-100 text-xs mt-1 font-medium">
              បញ្ចូលលេខកូដសុវត្ថិភាព ៦ ខ្ទង់ពី Authenticator App របស់អ្នក
            </p>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Account Indicator */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl flex items-center justify-between text-xs shadow-xs">
            <span className="text-slate-500 font-medium">Authenticating User:</span>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#2089C8] text-white font-extrabold flex items-center justify-center text-[11px] shadow-xs">
                {(pendingTwoFactor?.username || 'U').charAt(0).toUpperCase()}
              </div>
              <span className="font-bold text-slate-800 font-mono">
                {pendingTwoFactor?.username || 'User'}
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 text-center">
                Security Passcode (TOTP)
              </label>

              {/* 6 Digit Segmented Input Boxes */}
              <div className="flex items-center justify-center gap-2.5 max-w-xs mx-auto">
                {digits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (inputRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={idx === 0 ? 6 : 1}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e.key)}
                    className="w-11 h-13 text-center text-xl font-mono font-black bg-slate-50/80 border-2 border-slate-200 focus:border-[#2089C8] focus:bg-white focus:ring-4 focus:ring-[#2089C8]/15 rounded-xl text-slate-900 outline-none transition-all shadow-xs"
                    placeholder="•"
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || fullCode.length !== 6}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#2089C8]/25 cursor-pointer bg-gradient-to-r from-[#155e89] to-[#2089C8] hover:from-[#134d70] hover:to-[#1a77af] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none text-white border border-[#155e89]"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>កំពុងផ្ទៀងផ្ទាត់លេខកូដ...</span>
                </span>
              ) : (
                <>
                  <span>Verify &amp; Enter System</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="bg-slate-50/80 px-6 py-3.5 border-t border-slate-100 text-center text-[11px] text-slate-400 font-medium">
          Mekong Stock Security Gateway • TOTP Enforced
        </div>
      </div>
    </div>
  );
};
