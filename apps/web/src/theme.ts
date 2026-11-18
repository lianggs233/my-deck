import { createTheme } from '@mantine/core'

export const theme = createTheme({
  primaryColor: 'teal',
  fontFamily: '"Noto Sans TC Variable", "Noto Sans TC", sans-serif',
  defaultRadius: 'md',
  spacing: {
    xs: '0.5rem',
    sm: '1rem',
    md: '1.5rem',
    lg: '2rem',
    xl: '2.5rem',
  },
  headings: {
    fontFamily: '"Noto Sans TC Variable", "Noto Sans TC", sans-serif',
    sizes: {
      h1: { fontSize: '2.5rem', lineHeight: '1.2' },
      h2: { fontSize: '1.5rem', lineHeight: '1.3' },
      h3: { fontSize: '1rem', lineHeight: '1.4' },
    },
  },
})
