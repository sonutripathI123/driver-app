import React, { useState } from 'react';
import { customerPortalApi } from '../services/api';
import { LoaderCircle, Lock, CheckCircle2, Eye, EyeOff } from 'lucide-react';

/**
 * Public page opened from the first-booking link (/set-password?token=…).
 * The customer chooses a password; after that they sign in normally.
 */
export const SetPasswordPage: React.FC = () => {
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneEmail, setDoneEmail] = useState<string | null>(null);

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = token && password.length >= 8 && confirm === password && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await customerPortalApi.setPassword(token, password);
      setDoneEmail(res.email || null);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Could not set your password. The link may have expired.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06090F] text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0D1322] border border-[#1F2E4D] rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="text-lg font-black text-white">OPAL CHAUFFEURS</div>
          <div className="text-[10px] font-bold tracking-widest text-[#DFCAA8] uppercase mt-1">Customer Portal</div>
        </div>

        {!token ? (
          <p className="text-sm font-bold text-rose-300 text-center">This link is missing its token. Please use the link from your booking message.</p>
        ) : doneEmail ? (
          <div className="text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <p className="text-sm font-black text-white">Your account is ready</p>
            <p className="text-xs font-semibold text-slate-300">Sign in with <span className="text-[#DFCAA8] font-mono">{doneEmail}</span> and the password you just set.</p>
            <a href="/" className="inline-block mt-2 px-5 py-2.5 rounded-xl bg-[#DFCAA8] text-[#0A0E1A] font-black text-xs">Go to sign in</a>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-xs font-bold text-slate-300 text-center">Set a password to track your bookings and re-book faster next time.</p>
            <div>
              <label className="text-[10px] uppercase font-black text-slate-300 block mb-1">New password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-[#121A2D] border border-[#1F2E4D] text-white text-sm font-bold focus:outline-none focus:border-[#DFCAA8]"
                  placeholder="At least 8 characters"
                />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-3 text-slate-400">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {tooShort && <p className="text-[11px] font-bold text-amber-300 mt-1">Use at least 8 characters.</p>}
            </div>
            <div>
              <label className="text-[10px] uppercase font-black text-slate-300 block mb-1">Confirm password</label>
              <input
                type={show ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#121A2D] border border-[#1F2E4D] text-white text-sm font-bold focus:outline-none focus:border-[#DFCAA8]"
                placeholder="Re-enter the password"
              />
              {mismatch && <p className="text-[11px] font-bold text-rose-300 mt-1">Passwords do not match.</p>}
            </div>
            {error && <p className="text-[11px] font-black text-rose-300">{error}</p>}
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-3 rounded-xl bg-[#DFCAA8] hover:bg-[#C2A16B] text-[#0A0E1A] font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {busy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : null} Set password & activate
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
