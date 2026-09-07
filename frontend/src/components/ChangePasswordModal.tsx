import React, { useState } from 'react';
import { KeyRound, X, Eye, EyeOff, LoaderCircle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { authApi } from '../services/api';

interface ChangePasswordModalProps {
  onClose: () => void;
}

const MIN_LENGTH = 8;

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const tooShort = newPassword.length > 0 && newPassword.length < MIN_LENGTH;
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const sameAsOld = newPassword.length > 0 && newPassword === currentPassword;
  const canSubmit =
    !!currentPassword &&
    newPassword.length >= MIN_LENGTH &&
    newPassword === confirmPassword &&
    !sameAsOld &&
    !isSaving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSaving(true);
    setError(null);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setDone(true);
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 400) {
        setError(typeof detail === 'string' ? detail : 'Your current password is incorrect.');
      } else if (!err?.response) {
        setError('Cannot reach the Opal Cloud Engine. Check your connection.');
      } else {
        setError(typeof detail === 'string' ? detail : 'Could not change the password. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const fieldClass =
    'w-full pl-3 pr-11 py-2.5 rounded-xl bg-white border border-[#E6D8C3] text-sm font-semibold text-[#0A0E1A] placeholder:text-[#0A0E1A]/40 focus:outline-none focus:border-[#C2A16B] focus:ring-2 focus:ring-[#DFCAA8]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md">
      <div className="bg-[#FAF6F0] border border-[#DFCAA8] rounded-3xl w-full max-w-md shadow-2xl text-[#0A0E1A] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[#E6D8C3] flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#FFFFFF] border border-[#DFCAA8] flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5 text-[#0A0E1A]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black text-[#0A0E1A] truncate">Change Password</h2>
              <p className="text-xs font-bold text-[#0A0E1A] opacity-70 truncate">
                Applies to your own sign-in only
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg border border-[#E6D8C3] text-[#0A0E1A] hover:bg-[#FEF9C3] hover:text-[#0A0E1A] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-[#10B981]">
              <CheckCircle2 className="w-5 h-5 text-[#10B981] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-black text-[#0A0E1A]">Password changed</p>
                <p className="text-xs font-bold text-[#0A0E1A] opacity-75">
                  Use your new password next time you sign in. Your current session stays active.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-[#06090F] border border-[#DFCAA8] text-white text-sm font-black hover:bg-[#E0F2FE] hover:text-[#0A0E1A] transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
            {error && (
              <div role="alert" className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-[#EF4444]">
                <ShieldAlert className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-[#0A0E1A]">{error}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="cp-current" className="block text-[11px] font-black uppercase tracking-wider">
                Current Password
              </label>
              <div className="relative">
                <input
                  id="cp-current"
                  type={reveal ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={fieldClass}
                />
                <button
                  type="button"
                  onClick={() => setReveal((v) => !v)}
                  aria-label={reveal ? 'Hide passwords' : 'Show passwords'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#0A0E1A] hover:bg-[#FEF9C3] transition-colors"
                >
                  {reveal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="cp-new" className="block text-[11px] font-black uppercase tracking-wider">
                New Password
              </label>
              <input
                id="cp-new"
                type={reveal ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={fieldClass}
              />
              {tooShort && (
                <p className="text-[11px] font-bold text-[#EF4444]">
                  Must be at least {MIN_LENGTH} characters.
                </p>
              )}
              {sameAsOld && (
                <p className="text-[11px] font-bold text-[#EF4444]">
                  New password must differ from the current one.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="cp-confirm" className="block text-[11px] font-black uppercase tracking-wider">
                Confirm New Password
              </label>
              <input
                id="cp-confirm"
                type={reveal ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={fieldClass}
              />
              {mismatch && (
                <p className="text-[11px] font-bold text-[#EF4444]">Passwords do not match.</p>
              )}
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-white border border-[#E6D8C3] text-[#0A0E1A] text-sm font-black hover:bg-[#FEF9C3] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#06090F] border border-[#DFCAA8] text-white text-sm font-black hover:bg-[#E0F2FE] hover:text-[#0A0E1A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#06090F] disabled:hover:text-white"
              >
                {isSaving ? (
                  <>
                    <LoaderCircle className="w-4 h-4 animate-spin" />
                    <span>Saving…</span>
                  </>
                ) : (
                  <span>Update</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ChangePasswordModal;
