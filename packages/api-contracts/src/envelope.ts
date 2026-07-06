export type ApiVersion = "v1";

export type ApiMeta = {
  requestId: string;
  workspaceId?: string;
};

export type ApiEnvelope<T> = {
  data: T;
  meta: {
    apiVersion: ApiVersion;
    requestId: string;
    workspaceId?: string;
  };
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details: unknown;
  };
  meta: {
    apiVersion: ApiVersion;
    requestId: string;
  };
};