import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material'

type FullscreenLoaderProps = {
  label?: string
}

export function FullscreenLoader({ label }: FullscreenLoaderProps) {
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        bgcolor: 'background.default',
        p: 3,
      }}
    >
      <Stack spacing={2} sx={{ alignItems: 'center' }}>
        <CircularProgress />
        {label && <Typography color="text.secondary">{label}</Typography>}
      </Stack>
    </Box>
  )
}

type FullscreenErrorProps = {
  message: string
  onRetry: () => void
}

// Portal 只有一個畫面，所以沒有「回登入頁」這個去處（demo 有，因為它分了
// /login 與 /dashboard 兩頁）——重試就是重新發起授權。
export function FullscreenError({ message, onRetry }: FullscreenErrorProps) {
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        bgcolor: 'background.default',
        p: 3,
      }}
    >
      <Stack spacing={2} sx={{ alignItems: 'center', maxWidth: 420, textAlign: 'center' }}>
        <Alert severity="error" sx={{ width: '100%' }}>
          {message}
        </Alert>
        <Stack direction="row" spacing={1.5}>
          <Button variant="contained" onClick={onRetry}>
            重試
          </Button>
        </Stack>
      </Stack>
    </Box>
  )
}
