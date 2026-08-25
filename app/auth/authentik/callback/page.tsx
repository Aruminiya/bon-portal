"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import { completeAuthentikLogin } from "@/lib/authentik";
import { completeLoginWithToken } from "@/lib/redirect";

export default function AuthentikCallbackPage() {
  const [error, setError] = useState<string | null>(null);
  // code 只能兌換一次，React StrictMode/開發模式會讓 effect 觸發兩次，用 ref 擋掉重複呼叫
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    async function run() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const oauthError = params.get("error");

      // 把 code/state 從網址列清掉，避免使用者重新整理時重送同一組 code
      window.history.replaceState({}, "", window.location.pathname);

      if (oauthError) {
        setError("登入已取消或未同意授權");
        return;
      }
      if (!code || !state) {
        setError("登入驗證失敗，請重新登入一次");
        return;
      }

      try {
        const idToken = await completeAuthentikLogin(code, state);
        completeLoginWithToken(idToken);
      } catch (e) {
        setError(e instanceof Error ? e.message : "登入失敗，請重試");
      }
    }

    void run();
  }, []);

  return (
    <Box
      component="main"
      sx={{
        mx: "auto",
        display: "flex",
        minHeight: "100vh",
        maxWidth: 384,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        px: 2,
        textAlign: "center",
      }}
    >
      {error ? (
        <>
          <Typography variant="body2" color="error">
            {error}
          </Typography>
          <Link href="/login" variant="body2">
            回登入頁重新登入
          </Link>
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          登入處理中...
        </Typography>
      )}
    </Box>
  );
}
