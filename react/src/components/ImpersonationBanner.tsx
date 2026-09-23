// ImpersonationBanner — DB-13 §11.2: a persistent shell banner while a super admin is on a "View
// as…" (impersonation) session. Same placement/shape family as DemoPanel (a full-width strip above
// the main content, gutter-scoped), but in the ready/warning hue — this is an operator caution, not
// a neutral status. Ends the session via useAuth().endImpersonation, which best-effort calls
// POST /api/admin/impersonation/end and restores the operator's own token either way.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function ImpersonationBanner() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { impersonation, endImpersonation } = useAuth();
  const [countdown, setCountdown] = useState('');
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    if (!impersonation?.expiresAt) return;
    function tick() {
      setCountdown(formatCountdown(new Date(impersonation!.expiresAt).getTime() - Date.now()));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [impersonation]);

  if (!impersonation) return null;

  const workspaceName = impersonation.workspaceName || t('impersonation.unnamedWorkspace');

  async function onEnd() {
    setEnding(true);
    try {
      await endImpersonation();
    } finally {
      setEnding(false);
      navigate('/tenants', { replace: true });
    }
  }

  return (
    <div className="border-b border-state-ready/30 bg-state-ready-tint px-6 py-2.5">
      <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center gap-x-2 gap-y-1.5">
        <Eye className="h-4 w-4 shrink-0 text-state-ready" aria-hidden="true" />
        <span className="text-[13px] font-medium text-state-ready">
          {t('impersonation.bannerViewing', { workspace: workspaceName })}
        </span>
        <span aria-hidden="true" className="text-state-ready/60">·</span>
        <span className="text-[13px] text-state-ready/85">{t('impersonation.readOnly')}</span>
        {countdown && (
          <>
            <span aria-hidden="true" className="text-state-ready/60">·</span>
            <span className="font-mono text-[13px] text-state-ready" aria-live="polite">
              {t('impersonation.endsIn', { time: countdown })}
            </span>
          </>
        )}
        {impersonation.reason && (
          <>
            <span aria-hidden="true" className="text-state-ready/60">·</span>
            <span
              className="min-w-0 max-w-[360px] truncate text-[13px] text-state-ready/85"
              title={impersonation.reason}
            >
              {impersonation.reason}
            </span>
          </>
        )}
        <div className="ms-auto shrink-0">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={ending}
            onClick={onEnd}
          >
            {t('impersonation.endSession')}
          </Button>
        </div>
      </div>
    </div>
  );
}
