import { apiFetch } from "@/lib/api-client/v1/http";

export const webhooksApi = {
  async listSubscriptions(workspaceId: string) {
    return apiFetch<{ subscriptions: unknown[] }>(
      `/api/v1/webhooks/workspaces/${encodeURIComponent(workspaceId)}/subscriptions`,
    );
  },

  async testSubscription(workspaceId: string, subscriptionId: string) {
    return apiFetch<{ delivered: boolean }>(
      `/api/v1/webhooks/workspaces/${encodeURIComponent(workspaceId)}/subscriptions/${encodeURIComponent(subscriptionId)}/test`,
      { method: "POST" },
    );
  },
};
