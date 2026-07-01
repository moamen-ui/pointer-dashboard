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
import { Label } from '@/components/ui/label';
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
  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const registerMut = usePostApiAuthRegisterInvite();

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
    setValidationError(null);
    setApiError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setValidationError(t('invite.passwordMismatch'));
      return;
    }
    if (password !== confirmPassword) {
      setValidationError(t('invite.passwordMismatch'));
      return;
    }

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

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {/* Email */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="join-email">{t('login.email')}</Label>
              <Input
                id="join-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            {/* Display name */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="join-display-name">{t('invite.displayName')}</Label>
              <Input
                id="join-display-name"
                type="text"
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="join-password">{t('invite.password')}</Label>
              <Input
                id="join-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setValidationError(null);
                }}
                required
              />
            </div>

            {/* Confirm password */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="join-confirm-password">{t('invite.confirmPassword')}</Label>
              <Input
                id="join-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setValidationError(null);
                }}
                required
              />
            </div>

            {validationError && (
              <p className="text-sm text-destructive">{validationError}</p>
            )}
            {apiError && <p className="text-sm text-destructive">{apiError}</p>}

            <Button
              type="submit"
              className="mt-1"
              disabled={
                registerMut.isPending ||
                !email.trim() ||
                !password ||
                !confirmPassword ||
                !displayName.trim()
              }
            >
              {t('invite.join')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
