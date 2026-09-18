import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  Rocket,
  Copy,
  Download,
  Terminal,
  Code2,
  Chrome,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  PartyPopper,
  RefreshCw,
  FolderPlus,
  ExternalLink,
  Laptop,
  Info,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  useGetApiAdminProjects,
  usePostApiAdminProjects,
  getGetApiAdminProjectsQueryKey,
  useGetApiMeApiKey,
  type ProjectResponse,
} from '@moamen-ui/pointer-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/FormField';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
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
import { AppTabs } from '@/components/shared/Tabs';
import { TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { useBranding } from '@/lib/branding';
import { slugifyKey, keyErrorFor } from '@/lib/project-utils';
import {
  isSuppressed,
  markShown,
  readDemoSession,
  shouldAutoOpen,
  suppress,
  unsuppress,
  checkLocalhostWidgetStatus,
  initCommand,
  monorepoInitCommand,
  credentialsSnippet,
  buildExtensionSteps,
  PROJECT_KEY_PLACEHOLDER,
  DOCTOR_COMMAND,
  type WizardStep,
  type InstallMethod,
  type FrameworkStack,
} from '@/lib/install-guide';

export type SetupStep = {
  titleKey: string;
  hintKey: string;
  code?: string;
  download?: boolean;
};

export const PASSWORD_PLACEHOLDER = '<your password>';

type InstallGuideValue = {
  open: () => void;
  projects: ProjectResponse[];
  nothingCollectedYet: boolean;
};

const InstallGuideContext = createContext<InstallGuideValue | null>(null);

export function useInstallGuide(): InstallGuideValue {
  const ctx = useContext(InstallGuideContext);
  if (!ctx) throw new Error('useInstallGuide must be used within InstallGuideProvider');
  return ctx;
}

export function InstallGuideProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const userId = user?.id ?? null;
  const [open, setOpen] = useState(false);

  const projectsQuery = useGetApiAdminProjects();
  const projects = useMemo(
    () => (projectsQuery.data ?? []).filter((p) => p.key),
    [projectsQuery.data],
  );

  const commentsCount = useMemo(
    () => (projectsQuery.data ?? []).reduce((sum, p) => sum + (p.commentsCount ?? 0), 0),
    [projectsQuery.data],
  );

  const nothingCollectedYet = !projectsQuery.isLoading && commentsCount === 0;

  const openGuide = useCallback(() => {
    markShown(userId);
    setOpen(true);
  }, [userId]);

  useEffect(() => {
    if (projectsQuery.isLoading) return;
    if (!userId) return;
    if (shouldAutoOpen({ isAdmin, isSuperAdmin, userId, commentsCount })) openGuide();
  }, [projectsQuery.isLoading, userId, isAdmin, isSuperAdmin, commentsCount, openGuide]);

  const value = useMemo<InstallGuideValue>(
    () => ({ open: openGuide, projects, nothingCollectedYet }),
    [openGuide, projects, nothingCollectedYet],
  );

  return (
    <InstallGuideContext.Provider value={value}>
      {children}
      {open && <InstallGuideWizardDialog projects={projects} onClose={() => setOpen(false)} />}
    </InstallGuideContext.Provider>
  );
}

function InstallGuideWizardDialog({
  projects,
  onClose,
}: {
  projects: ProjectResponse[];
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const userId = user?.id ?? null;
  const { branding } = useBranding();
  const extensionStoreUrl = branding?.extension.storeUrl ?? '';
  const extensionZipUrl = branding?.extension.zipUrl ?? '';

  const demo = useMemo(() => readDemoSession(), []);
  const apiKeyQuery = useGetApiMeApiKey();

  // API key and reveal state
  const [revealKey, setRevealKey] = useState(false);
  const [showCurl, setShowCurl] = useState(false);

  // Wizard Navigation
  const [currentStep, setCurrentStep] = useState<WizardStep>(() => {
    // If user has no projects, start on project setup
    return projects.length === 0 ? 'project' : 'project';
  });

  const [selectedMethod, setSelectedMethod] = useState<InstallMethod>('cli');
  const [selectedStack, setSelectedStack] = useState<FrameworkStack>('html');

  // Project Selection / Inline Creation
  const [projectKey, setProjectKey] = useState<string | null>(demo?.projectKey ?? projects[0]?.key ?? null);
  const [isCreatingInline, setIsCreatingInline] = useState(projects.length === 0);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectKey, setNewProjectKey] = useState('');
  const [keyEdited, setKeyEdited] = useState(false);

  // Localhost Verification State
  const [checkStatus, setCheckStatus] = useState<'idle' | 'checking' | 'active' | 'inactive'>('idle');
  const [suppressed, setSuppressed] = useState(() => isSuppressed(userId));

  const server = demo?.serverUrl || import.meta.env.VITE_API_BASE;
  const effectiveKey = projectKey ?? projects[0]?.key ?? PROJECT_KEY_PLACEHOLDER;

  const createProjectMut = usePostApiAdminProjects({
    mutation: {
      onSuccess: (created) => {
        queryClient.invalidateQueries({ queryKey: getGetApiAdminProjectsQueryKey() });
        const key = created.key ?? newProjectKey.trim();
        setProjectKey(key);
        setIsCreatingInline(false);
        setCurrentStep('method');
        toast(t('projects.saved'));
      },
      onError: () => {
        toast(t('common.error'), 'error');
      },
    },
  });

  const keyError = useMemo(
    () => keyErrorFor(newProjectKey, projects.map((p) => p.key)),
    [newProjectKey, projects],
  );

  const canCreate = !keyError && Boolean(newProjectName.trim());

  function handleCreateInline() {
    if (!canCreate) return;
    createProjectMut.mutate({
      data: {
        name: newProjectName.trim(),
        key: newProjectKey.trim(),
      },
    });
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast(t('demo.copied'));
    } catch {
      toast(t('demo.copyFailed'), 'error');
    }
  }

  function onSuppressedChange(checked: boolean) {
    setSuppressed(checked);
    if (checked) suppress(userId);
    else unsuppress(userId);
  }

  async function handleVerifyLocalhost() {
    if (!projectKey) return;
    setCheckStatus('checking');
    const isActive = await checkLocalhostWidgetStatus(server, projectKey);
    setCheckStatus(isActive ? 'active' : 'inactive');
  }

  // Snippet Builders
  const apiKey = apiKeyQuery.data?.apiKey ?? null;
  const initCmd = initCommand({
    server,
    apiKey,
    projectKey: projectKey !== PROJECT_KEY_PLACEHOLDER ? projectKey : null,
  });

  // Mask the API key in displayed commands (full key only in DOM when revealed)
  const maskKey = useCallback(
    (cmd: string) => (!apiKey || revealKey ? cmd : cmd.replace(apiKey, 'ptr_••••••••')),
    [apiKey, revealKey],
  );
  const maskedInitCmd = maskKey(initCmd);

  const monorepoCmd = monorepoInitCommand({
    server,
    apiKey,
    projectKey: projectKey !== PROJECT_KEY_PLACEHOLDER ? projectKey : null,
  });
  const maskedMonorepoCmd = maskKey(monorepoCmd);

  // `--delivery extension` records — for `pointer list`/`pointer apply` in this repo —
  // that reviewers use the Chrome extension rather than the injected widget.
  const extDeliveryCmd = `${initCmd} --delivery extension`;
  const maskedExtDeliveryCmd = maskKey(extDeliveryCmd);

  const initHintKey = apiKey ? 'install.stepInitHint' : 'install.stepInitHintNoKey';
  const creds = credentialsSnippet({
    apiKey,
    demo,
    credsEmailedText: t('demo.credsEmailed'),
  });

  const stackSnippets: Record<FrameworkStack, string> = {
    html: `<!-- Add before </body> or inside <head> -->\n<script src="${server}/widget.js" defer></script>\n<pointer-feedback project="${effectiveKey}" server="${server}"></pointer-feedback>`,
    react: `// In Next.js (app/layout.tsx):\nimport Script from 'next/script';\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang="en">\n      <body>\n        {children}\n        <Script src="${server}/widget.js" strategy="afterInteractive" />\n        <pointer-feedback project="${effectiveKey}" server="${server}" />\n      </body>\n    </html>\n  );\n}`,
    vue: `<!-- In Nuxt (app.vue) or Vue App -->\n<template>\n  <div>\n    <NuxtPage />\n    <pointer-feedback project="${effectiveKey}" server="${server}"></pointer-feedback>\n  </div>\n</template>\n\n<script setup>\nuseHead({\n  script: [{ src: '${server}/widget.js', defer: true }]\n});\n</script>`,
    angular: `<!-- In src/index.html -->\n<script src="${server}/widget.js" defer></script>\n<pointer-feedback project="${effectiveKey}" server="${server}"></pointer-feedback>`,
  };

  const stepsList = [
    { id: 'project' as const, label: t('install.wizard.stepProject') },
    { id: 'method' as const, label: t('install.wizard.stepMethod') },
    { id: 'install' as const, label: t('install.wizard.stepInstall') },
    { id: 'verify' as const, label: t('install.wizard.stepVerify') },
  ];

  const currentStepIdx = stepsList.findIndex((s) => s.id === currentStep);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto p-0">
        {/* Header */}
        <DialogHeader className="border-b border-border px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Rocket className="h-5 w-5 text-brand" />
            {t('install.title')}
          </DialogTitle>
        </DialogHeader>

        {/* Underline tabs stepper */}
        <div className="flex h-9 gap-4 overflow-x-auto border-b border-border px-5">
          {stepsList.map((stepItem, idx) => {
            const isCurrent = idx === currentStepIdx;
            return (
              <button
                key={stepItem.id}
                type="button"
                onClick={() => {
                  if (idx <= currentStepIdx || (stepItem.id === 'method' && projectKey)) {
                    setCurrentStep(stepItem.id);
                  }
                }}
                className={`whitespace-nowrap text-[14px] pb-2 border-b-2 border-transparent -mb-px transition-colors ${
                  isCurrent
                    ? 'text-foreground border-brand font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {stepItem.label}
              </button>
            );
          })}
        </div>

        {/* ========================================================================= */}
        {/* STEP 1: PROJECT SELECTION & INLINE CREATION                                */}
        {/* ========================================================================= */}
        {currentStep === 'project' && (
          <div className="flex min-w-0 flex-col gap-4 px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold">{t('install.wizard.createProjectTitle')}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('install.wizard.createProjectDesc')}
              </p>
            </div>

            {/* If projects exist and not creating inline */}
            {projects.length > 0 && !isCreatingInline ? (
              <div className="rounded-md border border-border bg-card p-4">
                <label className="text-xs font-medium text-foreground">
                  {t('install.wizard.selectProjectPrompt')}
                </label>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <Select
                      value={projectKey ?? undefined}
                      onValueChange={(val) => setProjectKey(val)}
                    >
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
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsCreatingInline(true)}
                      className="gap-1.5 shrink-0"
                    >
                      <FolderPlus className="h-4 w-4" />
                      {t('install.wizard.createNewProject')}
                    </Button>
                  )}
                </div>

                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={() => setCurrentStep('method')}
                    disabled={!projectKey}
                    className="gap-1.5"
                  >
                    <span>{t('install.wizard.next')}</span>
                    {isRtl ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ) : (
              /* Inline Project Creation Form */
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-col gap-3">
                  <FormField
                    label={t('install.wizard.projectName')}
                    htmlFor="wiz-project-name"
                    error={undefined}
                  >
                    <Input
                      id="wiz-project-name"
                      value={newProjectName}
                      onChange={(e) => {
                        setNewProjectName(e.target.value);
                        if (!keyEdited) setNewProjectKey(slugifyKey(e.target.value));
                      }}
                      placeholder={t('install.wizard.projectNamePlaceholder')}
                      autoFocus
                    />
                  </FormField>

                  <FormField
                    label={t('install.wizard.projectKey')}
                    htmlFor="wiz-project-key"
                    error={keyError || undefined}
                    hint={!keyError ? t('install.wizard.projectKeyHint') : undefined}
                  >
                    <Input
                      id="wiz-project-key"
                      value={newProjectKey}
                      onChange={(e) => {
                        setKeyEdited(true);
                        setNewProjectKey(e.target.value.toLowerCase().trim());
                      }}
                      className="font-mono text-xs"
                    />
                  </FormField>

                  <div className="mt-2 flex items-center justify-between pt-2">
                    {projects.length > 0 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsCreatingInline(false)}
                      >
                        {t('install.wizard.back')}
                      </Button>
                    ) : (
                      <span />
                    )}

                    <Button
                      onClick={handleCreateInline}
                      disabled={!canCreate || createProjectMut.isPending}
                      className="gap-1.5"
                    >
                      <span>{t('install.wizard.createAndContinue')}</span>
                      {isRtl ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: CHOOSE INTEGRATION METHOD                                         */}
        {/* ========================================================================= */}
        {currentStep === 'method' && (
          <div className="flex min-w-0 flex-col gap-4 px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold">{t('install.wizard.methodTitle')}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('install.wizard.methodDesc')}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Option 1: CLI (recommended) */}
              <button
                type="button"
                onClick={() => {
                  setSelectedMethod('cli');
                  setCurrentStep('install');
                }}
                className={`relative flex flex-col items-start gap-2 rounded-xl border p-4 text-start transition-all hover:border-brand ${
                  selectedMethod === 'cli' ? 'border-brand bg-brand/5 ring-1 ring-brand' : 'border-border bg-card'
                }`}
              >
                <Badge variant="default" className="absolute top-2.5 end-2.5 text-[0.65rem]">
                  {t('install.wizard.methodCliBadge')}
                </Badge>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <Terminal className="h-5 w-5" />
                </div>
                <div className="font-semibold text-sm">{t('install.wizard.methodCliTitle')}</div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  {t('install.wizard.methodCliDesc')}
                </div>
              </button>

              {/* Option 2: Chrome Extension */}
              <button
                type="button"
                onClick={() => {
                  setSelectedMethod('extension');
                  setCurrentStep('install');
                }}
                className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-start transition-all hover:border-brand ${
                  selectedMethod === 'extension' ? 'border-brand bg-brand/5 ring-1 ring-brand' : 'border-border bg-card'
                }`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-state-ready-tint text-state-ready">
                  <Chrome className="h-5 w-5" />
                </div>
                <div className="font-semibold text-sm">{t('install.wizard.methodExtTitle')}</div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  {t('install.wizard.methodExtDesc')}
                </div>
              </button>

              {/* Option 3: Manual snippet (advanced) */}
              <button
                type="button"
                onClick={() => {
                  setSelectedMethod('snippet');
                  setCurrentStep('install');
                }}
                className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-start transition-all hover:border-brand ${
                  selectedMethod === 'snippet' ? 'border-brand bg-brand/5 ring-1 ring-brand' : 'border-border bg-card'
                }`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                  <Code2 className="h-5 w-5" />
                </div>
                <div className="font-semibold text-sm">{t('install.wizard.methodSnippetTitle')}</div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  {t('install.wizard.methodSnippetDesc')}
                </div>
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setCurrentStep('project')}>
                {t('install.wizard.back')}
              </Button>
              <Button onClick={() => setCurrentStep('install')} className="gap-1.5">
                <span>{t('install.wizard.next')}</span>
                {isRtl ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: ADD CODE TO LOCAL PROJECT                                         */}
        {/* ========================================================================= */}
        {currentStep === 'install' && (
          <div className="flex min-w-0 flex-col gap-4 px-5 py-4">
            {/* 3A: CLI (recommended) */}
            {selectedMethod === 'cli' && (
              <div className="flex flex-col gap-4">
                {/* 1. Init command (primary) */}
                <div className="space-y-2">
                  <div className="text-[13px] font-medium text-foreground">
                    {t('install.stepInitTitle')}
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    {t(initHintKey)}
                  </div>
                  {/* The scroll lives on an inner element so the buttons, positioned against the
                       outer box, stay put while a long command scrolls beneath them. */}
                  <div className="relative rounded-md border border-border bg-gutter font-mono text-[13px]">
                    <div className="p-3 pe-24 overflow-x-auto">
                      <pre className="m-0">
                        <code>{maskedInitCmd}</code>
                      </pre>
                    </div>

                    <div className="absolute top-3 end-3 flex gap-1 bg-gutter rounded-md">
                      {apiKey && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRevealKey(!revealKey)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {revealKey ? (
                            <>
                              <EyeOff className="h-3.5 w-3.5" />
                              {t('install.wizard.hide')}
                            </>
                          ) : (
                            <>
                              <Eye className="h-3.5 w-3.5" />
                              {t('install.wizard.reveal')}
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copy(initCmd)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    {t('install.wizard.cliDeliveryNote')}
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    {t('install.wizard.cliJoinNote')}
                  </div>
                </div>

                {/* Collapsible curl fallback */}
                <div className="border-t border-border pt-3">
                  <button
                    type="button"
                    className="text-[12px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                    onClick={() => setShowCurl(!showCurl)}
                  >
                    {showCurl ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                    {t('install.stepCurlTitle')}
                  </button>

                  {showCurl && (
                    <div className="mt-2 space-y-2">
                      <div className="text-[12px] text-muted-foreground">
                        {t('install.stepCurlHint')}
                      </div>
                      <div className="relative rounded-md border border-border bg-gutter font-mono text-[13px] p-3 pe-12 overflow-x-auto">
                        <pre className="m-0">
                          <code>{`curl -fsSL ${server}/install.sh | sh`}</code>
                        </pre>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copy(`curl -fsSL ${server}/install.sh | sh`)}
                          className="absolute top-3 end-3"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Monorepo callout */}
                <div className="rounded-md border border-border bg-background p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-[12px] font-medium text-foreground">
                    <Info className="h-3.5 w-3.5 text-brand" />
                    {t('install.stepMonorepoTitle')}
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    {t('install.stepMonorepoHint')}
                  </div>
                  <div className="relative rounded-md border border-border bg-gutter font-mono text-[13px]">
                    <div className="p-3 pe-12 overflow-x-auto">
                      <pre className="m-0">
                        <code>{maskedMonorepoCmd}</code>
                      </pre>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copy(monorepoCmd)}
                      className="absolute top-3 end-3 bg-gutter rounded-md"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Credentials block */}
                <div className="space-y-2">
                  <div className="text-[13px] font-medium text-foreground">
                    {t('install.wizard.credsTitle')}
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    {t('install.wizard.credsHint')}
                  </div>
                  <div className="relative rounded-md border border-border bg-gutter font-mono text-[13px] p-3 pe-12 overflow-x-auto">
                    <pre className="m-0">
                      <code>{creds}</code>
                    </pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copy(creds)}
                      className="absolute top-3 end-3"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* 3B: Framework Code Snippets */}
            {selectedMethod === 'snippet' && (
              <div className="flex flex-col gap-3">
                <div className="text-xs text-muted-foreground">
                  {t('install.wizard.snippetInstructions')}
                </div>

                <AppTabs
                  tabs={[
                    { value: 'html', label: t('install.wizard.stackHtml') },
                    { value: 'react', label: t('install.wizard.stackReact') },
                    { value: 'vue', label: t('install.wizard.stackVue') },
                    { value: 'angular', label: t('install.wizard.stackAngular') },
                  ]}
                  value={selectedStack}
                  onValueChange={(val) => setSelectedStack(val as FrameworkStack)}
                >
                  {(['html', 'react', 'vue', 'angular'] as const).map((stack) => (
                    <TabsContent key={stack} value={stack}>
                      <div className="relative mt-2 rounded-md border border-border bg-gutter p-3 pe-12 overflow-x-auto">
                        <pre className="m-0 font-mono text-[13px] whitespace-pre-wrap">
                          <code>{stackSnippets[stack]}</code>
                        </pre>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copy(stackSnippets[stack])}
                          className="absolute top-3 end-3"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </TabsContent>
                  ))}
                </AppTabs>
              </div>
            )}

            {/* 3C: Chrome Extension Path */}
            {selectedMethod === 'extension' && (
              <ol className="m-0 flex list-none flex-col gap-3 p-0">
                {buildExtensionSteps({
                  server,
                  apiKey,
                  demo,
                  credsEmailedText: t('demo.credsEmailed'),
                  storeUrl: extensionStoreUrl,
                  zipUrl: extensionZipUrl,
                  isSuperAdmin,
                }).map((step, i) => (
                  <li key={step.titleKey} className="rounded-md border border-border bg-background p-4 space-y-2">
                    <div className="text-[13px] font-medium text-foreground">
                      {i + 1}. {t(step.titleKey)}
                    </div>
                    <div className="text-[12px] text-muted-foreground">{t(step.hintKey)}</div>
                    {step.noteKey && (
                      <div className="text-[12px] text-muted-foreground italic">{t(step.noteKey)}</div>
                    )}
                    {step.linkUrl && (
                      <Button asChild size="sm" className="inline-flex mt-2">
                        <a href={step.linkUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                          {t('install.extStoreLink')}
                        </a>
                      </Button>
                    )}
                    {step.downloadUrl && (
                      <Button asChild size="sm" className="inline-flex mt-2">
                        <a href={step.downloadUrl} download>
                          <Download className="h-4 w-4" />
                          {t('install.extDownload')}
                        </a>
                      </Button>
                    )}
                    {step.code && (
                      <div className="relative rounded-md border border-border bg-gutter font-mono text-[13px] p-3 overflow-x-auto whitespace-pre-wrap mt-2">
                        <pre className="m-0">
                          <code>{step.code}</code>
                        </pre>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copy(step.code!)}
                          className="absolute top-3 end-3"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}

            {/* 3C-note: record the extension choice for this repo's CLI */}
            {selectedMethod === 'extension' && (
              <div className="rounded-md border border-border bg-background p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-foreground">
                  <Info className="h-3.5 w-3.5 text-brand" />
                  {t('install.wizard.extRecordDeliveryTitle')}
                </div>
                <div className="text-[12px] text-muted-foreground">
                  {t('install.wizard.extRecordDeliveryHint')}
                </div>
                <div className="relative rounded-md border border-border bg-gutter font-mono text-[13px]">
                  <div className="p-3 pe-12 overflow-x-auto">
                    <pre className="m-0">
                      <code>{maskedExtDeliveryCmd}</code>
                    </pre>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copy(extDeliveryCmd)}
                    className="absolute top-3 end-3 bg-gutter rounded-md"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setCurrentStep('method')}>
                {t('install.wizard.back')}
              </Button>
              <Button onClick={() => setCurrentStep('verify')} className="gap-1.5">
                <span>{t('install.wizard.next')}</span>
                {isRtl ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 4: LAUNCH & SEE IT LIVE!                                             */}
        {/* ========================================================================= */}
        {currentStep === 'verify' && (
          <div className="flex min-w-0 flex-col gap-4 px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold">{t('install.wizard.step4Title')}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('install.wizard.step4Hint')}
              </p>
            </div>

            {/* Checklist items — what to expect differs by method; the extension has no
                 dev-server/code-injection step, it activates from the toolbar instead. */}
            <div className="flex flex-col gap-2.5">
              {selectedMethod === 'extension' ? (
                <>
                  <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
                    <Chrome className="mt-0.5 h-4 w-4 text-brand shrink-0" />
                    <div className="text-xs">
                      <div className="font-semibold">{t('install.wizard.verifyExtInstallTitle')}</div>
                      <div className="text-muted-foreground">{t('install.wizard.verifyExtInstallHint')}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
                    <ExternalLink className="mt-0.5 h-4 w-4 text-brand shrink-0" />
                    <div className="text-xs">
                      <div className="font-semibold">{t('install.wizard.verifyExtOpenTitle')}</div>
                      <div className="text-muted-foreground">{t('install.wizard.verifyExtOpenHint')}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
                    <Rocket className="mt-0.5 h-4 w-4 text-brand shrink-0" />
                    <div className="text-xs">
                      <div className="font-semibold">{t('install.wizard.verifyExtActivateTitle')}</div>
                      <div className="text-muted-foreground">{t('install.wizard.verifyExtActivateHint')}</div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
                    <Laptop className="mt-0.5 h-4 w-4 text-brand shrink-0" />
                    <div className="text-xs">
                      <div className="font-semibold">{t('install.wizard.runDevTitle')}</div>
                      <div className="text-muted-foreground">{t('install.wizard.runDevHint')}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
                    <ExternalLink className="mt-0.5 h-4 w-4 text-brand shrink-0" />
                    <div className="text-xs">
                      <div className="font-semibold">{t('install.wizard.openLocalTitle')}</div>
                      <div className="text-muted-foreground">{t('install.wizard.openLocalHint')}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
                    <Rocket className="mt-0.5 h-4 w-4 text-brand shrink-0" />
                    <div className="text-xs">
                      <div className="font-semibold">{t('install.wizard.spotWidgetTitle')}</div>
                      <div className="text-muted-foreground">{t('install.wizard.spotWidgetHint')}</div>
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-brand shrink-0" />
                <div className="text-xs">
                  <div className="font-semibold">{t('install.wizard.dropCommentTitle')}</div>
                  <div className="text-muted-foreground">{t('install.wizard.dropCommentHint')}</div>
                </div>
              </div>
            </div>

            {/* Universal check: works no matter which method was used */}
            <div className="rounded-md border border-border bg-background p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-foreground">
                <Info className="h-3.5 w-3.5 text-brand" />
                {t('install.wizard.verifyDoctorTitle')}
              </div>
              <div className="text-[12px] text-muted-foreground">
                {t('install.wizard.verifyDoctorHint')}
              </div>
              <div className="relative rounded-md border border-border bg-gutter font-mono text-[13px] p-3 pe-12 overflow-x-auto">
                <pre className="m-0">
                  <code>{DOCTOR_COMMAND}</code>
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copy(DOCTOR_COMMAND)}
                  className="absolute top-3 end-3"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Localhost Connection Checker */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs">
                  <div className="font-semibold">{t('install.wizard.checkConnection')}</div>
                  <div className="text-muted-foreground">
                    Project: <span className="font-mono text-foreground">{effectiveKey}</span> (http://localhost:3000)
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleVerifyLocalhost}
                  disabled={checkStatus === 'checking'}
                  className="gap-1.5 shrink-0"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${checkStatus === 'checking' ? 'animate-spin' : ''}`} />
                  {checkStatus === 'checking' ? t('install.wizard.checking') : t('install.wizard.checkConnection')}
                </Button>
              </div>

              {checkStatus === 'active' && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 p-2 text-xs text-emerald-600 font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  {t('install.wizard.connectionActive')}
                </div>
              )}

              {checkStatus === 'inactive' && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-state-ready-tint p-2 text-xs text-state-ready font-medium">
                  <AlertCircle className="h-4 w-4" />
                  {t('install.wizard.connectionInactive')}
                </div>
              )}
            </div>

            {/* Celebration Card (if comments already arrived) */}
            {projects.some((p) => (p.commentsCount ?? 0) > 0) && (
              <div className="flex flex-col gap-3 rounded-md border border-brand/50 bg-brand-tint p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <PartyPopper className="h-6 w-6 shrink-0 text-brand" />
                  <div>
                    <div className="text-sm font-bold text-foreground">
                      {t('install.wizard.celebrationTitle')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t('install.wizard.celebrationDesc')}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="shrink-0 self-start sm:self-auto"
                  onClick={() => {
                    onClose();
                    navigate('/projects');
                  }}
                >
                  {t('install.wizard.viewComments')}
                </Button>
              </div>
            )}

            {/* Footer with checkbox and button */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand"
                  checked={suppressed}
                  onChange={(e) => onSuppressedChange(e.target.checked)}
                />
                <span className="text-[14px] text-muted-foreground">{t('install.dontShowAgain')}</span>
              </label>

              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setCurrentStep('install')}>
                  {t('install.wizard.back')}
                </Button>
                <Button size="sm" onClick={onClose}>{t('install.wizard.finish')}</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
