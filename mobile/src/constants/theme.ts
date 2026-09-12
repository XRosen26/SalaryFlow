import { useColorScheme } from 'react-native';

export const light = {
  background: '#F5F7F4',
  surface: '#FFFFFF',
  surfaceMuted: '#EAF1ED',
  text: '#17221E',
  textSecondary: '#66736D',
  primary: '#176B55',
  primaryPressed: '#105442',
  primarySoft: '#DCEDE5',
  border: '#DDE5E0',
  income: '#1B7A5C',
  expense: '#C04444',
  warning: '#B87518',
  info: '#2866A9',
  tabInactive: '#7A8781',
  overlay: 'rgba(12, 28, 22, 0.45)',
} as const;

export const dark = {
  background: '#0E1714',
  surface: '#17231F',
  surfaceMuted: '#20322B',
  text: '#F3F7F5',
  textSecondary: '#AAB7B1',
  primary: '#69C5A2',
  primaryPressed: '#8BD5B8',
  primarySoft: '#213E34',
  border: '#2C4038',
  income: '#69C5A2',
  expense: '#FF8C8C',
  warning: '#E6B566',
  info: '#83B8EF',
  tabInactive: '#93A099',
  overlay: 'rgba(0, 0, 0, 0.65)',
} as const;

export type AppColors = typeof light | typeof dark;

export function useAppTheme(): AppColors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
