/// <reference types="vite/client" />

// Portal 的全部設定。這五個值在 **build 時**就被 Vite 換成字面值寫進產物，
// 不是執行時讀的 —— 所以一個 image 對應一個環境，換設定要重新 build
// （成本很低：build 不到一秒，而且在 Cloud Run 上改環境變數本來也要部署
// 一個新 revision，並沒有省掉那一步）。
//
// 本機開發由 .env 提供；build image 時由 Dockerfile 的 ARG 提供，
// .env 被 .dockerignore 擋在外面，不會誤把本機的 localhost 設定燒進正式版。
//
// 規則：一律用具名存取 `import.meta.env.VITE_XXX`，不要用動態 key
// （`import.meta.env[key]`）。具名存取 Vite 只會替換掉那一個值；動態存取
// 會讓它把「整個 env 物件」塞進 bundle，連你沒打算曝露的變數都會進去。
interface ImportMetaEnv {
  readonly VITE_AUTHENTIK_AUTHORITY: string
  readonly VITE_AUTHENTIK_CLIENT_ID: string
  readonly VITE_AUTHENTIK_REDIRECT_URI: string
  readonly VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI?: string
  readonly VITE_PORTAL_PRODUCTS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
