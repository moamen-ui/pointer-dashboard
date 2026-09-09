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
  Bot,
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
} from 'lucide-react';
import {
  useGetApiAdminProjects,
  usePostApiAdminProjects,
  getGetApiAdminProjectsQueryKey,
  type ProjectResponse,
} from '@moamen-ui/pointer-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { slugifyKey, keyErrorFor } from '@/lib/project-utils';
import {
  EXTENSION_ZIP_URL,
  isSuppressed,
  markShown,
  readDemoSession,
  shouldAutoOpen,
  suppress,
  unsuppress,
  checkLocalhostWidgetStatus,
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

export const PROJECT_KEY_PLACEHOLDER = '<your-project-key>';
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
  const { user, isAdmin } = useAuth();
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
    if (shouldAutoOpen({ isAdmin, userId, commentsCount })) openGuide();
  }, [projectsQuery.isLoading, userId, isAdmin, commentsCount, openGuide]);

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
  const { user, isAdmin } = useAuth();
  const userId = user?.id ?? null;

  const demo = useMemo(() => readDemoSession(), []);

  // Wizard Navigation
  const [currentStep, setCurrentStep] = useState<WizardStep>(() => {
    // If user has no projects, start on project setup
    return projects.length === 0 ? 'project' : 'project';
  });

  const [selectedMethod, setSelectedMethod] = useState<InstallMethod>('agent');
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
  const agentPrompt = `Add the Pointer feedback widget to this app using the pointer-init skill — project key: ${effectiveKey}, Pointer server URL: ${server}, environment: local`;
  const credentialsSnippet = demo
    ? demo.emailSent
      ? t('demo.credsEmailed')
      : `POINTER_EMAIL=${demo.email ?? ''}\nPOINTER_PASSWORD=${demo.password ?? ''}`
    : `POINTER_EMAIL=${user?.email ?? ''}\nPOINTER_PASSWORD=${PASSWORD_PLACEHOLDER}`;

  const stackSnippets: Record<FrameworkStack, string> = {
    html: `<!-- Add before </body> or inside <head> -->\n<script src="${server}/pointer.js" defer></script>\n<pointer-feedback project="${effectiveKey}" server="${server}"></pointer-feedback>`,
    react: `// In Next.js (app/layout.tsx):\nimport Script from 'next/script';\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang="en">\n      <body>\n        {children}\n        <Script src="${server}/pointer.js" strategy="afterInteractive" />\n        <pointer-feedback project="${effectiveKey}" server="${server}" />\n      </body>\n    </html>\n  );\n}`,
    vue: `<!-- In Nuxt (app.vue) or Vue App -->\n<template>\n  <div>\n    <NuxtPage />\n    <pointer-feedback project="${effectiveKey}" server="${server}"></pointer-feedback>\n  </div>\n</template>\n\n<script setup>\nuseHead({\n  script: [{ src: '${server}/pointer.js', defer: true }]\n});\n</script>`,
    angular: `<!-- In src/index.html -->\n<script src="${server}/pointer.js" defer></script>\n<pointer-feedback project="${effectiveKey}" server="${server}"></pointer-feedback>`,
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
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto p-6">
        {/* Header with Rocket Icon */}
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Rocket className="h-5 w-5 text-brand" />
              {t('install.title')}
            </DialogTitle>
            <Badge variant="neutral" className="text-xs">
              {stepsList[currentStepIdx]?.label}
            </Badge>
          </div>
        </DialogHeader>

        {/* Stepper Progress Indicator */}
        <div className="my-3 grid grid-cols-4 gap-2 border-b border-border/60 pb-3">
          {stepsList.map((stepItem, idx) => {
            const isDone = idx < currentStepIdx;
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
                className={`flex flex-col items-start gap-1 rounded-md p-1.5 text-start transition-colors ${
                  isCurrent
                    ? 'bg-brand/10 font-semibold text-brand'
                    : isDone
                      ? 'text-foreground hover:bg-muted'
                      : 'text-muted-foreground/60'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs">
                  {isDone ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-brand" />
                  ) : (
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                        isCurrent ? 'bg-brand text-white' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {idx + 1}
                    </span>
                  )}
                  <span className="truncate">{stepItem.label.split('. ')[1] ?? stepItem.label}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* ========================================================================= */}
        {/* STEP 1: PROJECT SELECTION & INLINE CREATION                                */}
        {/* ========================================================================= */}
        {currentStep === 'project' && (
          <div className="flex flex-col gap-4 py-2">
            <div>
              <h3 className="text-sm font-semibold">{t('install.wizard.createProjectTitle')}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('install.wizard.createProjectDesc')}
              </p>
            </div>

            {/* If projects exist and not creating inline */}
            {projects.length > 0 && !isCreatingInline ? (
              <div className="rounded-xl border border-border bg-card p-4">
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
                  <div>
                    <Label htmlFor="wiz-project-name" className="text-xs">
                      {t('install.wizard.projectName')}
                    </Label>
                    <Input
                      id="wiz-project-name"
                      value={newProjectName}
                      onChange={(e) => {
                        setNewProjectName(e.target.value);
                        if (!keyEdited) setNewProjectKey(slugifyKey(e.target.value));
                      }}
                      placeholder={t('install.wizard.projectNamePlaceholder')}
                      className="mt-1"
                      autoFocus
                    />
                  </div>

                  <div>
                    <Label htmlFor="wiz-project-key" className="text-xs">
                      {t('install.wizard.projectKey')}
                    </Label>
                    <Input
                      id="wiz-project-key"
                      value={newProjectKey}
                      onChange={(e) => {
                        setKeyEdited(true);
                        setNewProjectKey(e.target.value.toLowerCase().trim());
                      }}
                      className="mt-1 font-mono text-xs"
                    />
                    <p className="mt-1 text-[0.7rem] text-muted-foreground">
                      {t('install.wizard.projectKeyHint')}
                    </p>
                  </div>

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
          <div className="flex flex-col gap-4 py-2">
            <div>
              <h3 className="text-sm font-semibold">{t('install.wizard.methodTitle')}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('install.wizard.methodDesc')}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Option 1: AI Agent */}
              <button
                type="button"
                onClick={() => {
                  setSelectedMethod('agent');
                  setCurrentStep('install');
                }}
                className={`relative flex flex-col items-start gap-2 rounded-xl border p-4 text-start transition-all hover:border-brand ${
                  selectedMethod === 'agent' ? 'border-brand bg-brand/5 ring-1 ring-brand' : 'border-border bg-card'
                }`}
              >
                <Badge variant="default" className="absolute top-2.5 end-2.5 text-[0.65rem]">
                  {t('install.wizard.methodAgentBadge')}
                </Badge>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="font-semibold text-sm">{t('install.wizard.methodAgentTitle')}</div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  {t('install.wizard.methodAgentDesc')}
                </div>
              </button>

              {/* Option 2: Code Snippet */}
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

              {/* Option 3: Chrome Extension */}
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
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                  <Chrome className="h-5 w-5" />
                </div>
                <div className="font-semibold text-sm">{t('install.wizard.methodExtTitle')}</div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  {t('install.wizard.methodExtDesc')}
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
          <div className="flex flex-col gap-4 py-2">
            {/* 3A: AI Coding Agent Path */}
            {selectedMethod === 'agent' && (
              <div className="flex flex-col gap-3">
                {/* Skill install */}
                <div className="rounded-lg border border-border bg-card p-3.5">
                  <div className="text-xs font-semibold text-foreground">
                    {t('install.wizard.curlTitle')}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {t('install.wizard.curlHint')}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <pre className="m-0 flex-1 overflow-x-auto rounded bg-app px-2.5 py-2 text-xs font-mono">
                      <code>{`curl -fsSL ${server}/install.sh | sh`}</code>
                    </pre>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copy(`curl -fsSL ${server}/install.sh | sh`)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {t('demo.copy')}
                    </Button>
                  </div>
                </div>

                {/* Credentials */}
                <div className="rounded-lg border border-border bg-card p-3.5">
                  <div className="text-xs font-semibold text-foreground">
                    {t('install.wizard.credsTitle')}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {t('install.wizard.credsHint')}
                  </div>
                  <div className="mt-2 flex items-start gap-2">
                    <pre className="m-0 flex-1 overflow-x-auto rounded bg-app px-2.5 py-2 text-xs font-mono">
                      <code>{credentialsSnippet}</code>
                    </pre>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copy(credentialsSnippet)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {t('demo.copy')}
                    </Button>
                  </div>
                </div>

                {/* AI Agent Prompt */}
                <div className="rounded-lg border border-brand/40 bg-brand/5 p-3.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-brand">
                    <Bot className="h-4 w-4" />
                    {t('install.wizard.agentPromptTitle')}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {t('install.wizard.agentPromptHint')}
                  </div>
                  <div className="mt-2 flex items-start gap-2">
                    <pre className="m-0 flex-1 overflow-x-auto whitespace-pre-wrap rounded bg-card px-2.5 py-2 text-xs font-mono text-foreground">
                      <code>{agentPrompt}</code>
                    </pre>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => copy(agentPrompt)}
                      className="shrink-0"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {t('demo.copy')}
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
                      <div className="mt-2 flex items-start gap-2 rounded-lg border border-border bg-card p-3">
                        <pre className="m-0 flex-1 overflow-x-auto whitespace-pre-wrap rounded bg-app px-2.5 py-2 text-xs font-mono text-foreground">
                          <code>{stackSnippets[stack]}</code>
                        </pre>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copy(stackSnippets[stack])}
                          className="shrink-0"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          {t('demo.copy')}
                        </Button>
                      </div>
                    </TabsContent>
                  ))}
                </AppTabs>
              </div>
            )}

            {/* 3C: Chrome Extension Path */}
            {selectedMethod === 'extension' && (
              <div className="flex flex-col gap-3">
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">{t('install.extDownloadTitle')}</div>
                      <div className="text-xs text-muted-foreground">{t('install.extDownloadHint')}</div>
                    </div>
                    <Button asChild size="sm">
                      <a href={EXTENSION_ZIP_URL} download>
                        <Download className="h-3.5 w-3.5" />
                        {t('install.extDownloadButton')}
                      </a>
                    </Button>
                  </div>

                  <ol className="mt-4 flex list-none flex-col gap-3 p-0 text-xs">
                    <li className="rounded bg-app/50 p-2.5">
                      <span className="font-semibold">1. {t('install.extUnzipTitle')}</span>: {t('install.extUnzipHint')}
                    </li>
                    <li className="rounded bg-app/50 p-2.5">
                      <span className="font-semibold">2. {t('install.extLoadTitle')}</span>: {t('install.extLoadHint')}
                    </li>
                    <li className="rounded bg-app/50 p-2.5">
                      <span className="font-semibold">3. {t('install.extSignInTitle')}</span>: {t('install.extSignInHint')}
                    </li>
                  </ol>
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
          <div className="flex flex-col gap-4 py-2">
            <div>
              <h3 className="text-sm font-semibold">{t('install.wizard.step4Title')}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('install.wizard.step4Hint')}
              </p>
            </div>

            {/* Checklist items */}
            <div className="flex flex-col gap-2.5">
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

              <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-brand shrink-0" />
                <div className="text-xs">
                  <div className="font-semibold">{t('install.wizard.dropCommentTitle')}</div>
                  <div className="text-muted-foreground">{t('install.wizard.dropCommentHint')}</div>
                </div>
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
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-600 font-medium">
                  <AlertCircle className="h-4 w-4" />
                  {t('install.wizard.connectionInactive')}
                </div>
              )}
            </div>

            {/* Celebration Card (if comments already arrived) */}
            {projects.some((p) => (p.commentsCount ?? 0) > 0) && (
              <div className="flex items-center justify-between rounded-xl border border-brand/50 bg-brand/10 p-4">
                <div className="flex items-center gap-3">
                  <PartyPopper className="h-6 w-6 text-brand" />
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
                  onClick={() => {
                    onClose();
                    navigate('/projects');
                  }}
                >
                  {t('install.wizard.viewComments')}
                </Button>
              </div>
            )}

            {/* Footer options */}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 pt-2">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand"
                  checked={suppressed}
                  onChange={(e) => onSuppressedChange(e.target.checked)}
                />
                <span className="text-xs text-muted-foreground">{t('install.dontShowAgain')}</span>
              </label>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setCurrentStep('install')}>
                  {t('install.wizard.back')}
                </Button>
                <Button onClick={onClose}>{t('install.wizard.finish')}</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
