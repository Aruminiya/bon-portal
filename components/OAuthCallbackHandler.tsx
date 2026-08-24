"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import { completeLoginWithToken } from "@/lib/redirect";
import { verifyAndConsumeOAuthState } from "@/lib/oauthState";

type ExchangeTrigger = (arg: { code: string; state: string }) => Promise<{ token: string }>;

// Microsoft、Google 的 OAuth 回調頁邏輯完全一樣，只有兌換 token 的 API 不同，
// 所以共用這支元件，個別 provider 的 page.tsx 只負責帶入對應的 trigger。
export function OAuthCallbackHandler({ trigger }: { trigger: ExchangeTrigger }) {
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
      if (!code || !state || !verifyAndConsumeOAuthState(state)) {
        setError("登入驗證失敗，請重新登入一次");
        return;
      }

      try {
        const { token } = await trigger({ code, state });
        completeLoginWithToken(token);
      } catch (e) {
        setError(e instanceof Error ? e.message : "登入失敗，請重試");
      }
    }

    void run();
  }, [trigger]);

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
