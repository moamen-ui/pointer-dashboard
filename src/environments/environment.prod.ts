// Production build config. Swapped in for environment.ts via `fileReplacements`
// in angular.json (configuration: production). apiBase points at the deployed
// Pointer API host; the dev environment.ts keeps http://localhost:8090.
export const environment = {
  production: true,
  apiBase: 'https://api.pointer.moamen.work',
};
