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

/** One step in the guide. `code` is optional — instruction-only steps omit it. */
export interface SetupStep {
  titleKey: string;
  hintKey: string;
  code?: string;
  /** When set, the step renders a download anchor (not a code block) pointing here. */
  downloadUrl?: string;
}

/** Rendered in the snippet until the user actually has a project to point at. */
export const PROJECT_KEY_PLACEHOLDER = '<your-project-key>';
/** Placeholder inside the credentials snippet. Deliberately not translated — it
 *  is pasted into .pointer/credentials.env, where English reads correctly either way. */
export const PASSWORD_PLACEHOLDER = '<your password>';

/** What the dialog renders: the agent-driven path, the hand-wiring fallback,
 *  and the Chrome-extension install steps for the second tab. */
export interface GuideSteps {
  /** The recommended path, in order. */
  primary: SetupStep[];
  /** Hand-wiring the widget — only needed if you skip the agent prompt. */
  manual: SetupStep[];
  /** Loading the unpacked extension in Chrome — the no-code-install tab. */
  extension: SetupStep[];
}

/**
 * Builds the install steps. Pure so the branching (demo credentials vs. the signed-in
 * user's own, and the placeholder when there is no project yet) is unit-testable.
 *
 * Shape of the flow: install.sh drops in two skills — pointer-init and
 * pointer-feedback — so wiring the widget is a prompt, not two snippets pasted into
 * index.html. pointer-init detects the host stack (Vite / Angular / Next / CRA /
 * static / Swagger) and wires the loader and env vars the way that stack expects,
 * which the raw snippets cannot do. They stay available as the manual fallback.
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
    // Chrome-extension path: same server/credentials branches as the code tab,
    // but the widget comes from an unpacked zip instead of a script tag.
    extension: [
      { titleKey: 'install.extStep1Title', hintKey: 'install.extStep1Hint', downloadUrl: EXTENSION_ZIP_URL },
      { titleKey: 'install.extStep2Title', hintKey: 'install.extStep2Hint' },
      { titleKey: 'install.extStep3Title', hintKey: 'install.extStep3Hint', code: 'chrome://extensions' },
      {
        titleKey: 'install.extStep4Title',
        hintKey: 'install.extStep4Hint',
        code: demo
          ? `POINTER_SERVER=${server}\nPOINTER_EMAIL=${demo.email ?? ''}\nPOINTER_PASSWORD=${demo.password ?? ''}`
          : `POINTER_SERVER=${server}\nPOINTER_EMAIL=${input.userEmail ?? ''}\nPOINTER_PASSWORD=${PASSWORD_PLACEHOLDER}`,
      },
    ],
  };
}
