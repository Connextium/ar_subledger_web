import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/config/server-env";

type Role = "admin" | "accountant" | "viewer";

type AuthContext = {
  userId: string;
  serviceClient: SupabaseClient;
};

function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  return authHeader.slice(7).trim();
}

export async function authorizeWorkspaceRequest(
  request: Request,
  workspaceId: string,
  allowedRoles: Role[],
): Promise<AuthContext> {
  if (!serverEnv.supabaseUrl || !serverEnv.supabaseAnonKey || !serverEnv.supabaseServiceRoleKey) {
    throw new Error("Supabase server configuration is incomplete.");
  }

  const token = getBearerToken(request);
  if (!token) {
    throw new Error("Missing bearer token.");
  }

  const authClient = createClient(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) {
    throw new Error("Invalid auth token.");
  }

  const serviceClient = createClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data: roleRows, error: roleError } = await serviceClient
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userData.user.id)
    .in("role", allowedRoles)
    .limit(1);

  if (roleError) {
    throw new Error(`Failed membership check: ${roleError.message}`);
  }

  if (!roleRows || roleRows.length === 0) {
    if (!allowedRoles.includes("admin")) {
      throw new Error("Forbidden workspace access.");
    }

    const { data: ownerRows, error: ownerError } = await serviceClient
      .from("workspaces")
      .select("id")
      .eq("id", workspaceId)
      .eq("created_by", userData.user.id)
      .limit(1);

    if (ownerError) {
      throw new Error(`Failed owner check: ${ownerError.message}`);
    }

    if (!ownerRows || ownerRows.length === 0) {
      throw new Error("Forbidden workspace access.");
    }
  }

  return {
    userId: userData.user.id,
    serviceClient,
  };
}
