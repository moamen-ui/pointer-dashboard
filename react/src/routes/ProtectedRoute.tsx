// Route guards.
// ProtectedRoute     – admin-only; redirects to /login when there is no admin session.
// SuperAdminRoute    – super-admin-only; redirects to / when admin but not super-admin.
// AuthenticatedRoute – any logged-in user passes; redirects to /login otherwise.
// React equivalent of angular's adminGuard / authGuard.
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

/** Admin-only guard (original behaviour). */
export function ProtectedRoute() {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

/** Super-admin-only guard. Must be nested inside ProtectedRoute (admin check already done). */
export function SuperAdminRoute() {
  const { isSuperAdmin } = useAuth();
  if (!isSuperAdmin) {
    return <Navigate to="/overview" replace />;
  }
  return <Outlet />;
}

/** Authenticated-only guard – any logged-in user passes. Redirects to /login with the
 * current path+search preserved in `?next=`, so LoginPage can send the user back here
 * (e.g. arriving at /cli-login?code=… while signed out). */
export function AuthenticatedRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Outlet />;
}
