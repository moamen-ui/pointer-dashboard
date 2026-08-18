import { buildSteps, PASSWORD_PLACEHOLDER, PROJECT_KEY_PLACEHOLDER } from './install-guide.component';

const base = {
  server: 'https://api.example.test',
  projectKey: 'my-app',
  userEmail: 'admin@example.test',
  demo: null,
  credsEmailedText: 'emailed to you',
};

describe('buildSteps', () => {
  it('leads with installing the skills, not with hand-pasting snippets', () => {
    const { primary } = buildSteps(base);
    expect(primary[0].code).toBe('curl -fsSL https://api.example.test/install.sh | sh');
    // The two index.html snippets are the fallback, not part of the main path.
    expect(primary.map((s) => s.code ?? '').join('\n')).not.toContain('<script src=');
    expect(primary.map((s) => s.code ?? '').join('\n')).not.toContain('<pointer-feedback');
  });

  it('gives the agent the pointer-init skill and all three variables up front', () => {
    const prompt = buildSteps(base).primary[2].code!;
    // Named so the skill triggers; variables supplied so it need not stop and ask.
    expect(prompt).toContain('pointer-init skill');
    expect(prompt).toContain('project key: my-app');
    expect(prompt).toContain('Pointer server URL: https://api.example.test');
    expect(prompt).toContain('environment: local');
  });

  it('keeps the manual snippets available as a fallback', () => {
    const { manual } = buildSteps(base);
    expect(manual).toHaveLength(2);
    expect(manual[0].code).toContain('https://api.example.test/pointer.js');
    expect(manual[1].code).toContain('project="my-app"');
    expect(manual[1].code).toContain('server="https://api.example.test"');
  });

  it('falls back to a placeholder key in both the prompt and the manual snippet', () => {
    const { primary, manual } = buildSteps({ ...base, projectKey: null });
    expect(primary[2].code).toContain(`project key: ${PROJECT_KEY_PLACEHOLDER}`);
    expect(manual[1].code).toContain(`project="${PROJECT_KEY_PLACEHOLDER}"`);
  });

  it('uses the signed-in email with a password placeholder outside a demo', () => {
    const creds = buildSteps(base).primary[1].code!;
    expect(creds).toContain('POINTER_EMAIL=admin@example.test');
    expect(creds).toContain(`POINTER_PASSWORD=${PASSWORD_PLACEHOLDER}`);
  });

  it('uses the demo widget login when a demo session is active', () => {
    const creds = buildSteps({
      ...base,
      demo: { email: 'demo@example.test', password: 's3cret', projectKey: 'demo-proj' },
    }).primary[1].code!;
    expect(creds).toContain('POINTER_EMAIL=demo@example.test');
    expect(creds).toContain('POINTER_PASSWORD=s3cret');
  });

  it('tells the user to check their inbox when the demo creds were emailed', () => {
    const creds = buildSteps({
      ...base,
      demo: { email: 'demo@example.test', password: null, emailSent: true },
    }).primary[1].code!;
    expect(creds).toBe('emailed to you');
    expect(creds).not.toContain('POINTER_PASSWORD');
  });
});
