import { useAuth } from 'react-oidc-context'
import { AppBar, Box, Stack, Toolbar, Typography } from '@mui/material'

import { AuthentikLoginButton } from './AuthentikLoginButton'
import { AuthentikLogoutButton } from './AuthentikLogoutButton'

export function NavBar() {
  const auth = useAuth()

  return (
    <AppBar
      position="static"
      color="transparent"
      elevation={0}
      sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
    >
      <Toolbar sx={{ maxWidth: 960, mx: 'auto', width: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="body2" sx={{ color: 'white', fontWeight: 700 }}>
              B
            </Typography>
          </Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Bon Portal
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
          {/*
            三種狀態，不是兩種：「還在確認」必須跟「已確定沒登入」分開。
            直接把未確認當成沒登入的話，已登入的使用者會先閃一下「登入」
            按鈕才換成「登出」。狀態未定時兩顆都不渲染。
          */}
          {auth.isLoading ? null : auth.isAuthenticated ? (
            <AuthentikLogoutButton />
          ) : (
            <AuthentikLoginButton />
          )}
        </Stack>
      </Toolbar>
    </AppBar>
  )
}
