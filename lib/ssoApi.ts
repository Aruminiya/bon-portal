// 呼叫既有 SSO 後端（/auth/microsoft/login、/auth/microsoft/callback、
// /auth/google/login、/auth/google/callback，以及公司自建帳密登入 endpoint——
// 規格待補，見下方 usePasswordLogin）的 hooks。
//
// 這些 API 都是使用者操作觸發（點按鈕、OAuth 回調一次性交換），不是進頁面就要
// 自動讀取並保持最新的資料，所以統一用 useSWRMutation 的 trigger() 模式，
// 而不是 useSWR 的自動抓取 + revalidate（跟公司主要產品 bonvies 的慣例一致）。

import useSWRMutation from "swr/mutation";
import { fetcher, sendRequest } from "@/lib/fetcher";

export type OAuthLoginStart = {
  authUrl: string;
  state: string;
};

export function useMicrosoftLoginUrl() {
  return useSWRMutation<OAuthLoginStart>("/auth/microsoft/login", (key: string) =>
    fetcher(key),
  );
}

export function useMicrosoftCallbackExchange() {
  return useSWRMutation<{ token: string }, Error, string, { code: string; state: string }>(
    "/auth/microsoft/callback",
    sendRequest("POST"),
  );
}

export function useGoogleLoginUrl() {
  return useSWRMutation<OAuthLoginStart>("/auth/google/login", (key: string) => fetcher(key));
}

export function useGoogleCallbackExchange() {
  return useSWRMutation<{ token: string }, Error, string, { code: string; state: string }>(
    "/auth/google/callback",
    sendRequest("POST"),
  );
}

// TODO：公司自建帳密登入的 endpoint 規格待確認後補上實際路徑與 request/response 格式。
// 目前先假設最常見的形狀，取得規格後請更新這裡（同時檢查 error 欄位格式是否與 Microsoft 流程一致，
// 好讓 PasswordLoginForm 能用同一套方式顯示錯誤訊息）。
export function usePasswordLogin() {
  return useSWRMutation<{ token: string }, Error, string, { username: string; password: string }>(
    "/auth/login",
    sendRequest("POST"),
  );
}
