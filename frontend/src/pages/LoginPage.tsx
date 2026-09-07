import React, { useState } from 'react';
import { Car, Lock, Mail, Eye, EyeOff, LoaderCircle, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { login, isLoggingIn, loginError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || isLoggingIn) return;
    try {
      await login(email, password);
    } catch {
      // Message is surfaced through loginError; nothing to do here.
    }
  };

  return (
    <div className="min-h-screen bg-[#06090F] text-white flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[#FAF6F0] border border-[#DFCAA8] flex items-center justify-center shadow-lg">
            <Car className="w-8 h-8 text-[#0A0E1A]" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-wider text-white uppercase">
              Opal Chauffeurs Australia
            </h1>
            <p className="text-[11px] text-white font-mono tracking-widest uppercase font-bold opacity-90">
              Operations &amp; Dispatch Command Center
            </p>
          </div>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-[#FAF6F0] border border-[#E6D8C3] rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 text-[#0A0E1A]"
        >
          <div className="space-y-1 pb-1">
            <h2 className="text-base font-black text-[#0A0E1A]">Sign in</h2>
            <p className="text-xs font-bold text-[#0A0E1A] opacity-70">
              Authorised staff only. Access is governed by your assigned role.
            </p>
          </div>

          {loginError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-[#EF4444] text-[#0A0E1A]"
            >
              <ShieldAlert className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
              <p className="text-xs font-bold">{loginError}</p>
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="block text-[11px] font-black uppercase tracking-wider text-[#0A0E1A]">
              Work Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0A0E1A] opacity-60 pointer-events-none" />
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@opalchauffeurs.com.au"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-[#E6D8C3] text-sm font-semibold text-[#0A0E1A] placeholder:text-[#0A0E1A]/40 focus:outline-none focus:border-[#C2A16B] focus:ring-2 focus:ring-[#DFCAA8]"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label htmlFor="login-password" className="block text-[11px] font-black uppercase tracking-wider text-[#0A0E1A]">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0A0E1A] opacity-60 pointer-events-none" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-11 py-2.5 rounded-xl bg-white border border-[#E6D8C3] text-sm font-semibold text-[#0A0E1A] placeholder:text-[#0A0E1A]/40 focus:outline-none focus:border-[#C2A16B] focus:ring-2 focus:ring-[#DFCAA8]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#0A0E1A] hover:bg-[#FEF9C3] hover:text-[#0A0E1A] transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoggingIn || !email.trim() || !password}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#06090F] border border-[#DFCAA8] text-white text-sm font-black shadow-lg transition-all hover:bg-[#E0F2FE] hover:text-[#0A0E1A] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#06090F] disabled:hover:text-white"
          >
            {isLoggingIn ? (
              <>
                <LoaderCircle className="w-4 h-4 animate-spin" />
                <span>Verifying…</span>
              </>
            ) : (
              <span>Sign in to Dispatch</span>
            )}
          </button>
        </form>

        <p className="text-center text-[10px] font-mono text-white opacity-60">
          Opal Chauffeurs Australia Pty Ltd &nbsp;•&nbsp; ABN 68 642 908 112
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
