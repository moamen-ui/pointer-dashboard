// Route guards.
// ProtectedRoute     – admin-only; redirects to /login when there is no admin session.
// SuperAdminRoute    – super-admin-only; redirects to / when admin but not super-admin.
// AuthenticatedRoute – any logged-in user passes; redirects to /login otherwise.
// React equivalent of angular's adminGuard / authGuard.
import { Navigate, Outlet } from 'react-router-dom';
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

/** Authenticated-only guard – any logged-in user passes. */
export function AuthenticatedRoute() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
