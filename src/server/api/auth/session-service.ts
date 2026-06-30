export class SessionService {
  async register() {
    return { user: null };
  }

  async login() {
    return { session: null };
  }

  async logout() {
    return { revoked: true };
  }

  async refresh() {
    return { session: null };
  }

  async getSession() {
    return { session: null };
  }
}

export const sessionService = new SessionService();
