import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth';
import { PreferencesProvider } from '@/lib/preferences';
import { ToastProvider } from '@/components/ui/toast';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { Shell } from '@/features/shell/Shell';
import { LoginPage } from '@/features/login/LoginPage';
import { OverviewPage } from '@/features/overview/OverviewPage';
import { RolesPage } from '@/features/roles/RolesPage';
import { UsersPage } from '@/features/users/UsersPage';
import { ProjectsPage } from '@/features/projects/ProjectsPage';

export default function App() {
  return (
    <BrowserRouter>
      <PreferencesProvider>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<Shell />}>
                  <Route index element={<Navigate to="/overview" replace />} />
                  <Route path="/overview" element={<OverviewPage />} />
                  <Route path="/roles" element={<RolesPage />} />
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/projects" element={<ProjectsPage />} />
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
