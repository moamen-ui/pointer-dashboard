// Public self-signup page — shown only when scopedAdminSignupEnabled is true.
// Posts to /api/auth/register-admin; on success shows a "pending approval" message.
// Disabled state → "signup closed" notice.
// v2: Renders a plan selector from the public GET /api/plans endpoint.
//     Honors ?plan=<slug> query param to preselect a plan.
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  useGetApiAuthSignupEnabled,
  usePostApiAuthRegisterAdmin,
  useGetApiPlans,
  type PlanPublicResponse,
  PlanDisplayState,
  BillingInterval,
} from '@moamen-ui/pointer-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { extractMessage } from '@/lib/error';
import { cn } from '@/lib/utils';

// Helper: format plan price for display
function formatPlanPrice(plan: PlanPublicResponse): string {
  if (!plan.priceMonthly) return 'Free';
  const interval = plan.interval === BillingInterval.NUMBER_1 ? '/yr' : '/mo';
  return `${plan.priceMonthly} ${plan.currency ?? 'USD'}${interval}`;
}

// Plan card for the selector
function PlanCard({
  plan,
  selected,
  disabled,
  onClick,
}: {
  plan: PlanPublicResponse;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full flex-col gap-1 rounded-lg border px-3 py-3 text-start transition-colors',
        selected
          ? 'border-brand bg-brand-tint text-brand'
          : 'border-border bg-card text-card-foreground hover:border-brand/50',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-sm">{plan.name}</span>
        <span className="text-xs font-medium">{formatPlanPrice(plan)}</span>
      </div>
      {plan.displayState === PlanDisplayState.NUMBER_1 && (
        <span className="chip chip-neutral text-[10px]">{t('signup.plan.comingSoon')}</span>
      )}
      {plan.featureBullets && plan.featureBullets.length > 0 && (
        <ul className="mt-1 flex flex-col gap-0.5">
          {plan.featureBullets.slice(0, 3).map((b, i) => (
            <li key={i} className="text-xs text-muted-foreground">
              · {b}
            </li>
          ))}
        </ul>
      )}
    </button>
  );
}

export function SignupPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const planSlugFromQuery = searchParams.get('plan');

  // Use the typed enabled field from SignupEnabledResponse.
  const { data: signupData, isLoading: checkingEnabled } =
    useGetApiAuthSignupEnabled();
  const signupEnabled = signupData?.enabled === true;

  // Public plans list — anonymous, ordered by sortOrder.
  // Visible (0) + ComingSoon (1) shown; Hidden (2) excluded.
  const { data: plansRaw } = useGetApiPlans();
  const allPlans: PlanPublicResponse[] =
    (plansRaw as unknown as { data?: PlanPublicResponse[] })?.data ??
    (Array.isArray(plansRaw) ? (plansRaw as PlanPublicResponse[]) : []);

  const selectablePlans = allPlans
    .filter((p) => p.displayState !== PlanDisplayState.NUMBER_2)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  // Honor ?plan=<slug>: preselect that slug if it's Visible when plans load.
  // If no query param, default to null (Free / no plan selected).
  const initialSlug =
    planSlugFromQuery &&
    selectablePlans.some(
      (p) =>
        p.slug === planSlugFromQuery &&
        p.displayState === PlanDisplayState.NUMBER_0,
    )
      ? planSlugFromQuery
      : null;

  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialSlug);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registerMut = usePostApiAuthRegisterAdmin({
    mutation: {
      onSuccess: () => {
        setDone(true);
      },
      onError: (e: unknown) => {
        setError(extractMessage(e));
      },
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setError(null);

    // INTENTIONAL: planId is always sent as null (undefined) here.
    //
    // The public /api/plans endpoint returns PlanPublicResponse which has no `id` field,
    // only `slug`. Resolving a slug to an integer planId would require either:
    //   (a) the admin /api/admin/plans endpoint (requires super-admin auth), or
    //   (b) an id-bearing public endpoint that does not yet exist.
    //
    // The spec decision: treat the plan selector as display-only marketing UI.
    // When payment integration + an id-bearing public endpoint exist, replace
    // `planId: undefined` below with the resolved integer.
    //
    // See monetization-ui-spec.md §4 "Submit selected plan's id?"
    registerMut.mutate({
      data: {
        email: email.trim(),
        password,
        displayName: displayName.trim() || undefined,
        // planId: null — intentionally omitted until payment integration
      },
    });
  }

  if (checkingEnabled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
        <p className="text-sm text-muted-foreground">{t('signup.checking')}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <Card className="w-[440px] max-w-[92vw]">
        <CardContent className="flex flex-col gap-5 p-6">
          <h1 className="text-center text-xl font-bold">{t('signup.title')}</h1>

          {!signupEnabled ? (
            <>
              <p className="text-center text-sm text-muted-foreground">{t('signup.closed')}</p>
              <Link to="/login" className="text-center text-sm text-brand hover:underline">
                {t('signup.backToLogin')}
              </Link>
            </>
          ) : done ? (
            <>
              <p className="text-center text-sm text-muted-foreground">
                {t('signup.pending')}
              </p>
              <Link to="/login" className="text-center text-sm text-brand hover:underline">
                {t('signup.backToLogin')}
              </Link>
            </>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-name">{t('signup.displayName')}</Label>
                <Input
                  id="signup-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-email">{t('signup.email')}</Label>
                <Input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-password">{t('signup.password')}</Label>
                <Input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {/* Plan selector — shown when public plans are available */}
              {selectablePlans.length > 0 && (
                <div className="flex flex-col gap-2">
                  <Label>{t('signup.plan.chooseLabel')}</Label>
                  <div className="flex flex-col gap-2">
                    {selectablePlans.map((plan) => (
                      <PlanCard
                        key={plan.slug}
                        plan={plan}
                        selected={selectedSlug === plan.slug}
                        disabled={plan.displayState === PlanDisplayState.NUMBER_1}
                        onClick={() =>
                          setSelectedSlug(
                            selectedSlug === plan.slug ? null : (plan.slug ?? null),
                          )
                        }
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{t('signup.plan.hint')}</p>
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                type="submit"
                className="mt-1"
                disabled={registerMut.isPending || !email || !password}
              >
                {t('signup.submit')}
              </Button>
              <Link to="/login" className="text-center text-sm text-muted-foreground hover:underline">
                {t('signup.backToLogin')}
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
