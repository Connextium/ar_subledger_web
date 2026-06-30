export class FacilitatorApiService {
  async listRoutes(workspaceId: string) {
    return { workspaceId, routes: [] };
  }

  async listDocuments(workspaceId: string) {
    return { workspaceId, documents: [] };
  }

  async listExecutions(workspaceId: string) {
    return { workspaceId, executions: [] };
  }
}

export const facilitatorApiService = new FacilitatorApiService();
