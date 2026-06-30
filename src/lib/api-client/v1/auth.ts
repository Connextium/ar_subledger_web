import type { Session, User } from "@supabase/supabase-js";

export const authApi = {
  async register() {
    return { user: null as User | null };
  },
  async login() {
    return { session: null as Session | null };
  },
  async logout() {
    return { revoked: true };
  },
  async refresh() {
    return { session: null as Session | null };
  },
  async getSession() {
    return { session: null as Session | null, user: null as User | null };
  },
  async listApiKeys() {
    return { apiKeys: [] };
  },
  async createApiKey() {
    return { apiKey: null, record: null };
  },
  async revokeApiKey() {
    return { revoked: true };
  },
};
