import '@fontsource-variable/noto-sans-tc'
import '@mantine/core/styles.css'
import './index.css'

import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App'
import { ErrorAlertProvider } from './components/ui/ErrorAlertProvider'
import { theme } from './theme'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <ErrorAlertProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ErrorAlertProvider>
      </MantineProvider>
    </QueryClientProvider>
  </StrictMode>,
)
