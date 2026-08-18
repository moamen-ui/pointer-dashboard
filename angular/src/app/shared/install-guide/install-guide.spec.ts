import { buildSteps, PASSWORD_PLACEHOLDER, PROJECT_KEY_PLACEHOLDER } from './install-guide.component';

const base = {
  server: 'https://api.example.test',
  projectKey: 'my-app',
  userEmail: 'admin@example.test',
  demo: null,
  credsEmailedText: 'emailed to you',
};

describe('buildSteps', () => {
  it('points the widget snippet at the selected project and server', () => {
    const steps = buildSteps(base);
    expect(steps[0].code).toContain('https://api.example.test/pointer.js');
    expect(steps[1].code).toContain('project="my-app"');
    expect(steps[1].code).toContain('server="https://api.example.test"');
  });

  it('falls back to a placeholder key when the user has no project yet', () => {
    const steps = buildSteps({ ...base, projectKey: null });
    expect(steps[1].code).toContain(`project="${PROJECT_KEY_PLACEHOLDER}"`);
  });

  it('uses the signed-in email with a password placeholder outside a demo', () => {
    const creds = buildSteps(base)[3].code!;
    expect(creds).toContain('POINTER_EMAIL=admin@example.test');
    expect(creds).toContain(`POINTER_PASSWORD=${PASSWORD_PLACEHOLDER}`);
  });

  it('uses the demo widget login when a demo session is active', () => {
    const creds = buildSteps({
      ...base,
      demo: { email: 'demo@example.test', password: 's3cret', projectKey: 'demo-proj' },
    })[3].code!;
    expect(creds).toContain('POINTER_EMAIL=demo@example.test');
    expect(creds).toContain('POINTER_PASSWORD=s3cret');
  });

  it('tells the user to check their inbox when the demo creds were emailed', () => {
    const creds = buildSteps({
      ...base,
      demo: { email: 'demo@example.test', password: null, emailSent: true },
    })[3].code!;
    expect(creds).toBe('emailed to you');
    expect(creds).not.toContain('POINTER_PASSWORD');
  });
});
