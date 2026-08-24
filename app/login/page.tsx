"use client";

import { useEffect } from "react";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { MicrosoftLoginButton } from "@/components/MicrosoftLoginButton";
import { GoogleLoginButton } from "@/components/GoogleLoginButton";
import { PasswordLoginForm } from "@/components/PasswordLoginForm";
import { capturePendingRedirect } from "@/lib/redirect";

export default function LoginPage() {
  useEffect(() => {
    capturePendingRedirect(window.location.search.slice(1));
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
        justifyContent: "center",
        gap: 4,
        px: 2,
      }}
    >
      <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
        登入
      </Typography>
      <Stack spacing={1.5}>
        <MicrosoftLoginButton />
        <GoogleLoginButton />
      </Stack>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <Divider sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.disabled">
          或
        </Typography>
        <Divider sx={{ flex: 1 }} />
      </Stack>
      <PasswordLoginForm />
    </Box>
  );
}
