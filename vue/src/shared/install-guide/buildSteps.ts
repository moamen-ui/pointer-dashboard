// Pure builder for the install-guide steps — Vue port of the Angular app's
// buildSteps(). Lives in its own module (not inside an SFC <script> block)
// because step 1's snippet contains a literal closing </script> tag, which
// would terminate an SFC block.
import type { DemoSession } from '@/lib/demoSession';

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

/**
 * Builds the install steps. Pure so the branching (demo credentials vs. the signed-in
 * user's own, and the placeholder when there is no project yet) is unit-testable.
 */
export function buildSteps(input: {
  server: string;
  projectKey: string | null;
  userEmail: string | null;
  demo: DemoSession | null;
  credsEmailedText: string;
}): SetupStep[] {
  const { server, demo } = input;
  const projectKey = input.projectKey || PROJECT_KEY_PLACEHOLDER;
  const credentials = demo
    ? demo.emailSent
      ? input.credsEmailedText
      : `POINTER_EMAIL=${demo.email ?? ''}\nPOINTER_PASSWORD=${demo.password ?? ''}`
    : `POINTER_EMAIL=${input.userEmail ?? ''}\nPOINTER_PASSWORD=${PASSWORD_PLACEHOLDER}`;

  return [
    { titleKey: 'demo.step1Title', hintKey: 'demo.step1Hint', code: `<script src="${server}/pointer.js" defer></script>` },
    { titleKey: 'demo.step2Title', hintKey: 'demo.step2Hint', code: `<pointer-feedback project="${projectKey}" server="${server}"></pointer-feedback>` },
    { titleKey: 'demo.step3Title', hintKey: 'demo.step3Hint', code: `curl -fsSL ${server}/install.sh | sh` },
    { titleKey: 'demo.step4Title', hintKey: 'demo.step4Hint', code: credentials },
    { titleKey: 'demo.step5Title', hintKey: 'demo.step5Hint' },
    // Kept English on purpose — the pointer-feedback skill triggers on this phrasing.
    { titleKey: 'demo.step6Title', hintKey: 'demo.step6Hint', code: 'What are the new Pointer comments?' },
  ];
}
