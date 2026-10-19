"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireRole } from "@/lib/supabase/authGuard";

// Initialize admin Supabase client with the service role key to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface StaffPermissionsInput {
  can_dashboard: boolean;
  can_reservations: boolean;
  can_services: boolean;
  can_billing: boolean;
}

export async function createStaffAction(data: {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  dob?: string;
  username?: string;
  password: string;
  role: "admin" | "manager" | "staff";
  permissions: StaffPermissionsInput;
}) {
  try {
    // Security check: Only verified active admins can create staff
    await requireAdmin();

    if (!data.email || !data.password) {
      return { success: false, error: "Email and password are required" };
    }

    if (/\s/.test(data.password)) {
      return { success: false, error: "Password cannot contain spaces" };
    }

    // 1. Create user in Supabase Auth with admin client (pre-confirmed email)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        first_name: data.first_name,
        last_name: data.last_name,
        role: data.role,
        phone: data.phone || "",
      },
    });

    if (authError || !authData.user) {
      console.error("Error creating staff auth user:", authError);
      return { success: false, error: authError?.message || "Failed to create user account" };
    }

    const userId = authData.user.id;

    // 2. Ensure profiles table has complete data
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      email: data.email,
      role: data.role,
      first_name: data.first_name,
      last_name: data.last_name,
      phone: data.phone || null,
      dob: data.dob || null,
      username: data.username || null,
      status: "active",
      created_at: new Date().toISOString(),
    });

    if (profileError) {
      console.error("Error updating profile for new staff:", profileError);
    }

    // 3. Upsert staff permissions
    const { error: permError } = await supabase.from("staff_permissions").upsert({
      staff_id: userId,
      can_dashboard: Boolean(data.permissions.can_dashboard),
      can_reservations: Boolean(data.permissions.can_reservations),
      can_services: Boolean(data.permissions.can_services),
      can_billing: Boolean(data.permissions.can_billing),
    }, { onConflict: "staff_id" });

    if (permError) {
      console.error("Error saving staff permissions:", permError);
    }

    revalidatePath("/admin/staff");
    return { success: true, userId };
  } catch (err: any) {
    console.error("Unexpected error in createStaffAction:", err);
    return { success: false, error: err.message || "An unexpected error occurred" };
  }
}

export async function updateStaffAction(data: {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: "admin" | "manager" | "staff";
  status: "active" | "inactive";
  password?: string;
  permissions: StaffPermissionsInput;
}) {
  try {
    // Security check: Only verified active admins can modify staff
    await requireAdmin();

    if (!data.id) {
      return { success: false, error: "Staff ID is required" };
    }

    // 1. If new password provided, validate and update auth user
    if (data.password) {
      if (/\s/.test(data.password)) {
        return { success: false, error: "Password cannot contain spaces" };
      }
      if (data.password.length < 6) {
        return { success: false, error: "Password must be at least 6 characters" };
      }
      const { error: passErr } = await supabase.auth.admin.updateUserById(data.id, {
        password: data.password,
      });
      if (passErr) {
        console.error("Error updating staff password:", passErr);
        return { success: false, error: passErr.message };
      }
    }

    // Protect role elevation: Staff accounts cannot be changed to admin or manager
    const { data: existingUser } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.id)
      .single();

    if (existingUser?.role === "staff" && data.role !== "staff") {
      return { success: false, error: "Staff accounts cannot be elevated to Admin or Manager." };
    }

    // 2. Update profile
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone || null,
        role: existingUser?.role === "staff" ? "staff" : data.role,
        status: data.status,
      })
      .eq("id", data.id);

    if (profileError) {
      console.error("Error updating staff profile:", profileError);
      return { success: false, error: profileError.message };
    }

    // 3. Update staff permissions
    const { error: permError } = await supabase
      .from("staff_permissions")
      .upsert({
        staff_id: data.id,
        can_dashboard: Boolean(data.permissions.can_dashboard),
        can_reservations: Boolean(data.permissions.can_reservations),
        can_services: Boolean(data.permissions.can_services),
        can_billing: Boolean(data.permissions.can_billing),
      }, { onConflict: "staff_id" });

    if (permError) {
      console.error("Error updating staff permissions:", permError);
      return { success: false, error: permError.message };
    }

    revalidatePath("/admin/staff");
    return { success: true };
  } catch (err: any) {
    console.error("Unexpected error in updateStaffAction:", err);
    return { success: false, error: err.message || "An unexpected error occurred" };
  }
}

export async function deleteStaffAction(id: string) {
  try {
    // Security check: Only verified active admins can delete staff
    await requireAdmin();

    if (!id) return { success: false, error: "Staff ID required" };

    // 1. Delete from staff_permissions
    await supabase.from("staff_permissions").delete().eq("staff_id", id);

    // 2. Delete from profiles
    await supabase.from("profiles").delete().eq("id", id);

    // 3. Delete from Supabase Auth
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) {
      console.warn("Could not delete from auth.users (may already be deleted):", error);
    }

    revalidatePath("/admin/staff");
    return { success: true };
  } catch (err: any) {
    console.error("Error in deleteStaffAction:", err);
    return { success: false, error: err.message || "Failed to delete staff member" };
  }
}

export async function getStaffWithPermissionsAction() {
  try {
    // Security check: Only admins can view the staff management list with permissions
    await requireAdmin();

    const { data: profiles, error: pError } = await supabase
      .from("profiles")
      .select("*")
      .in("role", ["admin", "manager", "staff"])
      .order("created_at", { ascending: false });

    if (pError) throw pError;

    const { data: perms, error: permError } = await supabase
      .from("staff_permissions")
      .select("*");

    if (permError) throw permError;

    const permsMap = new Map((perms || []).map((p) => [p.staff_id, p]));

    const staffWithPerms = (profiles || []).map((p) => ({
      ...p,
      permissions: permsMap.get(p.id) || {
        can_dashboard: false,
        can_reservations: false,
        can_services: false,
        can_billing: false,
      },
    }));

    return { success: true, data: staffWithPerms };
  } catch (err: any) {
    console.error("Error fetching staff with permissions:", err);
    return { success: false, error: err.message, data: [] };
  }
}

export async function getStaffPermissionsForUser(userId: string) {
  try {
    const { data, error } = await supabase
      .from("staff_permissions")
      .select("*")
      .eq("staff_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error loading permissions for user:", error);
    }

    return {
      can_dashboard: data?.can_dashboard ?? false,
      can_reservations: data?.can_reservations ?? false,
      can_services: data?.can_services ?? false,
      can_billing: data?.can_billing ?? false,
    };
  } catch (err) {
    return {
      can_dashboard: false,
      can_reservations: false,
      can_services: false,
      can_billing: false,
    };
  }
}
