export type WebhookSubscription = {
  id: string;
  workspaceId: string;
  eventType: string;
  destinationUrl: string;
  status: "active" | "disabled";
  createdAt: string;
};

export type ListWebhookSubscriptionsResponse = {
  subscriptions: WebhookSubscription[];
};

export type TestWebhookSubscriptionResponse = {
  delivered: boolean;
};