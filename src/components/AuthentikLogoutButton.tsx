import { useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { Button, CircularProgress, Stack, Typography } from '@mui/material'

import { postLogoutRedirectUri } from '../config/oidc'

export function AuthentikLogoutButton() {
  const auth = useAuth()
  const [error, setError] = useState<string | null>(null)

  const loading = auth.activeNavigator === 'signoutRedirect'

  const handleClick = async () => {
    setError(null)
    try {
      // signoutRedirect() 內部依序做三件事：取 user 的 id_token 當 id_token_hint、
      // removeUser()、才導向 end-session。順序正是我們要的 —— 特別是 removeUser()
      // 發生在導向之前：登出會帶 post_logout_redirect_uri 回到 Portal，本機 user
      // 還留著的話，使用者回來會看到「已登入」，但 Authentik 的 SSO session 其實
      // 已經結束了，那是一個會誤導人的假狀態。
      //
      // id_token_hint 不能省：Authentik 只有搭配它才接受 post_logout_redirect_uri
      // （OIDC 規範規定，否則任何人光憑公開的 client_id 就能亂指定登出後的導向）。
      await auth.signoutRedirect({ post_logout_redirect_uri: postLogoutRedirectUri })
    } catch (e) {
      setError(e instanceof Error ? e.message : '無法連線到登出伺服器')
    }
  }

  return (
    <Stack spacing={1}>
      <Button
        variant="outlined"
        onClick={handleClick}
        disabled={loading}
        startIcon={loading ? <CircularProgress size={16} /> : undefined}
      >
        登出
      </Button>
      {error && (
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      )}
    </Stack>
  )
}
