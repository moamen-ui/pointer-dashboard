import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideTransloco, TranslocoLoader } from '@jsverse/transloco';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { InstallGuideService } from './install-guide.service';
import {
  API_KEY_PLACEHOLDER,
  buildExtensionSteps,
  buildSteps,
  EXTENSION_ZIP_URL,
  InstallGuideComponent,
  PROJECT_KEY_PLACEHOLDER,
} from './install-guide.component';

const base = {
  server: 'https://api.example.test',
  projectKey: 'my-app',
  userEmail: 'admin@example.test',
  apiKey: 'ptr_abc123',
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

  it("uses the signed-in user's own API key outside a demo", () => {
    const creds = buildSteps(base).primary[1].code!;
    expect(creds).toBe('POINTER_API_KEY=ptr_abc123');
  });

  it('falls back to a placeholder when the API key has not loaded yet', () => {
    const creds = buildSteps({ ...base, apiKey: null }).primary[1].code!;
    expect(creds).toBe(`POINTER_API_KEY=${API_KEY_PLACEHOLDER}`);
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

describe('buildExtensionSteps', () => {
  it('leads with a download step pointing at the landing-domain zip, not a code block', () => {
    const first = buildExtensionSteps(base)[0];
    expect(first.downloadUrl).toBe(EXTENSION_ZIP_URL);
    expect(first.code).toBeUndefined();
  });

  it('makes chrome://extensions copyable in the load step', () => {
    expect(buildExtensionSteps(base)[2].code).toBe('chrome://extensions');
  });

  it("signs in with the server URL and the signed-in user's own API key outside a demo", () => {
    const signIn = buildExtensionSteps(base)[3].code!;
    expect(signIn).toContain(base.server);
    expect(signIn).toContain(`POINTER_API_KEY=${base.apiKey}`);
  });

  it('uses the demo server URL and widget login during a demo session', () => {
    const signIn = buildExtensionSteps({
      ...base,
      server: 'https://demo.example.test',
      demo: { email: 'demo@example.test', password: 's3cret', serverUrl: 'https://demo.example.test' },
    })[3].code!;
    expect(signIn).toContain('https://demo.example.test');
    expect(signIn).toContain('POINTER_EMAIL=demo@example.test');
    expect(signIn).toContain('POINTER_PASSWORD=s3cret');
  });
});

describe('InstallGuideComponent extension tab', () => {
  // Enough translations for the pipe; the component also translates demo.* keys.
  const translations = {
    install: {
      title: 'Installation steps',
      intro: 'intro',
      manualTitle: 'manual',
      manualHint: 'manual hint',
      project: 'Project',
      noProjects: 'no projects',
      dontShowAgain: "don't show again",
      done: 'done',
      stepAgentTitle: 'agent',
      stepAgentHint: 'agent hint',
      tabCode: 'Code',
      tabExtension: 'Chrome extension',
      extDownload: 'Download extension (.zip)',
      extStep1Title: 'Download the extension',
      extStep1Hint: 'Grab the Pointer Chrome extension package.',
      extStep2Title: 'Unzip the file',
      extStep2Hint: 'Extract the zip anywhere you like.',
      extStep3Title: 'Load it in Chrome',
      extStep3Hint: 'Go to chrome://extensions…',
      extStep4Title: 'Sign in',
      extStep4Hint: 'Sign in hint',
    },
    demo: {
      copy: 'Copy',
      copied: 'copied',
      copyFailed: 'copy failed',
      credsEmailed: 'emailed to you',
      step1Title: 's1', step1Hint: 'h1', step2Title: 's2', step2Hint: 'h2',
      step3Title: 's3', step3Hint: 'h3', step4Title: 's4', step4Hint: 'h4',
      step5Title: 's5', step5Hint: 'h5', step6Title: 's6', step6Hint: 'h6',
    },
    nav: { projects: 'Projects' },
  };

  class InlineLoader implements TranslocoLoader {
    getTranslation(): Observable<typeof translations> {
      // delay(0) keeps the load event (and its toSignal write) out of the
      // render pass — of() would emit while the template is still building.
      return of(translations).pipe(delay(0));
    }
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InstallGuideComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTransloco({
          config: { availableLangs: ['en'], defaultLang: 'en', reRenderOnLangChange: false, prodMode: true },
          loader: InlineLoader,
        }),
        { provide: AuthService, useValue: { user: signal({ id: 1, email: 'admin@example.test' }) } },
        { provide: MatSnackBar, useValue: { open: () => ({}) } },
        { provide: InstallGuideService, useValue: { projects: signal([]), markShown: () => {}, isSuppressed: () => false } },
      ],
    }).compileComponents();
  });

  it('renders the download link and all four steps when the extension tab is selected', async () => {
    const fixture = TestBed.createComponent(InstallGuideComponent);
    fixture.detectChanges();

    // The component now also fetches the signed-in user's own API key (getApiMeApiKeyResource) —
    // flush that pending request so whenStable() doesn't hang waiting on it forever.
    const httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne('/api/me/api-key').flush({ apiKey: 'ptr_test' });

    await new Promise((r) => setTimeout(r)); // let the inline lang loader emit
    await fixture.whenStable();
    fixture.detectChanges();

    // The code tab is the default and shows no download link.
    expect(fixture.nativeElement.querySelector('a[download]')).toBeNull();

    fixture.componentInstance.tab.set('extension');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const link = el.querySelector<HTMLAnchorElement>('a[download]');
    expect(link?.getAttribute('href')).toBe(EXTENSION_ZIP_URL);
    expect(link?.textContent).toContain('Download extension (.zip)');

    const items = el.querySelectorAll('ol li');
    expect(items.length).toBe(4);
    expect(el.textContent).toContain('Load it in Chrome');
    expect(el.textContent).toContain('chrome://extensions');
    expect(el.textContent).toContain(environment.apiBase);
  });
});
