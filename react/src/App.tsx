import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth';
import { PreferencesProvider } from '@/lib/preferences';
import { ToastProvider } from '@/components/ui/toast';
import { ProtectedRoute, AuthenticatedRoute } from '@/routes/ProtectedRoute';
import { Shell } from '@/features/shell/Shell';
import { LoginPage } from '@/features/login/LoginPage';
import { OverviewPage } from '@/features/overview/OverviewPage';
import { RolesPage } from '@/features/roles/RolesPage';
import { UsersPage } from '@/features/users/UsersPage';
import { ProjectsPage } from '@/features/projects/ProjectsPage';
import { ProfilePage } from '@/features/profile';

export default function App() {
  return (
    <BrowserRouter>
      <PreferencesProvider>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              {/* Shell wraps all authenticated routes */}
              <Route element={<AuthenticatedRoute />}>
                <Route element={<Shell />}>
                  {/* Root redirect: admin → overview, non-admin → profile (handled by LoginPage / post-login) */}
                  <Route index element={<Navigate to="/overview" replace />} />

                  {/* Admin-only section */}
                  <Route element={<ProtectedRoute />}>
                    <Route path="/overview" element={<OverviewPage />} />
                    <Route path="/roles" element={<RolesPage />} />
                    <Route path="/users" element={<UsersPage />} />
                    <Route path="/projects" element={<ProjectsPage />} />
                  </Route>

                  {/* Authenticated-user routes (non-admin allowed) */}
                  <Route path="/profile" element={<ProfilePage />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </PreferencesProvider>
    </BrowserRouter>
  );
}
