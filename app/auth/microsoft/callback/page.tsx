"use client";

import { OAuthCallbackHandler } from "@/components/OAuthCallbackHandler";
import { useMicrosoftCallbackExchange } from "@/lib/ssoApi";

export default function MicrosoftCallbackPage() {
  const { trigger } = useMicrosoftCallbackExchange();
  return <OAuthCallbackHandler trigger={trigger} />;
}
