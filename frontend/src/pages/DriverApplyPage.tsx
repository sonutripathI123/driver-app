import React, { useMemo, useState } from 'react';
import { CheckCircle2, LoaderCircle, ShieldCheck, AlertTriangle } from 'lucide-react';
import { COMPANY } from '../config/company';

/**
 * Public driver self-registration form, reached from the shareable signup link
 * (/apply?token=…). No login: the applicant does not have one yet. The secret
 * token from the link is posted with the form and is what the backend checks,
 * so this page is useless without the exact link. On success the driver exists
 * in the roster and can sign in to the portal with the password they chose.
 *
 * A plain fetch is used, not the app's axios client, so the auth interceptor
 * (refresh/redirect on 401) never fires on this un-authenticated page.
 */

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL
  ? `${(import.meta as any).env.VITE_API_BASE_URL}/api/v1`
  : '/api/v1';

export const DriverApplyPage: React.FC = () => {
  const token = useMemo(() => new URLSearchParams(window.location.search).get('token') || '', []);

  const [form, setForm] = useState({
    full_name: '',
    phone: '+61 ',
    email: '',
    license_number: '',
    accreditation_number: '',
    password: '',
    confirm: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm) {
      setError('The two passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const resp = await fetch(`${API_BASE}/drivers/apply?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          license_number: form.license_number.trim(),
          accreditation_number: form.accreditation_number.trim() || null,
          password: form.password,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const detail = data?.detail;
        setError(
          typeof detail === 'string'
            ? detail
            : Array.isArray(detail) && detail.length
            ? detail.map((d: any) => `${(d.loc || []).slice(1).join('.') || 'field'}: ${d.msg}`).join(' • ')
            : 'Could not submit your registration. Please check the link and try again.'
        );
        return;
      }
      setDone(true);
    } catch {
      setError('Could not reach the server. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const field =
    'w-full px-4 py-3 rounded-xl bg-[#0D1322] border border-[#1F2E4D] text-white text-sm font-semibold focus:border-[#DFCAA8] focus:outline-none';
  const label = 'text-xs font-bold text-[#DFCAA8] uppercase tracking-wider block mb-1.5';

  return (
    <div className="min-h-screen bg-[#06090F] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0D1322] border border-[#DFCAA8] mb-3">
            <ShieldCheck className="w-7 h-7 text-[#DFCAA8]" />
          </div>
          <h1 className="text-xl font-black tracking-tight">{COMPANY.legalName}</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Chauffeur Registration</p>
        </div>

        {!token ? (
          <div className="rounded-2xl bg-[#2A1520] border border-amber-500 p-5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-black">This registration link is incomplete.</p>
              <p className="text-slate-300 mt-1">
                Please open the exact link your operator shared with you — it must include the access token.
              </p>
            </div>
          </div>
        ) : done ? (
          <div className="rounded-2xl bg-[#121A2D] border border-emerald-500 p-6 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h2 className="text-lg font-black">You&apos;re registered!</h2>
            <p className="text-sm text-slate-300">
              Your chauffeur profile has been created. You can now sign in to the driver app with your email and the
              password you just chose. Your operator will assign your vehicle and jobs.
            </p>
            <a
              href="/driver"
              className="inline-block mt-2 px-5 py-2.5 rounded-xl bg-[#DFCAA8] text-[#0A0E1A] font-black text-sm"
            >
              Go to the driver app →
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-2xl bg-[#121A2D] border border-[#1F2E4D] p-6 space-y-4 shadow-2xl">
            <p className="text-sm text-slate-300 font-semibold">
              Fill in your details to join the chauffeur roster. Everything marked * is required.
            </p>

            <div>
              <label className={label}>Full name *</label>
              <input className={field} required minLength={2} value={form.full_name} onChange={set('full_name')} placeholder="e.g. Amit Sharma" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={label}>Mobile / WhatsApp *</label>
                <input className={field} required type="tel" value={form.phone} onChange={set('phone')} placeholder="+61 400 000 000" />
              </div>
              <div>
                <label className={label}>Email *</label>
                <input className={field} required type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={label}>Driver licence no. *</label>
                <input className={field} required minLength={3} value={form.license_number} onChange={set('license_number')} placeholder="Your licence number" />
              </div>
              <div>
                <label className={label}>Accreditation no.</label>
                <input className={field} value={form.accreditation_number} onChange={set('accreditation_number')} placeholder="If you have one" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={label}>Create password *</label>
                <input className={field} required type="password" minLength={8} value={form.password} onChange={set('password')} placeholder="At least 8 characters" />
              </div>
              <div>
                <label className={label}>Confirm password *</label>
                <input className={field} required type="password" value={form.confirm} onChange={set('confirm')} placeholder="Re-type password" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 font-semibold">
              You&apos;ll use your email and this password to sign in to the driver app.
            </p>

            {error && (
              <div className="rounded-xl bg-rose-950 border border-rose-500 text-rose-200 text-xs font-bold p-3 break-words">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-[#DFCAA8] hover:bg-[#C2A16B] text-[#0A0E1A] font-black text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60"
            >
              {submitting ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {submitting ? 'Submitting…' : 'Join the roster'}
            </button>
          </form>
        )}

        <p className="text-center text-[11px] text-slate-500 mt-4">
          {COMPANY.legalName} • ABN {COMPANY.abn}
        </p>
      </div>
    </div>
  );
};

export default DriverApplyPage;
