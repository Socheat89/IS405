import React, { useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ShieldCheck, Copy, Check, ArrowRight, ArrowLeft, Smartphone, AlertTriangle,
  KeyRound, LogOut, Lock, Sparkles, CheckCircle2, QrCode, Key,
  Shield, HelpCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const SetupTwoFactorPage = () => {
  const { pendingTwoFactor, confirm2FA, loading, error, setError, logout } = useAuth();
  const [currentStep, setCurrentStep] = useState(1); // 1: QR Code Scan, 2: Enter 6-digit Code
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [activeDigitIndex, setActiveDigitIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRefs = useRef([]);

  const secret = pendingTwoFactor?.secret || '';
  const username = pendingTwoFactor?.username || 'User';
  const issuerName = 'Mekong Stock';

  // Standard TOTP URI formatting for Google / Microsoft Authenticator
  const otpAuthUri = `otpauth://totp/${encodeURIComponent(issuerName)}:${encodeURIComponent(username)}?secret=${secret}&issuer=${encodeURIComponent(issuerName)}&digits=6`;

  // Focus appropriate input when step changes
  useEffect(() => {
    if (currentStep === 2) {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 200);
    }
  }, [currentStep]);

  const handleCopySecret = () => {
    if (!secret) return;
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleGoToStep2 = () => {
    setError(null);
    setCurrentStep(2);
  };

  const handleBackToStep1 = () => {
    setError(null);
    setCurrentStep(1);
  };

  const submitCode = async (codeToSubmit) => {
    const code = codeToSubmit || digits.join('');
    if (code.length !== 6) {
      setError('សូមបញ្ចូលលេខកូដសម្ងាត់ ៦ ខ្ទង់ពី Authenticator App');
      return;
    }

    setIsSubmitting(true);
    try {
      await confirm2FA(code);
    } catch (err) {
      // Auto-clear digits and focus back to first box on failure
      setDigits(['', '', '', '', '', '']);
      setActiveDigitIndex(0);
      inputRefs.current[0]?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDigitChange = (index, value) => {
    // Handle paste of 6 digits
    if (value.length > 1) {
      const pasted = value.replace(/[^0-9]/g, '').slice(0, 6).split('');
      if (pasted.length > 0) {
        const newDigits = ['', '', '', '', '', ''];
        pasted.forEach((d, i) => {
          if (i < 6) newDigits[i] = d;
        });
        setDigits(newDigits);
        const nextFocus = Math.min(pasted.length, 5);
        setActiveDigitIndex(nextFocus);
        inputRefs.current[nextFocus]?.focus();

        // Auto-submit immediately if 6 digits are pasted
        if (pasted.length === 6) {
          submitCode(pasted.join(''));
        }
      }
      return;
    }

    const numVal = value.replace(/[^0-9]/g, '');
    const newDigits = [...digits];
    newDigits[index] = numVal;
    setDigits(newDigits);

    // Auto-advance to next input
    if (numVal && index < 5) {
      setActiveDigitIndex(index + 1);
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit instantly when the 6th digit is typed
    if (numVal && index === 5 && newDigits.every(d => d !== '')) {
      submitCode(newDigits.join(''));
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        setActiveDigitIndex(index - 1);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      setActiveDigitIndex(index - 1);
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      setActiveDigitIndex(index + 1);
      inputRefs.current[index + 1]?.focus();
    }
  };

  const fullCode = digits.join('');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/40 to-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans relative overflow-hidden">
      {/* Ambient background glow elements */}
      <div className="absolute top-0 right-0 w-[550px] h-[550px] bg-[#2089C8]/12 rounded-full -translate-y-1/3 translate-x-1/3 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[550px] h-[550px] bg-emerald-400/12 rounded-full translate-y-1/3 -translate-x-1/3 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-[400px] bg-sky-200/25 rounded-full blur-[130px] pointer-events-none" />

      {/* Main Container / Modal */}
      <div className="w-full max-w-lg bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-slate-900/10 border border-slate-200/90 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200 flex flex-col transition-all">
        
        {/* Branding Header */}
        <div className="bg-gradient-to-r from-[#155e89] via-[#2089C8] to-[#2aa2e8] p-6 sm:p-7 text-white text-center relative overflow-hidden shadow-sm">
          {/* Subtle light effect */}
          <div className="absolute inset-0 bg-radial from-white/20 to-transparent opacity-60 pointer-events-none" />

          {/* Logout Button */}
          <button
            onClick={logout}
            className="absolute top-4 right-4 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all backdrop-blur-md border border-white/20 shadow-sm cursor-pointer active:scale-95"
            title="Cancel and logout"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>

          <div className="relative z-10">
            <div className="inline-flex p-3 bg-white/15 rounded-2xl mb-2.5 backdrop-blur-md border border-white/25 shadow-inner">
              <ShieldCheck className="w-7 h-7 text-emerald-300" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white drop-shadow-sm">
              Two-Factor Authentication Setup
            </h1>
            <p className="text-sky-100 text-xs mt-1.5 font-medium max-w-sm mx-auto leading-relaxed">
              ភ្ជាប់គណនីរបស់អ្នកជាមួយ <strong className="text-white">Google Authenticator</strong> ឬ <strong className="text-white">Microsoft Authenticator</strong>
            </p>

            {/* Step Progress Pills */}
            <div className="flex items-center justify-center gap-2 mt-4">
              <div 
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  currentStep === 1 
                    ? 'bg-white text-[#155e89] shadow-md scale-105' 
                    : 'bg-white/20 text-white hover:bg-white/30 cursor-pointer'
                }`}
                onClick={() => setCurrentStep(1)}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${currentStep === 1 ? 'bg-[#2089C8] text-white' : 'bg-white/40 text-white'}`}>1</span>
                <span>Scan QR</span>
              </div>
              <div className="w-4 h-0.5 bg-white/30 rounded-full" />
              <div 
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  currentStep === 2 
                    ? 'bg-white text-[#155e89] shadow-md scale-105' 
                    : 'bg-white/20 text-white'
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${currentStep === 2 ? 'bg-[#2089C8] text-white' : 'bg-white/40 text-white'}`}>2</span>
                <span>Enter Code</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Step Content */}
        <div className="p-6 sm:p-8">
          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* ════════════════ STEP 1: SCAN QR CODE ════════════════ */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-250">
              <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-[#2089C8]" />
                    <span>Scan QR Code with Authenticator App</span>
                  </span>
                  <span className="text-[11px] font-mono font-bold text-[#155e89] bg-sky-100/80 px-2.5 py-0.5 rounded-full border border-sky-200 shadow-xs">
                    @{username}
                  </span>
                </div>

                {/* QR Code Container with subtle hover zoom */}
                <div className="flex justify-center pt-1">
                  <div className="p-4 bg-white rounded-2xl shadow-md border border-slate-200/80 inline-block hover:shadow-xl hover:scale-[1.02] transition-all">
                    <QRCodeSVG
                      value={otpAuthUri}
                      size={180}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                </div>

                {/* Manual Secret Key Card */}
                <div className="pt-1">
                  <div className="text-[11px] text-slate-500 text-center mb-1.5 font-medium">
                    ឬវាយបញ្ចូល Key ដោយដៃ (Manual Entry):
                  </div>
                  <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2 max-w-sm mx-auto shadow-xs hover:border-slate-300 transition-colors">
                    <div className="flex items-center gap-2 truncate">
                      <KeyRound className="w-4 h-4 text-[#2089C8] shrink-0" />
                      <span className="font-mono text-xs font-bold text-slate-800 tracking-wider select-all truncate">
                        {secret}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-[#155e89] border border-sky-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all shrink-0 cursor-pointer shadow-xs active:scale-95"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#2089C8]" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action: Next Step */}
              <button
                type="button"
                onClick={handleGoToStep2}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#2089C8]/25 cursor-pointer bg-gradient-to-r from-[#155e89] to-[#2089C8] hover:from-[#134d70] hover:to-[#1a77af] active:scale-[0.99] text-white border border-[#155e89]"
              >
                <span>ខ្ញុំបាន Scan រួចរាល់ (Next: Enter 6-Digit Code)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ════════════════ STEP 2: ENTER 6-DIGIT CODE ════════════════ */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-250">
              
              {/* Back to QR Code Header */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleBackToStep1}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#2089C8] transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-slate-50"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>ត្រឡប់ទៅមើល QR Code វិញ</span>
                </button>

                <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#155e89] bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-full font-bold">
                  <Smartphone className="w-3 h-3 text-[#2089C8]" />
                  <span>Authenticator</span>
                </div>
              </div>

              {/* Input Card Container */}
              <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-6 text-center space-y-4 shadow-sm">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-sky-100 text-[#2089C8] flex items-center justify-center mx-auto mb-2.5 shadow-inner border border-sky-200">
                    <Shield className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Enter 6-Digit Verification Code
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    សូមមើលលេខកូដ ៦ ខ្ទង់ក្នុង Authenticator App របស់អ្នក ហើយវាយបញ្ចូលខាងក្រោម
                  </p>
                </div>

                {/* 6 Segmented Boxes with Active Pulse & Micro-animations */}
                <div className="pt-2">
                  <div className="flex items-center justify-center gap-2.5 max-w-xs mx-auto">
                    {digits.map((digit, idx) => {
                      const isActive = activeDigitIndex === idx;
                      const isFilled = digit !== '';
                      return (
                        <div key={idx} className="relative">
                          <input
                            ref={(el) => (inputRefs.current[idx] = el)}
                            type="text"
                            inputMode="numeric"
                            maxLength={idx === 0 ? 6 : 1}
                            value={digit}
                            onFocus={() => setActiveDigitIndex(idx)}
                            onChange={(e) => handleDigitChange(idx, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(idx, e.key)}
                            className={`w-11 sm:w-12 h-14 text-center text-2xl font-mono font-black rounded-xl outline-none transition-all shadow-xs ${
                              isFilled
                                ? 'bg-white border-2 border-[#2089C8] text-[#155e89] shadow-md shadow-[#2089C8]/10 scale-105'
                                : isActive
                                ? 'bg-white border-2 border-[#2089C8] ring-4 ring-[#2089C8]/15'
                                : 'bg-white/80 border-2 border-slate-200 text-slate-900 hover:border-slate-300'
                            }`}
                            placeholder="•"
                            disabled={loading || isSubmitting}
                          />
                          {/* Active dot indicator */}
                          {isActive && !isFilled && (
                            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#2089C8] rounded-full animate-ping" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Auto submit status indication */}
                <div className="pt-1">
                  {isSubmitting || loading ? (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-100 text-[#155e89] text-xs font-bold animate-pulse">
                      <span className="w-3.5 h-3.5 border-2 border-[#2089C8] border-t-transparent rounded-full animate-spin" />
                      <span>កំពុងផ្ទៀងផ្ទាត់ និងចូលប្រព័ន្ធដោយស្វ័យប្រវត្តិ...</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-medium">
                      វាយគ្រប់ ៦ ខ្ទង់ វានឹង <strong className="text-slate-600">Auto Verify</strong> ចូលប្រព័ន្ធភ្លាមៗ
                    </span>
                  )}
                </div>
              </div>

              {/* Fallback Manual Submit Button */}
              <button
                type="button"
                onClick={() => submitCode()}
                disabled={loading || isSubmitting || fullCode.length !== 6}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#2089C8]/25 cursor-pointer bg-gradient-to-r from-[#155e89] to-[#2089C8] hover:from-[#134d70] hover:to-[#1a77af] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none text-white border border-[#155e89]"
              >
                {loading || isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>កំពុងផ្ទៀងផ្ទាត់លេខកូដ...</span>
                  </span>
                ) : (
                  <>
                    <span>Complete Setup &amp; Enter System</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50/80 px-6 py-3.5 border-t border-slate-100 text-center text-[11px] text-slate-400 font-medium">
          Mekong Stock Security • RFC 6238 Standard Time-based One-Time Password
        </div>
      </div>
    </div>
  );
};
