import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import ApplicationPending from '@/pages/ApplicationPending';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading, userRole, applicationStatus, applicationLoading, applicationRejectionReason, accountDeactivated } = useAuth();
  const location = useLocation();
  const [aalChecked, setAalChecked] = useState(false);
  const [needsMfa, setNeedsMfa] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setAalChecked(true);
      setNeedsMfa(false);
      return;
    }
    setAalChecked(false);
    (async () => {
      try {
        const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (cancelled) return;
        setNeedsMfa(data?.currentLevel === 'aal1' && data?.nextLevel === 'aal2');
      } catch {
        if (!cancelled) setNeedsMfa(false);
      } finally {
        if (!cancelled) setAalChecked(true);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      try {
        const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (cancelled) return;
        setNeedsMfa(data?.currentLevel === 'aal1' && data?.nextLevel === 'aal2');
      } catch { /* noop */ }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [user]);

  if (loading || (user && !aalChecked) || (user && applicationLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (needsMfa && location.pathname !== '/auth/mfa') {
    return <Navigate to="/auth/mfa" replace />;
  }

  // Block deactivated accounts (non-admin only)
  if (userRole !== 'admin' && accountDeactivated) {
    return <ApplicationPending status="deactivated" />;
  }

  // Block non-admin users whose application is pending, missing or rejected
  if (userRole !== 'admin' && (applicationStatus === 'pending' || applicationStatus === null)) {
    return <ApplicationPending status="pending" />;
  }

  if (userRole !== 'admin' && applicationStatus === 'rejected') {
    return (
      <ApplicationPending status="rejected" rejectionReason={applicationRejectionReason} />
    );
  }

  if (requiredRole && userRole !== requiredRole && userRole !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-foreground">Access Denied</h1>
          <p className="mt-2 text-muted-foreground">
            You don't have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
