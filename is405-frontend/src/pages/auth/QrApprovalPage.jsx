import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Monitor,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  User,
  RefreshCw,
  Smartphone,
  Eye,
  EyeOff,
  ArrowRight
} from 'lucide-react';
import { authService } from '../../services/auth/authService';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const TRUSTED_DEVICE_KEY = 'is405_trusted_device';

function getBrowserDeviceName() {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'Android Device';
  if (/iPhone/i.test(ua)) return 'Apple iPhone';
  if (/iPad/i.test(ua)) return 'Apple iPad';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Macintosh/i.test(ua)) return 'Mac Device';
  return 'Mobile Browser';
}

export const QrApprovalPage = ({ onNavigateLogin, onNavigateDashboard }) => {
  const { user: activeContextUser, token: authToken } = useAuth();
  const { t } = useLanguage();

  const [qrToken, setQrToken] = useState('');
  const [sessionInfo, setSessionInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [status, setStatus] = useState('CHECKING'); // CHECKING, READY, APPROVED, REJECTED, EXPIRED, ERROR
  const [errorMessage, setErrorMessage] = useState('');

  // Trusted Device Pairing state
  const [trustedDevice, setTrustedDevice] = useState(null);
  const [forceSwitchAccount, setForceSwitchAccount] = useState(false);

  // First-time or new device credentials form
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [trustThisDevice, setTrustThisDevice] = useState(true);

  // Extract qrToken from URL hash or query params
  useEffect(() => {
    const parseToken = () => {
      const hash = window.location.hash;
      const search = window.location.search;

      let extracted = '';
      if (hash.includes('token=')) {
        const match = hash.match(/token=([a-zA-Z0-9_\-]+)/);
        if (match) extracted = match[1];
      } else if (search.includes('token=')) {
        const params = new URLSearchParams(search);
        extracted = params.get('token') || '';
      }

      return extracted;
    };

    const token = parseToken();
    setQrToken(token);

    if (!token) {
      setLoading(false);
      setStatus('ERROR');
      setErrorMessage(t('No QR Code token provided in link.', 'មិនមានកូដ QR នៅក្នុងតំណភ្ជាប់នេះទេ។'));
      return;
    }

    loadSessionAndCheckDevice(token);
  }, []);

  const loadSessionAndCheckDevice = async (token) => {
    setLoading(true);
    setErrorMessage('');
    try {
      // 1. Fetch QR session status
      const data = await authService.getQrSessionInfo(token);
      setSessionInfo(data);

      if (data.status === 'Approved') {
        setStatus('APPROVED');
        setLoading(false);
        return;
      } else if (data.status === 'Rejected') {
        setStatus('REJECTED');
        setLoading(false);
        return;
      } else if (data.status === 'Expired' || data.isExpired) {
        setStatus('EXPIRED');
        setLoading(false);
        return;
      }

      // 2. Check if this device was already paired and remembered
      let savedDevice = null;
      try {
        const raw = localStorage.getItem(TRUSTED_DEVICE_KEY);
        if (raw) savedDevice = JSON.parse(raw);
      } catch (e) {}

      if (savedDevice?.deviceId && savedDevice?.deviceSecret) {
        const checkRes = await authService.checkTrustedDevice(token, savedDevice.deviceId, savedDevice.deviceSecret);
        if (checkRes.isTrusted && checkRes.user) {
          setTrustedDevice({
            ...savedDevice,
            user: checkRes.user,
            deviceName: checkRes.deviceName || savedDevice.deviceName
          });
        } else {
          // Device secret expired or invalid on backend
          setTrustedDevice(null);
          localStorage.removeItem(TRUSTED_DEVICE_KEY);
        }
      } else {
        setTrustedDevice(null);
      }

      setStatus('READY');
    } catch (err) {
      setStatus('ERROR');
      setErrorMessage(typeof err === 'string' ? err : err?.message || t('Failed to load QR session', 'មិនអាចទាញទិន្នន័យ QR Session បានទេ'));
    } finally {
      setLoading(false);
    }
  };

  // 1-Tap Approve for Trusted Paired Device
  const handleTrustedDeviceApprove = async () => {
    if (!qrToken || !trustedDevice) return;

    setApproving(true);
    setErrorMessage('');

    try {
      await authService.approveQrLogin(qrToken, {
        deviceId: trustedDevice.deviceId,
        deviceSecret: trustedDevice.deviceSecret
      });
      setStatus('APPROVED');
    } catch (err) {
      const msg = typeof err === 'string' ? err : err?.message || t('Approval failed', 'ការយល់ព្រមបានបរាជ័យ');
      setErrorMessage(msg);
      if (String(msg).toLowerCase().includes('device') || String(msg).toLowerCase().includes('pairing')) {
        setTrustedDevice(null);
        localStorage.removeItem(TRUSTED_DEVICE_KEY);
      }
    } finally {
      setApproving(false);
    }
  };

  // First-time or new device: Sign In and pair device
  const handleCredentialApprove = async (e) => {
    if (e) e.preventDefault();
    if (!qrToken) return;

    if (!username.trim() || !password.trim()) {
      setErrorMessage(t('Please enter your username and password.', 'សូមវាយឈ្មោះគណនី និងលេខសម្ងាត់'));
      return;
    }

    setApproving(true);
    setErrorMessage('');

    try {
      const res = await authService.approveQrLogin(qrToken, {
        username: username.trim(),
        password: password.trim(),
        trustThisDevice,
        deviceName: getBrowserDeviceName()
      });

      // Save trusted device locally so next time it won't ask for credentials
      if (res.trustedDevice?.deviceId && res.trustedDevice?.deviceSecret) {
        localStorage.setItem(TRUSTED_DEVICE_KEY, JSON.stringify(res.trustedDevice));
        setTrustedDevice(res.trustedDevice);
      }

      setStatus('APPROVED');
    } catch (err) {
      setErrorMessage(typeof err === 'string' ? err : err?.message || t('Invalid credentials or approval failed', 'ឈ្មោះគណនី ឬលេខសម្ងាត់មិនត្រឹមត្រូវ'));
    } finally {
      setApproving(false);
    }
  };

  // Approve for user already logged in with active context Bearer token
  const handleContextApprove = async () => {
    if (!qrToken) return;
    setApproving(true);
    setErrorMessage('');
    try {
      await authService.approveQrLogin(qrToken);
      setStatus('APPROVED');
    } catch (err) {
      setErrorMessage(typeof err === 'string' ? err : err?.message || t('Approval failed', 'ការយល់ព្រមបានបរាជ័យ'));
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!qrToken) return;
    setRejecting(true);
    try {
      await authService.rejectQrLogin(qrToken, 'User rejected from phone');
      setStatus('REJECTED');
    } catch (err) {
      setErrorMessage(typeof err === 'string' ? err : err?.message || t('Failed to reject login', 'មិនអាចបដិសេធបានទេ'));
    } finally {
      setRejecting(false);
    }
  };

  const handleForgetDevice = async () => {
    if (trustedDevice?.deviceId) {
      await authService.revokeTrustedDevice(trustedDevice.deviceId, trustedDevice.deviceSecret);
    }
    localStorage.removeItem(TRUSTED_DEVICE_KEY);
    setTrustedDevice(null);
    setForceSwitchAccount(true);
  };

  return (
    <div className="auth-page">
      {/* Decorative background blobs - matching LoginPage */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-100/60 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-teal-100/50 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl pointer-events-none" />

      <div className="auth-card w-full max-w-md relative z-10 shadow-2xl rounded-3xl overflow-hidden border border-slate-200/80">
        
        {/* Header - Matching LoginPage's premium emerald gradient header */}
        <div className="auth-card-header pb-5">
          <div className="relative z-10 text-center">
            <div className="inline-flex p-3 bg-white/15 rounded-2xl mb-2.5 border border-white/20 shadow-inner">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              {t('Desktop QR Approval', 'យល់ព្រមចូលប្រើកុំព្យូទ័រ')}
            </h1>
            <p className="text-emerald-100 text-xs mt-1 font-medium">
              {t('Mekong Stock ERP · Multi-Device Instant Authentication', 'ប្រព័ន្ធសុវត្ថិភាព Mekong Stock · ផ្ទៀងផ្ទាត់រហ័ស')}
            </p>
          </div>
        </div>

        {/* Status bar strip below header */}
        {sessionInfo && (
          <div className="bg-slate-50/90 px-6 py-2.5 border-b border-slate-200/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-slate-600 font-medium">
              <Monitor className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="font-mono text-[11px] text-slate-700">
                {sessionInfo?.deviceIp || 'Desktop Browser'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                {t('Bypass 2FA (Verified)', 'រំលង 2FA')}
              </span>
            </div>
          </div>
        )}

        {/* Card Body */}
        <div className="p-6 sm:p-8 bg-white">
          {/* Loading state */}
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <div className="w-9 h-9 border-3 border-emerald-500/20 border-t-emerald-600 rounded-full animate-spin" />
              <span className="text-xs font-semibold text-slate-500">
                {t('Checking device and QR session...', 'កំពុងពិនិត្យឧបករណ៍ និង QR Session...')}
              </span>
            </div>
          )}

          {/* Error message */}
          {errorMessage && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {/* State: APPROVED */}
          {!loading && status === 'APPROVED' && (
            <div className="text-center py-6 animate-scale-in">
              <div className="w-16 h-16 bg-emerald-100 border border-emerald-300 rounded-full flex items-center justify-center text-emerald-600 mx-auto mb-4 shadow-lg shadow-emerald-600/20">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-2">
                {t('Login Approved Successfully!', 'បានយល់ព្រមជោគជ័យ!')}
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto mb-6">
                {t(
                  'Your desktop computer has been authenticated and logged in immediately without needing password or 2FA.',
                  'កុំព្យូទ័ររបស់អ្នកបានចូលប្រើប្រាស់ដោយជោគជ័យរួចរាល់ហើយ ដោយមិនបាច់វាយលេខសម្ងាត់ និង 2FA ឡើយ។'
                )}
              </p>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 mb-6 font-medium">
                {t('You can close this tab on your phone now.', 'អ្នកអាចបិទផ្ទាំងទូរស័ព្ទនេះបានឥឡូវនេះ។')}
              </div>
              {onNavigateDashboard && activeContextUser && (
                <button
                  onClick={onNavigateDashboard}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  {t('Open Mobile Dashboard', 'បើកផ្ទាំងគ្រប់គ្រងលើទូរស័ព្ទ')}
                </button>
              )}
            </div>
          )}

          {/* State: REJECTED */}
          {!loading && status === 'REJECTED' && (
            <div className="text-center py-6 animate-scale-in">
              <div className="w-16 h-16 bg-rose-100 border border-rose-200 rounded-full flex items-center justify-center text-rose-600 mx-auto mb-4">
                <XCircle className="w-9 h-9" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-2">
                {t('Login Request Rejected', 'សំណើចូលប្រើត្រូវបានបដិសេធ')}
              </h2>
              <p className="text-xs text-slate-500 max-w-xs mx-auto mb-6">
                {t('The desktop screen has been notified of this rejection.', 'កុំព្យូទ័រត្រូវបានជូនដំណឹងអំពីការបដិសេធនេះរួចរាល់។')}
              </p>
              <button
                onClick={() => {
                  window.location.hash = 'dashboard';
                  if (onNavigateDashboard) onNavigateDashboard();
                }}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                {t('Go Home', 'ត្រឡប់ទៅទំព័រដើម')}
              </button>
            </div>
          )}

          {/* State: EXPIRED */}
          {!loading && status === 'EXPIRED' && (
            <div className="text-center py-6 animate-scale-in">
              <div className="w-16 h-16 bg-amber-100 border border-amber-200 rounded-full flex items-center justify-center text-amber-600 mx-auto mb-4">
                <Clock className="w-9 h-9" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-2">
                {t('QR Code Expired', 'QR Code នេះបានផុតកំណត់ហើយ')}
              </h2>
              <p className="text-xs text-slate-500 max-w-xs mx-auto mb-6">
                {t('Please refresh or generate a new QR Code on your desktop screen.', 'សូមចុចបង្កើត QR Code ថ្មីនៅលើអេក្រង់កុំព្យូទ័រ។')}
              </p>
              <button
                onClick={() => loadSessionAndCheckDevice(qrToken)}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>{t('Check Again', 'ពិនិត្យឡើងវិញ')}</span>
              </button>
            </div>
          )}

          {/* State: READY for Approval */}
          {!loading && status === 'READY' && (
            <div className="space-y-5">
              
              {/* Session Summary Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs space-y-2.5">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t('Device IP', 'អាសយដ្ឋាន IP')}:</span>
                  </span>
                  <span className="font-mono font-medium text-slate-700">{sessionInfo?.deviceIp || 'Desktop Browser'}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t('Requested', 'ពេលវេលាស្នើសុំ')}:</span>
                  </span>
                  <span className="font-medium text-slate-700">
                    {sessionInfo?.createdAtUtc ? new Date(sessionInfo.createdAtUtc).toLocaleTimeString() : 'Just now'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{t('Security Policy', 'សុវត្ថិភាព')}:</span>
                  </span>
                  <span className="text-emerald-700 font-bold">{t('Bypass 2FA (Phone Verified)', 'រំលង 2FA ដោយសារទូរស័ព្ទបញ្ជាក់')}</span>
                </div>
              </div>

              {/* ── CASE 1: TRUSTED PAIRED DEVICE (NO CREDENTIALS NEEDED! ONLY APPROVE & REJECT) ── */}
              {trustedDevice && !forceSwitchAccount ? (
                <div className="space-y-4 animate-scale-in">
                  
                  {/* Paired Device Card */}
                  <div className="p-4 bg-gradient-to-br from-emerald-50 via-teal-50/50 to-slate-50 border border-emerald-200/80 rounded-2xl shadow-xs">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white font-extrabold text-base flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/25">
                        {trustedDevice.user?.username ? trustedDevice.user.username.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <Smartphone className="w-3 h-3 text-emerald-600" />
                            {t('Trusted Phone Device', 'ឧបករណ៍ទុកចិត្ត')}
                          </span>
                        </div>
                        <p className="font-extrabold text-base text-slate-900 truncate mt-1">
                          {trustedDevice.user?.username || trustedDevice.username}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {trustedDevice.user?.email || trustedDevice.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Recognition Notice */}
                  <div className="p-3.5 bg-emerald-50/80 border border-emerald-200/70 rounded-xl text-[11px] text-emerald-800 text-center font-medium leading-relaxed">
                    {t(
                      'Device recognized! Tap "Approve" below to sign in to desktop instantly without password or 2FA.',
                      'ឧបករណ៍ត្រូវបានស្គាល់! ចុច "យល់ព្រម" ខាងក្រោមដើម្បីចូលភ្លាមៗ ដោយមិនបាច់វាយលេខសម្ងាត់ និង 2FA ឡើយ។'
                    )}
                  </div>

                  {/* Action Buttons: ONLY Approve & Reject */}
                  <div className="pt-2 flex flex-col gap-2.5">
                    <button
                      onClick={handleTrustedDeviceApprove}
                      disabled={approving || rejecting}
                      className="btn-primary w-full py-4 text-sm font-bold shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 transition-all rounded-2xl cursor-pointer flex items-center justify-center gap-2 border-0"
                    >
                      {approving ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="spinner !w-4 !h-4 border-white/30 !border-t-white" />
                          {t('Approving...', 'កំពុងយល់ព្រម...')}
                        </span>
                      ) : (
                        <>
                          <CheckCircle2 className="w-5 h-5" />
                          <span>{t('Approve Login (1-Tap)', '✓ យល់ព្រមឱ្យកុំព្យូទ័រចូលប្រើ')}</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleReject}
                      disabled={approving || rejecting}
                      className="w-full py-3 bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-rose-200 hover:border-rose-300 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>{t('Reject Request', '✕ បដិសេធ')}</span>
                    </button>
                  </div>

                  {/* Secondary options */}
                  <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setForceSwitchAccount(true)}
                      className="hover:text-emerald-700 font-medium transition-colors cursor-pointer"
                    >
                      {t('Sign in with different account?', 'ចូលដោយគណនីផ្សេង?')}
                    </button>
                    <button
                      type="button"
                      onClick={handleForgetDevice}
                      className="hover:text-rose-600 font-medium transition-colors cursor-pointer text-slate-400"
                    >
                      {t('Forget this device', 'ផ្តាច់ឧបករណ៍នេះ')}
                    </button>
                  </div>
                </div>
              ) : activeContextUser && authToken && !forceSwitchAccount ? (
                /* ── CASE 2: ACTIVELY LOGGED IN VIA BROWSER CONTEXT ── */
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-md">
                      {activeContextUser.username ? activeContextUser.username.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-500">{t('Approve login for account:', 'យល់ព្រមចូលគណនី:')}</p>
                      <p className="font-bold text-sm text-slate-900 truncate">{activeContextUser.username}</p>
                      <p className="text-[11px] text-slate-500 truncate">{activeContextUser.email || `${activeContextUser.username}@company.com`}</p>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col gap-2.5">
                    <button
                      onClick={handleContextApprove}
                      disabled={approving || rejecting}
                      className="btn-primary w-full py-4 text-sm font-bold shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 transition-all rounded-2xl cursor-pointer flex items-center justify-center gap-2 border-0"
                    >
                      {approving ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="spinner !w-4 !h-4 border-white/30 !border-t-white" />
                          {t('Approving...', 'កំពុងយល់ព្រម...')}
                        </span>
                      ) : (
                        <>
                          <CheckCircle2 className="w-5 h-5" />
                          <span>{t('Approve Login', 'យល់ព្រមឱ្យកុំព្យូទ័រចូលប្រើ')}</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleReject}
                      disabled={approving || rejecting}
                      className="w-full py-3 bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>{t('Reject Request', 'បដិសេធ')}</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* ── CASE 3: 1ST TIME LOGIN / NEW UNPAIRED DEVICE (MUST TYPE USERNAME & PASSWORD) ── */
                <form onSubmit={handleCredentialApprove} className="space-y-4">
                  <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-xs leading-relaxed flex items-start gap-2.5">
                    <Smartphone className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      {t(
                        '1st time on this phone? Sign in once to pair this phone as a Trusted Device. Next time you will only need to tap Approve!',
                        'ចូលលើកទី១ លើទូរស័ព្ទនេះ? សូមវាយគណនីម្តងដើម្បីស្គាល់ឧបករណ៍នេះ។ លើកក្រោយមិនបាច់វាយលេខសម្ងាត់ទៀតទេ គឺចុច Approve តែម្តង!'
                      )}
                    </span>
                  </div>

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

                  {/* Trust this device checkbox */}
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer pt-1 select-none">
                    <input
                      type="checkbox"
                      checked={trustThisDevice}
                      onChange={(e) => setTrustThisDevice(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="font-medium">
                      {t(
                        'Remember & pair this device (1-tap approve next time)',
                        'ចងចាំឧបករណ៍នេះ (លើកក្រោយចូលដោយមិនបាច់វាយលេខសម្ងាត់)'
                      )}
                    </span>
                  </label>

                  <div className="pt-2 flex flex-col gap-2.5">
                    <button
                      type="submit"
                      disabled={approving}
                      className="btn-primary w-full py-3.5 text-sm font-bold shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 transition-all rounded-xl cursor-pointer flex items-center justify-center gap-2 border-0"
                    >
                      {approving ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="spinner !w-4 !h-4 border-white/30 !border-t-white" />
                          {t('Authenticating & Pairing...', 'កំពុងផ្ទៀងផ្ទាត់ និងចងចាំឧបករណ៍...')}
                        </span>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{t('Sign In & Approve Desktop', 'ចូលគណនី និងយល់ព្រមឱ្យកុំព្យូទ័រចូល')}</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleReject}
                      className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                    >
                      {t('Cancel', 'បោះបង់')}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Footer - Matching LoginPage */}
        <div className="bg-gray-50/80 border-t border-gray-100 px-6 py-3.5 text-center text-[11px] text-gray-400 font-medium">
          Mekong Stock Security · Multi-Device Instant Authentication
        </div>
      </div>
    </div>
  );
};
