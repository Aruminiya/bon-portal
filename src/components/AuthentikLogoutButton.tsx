import { useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { Button, CircularProgress, Stack, Typography } from '@mui/material'

import { postLogoutRedirectUri } from '../config/oidc'
import { signoutWithCancelBounce } from '../utils/authentikLogout'

export function AuthentikLogoutButton() {
  const auth = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setLoading(true)
    setError(null)
    try {
      // 順序有講究：
      // 1. id_token 必須在清掉 user 之前取出來，它是登出請求的 id_token_hint。
      // 2. removeUser() 不能省——登出會帶 post_logout_redirect_uri 導回 Portal，
      //    本機 user 還留著的話，使用者回來會看到「已登入」，但 Authentik 那邊的
      //    SSO session 其實已經結束了，那是一個會誤導人的假狀態。
      // 3. 這裡故意不用 auth.signoutRedirect()——原因見 signoutWithCancelBounce()
      //    （繞過 Authentik 登出白畫面的 bug）。
      const idTokenHint = auth.user?.id_token
      await auth.removeUser()
      await signoutWithCancelBounce(idTokenHint, postLogoutRedirectUri)
    } catch (e) {
      setError(e instanceof Error ? e.message : '無法連線到登出伺服器')
      setLoading(false)
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
