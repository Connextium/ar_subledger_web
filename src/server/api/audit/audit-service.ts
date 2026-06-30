export type AuditEventInput = {
  requestId: string;
  workspaceId?: string;
  subjectId?: string;
  authMode?: string;
  method: string;
  path: string;
  idempotencyKey?: string;
  outcome: "success" | "error" | "denied";
};

export class AuditService {
  async recordAuditEvent(input: AuditEventInput) {
    return { recorded: true, event: input };
  }
}

export const auditService = new AuditService();
