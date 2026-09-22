import type { AuthProviderNoUserManagerProps } from 'react-oidc-context'

export const oidcConfig: AuthProviderNoUserManagerProps = {
  // authority 一個值就夠 —— 授權、換 token、end-session 這些 endpoint 全部由
  // <authority>/.well-known/openid-configuration 取得，不用逐一設定，也就不會
  // 有「三個 endpoint 各自指到不同地方」這種設定漂移。
  authority: import.meta.env.VITE_AUTHENTIK_AUTHORITY,
  client_id: import.meta.env.VITE_AUTHENTIK_CLIENT_ID,
  redirect_uri: import.meta.env.VITE_AUTHENTIK_REDIRECT_URI,

  // offline_access 不是裝飾：少了它拿不到 refresh token，automaticSilentRenew
  // 會退回隱藏 iframe + prompt=none，而 authentik_session 是第三方 cookie ——
  // 本機 same-site 能跑，上雲一定被瀏覽器擋。
  // Authentik 會「靜默」把未設定的 scope 從請求裡交集掉，不報錯，所以本機正常
  // 不能當作通過，要以 discovery 的 scopes_supported 驗。
  //
  // 對 Portal 還有第二個理由：react-oidc-context 的 isAuthenticated 定義是
  // `user && !user.expired`，access token 一過期（預設 5 分鐘）就變 false，
  // 登出按鈕會跟著消失 —— 使用者就做不了 SLO 了。
  // products 是自訂的 scope（Authentik 端的 Scope Mapping），回傳這個使用者被
  // 授權的產品清單，已經歸納到產品層級 —— 細項權限（bonsale:admin 之類）在
  // Authentik 那邊就收斂掉了，Portal 不需要、也不該拿到整包 groups。
  scope: 'openid profile email offline_access products',

  automaticSilentRenew: true,

  // 換完 token 之後把 ?code=&state= 從網址清掉（授權碼單次有效，留在網址上
  // 只會讓使用者重新整理時重送同一組 code）。nonce 由 oidc-client-ts 自動
  // 產生與驗證，不用自己處理。
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname)
  },
}

// Authentik 對 post_logout_redirect_uri 是「字串完全比對」，連結尾斜線都算
// 不同。這裡跟 redirect_uri 一樣統一成帶尾斜線的首頁。
export const postLogoutRedirectUri: string =
  import.meta.env.VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI || `${window.location.origin}/`
