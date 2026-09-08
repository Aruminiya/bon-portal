// 跟 Authentik（自架的 OIDC provider，取代原本的 Microsoft/Google/帳密登入）溝通的邏輯。
//
// 這是純前端、沒有 client secret 的 Public client，走標準 OAuth Authorization Code +
// PKCE（RFC 7636）：不需要後端保管密鑰，code_verifier/state 存在 sessionStorage，
// 回調時比對、換 token 都在瀏覽器端直接打 Authentik 完成。

import { createPkcePair, randomString } from "@/lib/pkce";

function requiredEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} 未設定，請在 .env.local 內指定`);
  }
  return value;
}

const AUTHORIZATION_ENDPOINT = requiredEnv(
  "NEXT_PUBLIC_AUTHENTIK_AUTHORIZATION_ENDPOINT",
  process.env.NEXT_PUBLIC_AUTHENTIK_AUTHORIZATION_ENDPOINT,
);
const TOKEN_ENDPOINT = requiredEnv(
  "NEXT_PUBLIC_AUTHENTIK_TOKEN_ENDPOINT",
  process.env.NEXT_PUBLIC_AUTHENTIK_TOKEN_ENDPOINT,
);
const CLIENT_ID = requiredEnv(
  "NEXT_PUBLIC_AUTHENTIK_CLIENT_ID",
  process.env.NEXT_PUBLIC_AUTHENTIK_CLIENT_ID,
);

// 結束 Authentik SSO session 用的 end session endpoint。跟前三個不同，這個故意不用
// requiredEnv：沒設定的話只代表「登出功能還沒接上」，不該讓整個 App（包含登入）掛掉。
const END_SESSION_ENDPOINT = process.env.NEXT_PUBLIC_AUTHENTIK_END_SESSION_ENDPOINT;

const CALLBACK_PATH = "/auth/authentik/callback";
const STATE_STORAGE_KEY = "authentik_state";
const CODE_VERIFIER_STORAGE_KEY = "authentik_code_verifier";
const LAST_ID_TOKEN_STORAGE_KEY = "authentik_last_id_token";

function callbackRedirectUri(): string {
  return `${window.location.origin}${CALLBACK_PATH}`;
}

// 登入頁按下按鈕時呼叫：產生 PKCE 參數跟 state 存起來，再整頁導向 Authentik 的授權頁面。
export async function startAuthentikLogin() {
  const { codeVerifier, codeChallenge } = await createPkcePair();
  const state = randomString(16);

  sessionStorage.setItem(STATE_STORAGE_KEY, state);
  sessionStorage.setItem(CODE_VERIFIER_STORAGE_KEY, codeVerifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: callbackRedirectUri(),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  // 這裡要整頁導去外部的 Authentik 授權頁面（不同網域），不是站內路由，所以用
  // window.location 而非 next/navigation；AUTHORIZATION_ENDPOINT 本身是完整絕對網址。
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = `${AUTHORIZATION_ENDPOINT}?${params.toString()}`;
}

// /auth/authentik/callback 頁面呼叫：驗證 state、用 code_verifier 跟 code 換 id_token。
export async function completeAuthentikLogin(code: string, state: string): Promise<string> {
  const expectedState = sessionStorage.getItem(STATE_STORAGE_KEY);
  const codeVerifier = sessionStorage.getItem(CODE_VERIFIER_STORAGE_KEY);
  sessionStorage.removeItem(STATE_STORAGE_KEY);
  sessionStorage.removeItem(CODE_VERIFIER_STORAGE_KEY);

  if (!expectedState || state !== expectedState || !codeVerifier) {
    throw new Error("登入驗證失敗，請重新登入一次");
  }

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackRedirectUri(),
      client_id: CLIENT_ID,
      code_verifier: codeVerifier,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error_description ?? data?.error ?? `HTTP ${res.status}`);
  }
  return data.id_token as string;
}

export function isAuthentikLogoutConfigured(): boolean {
  return Boolean(END_SESSION_ENDPOINT);
}

// NavBar 要靠「這個分頁有沒有登入過」來決定顯示登入還是登出按鈕，但 sessionStorage 不是
// React state，寫進去不會觸發重新渲染。這裡包一層最小的訂閱機制，讓 UI 能用
// useSyncExternalStore 訂閱它，而不用把 token 提升成 React state（那反而會讓憑證多待在
// 記憶體裡的一份 copy）。
const sessionListeners = new Set<() => void>();

export function subscribeToAuthSession(listener: () => void): () => void {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

function notifyAuthSessionChange() {
  for (const listener of sessionListeners) {
    listener();
  }
}

// 只回傳原始字串，不解析也不驗證：存進去之前 /login/success 已經用
// decodeAndVerifyIdToken 驗過格式與 audience，UI 只需要知道「有沒有」。
//
// 特別是刻意不檢查 exp：id_token 只有 5 分鐘壽命，但 Authentik 那邊的 SSO session
// 活得久得多，而 end-session 端點驗 id_token_hint 時本來就會關掉 exp 檢查
// （「登出請求晚於 token 過期仍然合法」）。拿 exp 當登入狀態會讓登出按鈕在登入
// 五分鐘後自己消失，那是錯的。
export function getRememberedIdToken(): string | null {
  return sessionStorage.getItem(LAST_ID_TOKEN_STORAGE_KEY);
}

// /login/success 頁驗證完 id_token 後呼叫：Portal 平常不保留 id_token（見檔案開頭說明），
// 但沒有它就沒辦法在登出時帶 id_token_hint，Authentik 會拒絕帶 post_logout_redirect_uri
// 的登出請求（見 startAuthentikLogout 的說明），導致登出後沒辦法自動導回 Portal。
// 這裡只在使用者「直接開 Portal 登入」（沒有 redirect_uri 導去其他服務）這個情境下，
// 用 sessionStorage 換取「登出能自動導回」——同分頁分頁關閉就會清掉，不是長期保存。
export function rememberIdTokenForLogout(idToken: string) {
  sessionStorage.setItem(LAST_ID_TOKEN_STORAGE_KEY, idToken);
  notifyAuthSessionChange();
}

// NavBar 的登出按鈕呼叫：「登出」實際上是結束使用者在 Authentik 那邊的 SSO session，
// 讓其他服務下次導回本 Portal 時不會直接沿用舊 session 靜默登入。
//
// post_logout_redirect_uri 只有搭配 id_token_hint 才會被 Authentik 接受（OIDC 規範規定，
// 否則任何人光憑公開的 client_id 就能亂指定登出後的導向網址）。有暫存到 id_token
// （見 rememberIdTokenForLogout）就帶上兩者、登出後自動導回 Portal；沒有的話（例如是從
// 其他服務轉來的登入、token 早就轉交出去了）就只結束 session，停在 Authentik 自己的
// 「已登出」頁面。
//
// 注意：Authentik 對 post_logout_redirect_uri 是「字串完全比對」（Provider 的 Redirect URIs
// 裡 type=logout、matching mode=strict 的那筆），連結尾斜線都算不同。這裡刻意用不帶尾斜線的
// window.location.origin，Authentik 那邊就要註冊成一模一樣的值（例如 http://localhost:6174），
// 否則登出會被擋成 Bad Request（invalid_request）。
export function startAuthentikLogout() {
  if (!END_SESSION_ENDPOINT) {
    throw new Error("尚未設定登出端點");
  }

  const idTokenHint = sessionStorage.getItem(LAST_ID_TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(LAST_ID_TOKEN_STORAGE_KEY);
  notifyAuthSessionChange();

  const params = new URLSearchParams({ client_id: CLIENT_ID });
  if (idTokenHint) {
    params.set("id_token_hint", idTokenHint);
    params.set("post_logout_redirect_uri", window.location.origin);
  }

  const endSession = new URL(END_SESSION_ENDPOINT);
  endSession.search = params.toString();

  // 繞過 Authentik 的一個 bug：它的 EndSessionView.dispatch 只要發現 session 裡還留著
  // 未完成的 flow plan（session key `authentik/flows/plan`），就直接回一個 body 全空的
  // HTTP 200 —— 使用者看到的是一片白畫面，而且根本沒登出。那個早退原本只是要處理
  // front-channel logout 的 iframe 請求，卻沒有判斷請求是不是來自 iframe，所以連正常的
  // 整頁導覽也一起誤傷。
  //
  // 而殘留幾乎是必然發生的：invalidation flow 最後的 SessionEndStage 是用「redirect
  // challenge」收尾，瀏覽器直接跳走、不會把結果回報給 flow executor，於是負責清掉 plan
  // 的 executor.cancel() 永遠不會被呼叫；接下來的登入又會用 cycle_key 把這筆殘留一起
  // 帶到新 session。也就是「登出過一次（任何一個 App 都算），下一次登出就白畫面」。
  //
  // 所以先繞去 Authentik 的 CancelView，它會刪掉那個 session key 再導向 next（只接受
  // 相對路徑，剛好 end-session 就在同一個 host 上），等於每次登出前都先把地雷清乾淨。
  const logoutUrl = new URL("/flows/-/cancel/", endSession);
  logoutUrl.searchParams.set("next", `${endSession.pathname}${endSession.search}`);

  // 導去外部的 Authentik 網域，不是站內路由，所以用 window.location。
  window.location.href = logoutUrl.toString();
}

export type AuthentikIdTokenClaims = {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  aud: string | string[];
  exp: number;
  [claim: string]: unknown;
};

function base64UrlDecode(segment: string): string {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
  const withPadding = padded + "=".repeat((4 - (padded.length % 4)) % 4);
  return decodeURIComponent(
    atob(withPadding)
      .split("")
      .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join(""),
  );
}

// 檢查 id_token 的格式、有效期、audience 是不是發給這個 client 的。故意不驗簽章：
// 這個 token 是我們自己剛剛直接跟 Authentik 的 token endpoint 換來的（HTTPS 直連，
// 不是從別處轉交過來的），驗簽章是給「收到別人轉交的 token」的下游服務做的事。
export function decodeAndVerifyIdToken(idToken: string): AuthentikIdTokenClaims {
  const segments = idToken.split(".");
  if (segments.length !== 3) {
    throw new Error("id_token 格式不正確");
  }

  let claims: AuthentikIdTokenClaims;
  try {
    claims = JSON.parse(base64UrlDecode(segments[1]));
  } catch {
    throw new Error("id_token 格式不正確");
  }

  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(CLIENT_ID)) {
    throw new Error("id_token 的 audience 不是這個應用程式");
  }

  if (typeof claims.exp !== "number" || claims.exp * 1000 <= Date.now()) {
    throw new Error("id_token 已過期，請重新登入一次");
  }

  return claims;
}
