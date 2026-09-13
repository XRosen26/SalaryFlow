import {
  createContext,
  createElement,
  type PropsWithChildren,
  useContext,
} from "react";
import { useColorScheme } from "react-native";

export type PaletteName =
  "forest" | "ocean" | "violet" | "amber" | "rose" | "slate";

export type AppColors = {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textSecondary: string;
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  border: string;
  income: string;
  expense: string;
  warning: string;
  info: string;
  tabInactive: string;
  overlay: string;
  chart: readonly string[];
};

type PalettePair = { light: AppColors; dark: AppColors };

const sharedLight = {
  surface: "#FFFFFF",
  text: "#17221E",
  textSecondary: "#66736D",
  expense: "#C04444",
  warning: "#B87518",
  tabInactive: "#7A8781",
  overlay: "rgba(12, 28, 22, 0.45)",
};
const sharedDark = {
  surface: "#17231F",
  text: "#F3F7F5",
  textSecondary: "#AAB7B1",
  expense: "#FF8C8C",
  warning: "#E6B566",
  tabInactive: "#93A099",
  overlay: "rgba(0, 0, 0, 0.65)",
};

export const palettes: Record<PaletteName, PalettePair> = {
  forest: {
    light: {
      ...sharedLight,
      background: "#F5F7F4",
      surfaceMuted: "#EAF1ED",
      primary: "#176B55",
      primaryPressed: "#105442",
      primarySoft: "#DCEDE5",
      border: "#DDE5E0",
      income: "#1B7A5C",
      info: "#2866A9",
      chart: [
        "#287A60",
        "#4C9674",
        "#76A765",
        "#A1A657",
        "#CF9846",
        "#C96D52",
        "#4E8C94",
        "#736F9C",
      ],
    },
    dark: {
      ...sharedDark,
      background: "#0E1714",
      surfaceMuted: "#20322B",
      primary: "#69C5A2",
      primaryPressed: "#8BD5B8",
      primarySoft: "#213E34",
      border: "#2C4038",
      income: "#69C5A2",
      info: "#83B8EF",
      chart: [
        "#72C5A5",
        "#8BCDA2",
        "#B1C979",
        "#D2C46D",
        "#E1AA5F",
        "#E18870",
        "#79B8BE",
        "#AAA0CC",
      ],
    },
  },
  ocean: {
    light: {
      ...sharedLight,
      background: "#F3F7FB",
      surfaceMuted: "#E6EFF7",
      primary: "#2563A2",
      primaryPressed: "#1D4E80",
      primarySoft: "#DDEAF6",
      border: "#D8E4EF",
      income: "#287D72",
      info: "#2563A2",
      chart: [
        "#2D6FA7",
        "#3C8FBE",
        "#43A3B0",
        "#62B39F",
        "#8AB979",
        "#D0A14E",
        "#D2765C",
        "#7E78B3",
      ],
    },
    dark: {
      ...sharedDark,
      background: "#0E1720",
      surface: "#17232D",
      surfaceMuted: "#203240",
      primary: "#83BCEF",
      primaryPressed: "#A3CEF3",
      primarySoft: "#20394D",
      border: "#2C4354",
      income: "#73C9B3",
      info: "#83BCEF",
      chart: [
        "#83BCEF",
        "#73C9EA",
        "#6FD2DA",
        "#88D5BD",
        "#ACD28B",
        "#E7BE6F",
        "#EA927A",
        "#AAA3DF",
      ],
    },
  },
  violet: {
    light: {
      ...sharedLight,
      background: "#F7F4FA",
      surfaceMuted: "#EFE8F5",
      primary: "#7253A6",
      primaryPressed: "#583D84",
      primarySoft: "#EAE1F3",
      border: "#E2D9EA",
      income: "#367F70",
      info: "#7253A6",
      chart: [
        "#7253A6",
        "#8B64B3",
        "#AA70AE",
        "#C67698",
        "#D08769",
        "#5D87B2",
        "#4E9687",
        "#9DA258",
      ],
    },
    dark: {
      ...sharedDark,
      background: "#171320",
      surface: "#211B2B",
      surfaceMuted: "#30263E",
      primary: "#BEA2EB",
      primaryPressed: "#D0B9F1",
      primarySoft: "#382B4B",
      border: "#493A5C",
      income: "#82C8B8",
      info: "#8DB9E5",
      chart: [
        "#BEA2EB",
        "#CAA7EF",
        "#E09DCE",
        "#ED9FBD",
        "#EEAC8D",
        "#8DB9E5",
        "#82C8B8",
        "#C5CE83",
      ],
    },
  },
  amber: {
    light: {
      ...sharedLight,
      background: "#FAF7F1",
      surfaceMuted: "#F4ECDD",
      primary: "#99621E",
      primaryPressed: "#774A14",
      primarySoft: "#F1E3CC",
      border: "#E9DFC9",
      income: "#3D7D69",
      info: "#587FA1",
      chart: [
        "#A56A20",
        "#BD812C",
        "#CF9D3F",
        "#D6B660",
        "#B37659",
        "#587FA1",
        "#4E8F80",
        "#846DA1",
      ],
    },
    dark: {
      ...sharedDark,
      background: "#1D1710",
      surface: "#292118",
      surfaceMuted: "#3A2E20",
      primary: "#E5BA73",
      primaryPressed: "#F0CC8D",
      primarySoft: "#49371F",
      border: "#5B4528",
      income: "#83C5B3",
      info: "#9BBBD8",
      chart: [
        "#E5BA73",
        "#EDC57C",
        "#F0D084",
        "#EADB9B",
        "#DDA38A",
        "#9BBBD8",
        "#83C5B3",
        "#C4A6DA",
      ],
    },
  },
  rose: {
    light: {
      ...sharedLight,
      background: "#FAF4F7",
      surfaceMuted: "#F7EAF0",
      primary: "#A4476C",
      primaryPressed: "#853453",
      primarySoft: "#F3DFE8",
      border: "#EAD8E0",
      income: "#397E72",
      info: "#746FB7",
      chart: [
        "#A84569",
        "#BE5876",
        "#D17484",
        "#D48B77",
        "#B4679D",
        "#746FB7",
        "#4F8D8E",
        "#78945E",
      ],
    },
    dark: {
      ...sharedDark,
      background: "#201319",
      surface: "#2C1C23",
      surfaceMuted: "#3E2631",
      primary: "#E99AB8",
      primaryPressed: "#F0B1C7",
      primarySoft: "#4A2937",
      border: "#5C3544",
      income: "#82C5C6",
      info: "#AAA6E6",
      chart: [
        "#E99AB8",
        "#EFA6BD",
        "#F2B0BC",
        "#EFB39F",
        "#DCA3D0",
        "#AAA6E6",
        "#82C5C6",
        "#AFC781",
      ],
    },
  },
  slate: {
    light: {
      ...sharedLight,
      background: "#F3F5F6",
      surfaceMuted: "#EAF0F3",
      primary: "#546775",
      primaryPressed: "#3C505F",
      primarySoft: "#E1E8EC",
      border: "#D9E1E5",
      income: "#3D7B68",
      info: "#4F6878",
      chart: [
        "#4F6878",
        "#647E8E",
        "#7A8E99",
        "#92989A",
        "#9A7967",
        "#A45F55",
        "#7A749B",
        "#68866E",
      ],
    },
    dark: {
      ...sharedDark,
      background: "#11181C",
      surface: "#1B252A",
      surfaceMuted: "#26343B",
      primary: "#A7C0D1",
      primaryPressed: "#BDD0DC",
      primarySoft: "#30414A",
      border: "#3D505A",
      income: "#A6C2AA",
      info: "#A7C0D1",
      chart: [
        "#A7C0D1",
        "#B5CCD8",
        "#C4D1D6",
        "#D0D2CF",
        "#D1AD99",
        "#DF9B91",
        "#B9ADD3",
        "#A6C2AA",
      ],
    },
  },
};

export type ThemeMode = "system" | "light" | "dark";
type ThemePreference = { palette: PaletteName; mode: ThemeMode };
const ThemeContext = createContext<ThemePreference>({
  palette: "forest",
  mode: "system",
});

export function AppThemeProvider({
  palette,
  mode = "system",
  children,
}: PropsWithChildren<{ palette: PaletteName; mode?: ThemeMode }>) {
  return createElement(
    ThemeContext.Provider,
    { value: { palette, mode } },
    children,
  );
}

export function useResolvedThemeMode(): "light" | "dark" {
  const { mode } = useContext(ThemeContext);
  const system = useColorScheme();
  return mode === "system" ? (system === "dark" ? "dark" : "light") : mode;
}

export function useAppTheme(): AppColors {
  const { palette } = useContext(ThemeContext);
  return palettes[palette][useResolvedThemeMode()];
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
