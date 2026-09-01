"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { isAuthentikLogoutConfigured, startAuthentikLogout } from "@/lib/authentik";

// 沒有設定 NEXT_PUBLIC_AUTHENTIK_END_SESSION_ENDPOINT 時，登出功能視為尚未接上，
// 這顆按鈕自己決定不渲染，呼叫端（NavBar）不需要重複判斷。
export function AuthentikLogoutButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAuthentikLogoutConfigured()) {
    return null;
  }

  const handleClick = () => {
    setLoading(true);
    setError(null);
    try {
      startAuthentikLogout();
    } catch (e) {
      setError(e instanceof Error ? e.message : "無法連線到登出伺服器");
      setLoading(false);
    }
  };

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
  );
}
