import { apiFetch } from "@/lib/api-client/v1/http";

export const factorApi = {
  async listEligibleInvoices(workspaceId: string) {
    return apiFetch<{ eligibleInvoices: unknown[] }>(
      `/api/v1/factor/workspaces/${encodeURIComponent(workspaceId)}/eligible-invoices`,
    );
  },
};
