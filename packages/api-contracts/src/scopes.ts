export type ApiActorRole = "buyer" | "supplier" | "factor" | "facilitator" | "platform";

export type ApiScope =
  | "auth:session"
  | "auth:register"
  | "auth:api-keys:read"
  | "auth:api-keys:write"
  | "buyer:read"
  | "buyer:write"
  | "buyer:payments:write"
  | "buyer:delegates:write"
  | "supplier:read"
  | "supplier:write"
  | "supplier:settlements:write"
  | "factor:read"
  | "factor:notes:write"
  | "facilitator:read"
  | "facilitator:routes:write"
  | "facilitator:documents:write"
  | "facilitator:executions:write"
  | "platform:read"
  | "platform:write"
  | "members:read"
  | "members:write"
  | "wallets:read"
  | "wallets:write"
  | "wallets:export"
  | "api-clients:read"
  | "api-clients:write"
  | "audit:read"
  | "webhooks:read"
  | "webhooks:write";

export type ApiAuthMode = "supabase_jwt" | "api_key";

export type ApiAuthContext = {
  subjectId: string;
  workspaceId?: string;
  actorRole: ApiActorRole;
  scopes: ApiScope[];
  authMode: ApiAuthMode;
};