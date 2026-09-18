// Install-guide auto-open policy + storage flags (React port of the Angular
// InstallGuideService policy half). The gate itself is a pure function so the
// branching is unit-testable; every storage access is guarded — private mode
// must not break the guide.

/**
 * Last-resort zip download, used only when the super admin has not set either
 * a Chrome Web Store URL or a custom zip URL in Settings → Extension (see
 * `BrandingExtension` in `lib/branding.tsx`, sourced from `GET /api/branding`).
 * Deliberately NOT derived from the API base — it's a marketing-site artifact,
 * not an API asset.
 */
export const FALLBACK_EXTENSION_ZIP_URL = 'https://pointer.moamen.work/pointer-extension.zip';

/** Per-user localStorage/sessionStorage keys for the auto-open policy. */
const SEEN_KEY = (userId: string) => `pointer_install_seen:${userId}`;
const SUPPRESSED_KEY = (userId: string) => `pointer_install_suppressed:${userId}`;
const SESSION_KEY = (userId: string) => `pointer_install_shown_session:${userId}`;

export type AutoOpenContext = {
  isAdmin: boolean;
  /** Super admins manage the platform and own no project, so the guide never opens itself for them. */
  isSuperAdmin?: boolean;
  userId: string | null;
  /** Comments across every project the user can see. */
  commentsCount: number;
};

export type WizardStep = 'project' | 'method' | 'install' | 'verify';
/**
 * 'cli' (recommended) and 'extension' are the easy paths: the CLI wires the widget,
 * the AI skills and sign-in in one command, and the extension needs no code change at
 * all. 'snippet' — copy-paste the `<pointer-feedback>` tag by hand — is the advanced/
 * manual fallback for repos that can't run the CLI.
 */
export type InstallMethod = 'cli' | 'extension' | 'snippet';
export type FrameworkStack = 'html' | 'react' | 'vue' | 'angular';

/** The universal post-install check, regardless of method. */
export const DOCTOR_COMMAND = 'npx pointer-feedback doctor';

/**
 * Checks if the widget is configured and active for localhost (http://localhost:3000)
 * by pinging the anonymous public activation endpoint.
 */
export async function checkLocalhostWidgetStatus(
  server: string,
  projectKey: string,
): Promise<boolean> {
  try {
    const origin = encodeURIComponent('http://localhost:3000');
    const res = await fetch(
      `${server}/api/public/projects/${encodeURIComponent(projectKey)}/widget-status?origin=${origin}`,
    );
    if (!res.ok) return false;
    const json = await res.json();
    return Boolean(json?.data?.active ?? json?.active);
  } catch {
    return false;
  }
}

/**
 * Auto-open policy: a workspace admin who is either new here or has no feedback
 * yet gets the guide opened for them. An explicit "don't show again" wins over
 * both, and it opens at most once per browser session so a reload doesn't nag.
 * A super admin never gets it opened for them — they manage the platform rather
 * than install a widget — but the nav entry still opens it on demand.
 */
export function shouldAutoOpen(ctx: AutoOpenContext): boolean {
  if (!ctx.isAdmin || ctx.isSuperAdmin || ctx.userId == null) return false;
  if (flag(SUPPRESSED_KEY(ctx.userId))) return false;
  if (flag(SESSION_KEY(ctx.userId), sessionStorage)) return false;
  const firstTime = !flag(SEEN_KEY(ctx.userId));
  return firstTime || ctx.commentsCount === 0;
}

/** Records that the guide has been shown (first-time no longer applies). */
export function markShown(userId: string | null): void {
  if (userId == null) return;
  setFlag(SEEN_KEY(userId));
  setFlag(SESSION_KEY(userId), sessionStorage);
}

/** "Don't show this again" — stops every future auto-open for this user. */
export function suppress(userId: string | null): void {
  if (userId == null) return;
  setFlag(SUPPRESSED_KEY(userId));
}

/** Undoes "don't show again" when the user unticks the box. */
export function unsuppress(userId: string | null): void {
  if (userId == null) return;
  try {
    localStorage.removeItem(SUPPRESSED_KEY(userId));
  } catch {
    // ignore
  }
}

export function isSuppressed(userId: string | null): boolean {
  return userId != null && flag(SUPPRESSED_KEY(userId));
}

function flag(key: string, store: Storage = localStorage): boolean {
  try {
    return store.getItem(key) === '1';
  } catch {
    return false;
  }
}

function setFlag(key: string, store: Storage = localStorage): void {
  try {
    store.setItem(key, '1');
  } catch {
    // Private-mode storage failures must not break the guide.
  }
}

// ── Demo session (sessionStorage['pointer_demo']) ─────────────────────────

/** Demo session written by the demo provisioning flow (sessionStorage). */
export type DemoSession = {
  email?: string | null;
  password?: string | null;
  projectKey?: string | null;
  serverUrl?: string | null;
  expiresAt?: string;
  emailSent?: boolean;
};

const DEMO_SESSION_KEY = 'pointer_demo';

export function readDemoSession(): DemoSession | null {
  try {
    return JSON.parse(sessionStorage.getItem(DEMO_SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

// ── Install-guide step builders ──────────────────────────────────────────────

export const PROJECT_KEY_PLACEHOLDER = '<your-project-key>';
export const API_KEY_PLACEHOLDER = '<your API key — see your Profile page>';

/**
 * Builds the primary `npx -y pointer-feedback init` command with the given parameters.
 * Only includes --key if apiKey exists, and --project only if projectKey is real.
 */
export function initCommand(input: {
  server: string;
  apiKey: string | null;
  projectKey: string | null;
  environment?: 'local' | 'staging' | 'production';
}): string {
  const parts = ['npx -y pointer-feedback init', `--server ${input.server}`];
  if (input.apiKey) {
    parts.push(`--key ${input.apiKey}`);
  }
  if (input.projectKey) {
    parts.push(`--project ${input.projectKey}`);
  }
  if (input.environment) {
    parts.push(`--environment ${input.environment}`);
  }
  return parts.join(' ');
}

/**
 * Builds the monorepo init command. Always includes --key (with placeholder if needed)
 * and --html to specify the app entry point.
 */
export function monorepoInitCommand(input: {
  server: string;
  apiKey: string | null;
  projectKey: string | null;
}): string {
  const parts = ['npx -y pointer-feedback init', `--server ${input.server}`];
  parts.push(`--key ${input.apiKey ?? API_KEY_PLACEHOLDER}`);
  parts.push(`--project ${input.projectKey || PROJECT_KEY_PLACEHOLDER}`);
  parts.push('--html apps/your-app/src/index.html');
  return parts.join(' ');
}

/**
 * Builds the credentials snippet: API key for normal users, email/password for demo.
 */
export function credentialsSnippet(input: {
  apiKey: string | null;
  demo: DemoSession | null;
  credsEmailedText: string;
}): string {
  const { demo, apiKey } = input;
  if (demo) {
    return demo.emailSent
      ? input.credsEmailedText
      : `POINTER_EMAIL=${demo.email ?? ''}\nPOINTER_PASSWORD=${demo.password ?? ''}`;
  }
  return `POINTER_API_KEY=${apiKey ?? API_KEY_PLACEHOLDER}`;
}

export type SetupStep = {
  titleKey: string;
  hintKey: string;
  code?: string;
  /** Triggers a file-download button (the extension zip). */
  downloadUrl?: string;
  /** Triggers an "open in new tab" link button (e.g. the Chrome Web Store listing). */
  linkUrl?: string;
  /** Extra muted note rendered under the hint — used for the admin-only Web Store hint. */
  noteKey?: string;
};

export type GuideSteps = {
  primary: SetupStep[];
  manual: SetupStep[];
};

/**
 * Builds the full step sequence for agent/guide mode.
 */
export function buildSteps(input: {
  server: string;
  projectKey: string | null;
  apiKey: string | null;
  demo: DemoSession | null;
  credsEmailedText: string;
}): GuideSteps {
  const { server, demo, projectKey } = input;
  const displayKey = projectKey || PROJECT_KEY_PLACEHOLDER;
  const credentials = credentialsSnippet(input);

  const primary: SetupStep[] = [
    {
      titleKey: 'install.stepInitTitle',
      hintKey:
        input.apiKey ? 'install.stepInitHint' : 'install.stepInitHintNoKey',
      code: initCommand({
        server,
        apiKey: input.apiKey,
        projectKey: projectKey !== PROJECT_KEY_PLACEHOLDER ? projectKey : null,
      }),
    },
  ];

  // Add demo credentials step if in demo and we're not an API key user
  if (!input.apiKey && demo) {
    primary.push({
      titleKey: 'demo.step4Title',
      hintKey: 'demo.step4Hint',
      code: credentials,
    });
  }

  // Add agent/manual steps
  primary.push(
    {
      titleKey: 'install.stepAgentTitle',
      hintKey: 'install.stepAgentHint',
      code: `Add the Pointer feedback widget to this app using the pointer-init skill — project key: ${displayKey}, Pointer server URL: ${server}, environment: local`,
    },
    { titleKey: 'demo.step5Title', hintKey: 'demo.step5Hint' },
    {
      titleKey: 'demo.step6Title',
      hintKey: 'demo.step6Hint',
      code: 'What are the new Pointer comments?',
    },
  );

  return {
    primary,
    manual: [
      { titleKey: 'demo.step1Title', hintKey: 'demo.step1Hint', code: `<script src="${server}/widget.js" defer></script>` },
      { titleKey: 'demo.step2Title', hintKey: 'demo.step2Hint', code: `<pointer-feedback project="${displayKey}" server="${server}"></pointer-feedback>` },
      { titleKey: 'install.stepCurlTitle', hintKey: 'install.stepCurlHint', code: `curl -fsSL ${server}/install.sh | sh` },
    ],
  };
}

/**
 * Builds the steps for the Chrome extension method.
 *
 * `storeUrl`/`zipUrl` come from branding (`GET /api/branding` → `extension`,
 * set by the super admin in Settings → Extension) and may be empty strings.
 * When a Web Store URL is set, installing is a single click there and the
 * "Load unpacked" dance disappears. Otherwise we fall back to the zip +
 * `chrome://extensions` flow, optionally pointing a super admin at the
 * setting that would remove this step for everyone.
 */
export function buildExtensionSteps(input: {
  server: string;
  apiKey: string | null;
  demo: DemoSession | null;
  credsEmailedText: string;
  storeUrl: string;
  zipUrl: string;
  isSuperAdmin?: boolean;
}): SetupStep[] {
  const { server, storeUrl, zipUrl, isSuperAdmin } = input;
  const credentials = credentialsSnippet(input);
  const signInStep: SetupStep = {
    titleKey: 'install.extStep4Title',
    hintKey: 'install.extStep4Hint',
    code: `${server}\n${credentials}`,
  };

  if (storeUrl) {
    return [
      {
        titleKey: 'install.extStoreStep1Title',
        hintKey: 'install.extStoreStep1Hint',
        linkUrl: storeUrl,
      },
      signInStep,
    ];
  }

  return [
    {
      titleKey: 'install.extStep1Title',
      hintKey: 'install.extStep1Hint',
      noteKey: isSuperAdmin ? 'install.extStep1AdminHint' : undefined,
      downloadUrl: zipUrl || FALLBACK_EXTENSION_ZIP_URL,
    },
    { titleKey: 'install.extStep2Title', hintKey: 'install.extStep2Hint' },
    { titleKey: 'install.extStep3Title', hintKey: 'install.extStep3Hint', code: 'chrome://extensions' },
    signInStep,
  ];
}
