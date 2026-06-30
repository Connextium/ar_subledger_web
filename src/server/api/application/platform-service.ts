export class PlatformApiService {
  async getMe() {
    return { user: null };
  }

  async listWorkspaces() {
    return { workspaces: [] };
  }

  async listWallets(workspaceId: string) {
    return { workspaceId, wallets: [] };
  }
}

export const platformApiService = new PlatformApiService();
