import { createClient as createServerAuthClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

// Service role client for privileged database queries
const adminSupabase = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface AuthProfile {
  id: string;
  email: string | null;
  role: "admin" | "manager" | "staff" | "customer";
  status: "active" | "inactive";
  first_name: string | null;
  last_name: string | null;
}

/**
 * Validates that the current request has an active authenticated session.
 * Returns the user and profile, or throws an Error.
 */
export async function requireAuthUser(): Promise<{ user: any; profile: AuthProfile }> {
  const authClient = await createServerAuthClient();
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized: Please sign in to perform this action.");
  }

  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select("id, email, role, status, first_name, last_name")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("Forbidden: User profile not found.");
  }

  if (profile.status === "inactive") {
    throw new Error("Forbidden: Account is inactive.");
  }

  return { user, profile: profile as AuthProfile };
}

/**
 * Validates that the current caller is authenticated and has one of the required roles.
 */
export async function requireRole(allowedRoles: ("admin" | "manager" | "staff")[]): Promise<{ user: any; profile: AuthProfile }> {
  const { user, profile } = await requireAuthUser();

  if (!allowedRoles.includes(profile.role as any)) {
    throw new Error(`Forbidden: Requires one of [${allowedRoles.join(", ")}] roles.`);
  }

  return { user, profile };
}

/**
 * Convenience helper to require Admin role.
 */
export async function requireAdmin(): Promise<{ user: any; profile: AuthProfile }> {
  return requireRole(["admin"]);
}

/**
 * Convenience helper to require Admin or Manager role.
 */
export async function requireAdminOrManager(): Promise<{ user: any; profile: AuthProfile }> {
  return requireRole(["admin", "manager"]);
}

/**
 * Validates that the current caller is authorized to manage refunds:
 * - Admin or Manager role
 * - Staff member with can_billing permission
 */
export async function requireRefundAuthorized(): Promise<{ user: any; profile: AuthProfile }> {
  const { user, profile } = await requireAuthUser();

  if (profile.role === "admin" || profile.role === "manager") {
    return { user, profile };
  }

  if (profile.role === "staff") {
    const { data: perms } = await adminSupabase
      .from("staff_permissions")
      .select("can_billing")
      .eq("staff_id", user.id)
      .single();

    if (perms?.can_billing) {
      return { user, profile };
    }

    throw new Error("Forbidden: Staff account requires 'can_billing' permission to manage refunds.");
  }

  throw new Error("Forbidden: You do not have permission to manage refunds.");
}
