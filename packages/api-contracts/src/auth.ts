import type { ApiScope } from "./scopes";

export type ApiUser = {
  id: string;
  email: string | null;
};

export type ApiSession = {
  user: ApiUser | null;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
};

export type RegisterRequest = {
  email: string;
  password: string;
};

export type RegisterResponse = {
  user: ApiUser | null;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  session: ApiSession | null;
};

export type LogoutResponse = {
  revoked: boolean;
};

export type RefreshResponse = {
  session: ApiSession | null;
};

export type SessionResponse = {
  session: ApiSession | null;
  user: ApiUser | null;
};

export type ApiKeyRecord = {
  id: string;
  name: string;
  scopes: ApiScope[];
  createdAt: string;
  revokedAt?: string;
};

export type ListApiKeysResponse = {
  apiKeys: ApiKeyRecord[];
};

export type CreateApiKeyRequest = {
  name?: string;
  scopes?: ApiScope[];
};

export type CreateApiKeyResponse = {
  apiKey: string | null;
  record: ApiKeyRecord | null;
};

export type RevokeApiKeyResponse = {
  revoked: boolean;
};