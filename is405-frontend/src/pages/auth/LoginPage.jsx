import React, { useState, useEffect, useRef } from 'react';
import { User, Lock, ArrowRight, Info, Eye, EyeOff, Zap, QrCode, Smartphone, RefreshCw, CheckCircle2, ShieldCheck, Copy, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { authService } from '../../services/auth/authService';

export const LoginPage = () => {
  const { login, loginWithQr, loading, error, setError } = useAuth();
  const { t, isKhmer } = useLanguage();

  // Login Mode: 'password' or 'qr'
  const [authMode, setAuthMode] = useState('password');

  // Password Login state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // QR Code Login state
  const [qrToken, setQrToken] = useState('');
  const [approvalUrl, setApprovalUrl] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  const [qrStatus, setQrStatus] = useState('Pending'); // 'Pending', 'Scanned', 'Approved', 'Expired', 'Rejected'
  const [qrExpiresAt, setQrExpiresAt] = useState(null);
  const [timeLeft, setTimeLeft] = useState(180);
  const [copiedLink, setCopiedLink] = useState(false);

  const pollIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // Start QR session when switching to QR mode
  useEffect(() => {
    if (authMode === 'qr') {
      initializeQrSession();
    } else {
      stopPolling();
      stopTimer();
    }

    return () => {
      stopPolling();
      stopTimer();
    };
  }, [authMode]);

  // Handle countdown timer
  useEffect(() => {
    if (authMode !== 'qr' || !qrExpiresAt) return;

    stopTimer();
    timerIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const expires = new Date(qrExpiresAt).getTime();
      const diffSec = Math.max(0, Math.floor((expires - now) / 1000));
      setTimeLeft(diffSec);

      if (diffSec <= 0) {
        setQrStatus('Expired');
        stopPolling();
        stopTimer();
      }
    }, 1000);

    return () => stopTimer();
  }, [qrExpiresAt, authMode]);

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const initializeQrSession = async () => {
    stopPolling();
    stopTimer();
    setQrLoading(true);
    setError(null);
    setQrStatus('Pending');
    setTimeLeft(180);

    try {
      const origin = window.location.origin;
      const res = await authService.generateQrLogin(origin);
      setQrToken(res.qrToken);
      setApprovalUrl(res.approvalUrl);
      setQrCodeDataUrl(res.qrCodeDataUrl || '');
      setQrExpiresAt(res.expiresAtUtc);
      setTimeLeft(res.expiresInSeconds || 180);

      // Start polling
      startPolling(res.qrToken);
    } catch (err) {
      setError(typeof err === 'string' ? err : err?.message || 'Failed to initialize QR login.');
      setQrStatus('Error');
    } finally {
      setQrLoading(false);
    }
  };

  const startPolling = (token) => {
    stopPolling();
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await authService.getQrLoginStatus(token);
        if (res.status === 'Scanned') {
          setQrStatus('Scanned');
        } else if (res.status === 'Approved') {
          setQrStatus('Approved');
          stopPolling();
          stopTimer();

          // Instant authentication without password or 2FA!
          setTimeout(() => {
            loginWithQr(res.accessToken, res.user);
          }, 800);
        } else if (res.status === 'Expired') {
          setQrStatus('Expired');
          stopPolling();
          stopTimer();
        } else if (res.status === 'Rejected') {
          setQrStatus('Rejected');
          stopPolling();
          stopTimer();
        }
      } catch (err) {
        console.warn('[QR Poll] check failed:', err);
      }
    }, 1500);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError(t('Please enter your username and password.', 'សូមវាយបញ្ចូលឈ្មោះគណនី និងលេខសម្ងាត់របស់អ្នក។'));
      return;
    }
    try {
      await login(username, password);
    } catch (err) {}
  };

  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleCopyLink = () => {
    if (!approvalUrl) return;
    navigator.clipboard.writeText(approvalUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="auth-page">
      {/* Decorative background blobs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-100/60 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-teal-100/50 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl pointer-events-none" />

      <div className="auth-card w-full max-w-md relative z-10 shadow-2xl rounded-3xl overflow-hidden border border-slate-200/80">
        
        {/* Header */}
        <div className="auth-card-header pb-5">
          <div className="relative z-10 text-center">
            <div className="inline-flex p-3 bg-white/15 rounded-2xl mb-2.5 border border-white/20 shadow-inner">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Mekong Stock ERP</h1>
            <p className="text-emerald-100 text-xs mt-1 font-medium">
              Inventory · Purchase Orders · Sales · Microservices
            </p>
          </div>
        </div>

        {/* Tab Switcher: Password vs QR Code */}
        <div className="bg-slate-100/80 p-1.5 border-b border-slate-200/80 flex items-center justify-center">
          <div className="grid grid-cols-2 w-full max-w-xs bg-slate-200/60 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => { setAuthMode('password'); setError(null); }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                authMode === 'password'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>{t('Password Login', 'វាយគណនី')}</span>
            </button>

            <button
              type="button"
              onClick={() => { setAuthMode('qr'); setError(null); }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                authMode === 'qr'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>{t('QR Code Login', 'ស្កេន QR Code')}</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-7 sm:p-8 bg-white">
          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: TRADITIONAL PASSWORD LOGIN */}
          {authMode === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="form-label">{t('Username or Email', 'ឈ្មោះគណនី ឬ អ៊ីមែល')}</label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none flex items-center">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t('Enter your username', 'វាយឈ្មោះគណនីរបស់អ្នក')}
                    className="form-input !pl-11 h-11 text-sm rounded-xl"
                    style={{ paddingLeft: '2.75rem' }}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">{t('Password', 'លេខសម្ងាត់')}</label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none flex items-center">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('Enter your password', 'វាយលេខសម្ងាត់របស់អ្នក')}
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
                className="btn-primary w-full py-3.5 text-sm font-bold shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 transition-all rounded-xl cursor-pointer flex items-center justify-center gap-2 border-0 mt-2"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="spinner !w-4 !h-4 border-white/30 !border-t-white" />
                    {t('Authenticating...', 'កំពុងផ្ទៀងផ្ទាត់...')}
                  </span>
                ) : (
                  <>
                    <span>{t('Sign In', 'ចូលប្រើប្រាស់')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setAuthMode('qr')}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>{t('Or sign in fast with Phone QR Code', 'ឬចូលប្រើរហ័សដោយស្កេន QR Code')}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: QR CODE LOGIN */}
          {authMode === 'qr' && (
            <div className="flex flex-col items-center text-center space-y-4">
              
              {/* QR Code Container */}
              <div className="relative p-4 rounded-3xl bg-slate-50 border-2 border-slate-200/90 shadow-inner group">
                {qrLoading ? (
                  <div className="w-[200px] h-[200px] flex flex-col items-center justify-center gap-3 text-slate-400">
                    <div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-600 rounded-full animate-spin" />
                    <span className="text-[11px] font-medium">{t('Generating QR Code...', 'កំពុងបង្កើត QR Code...')}</span>
                  </div>
                ) : qrStatus === 'Error' ? (
                  <div className="w-[200px] h-[200px] flex flex-col items-center justify-center gap-2 bg-rose-50/80 rounded-2xl p-4 text-center">
                    <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center">
                      <Lock className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-rose-800">
                      {t('QR Login Unavailable', 'មិនអាចប្រើ QR បានទេ')}
                    </span>
                    <p className="text-[10px] text-slate-500 line-clamp-2">
                      {error || t('QR login is currently disabled by policy.', 'មុខងារ QR ត្រូវបានបិទ។')}
                    </p>
                    <button
                      type="button"
                      onClick={() => setAuthMode('password')}
                      className="mt-1 px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-[11px] font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1"
                    >
                      <User className="w-3 h-3" />
                      <span>{t('Use Password', 'ប្រើលេខសម្ងាត់')}</span>
                    </button>
                  </div>
                ) : qrStatus === 'Expired' || qrStatus === 'Rejected' ? (
                  <div className="w-[200px] h-[200px] flex flex-col items-center justify-center gap-3 bg-slate-100 rounded-2xl p-4 text-center">
                    <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                      <RefreshCw className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-slate-700">
                      {qrStatus === 'Expired'
                        ? t('QR Code Expired', 'QR Code បានផុតកំណត់')
                        : t('Request Rejected', 'សំណើត្រូវបានបដិសេធ')}
                    </span>
                    <button
                      type="button"
                      onClick={initializeQrSession}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>{t('Regenerate QR', 'បង្កើត QR ថ្មី')}</span>
                    </button>
                  </div>
                ) : qrStatus === 'Approved' ? (
                  <div className="w-[200px] h-[200px] flex flex-col items-center justify-center gap-3 bg-emerald-50 rounded-2xl text-center animate-scale-in">
                    <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <span className="text-xs font-extrabold text-emerald-800">
                      {t('Approved! Logging in...', 'បានយល់ព្រម! កំពុងចូល...')}
                    </span>
                  </div>
                ) : (
                  <div className="relative">
                    {approvalUrl && (
                      <QRCodeSVG
                        value={approvalUrl}
                        size={200}
                        level="M"
                        includeMargin={false}
                        className="rounded-xl shadow-xs"
                      />
                    )}

                    {/* Overlay badge when Scanned */}
                    {qrStatus === 'Scanned' && (
                      <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-xs rounded-xl flex flex-col items-center justify-center p-3 text-white animate-fade-in">
                        <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white mb-2 shadow-md">
                          <Smartphone className="w-5 h-5 animate-bounce" />
                        </div>
                        <span className="text-xs font-bold leading-tight">
                          {t('QR Scanned!', 'បានស្កេនរួចរាល់!')}
                        </span>
                        <span className="text-[10px] text-emerald-200 mt-1 leading-snug">
                          {t('Please tap "Approve" on your phone', 'សូមចុច "យល់ព្រម" លើទូរស័ព្ទដៃ')}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Status and Countdown */}
              {qrStatus !== 'Approved' && qrStatus !== 'Expired' && qrStatus !== 'Rejected' && (
                <div className="flex items-center justify-between w-full max-w-[240px] text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-slate-600 font-medium">
                      {qrStatus === 'Scanned'
                        ? t('Waiting approval...', 'រង់ចាំការយល់ព្រម...')
                        : t('Waiting for scan...', 'រង់ចាំការស្កេន...')}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg text-[11px]">
                    {formatTimer(timeLeft)}
                  </span>
                </div>
              )}

              {/* Instructions in 3 Steps */}
              <div className="w-full bg-slate-50/80 border border-slate-200/70 rounded-2xl p-3.5 text-left text-xs space-y-2">
                <div className="font-bold text-slate-800 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-emerald-700">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{t('Instant Login Instructions', 'ការណែនាំអំពីការចូលប្រើភ្លាមៗ')}</span>
                </div>
                <ol className="text-slate-600 text-[11px] space-y-1 list-decimal pl-4 leading-relaxed">
                  <li>
                    {t(
                      'Open your phone camera or QR scanner app',
                      'បើកកាមេរ៉ាទូរស័ព្ទរបស់អ្នក ឬកម្មវិធីស្កេន QR'
                    )}
                  </li>
                  <li>
                    {t(
                      'Scan this QR code and open the link on phone',
                      'ស្កេន QR Code នេះ ហើយចុចបើកតំណភ្ជាប់លើទូរស័ព្ទ'
                    )}
                  </li>
                  <li>
                    <strong className="text-emerald-700">
                      {t(
                        'Tap "Approve" on your phone — no password or 2FA required!',
                        'ចុច "យល់ព្រម" លើទូរស័ព្ទ — មិនបាច់វាយលេខសម្ងាត់ និង 2FA ឡើយ!'
                      )}
                    </strong>
                  </li>
                </ol>
              </div>

              {/* Quick Actions / Link Copy */}
              <div className="flex items-center justify-between w-full pt-1 text-xs">
                <button
                  type="button"
                  onClick={initializeQrSession}
                  className="text-slate-500 hover:text-emerald-600 transition-colors flex items-center gap-1 text-[11px] cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>{t('Refresh QR', 'ផ្ទុកឡើងវិញ')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="text-slate-500 hover:text-emerald-600 transition-colors flex items-center gap-1 text-[11px] cursor-pointer"
                  title="Copy direct approval link for testing or sharing"
                >
                  {copiedLink ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedLink ? t('Link Copied!', 'បានចម្លង!') : t('Copy Link', 'ចម្លងតំណភ្ជាប់')}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Card Footer */}
        <div className="bg-gray-50/80 border-t border-gray-100 px-6 py-3.5 text-center text-[11px] text-gray-400 font-medium">
          Mekong Stock Microservices · Inventory &amp; Sales Management System
        </div>
      </div>
    </div>
  );
};
