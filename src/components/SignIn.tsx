import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import logoUrl from '../assets/dock-and-bay-logo.jpg';
import backdropUrl from '../assets/login-backdrop.webp';

// Premium split-screen sign-in. Left: editorial brand hero photo (desktop) /
// hero banner (mobile). Right: warm sign-in panel with the Dock & Bay
// diagonal-stripe signature. Single "Continue with Google" button — Supabase
// redirects back to this origin and useSession() picks up the session.
export const SignIn: React.FC<{ domainError?: boolean; onDismissDomainError?: () => void }> = ({
  domainError = false,
  onDismissDomainError,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    onDismissDomainError?.();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        // Hint Google to prefer a Dock & Bay Workspace account. UX hint only —
        // the real @dockandbay.com enforcement happens in AuthGate.
        queryParams: { hd: 'dockandbay.com', prompt: 'select_account' },
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // On success the browser redirects to Google, so no need to reset loading.
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col md:flex-row bg-[#faf7f2]">
      {/* ── Brand hero ─────────────────────────────────────────────
          Desktop: left half, full height. Mobile: top banner. */}
      <div className="relative h-44 sm:h-56 md:h-auto md:w-[52%] lg:w-[55%] overflow-hidden shrink-0">
        <img
          src={backdropUrl}
          alt="Dock & Bay"
          className="absolute inset-0 w-full h-full object-cover db-kenburns"
          fetchPriority="high"
        />
        {/* Warm editorial scrim — deeper at the bottom for the tagline */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#192434]/80 via-[#192434]/15 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#f3705a]/10 to-transparent mix-blend-multiply" />

        {/* Top-left wordmark on the photo */}
        <div className="absolute top-5 left-5 md:top-8 md:left-9 flex items-center gap-2.5">
          <span className="text-[10px] md:text-[11px] font-semibold tracking-[0.28em] text-white/90 uppercase">
            Dock &amp; Bay
          </span>
        </div>

        {/* Editorial tagline, bottom-left (desktop) */}
        <div className="hidden md:block absolute bottom-10 left-9 right-9">
          <div className="db-stripe h-1 w-14 rounded-full mb-5" />
          <h2 className="font-serif text-white text-[2.6rem] leading-[1.05] font-medium tracking-tight max-w-[15ch]">
            Your seat<br />by the sea.
          </h2>
          <p className="text-white/75 text-sm mt-4 max-w-[34ch] leading-relaxed">
            Book your desk, claim the sofa, or bring the pup along — the whole
            week, one tap.
          </p>
        </div>
      </div>

      {/* ── Sign-in panel ──────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 md:py-0">
        <div className="w-full max-w-sm flex flex-col">
          {/* Logo + eyebrow */}
          <div className="flex items-center gap-3 mb-8">
            <img
              src={logoUrl}
              alt="Dock & Bay"
              className="w-12 h-12 object-contain rounded-xl shadow-sm ring-1 ring-black/5"
            />
            <div className="leading-tight">
              <span className="block text-[10px] font-semibold tracking-[0.22em] text-slate-400 uppercase">
                Dock &amp; Bay
              </span>
              <span className="block text-sm font-semibold text-dock-navy">HQ Desk Rota</span>
            </div>
          </div>

          <h1 className="font-serif text-[2.4rem] leading-[1.05] font-semibold text-dock-navy tracking-tight">
            Welcome back
          </h1>
          <p className="text-[15px] text-slate-500 mt-3 leading-relaxed">
            Sign in with your Dock &amp; Bay account to pick your spot for the week.
          </p>

          {domainError && (
            <div className="mt-6 w-full bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-[13px] text-amber-800 leading-relaxed">
              That account isn&rsquo;t a <strong>@dockandbay.com</strong> address. Please sign in
              with your Dock &amp; Bay work account.
            </div>
          )}

          {error && (
            <div className="mt-6 w-full bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-[13px] text-red-700 leading-relaxed">
              {error}
            </div>
          )}

          {/* Google button — premium navy, white Google chip */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="group mt-8 w-full flex items-center justify-center gap-3 bg-dock-navy hover:bg-[#0f1722] text-white rounded-2xl px-5 py-4 text-[15px] font-semibold transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_8px_24px_-8px_rgba(25,36,52,0.5)] hover:shadow-[0_12px_32px_-8px_rgba(25,36,52,0.6)] active:scale-[0.99]"
          >
            <span className="flex items-center justify-center w-6 h-6 bg-white rounded-full shrink-0 transition-transform group-hover:scale-105">
              <svg className="w-3.5 h-3.5" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
            </span>
            <span>{loading ? 'Redirecting…' : 'Continue with Google'}</span>
          </button>

          {/* Footer: stripe + microcopy */}
          <div className="mt-8 flex items-center gap-3">
            <div className="db-stripe h-1 w-8 rounded-full opacity-80" />
            <p className="text-[12px] text-slate-400 leading-relaxed">
              Access is limited to Dock &amp; Bay team members.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
