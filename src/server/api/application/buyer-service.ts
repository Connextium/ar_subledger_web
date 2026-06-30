export class BuyerApiService {
  async listLedgers(workspaceId: string) {
    return { workspaceId, ledgers: [] };
  }

  async listVendors(workspaceId: string) {
    return { workspaceId, vendors: [] };
  }

  async listVendorInvoices(workspaceId: string) {
    return { workspaceId, vendorInvoices: [] };
  }
}

export const buyerApiService = new BuyerApiService();
