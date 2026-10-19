import React, { useState, useEffect } from 'react';
import { ShieldCheck, Monitor, Clock, Globe, CheckCircle2, XCircle, AlertTriangle, ArrowRight, Lock, User, RefreshCw } from 'lucide-react';
import { authService } from '../../services/auth/authService';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export const QrApprovalPage = ({ onNavigateLogin, onNavigateDashboard }) => {
  const { user, token: authToken, loginWithQr } = useAuth();
  const { t, isKhmer } = useLanguage();

  const [qrToken, setQrToken] = useState('');
  const [sessionInfo, setSessionInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [status, setStatus] = useState('CHECKING'); // CHECKING, READY, APPROVED, REJECTED, EXPIRED, ERROR
  const [errorMessage, setErrorMessage] = useState('');

  // Fallback login form for unauthenticated phone users
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Extract qrToken from URL hash or query params
  useEffect(() => {
    const parseToken = () => {
      // Check query in hash: #qr-approve?token=xyz or /?token=xyz
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

    // Fetch session details from backend
    loadSessionInfo(token);
  }, []);

  const loadSessionInfo = async (token) => {
    setLoading(true);
    setErrorMessage('');
    try {
      const data = await authService.getQrSessionInfo(token);
      setSessionInfo(data);

      if (data.status === 'Approved') {
        setStatus('APPROVED');
      } else if (data.status === 'Rejected') {
        setStatus('REJECTED');
      } else if (data.status === 'Expired' || data.isExpired) {
        setStatus('EXPIRED');
      } else {
        setStatus('READY');
      }
    } catch (err) {
      setStatus('ERROR');
      setErrorMessage(typeof err === 'string' ? err : err?.message || t('Failed to load QR session', 'មិនអាចទាញទិន្នន័យ QR Session បានទេ'));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (e) => {
    if (e) e.preventDefault();
    if (!qrToken) return;

    setApproving(true);
    setErrorMessage('');

    try {
      const isAlreadyLoggedIn = Boolean(user && authToken);
      const approveUsername = isAlreadyLoggedIn ? undefined : username.trim();
      const approvePassword = isAlreadyLoggedIn ? undefined : password.trim();

      if (!isAlreadyLoggedIn && (!approveUsername || !approvePassword)) {
        setErrorMessage(t('Please enter your username and password to approve.', 'សូមវាយឈ្មោះគណនី និងលេខសម្ងាត់ដើម្បីយល់ព្រម'));
        setApproving(false);
        return;
      }

      await authService.approveQrLogin(qrToken, approveUsername, approvePassword);
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

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100 font-sans relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-800/90 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10">
        
        {/* Header Icon */}
        <div className="text-center mb-6">
          <div className="inline-flex p-4 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400 mb-3 shadow-inner">
            <Monitor className="w-8 h-8" />
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            {t('Desktop QR Login Approval', 'យល់ព្រមចូលប្រើលើកុំព្យូទ័រ (QR Login)')}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {t('Approve access without typing password or 2FA on desktop', 'ចូលប្រើភ្លាមៗ ដោយមិនបាច់វាយលេខសម្ងាត់ និង 2FA លើកុំព្យូទ័រ')}
          </p>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
            <span className="text-xs font-medium">{t('Checking QR login session...', 'កំពុងពិនិត្យ QR Session...')}</span>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* State: APPROVED */}
        {!loading && status === 'APPROVED' && (
          <div className="text-center py-6 animate-scale-in">
            <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center text-emerald-400 mx-auto mb-4 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">
              {t('Login Approved Successfully!', 'បានយល់ព្រមជោគជ័យ!')}
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto mb-6">
              {t(
                'Your desktop computer has been authenticated and logged in immediately without needing password or 2FA.',
                'កុំព្យូទ័ររបស់អ្នកបានចូលប្រើប្រាស់ដោយជោគជ័យរួចរាល់ហើយ ដោយមិនបាច់វាយលេខសម្ងាត់ និង 2FA ឡើយ។'
              )}
            </p>
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700/60 text-[11px] text-slate-400 mb-6">
              {t('You can close this tab on your phone now.', 'អ្នកអាចបិទផ្ទាំងទូរស័ព្ទនេះបានឥឡូវនេះ។')}
            </div>
            {onNavigateDashboard && user && (
              <button
                onClick={onNavigateDashboard}
                className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                {t('Open Mobile Dashboard', 'បើកផ្ទាំងគ្រប់គ្រងលើទូរស័ព្ទ')}
              </button>
            )}
          </div>
        )}

        {/* State: REJECTED */}
        {!loading && status === 'REJECTED' && (
          <div className="text-center py-6 animate-scale-in">
            <div className="w-16 h-16 bg-rose-500/20 border border-rose-500/40 rounded-full flex items-center justify-center text-rose-400 mx-auto mb-4">
              <XCircle className="w-9 h-9" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">
              {t('Login Request Rejected', 'សំណើចូលប្រើត្រូវបានបដិសេធ')}
            </h2>
            <p className="text-xs text-slate-400 max-w-xs mx-auto mb-6">
              {t('The desktop screen has been notified of this rejection.', 'កុំព្យូទ័រត្រូវបានជូនដំណឹងអំពីការបដិសេធនេះរួចរាល់។')}
            </p>
            <button
              onClick={() => {
                window.location.hash = 'dashboard';
                if (onNavigateDashboard) onNavigateDashboard();
              }}
              className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              {t('Go Home', 'ត្រឡប់ទៅទំព័រដើម')}
            </button>
          </div>
        )}

        {/* State: EXPIRED */}
        {!loading && status === 'EXPIRED' && (
          <div className="text-center py-6 animate-scale-in">
            <div className="w-16 h-16 bg-amber-500/20 border border-amber-500/40 rounded-full flex items-center justify-center text-amber-400 mx-auto mb-4">
              <Clock className="w-9 h-9" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">
              {t('QR Code Expired', 'QR Code នេះបានផុតកំណត់ហើយ')}
            </h2>
            <p className="text-xs text-slate-400 max-w-xs mx-auto mb-6">
              {t('Please refresh or generate a new QR Code on your desktop screen.', 'សូមចុចបង្កើត QR Code ថ្មីនៅលើអេក្រង់កុំព្យូទ័រ។')}
            </p>
            <button
              onClick={() => loadSessionInfo(qrToken)}
              className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{t('Check Again', 'ពិនិត្យឡើងវិញ')}</span>
            </button>
          </div>
        )}

        {/* State: READY for Approval */}
        {!loading && status === 'READY' && (
          <div className="space-y-5">
            {/* Session details card */}
            <div className="bg-slate-900/70 border border-slate-700/60 rounded-2xl p-4 text-xs space-y-2.5">
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{t('Device IP', 'អាសយដ្ឋាន IP')}:</span>
                </span>
                <span className="font-mono text-slate-200">{sessionInfo?.deviceIp || 'Desktop Browser'}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t('Requested', 'ពេលវេលាស្នើសុំ')}:</span>
                </span>
                <span className="text-slate-200">
                  {sessionInfo?.createdAtUtc ? new Date(sessionInfo.createdAtUtc).toLocaleTimeString() : 'Just now'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('Security Policy', 'សុវត្ថិភាព')}:</span>
                </span>
                <span className="text-emerald-400 font-semibold">{t('Bypass 2FA (Phone Verified)', 'រំលង 2FA ដោយសារទូរស័ព្ទបញ្ជាក់')}</span>
              </div>
            </div>

            {/* If user is already logged in on this phone */}
            {user && authToken ? (
              <div className="space-y-4">
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-md">
                    {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-400">{t('Approve login for account:', 'យល់ព្រមចូលគណនី:')}</p>
                    <p className="font-bold text-sm text-white truncate">{user.username}</p>
                    <p className="text-[11px] text-slate-400 truncate">{user.email || `${user.username}@company.com`}</p>
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-2.5">
                  <button
                    onClick={handleApprove}
                    disabled={approving || rejecting}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/30 hover:shadow-emerald-600/50 transition-all cursor-pointer flex items-center justify-center gap-2 border-0"
                  >
                    {approving ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {t('Approving...', 'កំពុងយល់ព្រម...')}
                      </span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{t('Approve Login', 'យល់ព្រមឱ្យកុំព្យូទ័រចូលប្រើ')}</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleReject}
                    disabled={approving || rejecting}
                    className="w-full py-2.5 bg-slate-700/60 hover:bg-rose-600/80 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 border border-slate-600"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>{t('Reject Request', 'បដិសេធ')}</span>
                  </button>
                </div>
              </div>
            ) : (
              /* If user is not yet logged in on this phone */
              <form onSubmit={handleApprove} className="space-y-3.5">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-300">
                  {t(
                    'Please sign in to confirm and approve this desktop session:',
                    'សូមវាយគណនីរបស់អ្នកដើម្បីបញ្ជាក់ និងយល់ព្រមឱ្យកុំព្យូទ័រចូលប្រើ៖'
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    {t('Username or Email', 'ឈ្មោះគណនី ឬ អ៊ីមែល')}
                  </label>
                  <div className="relative flex items-center">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Username"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    {t('Password', 'លេខសម្ងាត់')}
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 text-slate-400 hover:text-slate-200 text-xs p-1"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="submit"
                    disabled={approving}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 border-0"
                  >
                    {approving ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {t('Authenticating & Approving...', 'កំពុងផ្ទៀងផ្ទាត់ និងយល់ព្រម...')}
                      </span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{t('Sign In & Approve Desktop', 'ចូលគណនី និងយល់ព្រមឱ្យកុំព្យូទ័រចូល')}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleReject}
                    className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  >
                    {t('Cancel', 'បោះបង់')}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-700/60 text-center text-[10px] text-slate-500">
          Mekong Stock Security · Multi-Device Instant Authentication
        </div>
      </div>
    </div>
  );
};
