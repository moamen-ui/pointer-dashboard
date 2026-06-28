// Route guards.
// AdminRoute  – redirects to /login when there is no admin session.
// AuthenticatedRoute – redirects to /login when there is no session (any role).
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

/** Authenticated-only guard – any logged-in user passes. */
export function AuthenticatedRoute() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
