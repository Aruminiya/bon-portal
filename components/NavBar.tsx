"use client";

import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { AuthentikLoginButton } from "@/components/AuthentikLoginButton";
import { AuthentikLogoutButton } from "@/components/AuthentikLogoutButton";

export function NavBar() {
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
          <AuthentikLoginButton />
          <AuthentikLogoutButton />
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
