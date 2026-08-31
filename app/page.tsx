"use client";

import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { NavBar } from "@/components/NavBar";

const FEATURES = [
  {
    title: "單一入口",
    description: "一次登入，暢行公司所有內部系統，不用在每個服務裡各自登入一次。",
  },
  {
    title: "安全可靠",
    description: "身份驗證交給公司統一的 Authentik，登入流程走業界標準 OAuth + PKCE。",
  },
  {
    title: "快速存取",
    description: "登入完成後自動導回原本要用的系統，省去中間繁瑣的手動跳轉。",
  },
];

export default function Home() {
  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <NavBar />

      <Box
        component="main"
        sx={{
          flex: 1,
          background: "linear-gradient(160deg, #EAF3F8 0%, #FAFAFA 45%)",
        }}
      >
        <Stack
          spacing={3}
          sx={{
            alignItems: "center",
            textAlign: "center",
            maxWidth: 480,
            mx: "auto",
            px: 2,
            pt: { xs: 8, md: 12 },
            pb: 8,
          }}
        >
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              bgcolor: "primary.main",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 24px rgba(75, 122, 149, 0.35)",
            }}
          >
            <Typography variant="h5" sx={{ color: "white", fontWeight: 700 }}>
              B
            </Typography>
          </Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
            Bon Portal 服務入口
          </Typography>
          <Typography variant="body1" color="text.secondary">
            集中管理所有內部系統的登入，一次登入即可暢行公司內部服務。
          </Typography>
        </Stack>

        <Box sx={{ maxWidth: 960, mx: "auto", px: 2, pb: 10 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
            {FEATURES.map((feature) => (
              <Paper key={feature.title} variant="outlined" sx={{ flex: 1, p: 3, borderRadius: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  {feature.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {feature.description}
                </Typography>
              </Paper>
            ))}
          </Stack>
        </Box>
      </Box>

      <Box component="footer" sx={{ py: 3, textAlign: "center" }}>
        <Typography variant="caption" color="text.disabled">
          © {new Date().getFullYear()} Bon Portal
        </Typography>
      </Box>
    </Box>
  );
}
