import React, { useState, useEffect, useRef } from 'react';
import { Trash2, AlertTriangle, AlertCircle, CheckCircle2, X, Loader2, ShieldAlert } from 'lucide-react';

/**
 * ConfirmModal – Premium confirmation dialog.
 *
 * Props:
 *  isOpen             – boolean
 *  onClose            – fn
 *  onConfirm          – async fn (called only when confirmed)
 *  title              – string
 *  message            – string
 *  itemName           – string (shown as highlighted label)
 *  requireConfirmText – string | null  When set, user must type this exact value to unlock the confirm button
 *  confirmInputLabel  – string         Override label above the input
 *  confirmText        – string (button label, default 'Delete')
 *  cancelText         – string
 *  type               – 'danger' | 'warning' | 'info'
 */
export const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed with this action?',
  itemName = '',
  requireConfirmText = null,
  confirmInputLabel = null,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  type = 'danger',
}) => {
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  // Reset state every time the modal opens
  useEffect(() => {
    if (isOpen) {
      setInputValue('');
      setError('');
      setLoading(false);
      // Auto-focus the input after a short delay for animation
      if (requireConfirmText) {
        setTimeout(() => inputRef.current?.focus(), 150);
      }
    }
  }, [isOpen, requireConfirmText]);

  if (!isOpen) return null;

  const isInputRequired = Boolean(requireConfirmText);
  const isInputMatch = !isInputRequired || inputValue === requireConfirmText;
  const canConfirm = !loading && isInputMatch;

  const handleConfirm = async () => {
    if (!canConfirm) {
      setError(`Type "${requireConfirmText}" exactly to confirm.`);
      inputRef.current?.focus();
      return;
    }
    try {
      setLoading(true);
      setError('');
      await onConfirm();
      onClose();
    } catch (err) {
      console.error('Confirmation action failed', err);
      setError(err?.message || 'An error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && canConfirm) handleConfirm();
  };

  const isDanger = type === 'danger';
  const isWarning = type === 'warning';

  const accentGradient = isDanger
    ? 'from-rose-500 via-red-500 to-amber-500'
    : isWarning
    ? 'from-amber-400 via-orange-400 to-yellow-500'
    : 'from-emerald-500 via-teal-500 to-blue-500';

  const iconClass = isDanger
    ? 'bg-rose-50 text-rose-600 border-rose-200 shadow-rose-100'
    : isWarning
    ? 'bg-amber-50 text-amber-600 border-amber-200 shadow-amber-100'
    : 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-emerald-100';

  const btnActive = isDanger
    ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-rose-600/25 hover:shadow-rose-600/35'
    : isWarning
    ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/25'
    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-600/25';

  // Input border color based on match state
  const inputBorderClass = inputValue
    ? isInputMatch
      ? 'border-emerald-400 bg-emerald-50/60 ring-emerald-400/30'
      : 'border-rose-400 bg-rose-50/60 ring-rose-400/30'
    : 'border-slate-200 bg-white ring-transparent';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200/80 relative overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Gradient Bar */}
        <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${accentGradient}`} />

        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Row */}
        <div className="flex items-start gap-4 pt-1">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-xs ${iconClass}`}>
            {isDanger ? (
              <Trash2 className="w-6 h-6 animate-pulse" />
            ) : isWarning ? (
              <AlertTriangle className="w-6 h-6" />
            ) : (
              <CheckCircle2 className="w-6 h-6" />
            )}
          </div>

          <div className="flex-1 min-w-0 pr-4">
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{title}</h3>
            <p className="text-xs text-slate-600 leading-relaxed mt-1.5">{message}</p>

            {itemName && (
              <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/90 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${isDanger ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                <span className="text-xs font-mono font-bold text-slate-800 truncate">{itemName}</span>
              </div>
            )}

            {isDanger && (
              <p className="text-[11px] text-rose-600/90 font-medium mt-2.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                This operation is permanent and cannot be undone.
              </p>
            )}
          </div>
        </div>

        {/* Confirmation Input */}
        {isInputRequired && (
          <div className="mt-5 space-y-2">
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
              {confirmInputLabel
                ? confirmInputLabel
                : <>Type <span className="font-mono text-rose-600 mx-1 normal-case tracking-normal">"{requireConfirmText}"</span> to confirm</>
              }
            </label>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => { setInputValue(e.target.value); setError(''); }}
              onKeyDown={handleKeyDown}
              placeholder={requireConfirmText}
              spellCheck={false}
              autoComplete="off"
              className={`w-full px-3.5 py-2.5 rounded-xl border-2 text-sm font-mono text-slate-900
                placeholder-slate-300 outline-none ring-2 transition-all duration-150
                ${inputBorderClass}`}
            />
            {/* Match Hint */}
            {inputValue && !isInputMatch && (
              <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block shrink-0" />
                Doesn't match — type exactly: <span className="font-mono ml-1">"{requireConfirmText}"</span>
              </p>
            )}
            {inputValue && isInputMatch && (
              <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
                Confirmed — you may now proceed.
              </p>
            )}
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mt-4 px-3.5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <p className="text-xs text-rose-700 font-medium leading-relaxed">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            title={isInputRequired && !isInputMatch ? `Type "${requireConfirmText}" to enable` : undefined}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md flex items-center gap-2 border-0
              ${canConfirm ? `${btnActive} cursor-pointer` : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}`}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{loading ? (isDanger ? 'Deleting...' : 'Processing...') : confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
