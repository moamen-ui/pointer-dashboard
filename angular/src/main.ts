import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));

// Pointer feedback widget — dogfoods Pointer on its own dashboard, but only for a user whose own
// tenant has access to that project. Mounted reactively by PointerDogfoodService (see app.ts),
// not here: unlike a top-level script tag, it can react to auth state and re-check on login/logout.
