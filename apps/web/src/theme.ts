import { createTheme } from '@mantine/core'

/**
 * 設計基準：Penpot「all page」切片（本地色板）。
 * Teal #12836F、Error #B42318、Navy #17324D、Yellow #FFC94A、
 * Muted #5D7184、Paper #F5F8F6、Mint #DDF4EC、Border #D8E2E8。
 */
export const theme = createTheme({
  primaryColor: 'teal',
  primaryShade: 6,
  defaultRadius: 'lg',
  fontFamily: '"Noto Sans TC Variable", "Noto Sans TC", sans-serif',
  headings: {
    fontFamily: '"Noto Sans TC Variable", "Noto Sans TC", sans-serif',
    fontWeight: '700',
    sizes: {
      h1: { fontSize: '2.5rem', lineHeight: '1.2' },
      h2: { fontSize: '1.5rem', lineHeight: '1.3' },
      h3: { fontSize: '1.25rem', lineHeight: '1.4' },
      h4: { fontSize: '1.125rem', lineHeight: '1.4' },
      h5: { fontSize: '1rem', lineHeight: '1.4' },
      h6: { fontSize: '0.875rem', lineHeight: '1.4' },
    },
  },
  spacing: {
    xs: '0.5rem',
    sm: '1rem',
    md: '1.5rem',
    lg: '2rem',
    xl: '3rem',
  },
  colors: {
    teal: [
      '#E9F5F1',
      '#D2EBE2',
      '#ABD9C9',
      '#79C2AB',
      '#45A78B',
      '#1E8F73',
      '#12836F',
      '#0F6C5B',
      '#0B6455',
      '#08473C',
    ],
    navy: [
      '#EDF2F6',
      '#D9E4EC',
      '#C9D8E2',
      '#A9C2D4',
      '#86A6BE',
      '#5E87A5',
      '#3E6484',
      '#24445F',
      '#17324D',
      '#0F2233',
    ],
    yellow: [
      '#FFFBEB',
      '#FFF6D6',
      '#FFF4CF',
      '#FFE9A3',
      '#FFDF7A',
      '#FFD55C',
      '#FFC94A',
      '#E8B23A',
      '#C9972E',
      '#A67B24',
    ],
    mint: [
      '#F2FBF7',
      '#E6F7F0',
      '#DDF4EC',
      '#C0EADD',
      '#98DBC7',
      '#6FC9AF',
      '#4DB596',
      '#3A9A80',
      '#2F7F6A',
      '#256555',
    ],
    muted: [
      '#F3F6F8',
      '#E4EAEE',
      '#D8E2E8',
      '#C3CFD8',
      '#A9B9C4',
      '#8CA0AE',
      '#71879A',
      '#5D7184',
      '#4A5B6B',
      '#3A4855',
    ],
    error: [
      '#FEF3F2',
      '#FEE4E2',
      '#FECDCA',
      '#FDA29B',
      '#F97066',
      '#F04438',
      '#D92D20',
      '#B42318',
      '#912018',
      '#7A271A',
    ],
  },
  components: {
    Button: {
      defaultProps: { radius: 'lg', size: 'lg' },
      styles: {
        root: {
          height: '3.5rem',
          fontSize: '1rem',
          fontWeight: 600,
        },
      },
    },
    TextInput: {
      defaultProps: { radius: 'lg' },
      styles: {
        label: { fontSize: '1rem', fontWeight: 600, color: '#17324D', marginBottom: 8 },
        input: { height: '3.5rem', fontSize: '1rem', borderColor: '#D8E2E8' },
      },
    },
    PasswordInput: {
      defaultProps: { radius: 'lg' },
      styles: {
        label: { fontSize: '1rem', fontWeight: 600, color: '#17324D', marginBottom: 8 },
        input: { height: '3.5rem', fontSize: '1rem', borderColor: '#D8E2E8' },
      },
    },
    Textarea: {
      defaultProps: { radius: 'lg' },
      styles: {
        label: { fontSize: '1rem', fontWeight: 600, color: '#17324D', marginBottom: 8 },
        input: { fontSize: '1rem', borderColor: '#D8E2E8' },
      },
    },
    Modal: {
      defaultProps: { radius: 'xl' },
    },
    Paper: {
      defaultProps: { radius: 'xl' },
    },
  },
})
