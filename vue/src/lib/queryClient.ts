import { QueryClient } from '@tanstack/vue-query';

// Shared QueryClient so both main.ts (VueQueryPlugin) and the module-level auth
// composable (logout → clear) reference the SAME cache. Kept in its own module to
// avoid a main.ts ↔ composable import cycle.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
