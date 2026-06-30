export class WebhookApiService {
  async listSubscriptions(workspaceId: string) {
    return { workspaceId, subscriptions: [] };
  }

  async testSubscription(workspaceId: string, subscriptionId: string) {
    return { workspaceId, subscriptionId, delivered: false };
  }
}

export const webhookApiService = new WebhookApiService();
