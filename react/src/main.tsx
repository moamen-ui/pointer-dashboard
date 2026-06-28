import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureApi } from '@/lib/api';
import '@/i18n'; // side-effect: init react-i18next before any component renders
import App from './App';
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
