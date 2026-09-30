import React from 'react';

export const ForbiddenPage = ({ 
  code = '', 
  onReturnDashboard = () => {}, 
  onGoBack = null 
}) => {
  const queryCode = typeof window !== 'undefined' 
    ? new URLSearchParams(window.location.search).get('code') 
    : '';
  const rawCode = code || queryCode;
  const displayCode = rawCode 
    ? (rawCode.includes('.') || rawCode.startsWith('/') ? rawCode : `/${rawCode}`)
    : '';

  const handleGoBack = () => {
    if (onGoBack) {
      onGoBack();
    } else if (window.history.length > 1) {
      window.history.back();
    } else {
      onReturnDashboard();
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f5f3] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans">
      {/* Soft Light Ambient Orbs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-rose-200/40 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-teal-200/40 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-100/30 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Main Card Container */}
      <div className="w-full max-w-lg relative z-10 animate-fade-in-up">
        <div className="bg-white/95 border border-slate-200/90 backdrop-blur-xl rounded-3xl p-8 sm:p-10 shadow-xl shadow-slate-300/40 relative overflow-hidden">
          
          {/* Top Accent Bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-400 to-teal-500"></div>

          {/* Content */}
          <div className="flex flex-col items-center text-center space-y-5">
            
            <div className="relative my-2">
              {/* Soft Glow Effect */}
              <div className="absolute -inset-2 rounded-2xl bg-rose-400/20 blur-md animate-pulse"></div>
              
              {/* Shield Icon Box */}
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-b from-rose-50 to-rose-100/80 border border-rose-200 flex items-center justify-center text-rose-600 shadow-md shadow-rose-100">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
              </div>
            </div>

            {/* HTTP Status Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold tracking-wider uppercase shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              HTTP 403 • ACCESS RESTRICTED
            </div>

            {/* Main Title & Description */}
            <div className="space-y-2 pt-1">
              <h1 className="text-3xl font-black tracking-tight text-slate-900">
                Permission Denied
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-sm mx-auto font-medium">
                Your account role does not have the required permissions to access this page. Please contact your system administrator to request access.
              </p>
            </div>

            {/* Denied Resource Details Box */}
            {displayCode && (
              <div className="w-full mt-2 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-amber-600 shrink-0 shadow-2xs">
                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Attempted Resource</div>
                    <div className="text-sm font-mono font-bold text-rose-600 truncate">
                      {displayCode}
                    </div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-rose-100/70 text-rose-700 text-[11px] font-mono font-bold border border-rose-200 shrink-0">
                  UNAUTHORIZED
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="w-full pt-3 space-y-2.5">
              <button
                type="button"
                onClick={onReturnDashboard}
                className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-sm font-bold shadow-md shadow-teal-600/25 hover:shadow-lg hover:shadow-teal-600/35 transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2.5 group cursor-pointer border-0"
              >
                <svg className="w-4.5 h-4.5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                </svg>
                <span>Return to Dashboard</span>
              </button>

              <button
                type="button"
                onClick={handleGoBack}
                className="w-full py-3 px-5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-300 shadow-2xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 0118 0z"/>
                </svg>
                <span>Go Back to Previous Page</span>
              </button>
            </div>

            {/* Footer Note */}
            <div className="pt-2 text-[11px] text-slate-400 font-medium">
              Mekong Stock Inventory Workspace • Security &amp; Authorization System
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};
