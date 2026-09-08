"use client";

import { useSyncExternalStore } from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { AuthentikLoginButton } from "@/components/AuthentikLoginButton";
import { AuthentikLogoutButton } from "@/components/AuthentikLogoutButton";
import { getRememberedIdToken, subscribeToAuthSession } from "@/lib/authentik";

export function NavBar() {
  // 登入狀態只存在瀏覽器的 sessionStorage 裡（見 lib/authentik.ts），伺服器端預渲染時
  // 讀不到，所以第三個參數（伺服器端／hydration 用的快照）回傳 undefined 代表「還不知道」。
  // 這個「未知」狀態必須跟「已確定沒登入」分開：直接預設成沒登入的話，已登入的使用者
  // 會先閃一下「登入」按鈕才換成「登出」。
  const idToken = useSyncExternalStore<string | null | undefined>(
    subscribeToAuthSession,
    getRememberedIdToken,
    () => undefined,
  );

  return (
    <AppBar
      position="static"
      color="transparent"
      elevation={0}
      sx={{ borderBottom: "1px solid", borderColor: "divider" }}
    >
      <Toolbar sx={{ maxWidth: 960, mx: "auto", width: "100%" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexGrow: 1 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              bgcolor: "primary.main",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography variant="body2" sx={{ color: "white", fontWeight: 700 }}>
              B
            </Typography>
          </Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Bon Portal
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
          {/* 登入與登出是互斥的狀態，只渲染其中一顆；狀態還沒確定時兩顆都不渲染。 */}
          {idToken === undefined ? null : idToken ? (
            <AuthentikLogoutButton />
          ) : (
            <AuthentikLoginButton />
          )}
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
