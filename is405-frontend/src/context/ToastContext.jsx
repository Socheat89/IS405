import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X, Sparkles } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(({ type = 'success', title, message, duration = 4000 }) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    const newToast = { id, type, title, message, duration, createdAt: Date.now() };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    return id;
  }, [removeToast]);

  const success = useCallback((message, title = 'ជោគជ័យ (Saved Successfully)') => {
    return addToast({ type: 'success', title, message });
  }, [addToast]);

  const error = useCallback((message, title = 'បរាជ័យ (Error Occurred)') => {
    return addToast({ type: 'error', title, message });
  }, [addToast]);

  const warning = useCallback((message, title = 'ការព្រមាន (Warning)') => {
    return addToast({ type: 'warning', title, message });
  }, [addToast]);

  const info = useCallback((message, title = 'ដំណឹង (Information)') => {
    return addToast({ type: 'info', title, message });
  }, [addToast]);

  // Global window listener for easy access
  useEffect(() => {
    window.toast = { success, error, warning, info, add: addToast, remove: removeToast };
  }, [success, error, warning, info, addToast, removeToast]);

  return (
    <ToastContext.Provider value={{ success, error, warning, info, addToast, removeToast }}>
      {children}

      {/* Floating Side-Slide Toast Container (Fixed to Top-Right) */}
      <div 
        aria-live="assertive" 
        className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm sm:max-w-md w-full pointer-events-none p-2 sm:p-0"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const ToastItem = ({ toast, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 250);
  };

  const config = {
    success: {
      bg: 'bg-white',
      border: 'border-emerald-500/30 shadow-emerald-500/10',
      headerBg: 'bg-emerald-50',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
      accentColor: 'bg-emerald-500',
      titleColor: 'text-emerald-950',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      badgeText: 'Saved'
    },
    error: {
      bg: 'bg-white',
      border: 'border-rose-500/30 shadow-rose-500/10',
      headerBg: 'bg-rose-50',
      icon: <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />,
      accentColor: 'bg-rose-500',
      titleColor: 'text-rose-950',
      badge: 'bg-rose-100 text-rose-800 border-rose-300',
      badgeText: 'Failed'
    },
    warning: {
      bg: 'bg-white',
      border: 'border-amber-500/30 shadow-amber-500/10',
      headerBg: 'bg-amber-50',
      icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
      accentColor: 'bg-amber-500',
      titleColor: 'text-amber-950',
      badge: 'bg-amber-100 text-amber-800 border-amber-300',
      badgeText: 'Alert'
    },
    info: {
      bg: 'bg-white',
      border: 'border-[#2089C8]/30 shadow-[#2089C8]/10',
      headerBg: 'bg-sky-50',
      icon: <Info className="w-5 h-5 text-[#2089C8] shrink-0" />,
      accentColor: 'bg-[#2089C8]',
      titleColor: 'text-sky-950',
      badge: 'bg-sky-100 text-[#155e89] border-sky-300',
      badgeText: 'Notice'
    }
  }[toast.type || 'success'];

  return (
    <div
      className={`pointer-events-auto w-full rounded-2xl border ${config.border} ${config.bg} shadow-2xl backdrop-blur-xl overflow-hidden transition-all duration-300 transform ${
        isExiting 
          ? 'translate-x-full opacity-0 scale-95' 
          : 'animate-slide-in-right'
      }`}
      style={{
        animation: !isExiting ? 'slideInFromRight 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards' : undefined
      }}
    >
      {/* Side Color Accent Strip */}
      <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${config.accentColor}`} />

      <div className="p-4 pl-4.5 flex items-start gap-3.5 relative">
        <div className="mt-0.5">{config.icon}</div>

        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center gap-2 mb-0.5">
            <h4 className={`text-xs font-black tracking-tight ${config.titleColor} truncate`}>
              {toast.title}
            </h4>
            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-md border ${config.badge}`}>
              {config.badgeText}
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed break-words font-medium">
            {toast.message}
          </p>
        </div>

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          title="Close notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Shrinking Animated Progress Bar */}
      {toast.duration > 0 && (
        <div className="h-1 w-full bg-slate-100 overflow-hidden">
          <div 
            className={`h-full ${config.accentColor} transition-all`}
            style={{
              animation: `progressShrink ${toast.duration}ms linear forwards`
            }}
          />
        </div>
      )}
    </div>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback if accessed outside provider
    return {
      success: (msg, title) => window.toast?.success?.(msg, title) || console.log('Toast:', msg),
      error: (msg, title) => window.toast?.error?.(msg, title) || console.error('Toast:', msg),
      warning: (msg, title) => window.toast?.warning?.(msg, title) || console.warn('Toast:', msg),
      info: (msg, title) => window.toast?.info?.(msg, title) || console.info('Toast:', msg),
      addToast: () => {},
      removeToast: () => {},
    };
  }
  return context;
};
