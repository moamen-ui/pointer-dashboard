import { createApp } from 'vue';
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query';
import { configureApi } from '@/lib/api';
import { i18n } from '@/i18n';
import { initPreferences } from '@/composables/usePreferences';
import { initBranding } from '@/composables/useBranding';
import { router } from '@/router';
import App from './App.vue';
import './index.css';

// Set AXIOS_INSTANCE baseURL + auth/401 interceptors before the app mounts.
configureApi();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Load the initial locale + apply theme/dir to <html> before mounting so the
// first paint already reflects the persisted language/theme.
// Fetch branding concurrently — it applies document.title / favicon effects
// when the data arrives; failures fall back to bundled defaults silently.
void Promise.all([initPreferences(), initBranding()]).finally(() => {
  createApp(App)
    .use(i18n)
    .use(router)
    .use(VueQueryPlugin, { queryClient })
    .mount('#app');
});
