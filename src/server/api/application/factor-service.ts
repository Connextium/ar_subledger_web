export class FactorApiService {
  async listEligibleInvoices(workspaceId: string) {
    return { workspaceId, eligibleInvoices: [] };
  }
}

export const factorApiService = new FactorApiService();
