import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));

// Pointer feedback widget — dogfoods Pointer on its own dashboard, pointed at the same API
// (apiBase). Guarded by `enabled` so a build can ship without it.
if (environment.pointerFeedback.enabled) {
  const script = document.createElement('script');
  script.src = `${environment.apiBase}/pointer.js`;
  script.defer = true;
  document.head.appendChild(script);

  const widget = document.createElement('pointer-feedback');
  widget.setAttribute('project', environment.pointerFeedback.project);
  widget.setAttribute('server', environment.apiBase);
  widget.setAttribute('environment', environment.pointerFeedback.environment);
  widget.setAttribute('source-attr', 'data-component-source');
  document.body.appendChild(widget);
}
