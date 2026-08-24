import { createTheme } from "@mui/material/styles";

// 色票取自 Bonvies 內部 theme package（不同 repo、非同一個 workspace，
// 所以直接複製色值而非加套件依賴）：
// Bonsale/code/bonvies/packages/theme/src/bonvies/index.ts
export const theme = createTheme({
  typography: {
    fontFamily:
      "var(--font-geist-sans), Roboto, 'Noto Sans TC', Arial, Helvetica, sans-serif",
  },
  palette: {
    primary: {
      main: "#7BA9C6",
      light: "#9FC1D6",
      dark: "#4B7A95",
    },
    secondary: {
      main: "#89D0DF",
      light: "#BCFFFF",
      dark: "#579FAD",
    },
    error: {
      main: "#FF4D4D",
      light: "#FF8279",
      dark: "#C50024",
    },
    warning: {
      main: "#F2C055",
      light: "#FFF285",
      dark: "#BC9024",
    },
    info: {
      main: "#6CC0C0",
      light: "#90D0D0",
      dark: "#4BAFAF",
    },
    success: {
      main: "#70DCAD",
      light: "#A4FFDF",
      dark: "#3BA97D",
    },
    text: {
      primary: "rgba(0,0,0,0.8)",
      secondary: "rgba(0,0,0,0.6)",
      disabled: "rgba(0,0,0,0.38)",
    },
    background: {
      default: "#FAFAFA",
      paper: "#FFFFFF",
    },
  },
});
