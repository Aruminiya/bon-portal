import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

// 沒有帶合法 redirect_uri 進來時的預設落地頁（例如使用者直接開 Portal 網址登入，
// 不是從其他服務被導過來的）。
export default function LoginSuccessPage() {
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
      <Typography variant="h6" component="h1" sx={{ fontWeight: 600 }}>
        登入成功
      </Typography>
      <Typography variant="body2" color="text.secondary">
        請從公司服務入口進入你要使用的系統。
      </Typography>
    </Box>
  );
}
