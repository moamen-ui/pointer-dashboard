// Public self-signup page — shown only when scopedAdminSignupEnabled is true.
// The form itself (enabled check, plan selector, register-admin mutation) lives in
// RegisterWorkspaceForm so /login can also render it inline (#213) when not in demo mode.
import { AuthLayout } from '@/components/AuthLayout';
import { RegisterWorkspaceForm } from './RegisterWorkspaceForm';

export function SignupPage() {
  return (
    <AuthLayout>
      <RegisterWorkspaceForm />
    </AuthLayout>
  );
}
