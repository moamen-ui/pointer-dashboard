// JoinPage — anonymous /join?code=… route.
// Reads `code` from query string, previews the invite via getApiInvitesCode,
// then accepts via usePostApiAuthRegisterInvite and signs in like the demo flow.
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  useGetApiInvitesCode,
  usePostApiAuthRegisterInvite,
  getApiAuthMe,
} from '@moamen-ui/pointer-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { FormField } from '@/components/shared/FormField';
import { emailError, passwordError, requiredError } from '@/lib/validators';
import { setAuthHeader } from '@/lib/api';
import { setItem, TOKEN_KEY, USER_KEY } from '@/lib/storage';
import { extractMessage } from '@/lib/error';

const MIN_PASSWORD_LENGTH = 8;

export function JoinPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code') ?? '';

  // If no code in URL, show invalid link immediately.
  if (!code) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
        <Card className="w-[420px] max-w-[92vw]">
          <CardContent className="flex flex-col gap-5 p-6">
            <h1 className="text-center text-xl font-bold">{t('invite.section')}</h1>
            <p className="text-center text-sm text-destructive">{t('invite.invalidLink')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <JoinForm code={code} />;
}

function JoinForm({ code }: { code: string }) {
  const { t } = useTranslation();

  const { data: preview, isLoading: previewLoading, isError: previewError } =
    useGetApiInvitesCode(code);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [displayNameTouched, setDisplayNameTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const registerMut = usePostApiAuthRegisterInvite();

  const emailErrorMsg = emailError(email, t);
  const displayNameErrorMsg = requiredError(displayName, t);
  const passwordErrorMsg = passwordError(password, MIN_PASSWORD_LENGTH, t);
  const confirmPasswordErrorMsg = requiredError(confirmPassword, t);
  // Cross-field check — like the Angular form's group validator, it compares
  // both values and is not a per-field error.
  const passwordsMismatch = password !== confirmPassword;
  const formInvalid =
    !!emailErrorMsg ||
    !!displayNameErrorMsg ||
    !!passwordErrorMsg ||
    !!confirmPasswordErrorMsg ||
    passwordsMismatch;

  if (previewLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
        <Card className="w-[420px] max-w-[92vw]">
          <CardContent className="flex flex-col gap-5 p-6">
            <p className="text-center text-sm text-muted-foreground">{t('settings.loading')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (previewError || !preview) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
        <Card className="w-[420px] max-w-[92vw]">
          <CardContent className="flex flex-col gap-5 p-6">
            <h1 className="text-center text-xl font-bold">{t('invite.section')}</h1>
            <p className="text-center text-sm text-destructive">{t('invite.invalidOrExpired')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const workspaceName = preview.workspaceName ?? '';
  const roleName = preview.roleName ?? '';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setApiError(null);
    if (formInvalid) return;

    registerMut.mutate(
      {
        data: {
          code,
          email: email.trim(),
          password,
          displayName: displayName.trim(),
        },
      },
      {
        onSuccess: async (res) => {
          try {
            const token = res.token ?? '';
            setItem(TOKEN_KEY, token);
            setAuthHeader(token);
            const me = await getApiAuthMe();
            setItem(USER_KEY, JSON.stringify(me));
            // Hard-navigate so AuthProvider re-initialises from localStorage.
            window.location.assign(me.isAdmin ? '/overview' : '/profile');
          } catch (err) {
            setApiError(extractMessage(err));
            setItem(TOKEN_KEY, '');
            setAuthHeader(null);
          }
        },
        onError: (err: unknown) => {
          setApiError(extractMessage(err));
        },
      },
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <Card className="w-[420px] max-w-[92vw]">
        <CardContent className="flex flex-col gap-5 p-6">
          <h1 className="text-center text-xl font-bold">
            {t('invite.joinTitle', { workspace: workspaceName })}
          </h1>
          {roleName && (
            <p className="text-center text-sm text-muted-foreground">
              {t('invite.joinRole', { role: roleName })}
            </p>
          )}

          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            {/* Email */}
            <FormField
              label={t('login.email')}
              htmlFor="join-email"
              error={emailTouched || submitted ? emailErrorMsg : undefined}
            >
              <Input
                id="join-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                autoFocus
              />
            </FormField>

            {/* Display name */}
            <FormField
              label={t('invite.displayName')}
              htmlFor="join-display-name"
              error={displayNameTouched || submitted ? displayNameErrorMsg : undefined}
            >
              <Input
                id="join-display-name"
                type="text"
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onBlur={() => setDisplayNameTouched(true)}
              />
            </FormField>

            {/* Password */}
            <FormField
              label={t('invite.password')}
              htmlFor="join-password"
              error={passwordTouched || submitted ? passwordErrorMsg : undefined}
            >
              <PasswordInput
                id="join-password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setPasswordTouched(true)}
              />
            </FormField>

            {/* Confirm password */}
            <FormField
              label={t('invite.confirmPassword')}
              htmlFor="join-confirm-password"
              error={confirmPasswordTouched || submitted ? confirmPasswordErrorMsg : undefined}
            >
              <PasswordInput
                id="join-confirm-password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => setConfirmPasswordTouched(true)}
              />
            </FormField>

            {/* Cross-field mismatch compares both passwords, so it isn't a
                 per-field error and stays OUT of FormField's own error slot —
                 it renders here, below both fields. */}
            {confirmPasswordTouched || submitted ? (
              passwordsMismatch && (
                <p className="text-sm text-destructive">{t('invite.passwordMismatch')}</p>
              )
            ) : null}
            {apiError && <p className="text-sm text-destructive">{apiError}</p>}

            <Button
              type="submit"
              className="mt-1"
              disabled={registerMut.isPending || formInvalid}
            >
              {t('invite.join')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
