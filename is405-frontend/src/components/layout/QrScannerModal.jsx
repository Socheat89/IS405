import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, CheckCircle2, AlertTriangle, Monitor, ShieldCheck, RefreshCw, KeyRound } from 'lucide-react';
import { authService } from '../../services/auth/authService';
import { useLanguage } from '../../context/LanguageContext';

export const QrScannerModal = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const [mode, setMode] = useState('camera'); // 'camera' or 'manual'
  const [manualToken, setManualToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionData, setSessionData] = useState(null);
  const [status, setStatus] = useState('IDLE'); // IDLE, DETECTED, APPROVED, ERROR
  const [errorMessage, setErrorMessage] = useState('');
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Start camera when modal opens in camera mode
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      resetState();
      return;
    }

    if (mode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, mode]);

  const resetState = () => {
    setManualToken('');
    setLoading(false);
    setSessionData(null);
    setStatus('IDLE');
    setErrorMessage('');
    setCameraError('');
  };

  const startCamera = async () => {
    setCameraError('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(t('Camera not supported on this browser. Please use manual code entry.', 'កម្មវិធីរុករកនេះមិនគាំទ្រកាមេរ៉ាទេ។ សូមបញ្ចូលកូដដោយផ្ទាល់។'));
        setMode('manual');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.warn('Camera access denied or unavailable:', err);
      setCameraError(t('Could not access camera. Please allow permission or enter code below.', 'មិនអាចបើកកាមេរ៉ាបានទេ។ សូមផ្តល់សិទ្ធិ ឬវាយបញ្ចូលកូដខាងក្រោម។'));
      setMode('manual');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const handleProcessToken = async (tokenCandidate) => {
    if (!tokenCandidate || !tokenCandidate.trim()) return;

    // Clean URL if full URL was pasted
    let cleanToken = tokenCandidate.trim();
    if (cleanToken.includes('token=')) {
      const match = cleanToken.match(/token=([a-zA-Z0-9_\-]+)/);
      if (match) cleanToken = match[1];
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const data = await authService.getQrSessionInfo(cleanToken);
      setSessionData({ ...data, token: cleanToken });
      setStatus('DETECTED');
      stopCamera();
    } catch (err) {
      setStatus('ERROR');
      setErrorMessage(typeof err === 'string' ? err : err?.message || t('Invalid or expired QR token', 'កូដ QR មិនត្រឹមត្រូវ ឬផុតកំណត់'));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!sessionData?.token) return;

    setLoading(true);
    setErrorMessage('');

    try {
      await authService.approveQrLogin(sessionData.token);
      setStatus('APPROVED');
    } catch (err) {
      setErrorMessage(typeof err === 'string' ? err : err?.message || t('Failed to approve login', 'ការយល់ព្រមបានបរាជ័យ'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden relative">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-xl">
              <Camera className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight">
                {t('Scan QR to Login Desktop', 'ស្កេន QR ដើម្បីចូលលើកុំព្យូទ័រ')}
              </h3>
              <p className="text-[11px] text-emerald-100">
                {t('Approve desktop session instantly', 'យល់ព្រមឱ្យកុំព្យូទ័រចូលប្រើប្រាស់ភ្លាមៗ')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Mode Tabs */}
          {status === 'IDLE' && (
            <div className="flex rounded-xl bg-slate-100 p-1 mb-5">
              <button
                type="button"
                onClick={() => setMode('camera')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === 'camera'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{t('Use Camera', 'បើកកាមេរ៉ា')}</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('manual')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === 'manual'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{t('Enter Code', 'បញ្ចូលកូដ')}</span>
              </button>
            </div>
          )}

          {/* Camera Viewfinder */}
          {status === 'IDLE' && mode === 'camera' && (
            <div className="space-y-4">
              <div className="relative aspect-square max-w-[280px] mx-auto rounded-2xl overflow-hidden bg-slate-950 border-2 border-dashed border-emerald-500/50 flex items-center justify-center shadow-inner">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Animated Scanner Frame Overlay */}
                <div className="absolute inset-6 border-2 border-emerald-400 rounded-xl pointer-events-none flex flex-col justify-between p-2">
                  <div className="flex justify-between">
                    <div className="w-3 h-3 border-t-2 border-l-2 border-emerald-400 -mt-2 -ml-2" />
                    <div className="w-3 h-3 border-t-2 border-r-2 border-emerald-400 -mt-2 -mr-2" />
                  </div>
                  <div className="h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse" />
                  <div className="flex justify-between">
                    <div className="w-3 h-3 border-b-2 border-l-2 border-emerald-400 -mb-2 -ml-2" />
                    <div className="w-3 h-3 border-b-2 border-r-2 border-emerald-400 -mb-2 -mr-2" />
                  </div>
                </div>
              </div>

              <p className="text-center text-xs text-slate-500">
                {t(
                  'Point your camera at the QR Code on your computer screen.',
                  'តម្រង់កាមេរ៉ារបស់អ្នកទៅកាន់ QR Code នៅលើអេក្រង់កុំព្យូទ័រ។'
                )}
              </p>

              {cameraError && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
                  {cameraError}
                </div>
              )}
            </div>
          )}

          {/* Manual Token Entry */}
          {status === 'IDLE' && mode === 'manual' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {t('Paste QR Token or Link', 'បិទភ្ជាប់កូដ QR ឬតំណភ្ជាប់')}
                </label>
                <input
                  type="text"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="e.g. m_8yX2..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <button
                type="button"
                onClick={() => handleProcessToken(manualToken)}
                disabled={loading || !manualToken.trim()}
                className="btn-primary w-full py-2.5 text-xs font-bold rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('Verifying...', 'កំពុងពិនិត្យ...')}
                  </span>
                ) : (
                  <span>{t('Continue', 'បន្ត')}</span>
                )}
              </button>
            </div>
          )}

          {/* DETECTED / CONFIRM APPROVE */}
          {status === 'DETECTED' && sessionData && (
            <div className="space-y-5 animate-scale-in">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2 text-xs">
                <div className="flex items-center gap-2 text-emerald-800 font-bold">
                  <Monitor className="w-4 h-4 text-emerald-600" />
                  <span>{t('Desktop Login Request Found', 'បានរកឃើញសំណើចូលកុំព្យូទ័រ')}</span>
                </div>
                <div className="text-slate-600 space-y-1 pt-1 text-[11px]">
                  <div>IP: <span className="font-mono font-semibold text-slate-800">{sessionData.deviceIp || 'Desktop'}</span></div>
                  <div>Time: <span className="font-semibold text-slate-800">{new Date(sessionData.createdAtUtc).toLocaleTimeString()}</span></div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600">
                {t(
                  'Approving will immediately sign in this desktop computer without requiring username, password, or 2FA.',
                  'ការចុចយល់ព្រម នឹងអនុញ្ញាតឱ្យកុំព្យូទ័រនេះចូលប្រើភ្លាមៗ ដោយមិនបាច់វាយលេខសម្ងាត់ និង 2FA ឡើយ។'
                )}
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={loading}
                  className="btn-primary w-full py-3 text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {t('Approving...', 'កំពុងយល់ព្រម...')}
                    </span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{t('Approve Login Now', 'យល់ព្រមឱ្យចូលប្រើភ្លាមៗ')}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStatus('IDLE');
                    if (mode === 'camera') startCamera();
                  }}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  {t('Back', 'ថយក្រោយ')}
                </button>
              </div>
            </div>
          )}

          {/* APPROVED STATE */}
          {status === 'APPROVED' && (
            <div className="text-center py-6 space-y-4 animate-scale-in">
              <div className="w-16 h-16 bg-emerald-100 border border-emerald-300 rounded-full flex items-center justify-center text-emerald-600 mx-auto shadow-md">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h4 className="font-extrabold text-base text-slate-900">
                {t('Login Approved!', 'បានយល់ព្រមជោគជ័យ!')}
              </h4>
              <p className="text-xs text-slate-600 max-w-xs mx-auto">
                {t(
                  'Your desktop computer is now signed in. You may close this window.',
                  'កុំព្យូទ័ររបស់អ្នកបានចូលប្រើប្រាស់រួចរាល់ហើយ។ អ្នកអាចបិទផ្ទាំងនេះបាន។'
                )}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="btn-primary w-full py-2.5 text-xs font-bold rounded-xl shadow-md cursor-pointer"
              >
                {t('Close', 'បិទ')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
