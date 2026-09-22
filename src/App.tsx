import { useAuth } from 'react-oidc-context'
import { Box, Link, Paper, Stack, Typography } from '@mui/material'

import { FullscreenError, FullscreenLoader } from './components/FullscreenState'
import { NavBar } from './components/NavBar'
import { AuthentikLoginButton } from './components/AuthentikLoginButton'
import { getPortalProducts } from './utils/portalProducts'

function ProductList() {
  const products = getPortalProducts()

  if (products.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
        尚未設定任何服務。請在建置時以 VITE_PORTAL_PRODUCTS 填入服務網址。
      </Typography>
    )
  }

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
      {products.map((product) => (
        <Paper key={product.url} variant="outlined" sx={{ flex: 1, borderRadius: 2 }}>
          {/*
            刻意是同分頁的普通連結：
            - 不用 target="_blank"——這是「進入某個服務」，不是開附件。
            - 不用 iframe——Authentik 的 Django 有 XFrameOptionsMiddleware，
              X-Frame-Options: DENY，任何 iframe 都會空白，不分同不同網域。
            - 不附加任何參數——URL 就是服務的入口路徑本身，憑證不經過 Portal，
              由該服務自己跑一次 OIDC 補完登入（瀏覽器已經有 authentik_session
              cookie，所以不會再問一次密碼）。
          */}
          <Link
            href={product.url}
            underline="none"
            sx={{
              display: 'block',
              p: 3,
              color: 'text.primary',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {product.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {product.url}
            </Typography>
          </Link>
        </Paper>
      ))}
    </Stack>
  )
}

export default function App() {
  const auth = useAuth()

  if (auth.isLoading) {
    return <FullscreenLoader label="確認登入狀態中..." />
  }

  if (auth.error) {
    return (
      <FullscreenError
        message={auth.error.message}
        onRetry={() => void auth.signinRedirect()}
      />
    )
  }

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <NavBar />

      <Box
        component="main"
        sx={{
          flex: 1,
          background: 'linear-gradient(160deg, #EAF3F8 0%, #FAFAFA 45%)',
        }}
      >
        <Stack
          spacing={3}
          sx={{
            alignItems: 'center',
            textAlign: 'center',
            maxWidth: 480,
            mx: 'auto',
            px: 2,
            pt: { xs: 8, md: 12 },
            pb: 8,
          }}
        >
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(75, 122, 149, 0.35)',
            }}
          >
            <Typography variant="h5" sx={{ color: 'white', fontWeight: 700 }}>
              B
            </Typography>
          </Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
            Bon Portal 服務入口
          </Typography>
          <Typography variant="body1" color="text.secondary">
            集中管理所有內部系統的登入,一次登入即可暢行公司內部服務。
          </Typography>
          {!auth.isAuthenticated && <AuthentikLoginButton />}
        </Stack>

        <Box sx={{ maxWidth: 960, mx: 'auto', px: 2, pb: 10 }}>
          {auth.isAuthenticated && <ProductList />}
        </Box>
      </Box>

      <Box component="footer" sx={{ py: 3, textAlign: 'center' }}>
        <Typography variant="caption" color="text.disabled">
          © {new Date().getFullYear()} Bon Portal
        </Typography>
      </Box>
    </Box>
  )
}
