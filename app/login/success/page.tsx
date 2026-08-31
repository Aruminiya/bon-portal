"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import { decodeAndVerifyIdToken } from "@/lib/authentik";

type VerifyState =
  | { status: "checking" }
  | { status: "ok"; label: string }
  | { status: "error"; message: string };

// 沒有帶合法 redirect_uri 進來時的預設落地頁（例如使用者直接開 Portal 網址登入，
// 不是從其他服務被導過來的）。實際解出網址上的 token 並驗證格式/有效期/audience，
// 不是單純顯示一句「登入成功」——沒有拿到有效 token 就必須顯示失敗，不能假裝成功。
export default function LoginSuccessPage() {
  const [state, setState] = useState<VerifyState>({ status: "checking" });
  // 讀完 hash 就會清掉網址，這個動作不是 idempotent 的：React StrictMode/開發模式
  // 會讓 effect 觸發兩次，第二次執行時 hash 已經被清空，會誤判成「找不到憑證」
  // 蓋掉第一次的正確結果，所以要用 ref 擋掉重複呼叫（跟兩個 OAuth callback 頁一樣）。
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    // 這裡故意在 effect 裡同步 setState：這頁會被靜態預渲染（build 時沒有 window），
    // 必須先渲染出「確認登入狀態中」這個佔位畫面跟伺服器端渲染結果一致，
    // 再由 effect 在瀏覽器端讀 window.location.hash 更新成實際結果，
    // 不能在 render 階段直接算，否則會跟預渲染出來的 HTML 對不上（hydration mismatch）。
    const hash = window.location.hash.slice(1);
    // 拿到後立刻把 token 從網址列清掉，避免留在瀏覽器歷史紀錄裡
    window.history.replaceState({}, "", window.location.pathname);

    const token = new URLSearchParams(hash).get("token");
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ status: "error", message: "找不到登入憑證，請重新登入一次" });
      return;
    }

    try {
      const claims = decodeAndVerifyIdToken(token);
      const label = claims.email ?? claims.preferred_username ?? claims.name ?? claims.sub;
      setState({ status: "ok", label: String(label) });
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "登入驗證失敗，請重新登入一次",
      });
    }
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
        gap: 1,
        px: 2,
        textAlign: "center",
      }}
    >
      {state.status === "checking" && (
        <Typography variant="body2" color="text.secondary">
          確認登入狀態中...
        </Typography>
      )}

      {state.status === "ok" && (
        <>
          <Typography variant="h6" component="h1" sx={{ fontWeight: 600 }}>
            登入成功
          </Typography>
          <Typography variant="body2" color="text.secondary">
            已驗證為 {state.label}，請從公司服務入口進入你要使用的系統。
          </Typography>
        </>
      )}

      {state.status === "error" && (
        <>
          <Typography variant="h6" component="h1" sx={{ fontWeight: 600 }}>
            登入驗證失敗
          </Typography>
          <Typography variant="body2" color="error">
            {state.message}
          </Typography>
          <Link href="/login" variant="body2">
            回登入頁重新登入
          </Link>
        </>
      )}
    </Box>
  );
}
