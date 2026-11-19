import { createContext, useContext } from 'react'

export interface ErrorAlertContextValue {
  showError: (message: string) => void
}

export const ErrorAlertContext = createContext<ErrorAlertContextValue | null>(null)

export function useErrorAlert(): ErrorAlertContextValue {
  const value = useContext(ErrorAlertContext)
  if (!value) throw new Error('useErrorAlert 必須在 <ErrorAlertProvider> 內使用')
  return value
}
