import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from 'react-oidc-context'
import { CssBaseline, ThemeProvider } from '@mui/material'

import { oidcConfig } from './config/oidc'
import { theme } from './theme'
import App from './App.tsx'

// Portal 只有首頁一個畫面，所以沒有裝 router。nginx 的 try_files 會讓任何路徑
// 都回傳 index.html（見 nginx.conf），這兩行負責把網址列收回 "/"，效果等同
// router 的 catch-all route，但不用為此多一個相依。
//
// 必須在 AuthProvider 掛載之前跑完：Authentik 導回來時落在 "/" 且帶著
// ?code=&state=，pathname 正好是 "/"，所以這段不會動到它。
if (window.location.pathname !== '/') {
  window.history.replaceState({}, '', `/${window.location.search}${window.location.hash}`)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider {...oidcConfig}>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
