export class SupplierApiService {
  async listLedgers(workspaceId: string) {
    return { workspaceId, ledgers: [] };
  }

  async listCustomers(workspaceId: string) {
    return { workspaceId, customers: [] };
  }

  async listInvoices(workspaceId: string) {
    return { workspaceId, invoices: [] };
  }
}

export const supplierApiService = new SupplierApiService();
