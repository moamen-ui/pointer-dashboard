// Production build config. Swapped in for environment.ts via `fileReplacements`
// in angular.json (configuration: production). apiBase points at the deployed
// Pointer API host; the dev environment.ts keeps http://localhost:8090.
export const environment = {
  production: true,
  apiBase: 'https://api.pointer.moamen.work',
  // Dogfoods the Pointer widget on the dashboard itself, pointed at the same API (apiBase).
  pointerFeedback: {
    enabled: true,
    project: 'pointer-dashboard',
    environment: 'production',
  },
};
