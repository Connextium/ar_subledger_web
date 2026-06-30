export type ApiKeyRecord = {
  id: string;
  name: string;
  scopes: string[];
  createdAt: string;
  revokedAt?: string;
};

export class ApiKeyService {
  async createApiKey() {
    return {
      apiKey: `ars_${crypto.randomUUID().replaceAll("-", "")}`,
      record: { id: crypto.randomUUID(), name: "API key", scopes: [], createdAt: new Date().toISOString() },
    };
  }

  async listApiKeys(): Promise<ApiKeyRecord[]> {
    return [];
  }

  async revokeApiKey(keyId: string) {
    return { keyId, revoked: true };
  }

  async authenticateApiKey() {
    return null;
  }
}

export const apiKeyService = new ApiKeyService();
