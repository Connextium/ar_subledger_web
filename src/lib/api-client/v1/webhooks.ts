export const webhooksApi = {
  async listSubscriptions() {
    return { subscriptions: [] };
  },
  async testSubscription() {
    return { delivered: false };
  },
};
