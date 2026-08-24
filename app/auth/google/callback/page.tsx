"use client";

import { OAuthCallbackHandler } from "@/components/OAuthCallbackHandler";
import { useGoogleCallbackExchange } from "@/lib/ssoApi";

export default function GoogleCallbackPage() {
  const { trigger } = useGoogleCallbackExchange();
  return <OAuthCallbackHandler trigger={trigger} />;
}
