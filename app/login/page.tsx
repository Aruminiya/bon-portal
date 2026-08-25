"use client";

import { useEffect } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { AuthentikLoginButton } from "@/components/AuthentikLoginButton";
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
      <AuthentikLoginButton />
    </Box>
  );
}
