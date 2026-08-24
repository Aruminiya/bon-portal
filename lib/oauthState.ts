// OAuth 授權碼流程用的 CSRF state 存取，Microsoft、Google 共用同一套邏輯：
// 發起登入時把後端給的 state 存起來，回調時比對網址上的 state 是否一致，
// 不一致（或根本沒存過）就視為驗證失敗，避免 CSRF 攻擊或使用者直接打開舊的回調網址。

const STATE_STORAGE_KEY = "sso_state";

export function storeOAuthState(state: string) {
  sessionStorage.setItem(STATE_STORAGE_KEY, state);
}

export function verifyAndConsumeOAuthState(state: string | null): boolean {
  const expectedState = sessionStorage.getItem(STATE_STORAGE_KEY);
  sessionStorage.removeItem(STATE_STORAGE_KEY);
  return Boolean(state && expectedState && state === expectedState);
}
