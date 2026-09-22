import { useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { Button, CircularProgress, Stack, Typography } from '@mui/material'

export function AuthentikLoginButton() {
  const auth = useAuth()
  const [error, setError] = useState<string | null>(null)

  // auth.activeNavigator 在導向 Authentik 的期間為真；用它而不是自己的 state，
  // 這樣重新整理或多顆按鈕同時存在時狀態才一致。
  const loading = auth.activeNavigator === 'signinRedirect'

  const handleClick = async () => {
    setError(null)
    try {
      await auth.signinRedirect()
    } catch (e) {
      setError(e instanceof Error ? e.message : '無法連線到登入伺服器')
    }
  }

  return (
    <Stack spacing={1}>
      <Button
        variant="contained"
        onClick={handleClick}
        disabled={loading}
        startIcon={loading ? <CircularProgress size={16} /> : undefined}
      >
        登入
      </Button>
      {error && (
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      )}
    </Stack>
  )
}
