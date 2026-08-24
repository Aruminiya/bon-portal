"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { usePasswordLogin } from "@/lib/ssoApi";
import { completeLoginWithToken } from "@/lib/redirect";

export function PasswordLoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { trigger, isMutating, error } = usePasswordLogin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { token } = await trigger({ username, password });
      completeLoginWithToken(token);
    } catch {
      // 錯誤訊息已經在 error 裡，交給下面顯示
    }
  };

  return (
    <Stack component="form" spacing={2} onSubmit={handleSubmit}>
      <TextField
        label="帳號"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoComplete="username"
        size="small"
        fullWidth
      />
      <TextField
        label="密碼"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        size="small"
        fullWidth
      />
      {error && (
        <Typography variant="body2" color="error">
          {error.message}
        </Typography>
      )}
      <Button
        type="submit"
        variant="contained"
        disabled={isMutating || !username || !password}
      >
        登入
      </Button>
    </Stack>
  );
}
