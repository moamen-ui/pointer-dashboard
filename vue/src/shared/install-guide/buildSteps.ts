// Pure builder for the install-guide steps — Vue port of the Angular app's
// buildSteps(). Lives in its own module (not inside an SFC <script> block)
// because the manual loader snippet contains a literal closing </script> tag,
// which would terminate an SFC block.
import type { DemoSession } from '@/lib/demoSession';

/**
 * The Chrome extension package. Served from the landing domain, deliberately
 * NOT derived from the API base — it is a static artifact, not an API route.
 */
export const EXTENSION_ZIP_URL = 'https://pointer.moamen.work/pointer-extension.zip';

/** Placeholder for a project key when one is not yet selected. */
export const PROJECT_KEY_PLACEHOLDER = '<your-project-key>';
/** Placeholder for an API key when the user hasn't obtained one yet. */
export const API_KEY_PLACEHOLDER = '<your API key — see your Profile page>';

/** One step in the guide. `code` is optional — instruction-only steps omit it. */
export type SetupStep = {
  titleKey: string;
  hintKey: string;
  code?: string;
  /** When set, the step renders a download anchor (not a code block) pointing here. */
  downloadUrl?: string;
};

export type WizardStep = 'project' | 'method' | 'install' | 'verify';
export type InstallMethod = 'agent' | 'snippet' | 'extension';
export type FrameworkStack = 'html' | 'react' | 'vue' | 'angular';

/**
 * Pings the public activation endpoint to check if the project is active on localhost.
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

/** Placeholder inside the credentials snippet. Deliberately not translated — it
 *  is pasted into .pointer/credentials.env, where English reads correctly either way. */
export const PASSWORD_PLACEHOLDER = '<your password>';

/**
 * Builds the init command for the pointer-feedback CLI.
 * Includes server, and optional key/project/environment.
 */
export function initCommand(i: {
  server: string;
  apiKey: string | null;
  projectKey: string | null;
  environment?: 'local' | 'staging' | 'production';
}): string {
  const parts = ['npx -y pointer-feedback init', `--server ${i.server}`];
  if (i.apiKey) parts.push(`--key ${i.apiKey}`);
  if (i.projectKey) parts.push(`--project ${i.projectKey}`);
  if (i.environment) parts.push(`--environment ${i.environment}`);
  return parts.join(' ');
}

/**
 * Builds the monorepo init command.
 * Always includes placeholders for key and project (unless overridden).
 */
export function monorepoInitCommand(i: {
  server: string;
  apiKey: string | null;
  projectKey: string | null;
}): string {
  const parts = ['npx -y pointer-feedback init', `--server ${i.server}`];
  parts.push(`--key ${i.apiKey ?? API_KEY_PLACEHOLDER}`);
  parts.push(`--project ${i.projectKey || PROJECT_KEY_PLACEHOLDER}`);
  parts.push('--html apps/your-app/src/index.html');
  return parts.join(' ');
}

/**
 * Builds the credentials snippet, selecting between API key (production)
 * and demo email/password credentials.
 */
export function credentialsSnippet(input: {
  server: string;
  userEmail: string | null;
  apiKey: string | null;
  demo: DemoSession | null;
  credsEmailedText: string;
}): string {
  const { demo } = input;
  return demo
    ? demo.emailSent
      ? input.credsEmailedText
      : `POINTER_EMAIL=${demo.email ?? ''}\nPOINTER_PASSWORD=${demo.password ?? ''}`
    : `POINTER_API_KEY=${input.apiKey ?? API_KEY_PLACEHOLDER}`;
}

/** What the dialog renders: the agent-driven path, the hand-wiring fallback,
 *  and the Chrome-extension install steps for the second tab. */
export type GuideSteps = {
  /** The recommended path, in order. */
  primary: SetupStep[];
  /** Hand-wiring the widget — only needed if you skip the agent prompt. */
  manual: SetupStep[];
  /** Loading the unpacked extension in Chrome — the no-code-install tab. */
  extension: SetupStep[];
};

/**
 * Builds the install steps for the agent method. Pure so the branching (demo credentials
 * vs. the signed-in user's own, and the placeholder when there is no project/API key yet)
 * is unit-testable.
 */
export function buildSteps(input: {
  server: string;
  projectKey: string | null;
  userEmail: string | null;
  apiKey: string | null;
  demo: DemoSession | null;
  credsEmailedText: string;
}): GuideSteps {
  const { server, demo } = input;
  const projectKey = input.projectKey || PROJECT_KEY_PLACEHOLDER;
  const credentials = credentialsSnippet(input);

  const primary: SetupStep[] = [
    {
      titleKey: 'install.stepInitTitle',
      hintKey: input.apiKey ? 'install.stepInitHint' : 'install.stepInitHintNoKey',
      code: initCommand({
        server,
        apiKey: input.apiKey,
        projectKey: input.projectKey !== PROJECT_KEY_PLACEHOLDER ? input.projectKey : null,
      }),
    },
  ];

  // Demo users see credentials step in primary path
  if (!input.apiKey && demo) {
    primary.push({
      titleKey: 'demo.step4Title',
      hintKey: 'demo.step4Hint',
      code: credentials,
    });
  }

  primary.push(
    {
      titleKey: 'install.stepAgentTitle',
      hintKey: 'install.stepAgentHint',
      code: `Add the Pointer feedback widget to this app using the pointer-init skill — project key: ${projectKey}, Pointer server URL: ${server}, environment: local`,
    },
    { titleKey: 'demo.step5Title', hintKey: 'demo.step5Hint' },
    { titleKey: 'demo.step6Title', hintKey: 'demo.step6Hint', code: 'What are the new Pointer comments?' },
  );

  return {
    primary,
    manual: [
      { titleKey: 'demo.step1Title', hintKey: 'demo.step1Hint', code: `<script src="${server}/pointer.js" defer></script>` },
      { titleKey: 'demo.step2Title', hintKey: 'demo.step2Hint', code: `<pointer-feedback project="${projectKey}" server="${server}"></pointer-feedback>` },
      { titleKey: 'install.stepCurlTitle', hintKey: 'install.stepCurlHint', code: `curl -fsSL ${server}/install.sh | sh` },
    ],
    extension: buildExtensionSteps(input),
  };
}

/**
 * Builds the extension install steps.
 */
export function buildExtensionSteps(input: {
  server: string;
  userEmail: string | null;
  apiKey: string | null;
  demo: DemoSession | null;
  credsEmailedText: string;
}): SetupStep[] {
  const { server } = input;
  return [
    {
      titleKey: 'install.extStep1Title',
      hintKey: 'install.extStep1Hint',
      downloadUrl: EXTENSION_ZIP_URL,
    },
    { titleKey: 'install.extStep2Title', hintKey: 'install.extStep2Hint' },
    { titleKey: 'install.extStep3Title', hintKey: 'install.extStep3Hint', code: 'chrome://extensions' },
    {
      titleKey: 'install.extStep4Title',
      hintKey: 'install.extStep4Hint',
      code: `${server}\n${credentialsSnippet(input)}`,
    },
  ];
}
