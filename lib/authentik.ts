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

const CALLBACK_PATH = "/auth/authentik/callback";
const STATE_STORAGE_KEY = "authentik_state";
const CODE_VERIFIER_STORAGE_KEY = "authentik_code_verifier";

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
