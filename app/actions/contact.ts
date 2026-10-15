"use server";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function submitContactMessageAction(data: {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}) {
  try {
    const { error } = await supabase.from("contact_messages").insert([{
      name: data.name.trim(),
      email: data.email.trim(),
      phone: data.phone?.trim() || null,
      subject: data.subject || "General Inquiry",
      message: data.message.trim(),
      status: "unread",
    }]);

    if (error) {
      console.error("Contact message insert error:", error);
      return { success: false, error: error.message };
    }

    // Also insert admin notification
    await supabase.from("notifications").insert([{
      user_id: null,
      type: "info",
      title: "New Customer Message",
      message: `${data.name} sent a message: "${data.subject || "General Inquiry"}"`,
      read: false,
    }]);

    return { success: true };
  } catch (err: any) {
    console.error("submitContactMessageAction error:", err);
    return { success: false, error: err.message };
  }
}

export async function updateMessageStatusAction(id: string, status: "unread" | "read" | "replied" | "archived") {
  try {
    const { error } = await supabase
      .from("contact_messages")
      .update({ status })
      .eq("id", id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteMessageAction(id: string) {
  try {
    const { error } = await supabase.from("contact_messages").delete().eq("id", id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
