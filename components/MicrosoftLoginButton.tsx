"use client";

import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useMicrosoftLoginUrl } from "@/lib/ssoApi";
import { storeOAuthState } from "@/lib/oauthState";

export function MicrosoftLoginButton() {
  const { trigger, isMutating, error } = useMicrosoftLoginUrl();

  const handleClick = async () => {
    const { authUrl, state } = await trigger();
    storeOAuthState(state);
    window.location.href = authUrl;
  };

  return (
    <Stack spacing={1}>
      <Button
        variant="outlined"
        onClick={handleClick}
        disabled={isMutating}
        startIcon={isMutating ? <CircularProgress size={16} /> : undefined}
      >
        使用 Microsoft 365 登入
      </Button>
      {error && (
        <Typography variant="body2" color="error">
          {error.message}
        </Typography>
      )}
    </Stack>
  );
}
