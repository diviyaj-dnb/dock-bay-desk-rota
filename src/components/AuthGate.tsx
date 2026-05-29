import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useSession } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import { SignIn } from './SignIn';

const ALLOWED_DOMAIN = 'dockandbay.com';

// Wraps the app behind Google sign-in. Three states:
//   1. loading      → spinner while we check for an existing session
//   2. no session   → show the SignIn screen
//   3. wrong domain → sign the user out + show SignIn with a domain error
//   4. authed + @dockandbay.com → render the app
export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading } = useSession();
  const [domainError, setDomainError] = useState(false);

  if (loading) {
    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center bg-slate-100/60">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <SignIn domainError={domainError} onDismissDomainError={() => setDomainError(false)} />;
  }

  // Enforce the @dockandbay.com domain. Client-side gate for UX — the
  // authoritative enforcement will be Supabase RLS once it's tightened.
  const email = session.user.email ?? '';
  const domain = email.split('@')[1]?.toLowerCase();
  if (domain !== ALLOWED_DOMAIN) {
    // Sign the wrong-domain user out, then show the gate with an explanation.
    supabase.auth.signOut();
    if (!domainError) setDomainError(true);
    return <SignIn domainError onDismissDomainError={() => setDomainError(false)} />;
  }

  return <>{children}</>;
};
