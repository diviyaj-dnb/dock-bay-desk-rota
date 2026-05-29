import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import logoUrl from '../assets/dock-and-bay-logo.jpg';
import backdropUrl from '../assets/login-backdrop.webp';

// Split-screen sign-in. Left: full-bleed Dock & Bay brand photo (no overlay).
// Right: a clean, precisely-spaced sign-in panel. Single "Continue with
// Google" button — Supabase redirects back to this origin and useSession()
// picks up the session.
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
      {/* ── Brand photo ── desktop: left half · mobile: top hero ── */}
      <div className="relative h-[34vh] min-h-[200px] sm:h-[40vh] md:h-auto md:w-[52%] lg:w-[56%] overflow-hidden shrink-0 bg-[#cfe6f5]">
        <img
          src={backdropUrl}
          alt="Dock & Bay quick-dry towels"
          className="absolute inset-0 w-full h-full object-cover db-kenburns"
          style={{ objectPosition: '55% 52%' }}
          fetchPriority="high"
        />
        {/* Wordmark, top-left on the photo */}
        <div className="absolute top-5 left-5 md:top-8 md:left-9">
          <span className="text-[10px] md:text-[11px] font-semibold tracking-[0.28em] text-white uppercase drop-shadow-[0_1px_4px_rgba(0,0,0,0.35)]">
            Dock &amp; Bay
          </span>
        </div>
        {/* Hairline seam + faint depth at the edge meeting the panel */}
        <div className="hidden md:block absolute inset-y-0 right-0 w-24 bg-gradient-to-r from-transparent to-black/5" />
      </div>

      {/* ── Sign-in panel ── */}
      <div className="flex-1 flex items-center justify-center px-6 sm:px-10 py-12 md:py-0">
        <div className="w-full max-w-[360px] flex flex-col items-center text-center">
          {/* Brand lockup — centred */}
          <img
            src={logoUrl}
            alt="Dock & Bay"
            className="w-16 h-16 object-contain rounded-2xl ring-1 ring-black/5 shadow-sm"
          />
          <span className="mt-4 text-[10px] font-semibold tracking-[0.24em] text-slate-400 uppercase">
            Dock &amp; Bay · HQ Desk Rota
          </span>

          {/* Heading block */}
          <h1 className="mt-6 font-serif text-[2.5rem] leading-[1.04] font-semibold text-dock-navy tracking-tight">
            Welcome back
          </h1>
          <p className="text-[15px] text-slate-500 mt-3 leading-relaxed max-w-[300px]">
            Sign in with your Dock &amp; Bay account to book your spot for the week.
          </p>

          {/* Notices */}
          {domainError && (
            <div className="mt-6 w-full bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-[13px] text-amber-800 leading-relaxed text-left">
              That account isn&rsquo;t a <strong>@dockandbay.com</strong> address. Please sign in
              with your Dock &amp; Bay work account.
            </div>
          )}
          {error && (
            <div className="mt-6 w-full bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-[13px] text-red-700 leading-relaxed text-left">
              {error}
            </div>
          )}

          {/* Google button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="group mt-9 w-full flex items-center justify-center gap-3 bg-dock-navy hover:bg-[#0f1722] text-white rounded-2xl px-5 h-14 text-[15px] font-semibold transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_10px_30px_-10px_rgba(25,36,52,0.55)] hover:shadow-[0_14px_36px_-10px_rgba(25,36,52,0.65)] active:scale-[0.99]"
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

          {/* Footer microcopy */}
          <p className="mt-8 text-[12px] text-slate-400 leading-relaxed">
            Access is limited to Dock &amp; Bay team members.
          </p>
        </div>
      </div>
    </div>
  );
};
