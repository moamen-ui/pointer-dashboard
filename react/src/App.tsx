import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth';
import { PreferencesProvider } from '@/lib/preferences';
import { ToastProvider } from '@/components/ui/toast';
import { ProtectedRoute, SuperAdminRoute, AuthenticatedRoute } from '@/routes/ProtectedRoute';
import { Shell } from '@/features/shell/Shell';
import { LoginPage } from '@/features/login/LoginPage';
import { OverviewPage } from '@/features/overview/OverviewPage';
import { RolesPage } from '@/features/roles/RolesPage';
import { UsersPage } from '@/features/users/UsersPage';
import { ProjectsPage } from '@/features/projects/ProjectsPage';
import { ProfilePage } from '@/features/profile';
import { StatusesPage } from '@/features/statuses/StatusesPage';
import { TenantsPage } from '@/features/tenants/TenantsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { PlansPage } from '@/features/plans/PlansPage';
import { SignupPage } from '@/features/signup/SignupPage';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage';
import { JoinPage } from '@/features/auth/JoinPage';
import { UpgradePrompt } from '@/components/UpgradePrompt';

function IndexRedirect() {
  const { isAdmin } = useAuth();
  return <Navigate to={isAdmin ? '/overview' : '/profile'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <PreferencesProvider>
        <AuthProvider>
          <ToastProvider>
            <UpgradePrompt />
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/forgot" element={<ForgotPasswordPage />} />
              <Route path="/reset" element={<ResetPasswordPage />} />
              <Route path="/join" element={<JoinPage />} />

              {/* Shell wraps all authenticated routes */}
              <Route element={<AuthenticatedRoute />}>
                <Route element={<Shell />}>
                  {/* Root redirect: admin → overview, non-admin → profile */}
                  <Route index element={<IndexRedirect />} />

                  {/* Admin-only section */}
                  <Route element={<ProtectedRoute />}>
                    <Route path="/overview" element={<OverviewPage />} />
                    <Route path="/roles" element={<RolesPage />} />
                    <Route path="/users" element={<UsersPage />} />
                    <Route path="/statuses" element={<StatusesPage />} />
                    {/* Admin view of another user's profile */}
                    <Route path="/users/:id/profile" element={<ProfilePage />} />

                    {/* Super-admin-only section */}
                    <Route element={<SuperAdminRoute />}>
                      <Route path="/tenants" element={<TenantsPage />} />
                      <Route path="/plans" element={<PlansPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                    </Route>
                  </Route>

                  {/* Authenticated-user routes (non-admin allowed) */}
                  <Route path="/projects" element={<ProjectsPage />} />
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
