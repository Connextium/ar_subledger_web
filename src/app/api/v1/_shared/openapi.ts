const jsonResponse = {
  description: "API envelope response",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          data: { type: "object" },
          meta: { type: "object" },
        },
      },
    },
  },
};

function route(methods: string[], tag: string) {
  return Object.fromEntries(
    methods.map((method) => [
      method,
      {
        tags: [tag],
        responses: {
          "200": jsonResponse,
          "400": jsonResponse,
          "401": jsonResponse,
          "500": jsonResponse,
        },
      },
    ]),
  );
}

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "AR Subledger API",
    version: "1.0.0",
  },
  tags: [
    { name: "Auth" },
    { name: "Platform" },
    { name: "Buyer" },
    { name: "Supplier" },
    { name: "Factor" },
    { name: "Facilitator" },
    { name: "Webhook" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer" },
      apiKeyAuth: { type: "apiKey", in: "header", name: "X-API-Key" },
    },
  },
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  paths: {
    "/api/v1/auth/register": route(["post"], "Auth"),
    "/api/v1/auth/login": route(["post"], "Auth"),
    "/api/v1/auth/logout": route(["post"], "Auth"),
    "/api/v1/auth/refresh": route(["post"], "Auth"),
    "/api/v1/auth/session": route(["get"], "Auth"),
    "/api/v1/auth/api-keys": route(["get", "post"], "Auth"),
    "/api/v1/auth/api-keys/{keyId}": route(["delete"], "Auth"),
    "/api/v1/platform/health": route(["get"], "Platform"),
    "/api/v1/platform/version": route(["get"], "Platform"),
    "/api/v1/platform/openapi.json": route(["get"], "Platform"),
    "/api/v1/platform/me": route(["get"], "Platform"),
    "/api/v1/platform/workspaces": route(["get", "post"], "Platform"),
    "/api/v1/platform/workspaces/{workspaceId}": route(["get", "patch"], "Platform"),
    "/api/v1/platform/workspaces/{workspaceId}/members": route(["get", "post"], "Platform"),
    "/api/v1/platform/workspaces/{workspaceId}/members/{userId}": route(["patch", "delete"], "Platform"),
    "/api/v1/platform/workspaces/{workspaceId}/wallets": route(["get", "post"], "Platform"),
    "/api/v1/platform/workspaces/{workspaceId}/wallets/import": route(["post"], "Platform"),
    "/api/v1/platform/workspaces/{workspaceId}/wallets/{walletId}/main": route(["post"], "Platform"),
    "/api/v1/platform/workspaces/{workspaceId}/wallets/{walletId}/export": route(["post"], "Platform"),
    "/api/v1/platform/workspaces/{workspaceId}/wallet-balances/refresh": route(["post"], "Platform"),
    "/api/v1/platform/workspaces/{workspaceId}/api-clients": route(["get", "post"], "Platform"),
    "/api/v1/platform/workspaces/{workspaceId}/api-clients/{clientId}": route(["patch", "delete"], "Platform"),
    "/api/v1/platform/workspaces/{workspaceId}/audit-events": route(["get"], "Platform"),
    "/api/v1/buyer/workspaces/{workspaceId}/ledgers": route(["get", "post"], "Buyer"),
    "/api/v1/buyer/workspaces/{workspaceId}/vendors": route(["get", "post"], "Buyer"),
    "/api/v1/buyer/workspaces/{workspaceId}/vendor-invoices": route(["get", "post"], "Buyer"),
    "/api/v1/supplier/workspaces/{workspaceId}/ledgers": route(["get", "post"], "Supplier"),
    "/api/v1/supplier/workspaces/{workspaceId}/customers": route(["get", "post"], "Supplier"),
    "/api/v1/supplier/workspaces/{workspaceId}/invoices": route(["get", "post"], "Supplier"),
    "/api/v1/factor/workspaces/{workspaceId}/eligible-invoices": route(["get"], "Factor"),
    "/api/v1/facilitator/workspaces/{workspaceId}/routes": route(["get", "post"], "Facilitator"),
    "/api/v1/facilitator/workspaces/{workspaceId}/documents": route(["get", "post"], "Facilitator"),
    "/api/v1/facilitator/workspaces/{workspaceId}/executions": route(["get", "post"], "Facilitator"),
    "/api/v1/webhooks/workspaces/{workspaceId}/subscriptions": route(["get", "post"], "Webhook"),
    "/api/v1/webhooks/workspaces/{workspaceId}/subscriptions/{subscriptionId}": route(["patch", "delete"], "Webhook"),
    "/api/v1/webhooks/workspaces/{workspaceId}/subscriptions/{subscriptionId}/test": route(["post"], "Webhook"),
  },
} as const;
