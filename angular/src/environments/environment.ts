export const environment = {
  production: false,
  apiBase: 'http://localhost:8090',
  // Dogfoods the Pointer widget on the dashboard itself, pointed at the same API (apiBase).
  pointerFeedback: {
    enabled: true,
    project: 'pointer-dashboard',
    environment: 'local',
  },
};
