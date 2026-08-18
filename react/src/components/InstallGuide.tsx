// InstallGuide — the Pointer installation steps in one shared dialog (React
// port of the Angular InstallGuideComponent). Opened from the header rocket
// icon (any signed-in user, any time) and automatically for a workspace admin
// who is new here or has no feedback yet — see lib/install-guide.ts for that
// policy. The demo banner's "View installation steps" button opens it too, so
// the steps have one source of truth.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Rocket, Copy } from 'lucide-react';
import { useGetApiAdminProjects, type ProjectResponse } from '@moamen-ui/pointer-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import {
  isSuppressed,
  markShown,
  readDemoSession,
  shouldAutoOpen,
  suppress,
  unsuppress,
  type DemoSession,
} from '@/lib/install-guide';

/** One step in the guide. `code` is optional — instruction-only steps omit it. */
export interface SetupStep {
  titleKey: string;
  hintKey: string;
  code?: string;
}

/** Rendered in the snippet until the user actually has a project to point at. */
export const PROJECT_KEY_PLACEHOLDER = '<your-project-key>';
/** Placeholder inside the credentials snippet. Deliberately not translated — it
 *  is pasted into .pointer/credentials.env, where English reads correctly either way. */
export const PASSWORD_PLACEHOLDER = '<your password>';

/** What the dialog renders: the agent-driven path, plus the hand-wiring fallback. */
export interface GuideSteps {
  /** The recommended path, in order. */
  primary: SetupStep[];
  /** Hand-wiring the widget — only needed if you skip the agent prompt. */
  manual: SetupStep[];
}

/**
 * Builds the install steps. Pure so the branching (demo credentials vs. the
 * signed-in user's own, and the placeholder when there is no project yet) is
 * unit-testable.
 *
 * Shape of the flow: install.sh drops in two skills — pointer-init and
 * pointer-feedback — so wiring the widget is a prompt, not two snippets pasted
 * into index.html. pointer-init detects the host stack (Vite / Angular / Next /
 * CRA / static / Swagger) and wires the loader and env vars the way that stack
 * expects, which the raw snippets cannot do. They stay available as the manual
 * fallback.
 */
export function buildSteps(input: {
  server: string;
  projectKey: string | null;
  userEmail: string | null;
  demo: DemoSession | null;
  credsEmailedText: string;
}): GuideSteps {
  const { server, demo } = input;
  const projectKey = input.projectKey || PROJECT_KEY_PLACEHOLDER;
  const credentials = demo
    ? demo.emailSent
      ? input.credsEmailedText
      : `POINTER_EMAIL=${demo.email ?? ''}\nPOINTER_PASSWORD=${demo.password ?? ''}`
    : `POINTER_EMAIL=${input.userEmail ?? ''}\nPOINTER_PASSWORD=${PASSWORD_PLACEHOLDER}`;

  return {
    primary: [
      // Installs pointer-init + pointer-feedback and scaffolds .pointer/credentials.env.
      { titleKey: 'demo.step3Title', hintKey: 'demo.step3Hint', code: `curl -fsSL ${server}/install.sh | sh` },
      { titleKey: 'demo.step4Title', hintKey: 'demo.step4Hint', code: credentials },
      // Names the skill and supplies its three variables, so the agent wires the
      // widget straight away instead of stopping to ask for them.
      {
        titleKey: 'install.stepAgentTitle',
        hintKey: 'install.stepAgentHint',
        code: `Add the Pointer feedback widget to this app using the pointer-init skill — project key: ${projectKey}, Pointer server URL: ${server}, environment: local`,
      },
      { titleKey: 'demo.step5Title', hintKey: 'demo.step5Hint' },
      // Kept English on purpose — the pointer-feedback skill triggers on this phrasing.
      { titleKey: 'demo.step6Title', hintKey: 'demo.step6Hint', code: 'What are the new Pointer comments?' },
    ],
    manual: [
      { titleKey: 'demo.step1Title', hintKey: 'demo.step1Hint', code: `<script src="${server}/pointer.js" defer></script>` },
      { titleKey: 'demo.step2Title', hintKey: 'demo.step2Hint', code: `<pointer-feedback project="${projectKey}" server="${server}"></pointer-feedback>` },
    ],
  };
}

interface InstallGuideValue {
  open: () => void;
  /** The user's own projects (only ones with a key are pickable). */
  projects: ProjectResponse[];
  /** True once the project list has loaded and no comment exists anywhere. */
  nothingCollectedYet: boolean;
}

const InstallGuideContext = createContext<InstallGuideValue | null>(null);

export function useInstallGuide(): InstallGuideValue {
  const ctx = useContext(InstallGuideContext);
  if (!ctx) throw new Error('useInstallGuide must be used within InstallGuideProvider');
  return ctx;
}

/**
 * Owns the install guide: how it opens, and whether it opens by itself. The
 * project list lives here (rather than in the dialog) so the header (which
 * shows a hint dot while nothing has been collected yet), the dialog's project
 * picker and the auto-open gate share a single fetch.
 */
export function InstallGuideProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth();
  const userId = user?.id ?? null;
  const [open, setOpen] = useState(false);

  // GET /api/admin/projects is plain [Authorize], so every signed-in user —
  // stakeholders included — gets their own list.
  const projectsQuery = useGetApiAdminProjects();
  const projects = useMemo(
    () => (projectsQuery.data ?? []).filter((p) => p.key),
    [projectsQuery.data],
  );

  /** Total comments across visible projects; 0 means nothing has been collected yet. */
  const commentsCount = useMemo(
    () => (projectsQuery.data ?? []).reduce((sum, p) => sum + (p.commentsCount ?? 0), 0),
    [projectsQuery.data],
  );

  const nothingCollectedYet = !projectsQuery.isLoading && commentsCount === 0;

  const openGuide = useCallback(() => {
    // Opening it counts as seen, however it was opened.
    markShown(userId);
    setOpen(true);
  }, [userId]);

  // A workspace admin who is new here — or whose workspace has collected
  // nothing yet — gets the guide opened for them, once. The effect waits for
  // the project list so commentsCount is real rather than a loading 0.
  useEffect(() => {
    if (projectsQuery.isLoading) return;
    if (!userId) return;
    if (shouldAutoOpen({ isAdmin, userId, commentsCount })) openGuide();
  }, [projectsQuery.isLoading, userId, isAdmin, commentsCount, openGuide]);

  const value = useMemo<InstallGuideValue>(
    () => ({ open: openGuide, projects, nothingCollectedYet }),
    [openGuide, projects, nothingCollectedYet],
  );

  return (
    <InstallGuideContext.Provider value={value}>
      {children}
      {open && <InstallGuideDialog projects={projects} onClose={() => setOpen(false)} />}
    </InstallGuideContext.Provider>
  );
}

function InstallGuideDialog({
  projects,
  onClose,
}: {
  projects: ProjectResponse[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const demo = useMemo(() => readDemoSession(), []);
  /** Selected project key; defaults to the demo project, else the first one. */
  const [projectKey, setProjectKey] = useState<string | null>(demo?.projectKey ?? null);
  const [suppressed, setSuppressed] = useState(() => isSuppressed(userId));

  const server = demo?.serverUrl || import.meta.env.VITE_API_BASE;
  const effectiveKey =
    projectKey && projects.some((p) => p.key === projectKey)
      ? projectKey
      : projects[0]?.key ?? null;

  // Recomputed every render, so a language switch re-resolves the emailed-creds
  // notice alongside the translated titles/hints.
  const steps = buildSteps({
    server,
    projectKey: effectiveKey,
    userEmail: user?.email ?? null,
    demo,
    credsEmailedText: t('demo.credsEmailed'),
  });

  function onSuppressedChange(checked: boolean) {
    setSuppressed(checked);
    if (checked) suppress(userId);
    else unsuppress(userId);
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast(t('demo.copied'));
    } catch {
      toast(t('demo.copyFailed'), 'error');
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-brand" />
            {t('install.title')}
          </DialogTitle>
        </DialogHeader>

        <p className="m-0 text-[0.85rem] text-muted-foreground">{t('install.intro')}</p>

        {/* Which project the snippet points at */}
        {projects.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t('install.project')}</span>
            <Select value={effectiveKey ?? undefined} onValueChange={setProjectKey}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id ?? p.key!} value={p.key!}>
                    {p.name} ({p.key})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : !demo ? (
          <p className="m-0 rounded-lg border border-border bg-app/40 p-3 text-[0.85rem]">
            {t('install.noProjects')}{' '}
            <DialogClose asChild>
              <Link to="/projects" className="text-brand underline">
                {t('nav.projects')}
              </Link>
            </DialogClose>
          </p>
        ) : null}

        {/* The recommended path: install the skills, then let the agent wire the widget */}
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {steps.primary.map((st, i) => (
            <li key={st.titleKey} className="rounded-lg border border-border bg-app/40 p-3">
              <div className="text-[0.85rem] font-semibold">
                {i + 1}. {t(st.titleKey)}
              </div>
              <div className="mt-0.5 text-[0.78rem] text-muted-foreground">{t(st.hintKey)}</div>
              {st.code && (
                <div className="mt-2 flex items-start gap-2">
                  <pre className="m-0 flex-1 overflow-x-auto whitespace-pre-wrap rounded bg-app px-2 py-1.5 text-[0.78rem]">
                    <code>{st.code}</code>
                  </pre>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => copy(st.code!)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {t('demo.copy')}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ol>

        {/* Hand-wiring, for anyone not using an agent. Collapsed: the prompt above
             does this per-stack, so these snippets are the fallback, not the path. */}
        <details className="mt-4 rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-[0.85rem] font-semibold">
            {t('install.manualTitle')}
          </summary>
          <p className="mb-2 mt-1 text-[0.78rem] text-muted-foreground">{t('install.manualHint')}</p>
          <div className="flex flex-col gap-3">
            {steps.manual.map((st) => (
              <div key={st.titleKey}>
                <div className="text-[0.8rem] font-medium">{t(st.titleKey)}</div>
                <div className="mt-0.5 text-[0.75rem] text-muted-foreground">{t(st.hintKey)}</div>
                {st.code && (
                  <div className="mt-1.5 flex items-start gap-2">
                    <pre className="m-0 flex-1 overflow-x-auto whitespace-pre-wrap rounded bg-app px-2 py-1.5 text-[0.78rem]">
                      <code>{st.code}</code>
                    </pre>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => copy(st.code!)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {t('demo.copy')}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </details>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand"
              checked={suppressed}
              onChange={(e) => onSuppressedChange(e.target.checked)}
            />
            <span className="text-[0.8rem]">{t('install.dontShowAgain')}</span>
          </label>
          <Button onClick={onClose}>{t('install.done')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
