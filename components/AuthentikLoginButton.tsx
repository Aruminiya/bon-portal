"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { startAuthentikLogin } from "@/lib/authentik";

export function AuthentikLoginButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      await startAuthentikLogin();
    } catch (e) {
      setError(e instanceof Error ? e.message : "無法連線到登入伺服器");
      setLoading(false);
    }
  };

  return (
    <Stack spacing={1}>
      <Button
        variant="contained"
        onClick={handleClick}
        disabled={loading}
        startIcon={loading ? <CircularProgress size={16} /> : undefined}
      >
        使用公司帳號登入
      </Button>
      {error && (
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      )}
    </Stack>
  );
}
