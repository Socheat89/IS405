import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  ShieldCheck, Key, Copy, Check, Smartphone, AlertTriangle, 
  Lock, CheckCircle2, ShieldAlert, Cpu, QrCode, Power, ShieldOff,
  Sparkles, Info, X, KeyRound, ArrowRight, RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/auth/authService';
import { useToast } from '../../context/ToastContext';

export const Security2FAPage = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [is2FAEnabled, setIs2FAEnabled] = useState(() => {
    return user?.twoFactorEnabled ?? true;
  });

  const [setupData, setSetupData] = useState(null);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [copied, setCopied] = useState(false);

  // Enable Flow State
  const [enableCode, setEnableCode] = useState('');
  const [enabling, setEnabling] = useState(false);

  // Disable Modal State
  const [disableModalOpen, setDisableModalOpen] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [disabling, setDisabling] = useState(false);
  const [disableError, setDisableError] = useState('');

  // Sync state with user info
  useEffect(() => {
    if (user?.twoFactorEnabled !== undefined) {
      setIs2FAEnabled(user.twoFactorEnabled);
    }
  }, [user]);

  // Auto-generate QR code and secret on mount IF 2FA is not yet enabled
  useEffect(() => {
    if (!is2FAEnabled && !setupData && !loadingSetup) {
      autoFetchSetupData();
    }
  }, [is2FAEnabled]);

  const autoFetchSetupData = async () => {
    setLoadingSetup(true);
    try {
      const data = await authService.setupTwoFactor();
      setSetupData(data);
    } catch (err) {
      console.warn('Auto 2FA setup failed:', err?.message);
    } finally {
      setLoadingSetup(false);
    }
  };

  const secret = setupData?.secret || '';
  const issuerName = 'Mekong Stock';
  const otpAuthUri = setupData?.otpAuthUri || (secret ? `otpauth://totp/${encodeURIComponent(issuerName)}:${encodeURIComponent(user?.username || 'User')}?secret=${secret}&issuer=${encodeURIComponent(issuerName)}&digits=6` : '');

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.info('បានចម្លង Secret Key ទៅកាន់ Clipboard រួចរាល់!', 'Copied Key');
    setTimeout(() => setCopied(false), 2000);
  };

  // Enable 2FA Handler
  const handleEnable2FA = async (e) => {
    e.preventDefault();
    if (enableCode.length !== 6) {
      toast.warning('សូមបញ្ចូលលេខកូដ ៦ ខ្ទង់ពី Authenticator App');
      return;
    }

    setEnabling(true);
    try {
      await authService.enableTwoFactor(enableCode);
      setIs2FAEnabled(true);
      setEnableCode('');
      setSetupData(null);
      toast.success('បានបើកដំណើរការ 2FA (Two-Factor Authentication) បានជោគជ័យ!', '2FA Enabled');
      
      // Update local storage user info
      const savedUser = localStorage.getItem('is405_user_info');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        parsed.twoFactorEnabled = true;
        localStorage.setItem('is405_user_info', JSON.stringify(parsed));
      }
    } catch (err) {
      const msg = typeof err === 'string' ? err : err?.response?.data?.message || err?.message || 'លេខកូដ 2FA មិនត្រឹមត្រូវ';
      toast.error(msg, '2FA Verification Failed');
    } finally {
      setEnabling(false);
    }
  };

  // Disable 2FA Handler
  const handleDisable2FA = async (e) => {
    e.preventDefault();
    if (disableCode.length !== 6) {
      setDisableError('សូមបញ្ចូលលេខកូដសម្ងាត់ ៦ ខ្ទង់');
      return;
    }

    setDisabling(true);
    setDisableError('');
    try {
      await authService.disableTwoFactor(disableCode);
      setIs2FAEnabled(false);
      setDisableModalOpen(false);
      setDisableCode('');
      toast.success('បានបិទ 2FA (Two-Factor Authentication) រួចរាល់!', '2FA Disabled');
      
      // Update local storage user info
      const savedUser = localStorage.getItem('is405_user_info');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        parsed.twoFactorEnabled = false;
        localStorage.setItem('is405_user_info', JSON.stringify(parsed));
      }

      // Auto-fetch fresh QR code for re-enabling
      autoFetchSetupData();
    } catch (err) {
      const msg = typeof err === 'string' ? err : err?.response?.data?.message || err?.message || 'លេខកូដ 2FA មិនត្រឹមត្រូវ';
      setDisableError(msg);
      toast.error(msg, 'Failed to Disable 2FA');
    } finally {
      setDisabling(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full max-w-[1600px] mx-auto space-y-6 pb-16">
      
      {/* Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#155e89] to-[#2089C8] text-white flex items-center justify-center shadow-xs border border-[#155e89]">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Security &amp; 2FA Control Hub</span>
              {is2FAEnabled ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Disabled
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Two-Factor Authentication (TOTP) configuration for account <strong className="text-slate-800">{user?.username}</strong>
            </p>
          </div>
        </div>

        {/* Top Status Action Button */}
        {is2FAEnabled ? (
          <button
            onClick={() => {
              setDisableError('');
              setDisableCode('');
              setDisableModalOpen(true);
            }}
            className="btn-danger px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-xs active:scale-95 transition-all shrink-0"
          >
            <ShieldOff className="w-4 h-4" />
            <span>Disable 2FA Protection</span>
          </button>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>2FA Setup Required</span>
          </div>
        )}
      </div>

      {/* Security Status Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`erp-card p-4 border-l-4 flex items-center justify-between bg-white ${
          is2FAEnabled ? 'border-l-emerald-500' : 'border-l-amber-500'
        }`}>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase">2FA Protection Status</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`w-2 h-2 rounded-full ${is2FAEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className={`text-sm font-bold ${is2FAEnabled ? 'text-emerald-800' : 'text-amber-800'}`}>
                {is2FAEnabled ? 'Fully Protected (Enforced)' : 'Not Protected (Disabled)'}
              </span>
            </div>
          </div>
          <div className={`p-2.5 rounded-xl border ${
            is2FAEnabled ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
          }`}>
            {is2FAEnabled ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
          </div>
        </div>

        <div className="erp-card p-4 border-l-4 border-l-[#2089C8] flex items-center justify-between bg-white">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Security Standard</span>
            <div className="mt-1">
              <span className="text-sm font-bold font-mono text-slate-900">RFC 6238 TOTP SHA-1</span>
            </div>
          </div>
          <div className="p-2.5 bg-sky-50 text-[#2089C8] rounded-xl border border-sky-100">
            <Cpu className="w-5 h-5" />
          </div>
        </div>

        <div className="erp-card p-4 border-l-4 border-l-blue-500 flex items-center justify-between bg-white">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Supported Authenticator Apps</span>
            <div className="mt-1">
              <span className="text-xs font-bold text-slate-800">Google, Microsoft, 1Password</span>
            </div>
          </div>
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
            <Smartphone className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ════════════════ CASE 1: 2FA IS ALREADY ENABLED (NO QR CODE) ════════════════ */}
      {is2FAEnabled ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Protection Card (Span 2 cols) */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  គណនីរបស់អ្នកត្រូវបានការពារដោយ 2FA រួចរាល់
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  រាល់ពេលដែលអ្នក Login ចូលក្នុងប្រព័ន្ធ Mekong Stock ERP អ្នកនឹងត្រូវបានតម្រូវឱ្យបញ្ចូលលេខកូដសុវត្ថិភាព ៦ ខ្ទង់ពី Authenticator App។
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Protection Type</span>
                <p className="text-xs font-bold text-slate-800">Time-based One-Time Password (TOTP)</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Account Linked</span>
                <p className="text-xs font-bold font-mono text-[#155e89]">@{user?.username} ({user?.email || 'Active'})</p>
              </div>
            </div>

            {/* Card Footer Note */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-600" />
                <span>QR Code ត្រូវបានលាក់ដោយស្វ័យប្រវត្តិដើម្បីសុវត្ថិភាពខ្ពស់</span>
              </div>
              <span className="text-[11px] font-mono text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                Protected
              </span>
            </div>
          </div>

          {/* Security Guidelines */}
          <div className="bg-slate-50 rounded-3xl border border-slate-200/80 p-6 space-y-4">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#2089C8]" />
              Security Tips &amp; Best Practices
            </h4>
            <ul className="space-y-3 text-xs text-slate-600">
              <li className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>កុំចែករំលែកលេខកូដ 2FA ទៅកាន់អ្នកដទៃជាដាច់ខាត។</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>ប្រើកម្មវិធី Google Authenticator ឬ Microsoft Authenticator ដែលមាន Cloud Backup។</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>ប្រសិនបើអ្នកបាត់ទូរស័ព្ទដៃ សូមទាក់ទង System Administrator ដើម្បី Reset 2FA។</span>
              </li>
            </ul>
          </div>
        </div>
      ) : (
        /* ════════════════ CASE 2: 2FA IS DISABLED (AUTO SHOW QR CODE & SETUP) ════════════════ */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Auto Generated QR Code Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-[#2089C8]" />
                  <span>Scan QR Code to Enable 2FA</span>
                </h3>
                <span className="text-[11px] font-mono text-[#155e89] bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-full font-bold">
                  Auto Generated
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-5">
                បើក Google Authenticator ឬ Microsoft Authenticator រួច Scan QR Code ខាងក្រោម៖
              </p>

              <div className="text-center">
                <div className="bg-gradient-to-b from-sky-50 to-white p-4 rounded-3xl border border-sky-200/80 inline-block shadow-sm mb-4">
                  {loadingSetup ? (
                    <div className="w-[180px] h-[180px] flex flex-col items-center justify-center gap-2 text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin text-[#2089C8]" />
                      <span className="text-[11px]">Generating Key...</span>
                    </div>
                  ) : otpAuthUri ? (
                    <QRCodeSVG value={otpAuthUri} size={180} level="M" includeMargin={true} />
                  ) : (
                    <div className="w-[180px] h-[180px] flex items-center justify-center text-slate-400 text-xs">
                      No Key Available
                    </div>
                  )}
                </div>

                {/* Secret Key Box */}
                {secret && (
                  <div className="bg-slate-50 px-3.5 py-2.5 rounded-2xl border border-slate-200 flex items-center justify-between text-xs max-w-sm mx-auto shadow-xs">
                    <div className="flex items-center gap-2 truncate">
                      <KeyRound className="w-4 h-4 text-[#2089C8] shrink-0" />
                      <span className="font-mono font-bold text-slate-800 tracking-wider truncate select-all">{secret}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(secret)}
                      className="px-2.5 py-1 bg-sky-100 hover:bg-sky-200 text-[#155e89] border border-sky-200 rounded-lg text-xs font-semibold shrink-0 transition-colors cursor-pointer"
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-400 text-center">
              Issuer: <strong className="text-slate-700">{issuerName}</strong> • Account: <strong className="text-slate-700">{user?.username}</strong>
            </div>
          </div>

          {/* Right: Enter 6-Digit Passcode to Activate */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-5">
              <div>
                <h3 className="font-bold text-slate-900 text-sm mb-1">Activate &amp; Enable 2FA</h3>
                <p className="text-xs text-slate-500">
                  បញ្ចូលលេខកូដ ៦ ខ្ទង់ពី Authenticator App ដើម្បីបញ្ជាក់ និងបើកដំណើរការ 2FA៖
                </p>
              </div>

              <form onSubmit={handleEnable2FA} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 text-center">
                    6-Digit Security Passcode
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={enableCode}
                    onChange={(e) => setEnableCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="000000"
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-center font-mono text-2xl font-black tracking-widest text-slate-900 focus:outline-none focus:border-[#2089C8] focus:bg-white focus:ring-4 focus:ring-[#2089C8]/15 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={enabling || enableCode.length !== 6}
                  className="w-full btn-primary py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all shadow-md shadow-[#2089C8]/20"
                >
                  {enabling ? (
                    <span className="inline-flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>កំពុងផ្ទៀងផ្ទាត់ និងបើក 2FA...</span>
                    </span>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Enable Two-Factor Authentication</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Steps Guide */}
            <div className="bg-slate-50 rounded-3xl border border-slate-200/80 p-6 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-[#2089C8]" />
                How to Enable 2FA
              </h4>
              <ul className="space-y-2.5 text-xs text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-sky-100 text-[#155e89] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <span>Scan the QR code with your mobile Authenticator App.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-sky-100 text-[#155e89] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <span>Enter the 6-digit verification code generated by the app above.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-sky-100 text-[#155e89] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <span>Click Enable to securely lock and protect your account.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════ DISABLE 2FA CONFIRMATION MODAL ════════════════ */}
      {disableModalOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 bg-rose-50/80 border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
                  <ShieldOff className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Disable 2FA Protection</h3>
                  <p className="text-[11px] text-slate-500">បញ្ជាក់ការបិទសុវត្ថិភាព 2FA</p>
                </div>
              </div>
              <button
                onClick={() => setDisableModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleDisable2FA} className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                តើអ្នកពិតជាចង់បិទ 2FA មែនទេ? សូមបញ្ចូលលេខកូដ ៦ ខ្ទង់ពី Authenticator App របស់អ្នកដើម្បីផ្ទៀងផ្ទាត់សុវត្ថិភាព៖
              </p>

              {disableError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{disableError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 text-center">
                  6-Digit Passcode
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="000000"
                  className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-center font-mono text-xl font-bold tracking-widest text-slate-900 focus:outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/15"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDisableModalOpen(false)}
                  className="btn-secondary flex-1 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disabling || disableCode.length !== 6}
                  className="btn-danger flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {disabling ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <ShieldOff className="w-3.5 h-3.5" />
                      <span>Confirm Disable</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
