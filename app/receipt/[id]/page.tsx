"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";

export default function ReceiptPage() {
  const params = useParams();
  const id = params?.id as string;
  const supabase = createClient();
  const [reservation, setReservation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const { data } = await supabase
        .from("reservations")
        .select("*, services(name, type), payments(method, reference_number, status)")
        .eq("id", id)
        .single();
      setReservation(data);
      setLoading(false);
      if (data) {
        setTimeout(() => window.print(), 600);
      }
    }
    load();
  }, [id]);

  if (loading) return <div style={{ padding: "24px", textAlign: "center", fontFamily: "monospace" }}>Loading receipt…</div>;
  if (!reservation) return <div style={{ padding: "24px", textAlign: "center", fontFamily: "monospace" }}>Receipt not found.</div>;

  const payment = Array.isArray(reservation.payments) ? reservation.payments[0] : reservation.payments;

  const row = (label: string, value: string) => (
    <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px", gap: "6px" }}>
      <span style={{ fontWeight: "bold", flexShrink: 0 }}>{label}:</span>
      <span style={{ textAlign: "right", wordBreak: "break-all" }}>{value}</span>
    </div>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #f0f0f0; }
        body { display: flex; justify-content: center; align-items: flex-start; padding: 24px; min-height: 100vh; }

        @media print {
          html, body {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          @page {
            size: 72mm auto;
            margin: 5mm 6mm;
          }
          body { display: block; }
          .no-print { display: none !important; }
        }
      `}} />

      <div style={{
        background: "white",
        width: "72mm",
        margin: "0 auto",
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: "11px",
        lineHeight: "1.55",
        color: "#111",
        padding: "0",
      }}>

        {/* ── HEADER ── */}
        <div style={{ textAlign: "center", paddingBottom: "8px", borderBottom: "1px dashed #444", marginBottom: "8px" }}>
          <div style={{ fontSize: "15px", fontWeight: "900", letterSpacing: "3px" }}>JBENZ BISTRO</div>
          <div style={{ fontSize: "9px", color: "#666", marginTop: "2px", letterSpacing: "0.5px" }}>
            Fine Dining · Karaoke · Billiards
          </div>
          <div style={{ fontSize: "10px", fontWeight: "bold", marginTop: "5px", letterSpacing: "1.5px" }}>
            ─── OFFICIAL RECEIPT ───
          </div>
        </div>

        {/* ── RESERVATION DETAILS ── */}
        <div style={{ marginBottom: "8px" }}>
          {row("Code",     reservation.reservation_code ?? "—")}
          {row("Customer", reservation.customer_name || "Walk-in / Guest")}
          {row("Email",    reservation.customer_email || "—")}
          {row("Phone",    reservation.customer_phone || "—")}
          {row("Date",     format(new Date(reservation.date), "MMM dd, yyyy"))}
          {row("Time",     reservation.time_start ?? "—")}
          {row("Guests",   `${reservation.guests} pax`)}
        </div>

        {/* ── SERVICE LINE ── */}
        <div style={{ borderTop: "1px dashed #444", borderBottom: "1px dashed #444", padding: "6px 0", marginBottom: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "9px", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "5px" }}>
            <span>Description</span>
            <span>Amount</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontWeight: "bold" }}>{reservation.services?.name ?? "Service"}</div>
              <div style={{ fontSize: "9px", textTransform: "uppercase", color: "#666" }}>
                {reservation.services?.type ?? ""}
              </div>
            </div>
            <span style={{ fontWeight: "bold", flexShrink: 0, marginLeft: "8px" }}>
              ₱{(reservation.total_amount ?? 0).toLocaleString()}
            </span>
          </div>
        </div>

        {/* ── TOTAL ── */}
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "900", fontSize: "13px", padding: "4px 0", marginBottom: "8px", borderBottom: "2px solid #111" }}>
          <span>TOTAL DUE</span>
          <span>₱{(reservation.total_amount ?? 0).toLocaleString()}</span>
        </div>

        {/* ── PAYMENT INFO ── */}
        {payment && (
          <div style={{ marginBottom: "8px" }}>
            {row("Payment",    payment.method?.toUpperCase() ?? "—")}
            {row("Ref No.",    payment.reference_number || "—")}
            {row("Pay Status", payment.status?.toUpperCase() ?? "—")}
          </div>
        )}

        {/* ── FOOTER ── */}
        <div style={{ borderTop: "1px dashed #444", paddingTop: "8px", textAlign: "center" }}>
          <div style={{ fontWeight: "bold", fontSize: "10px", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "3px" }}>
            RESERVATION: {reservation.status?.toUpperCase()}
          </div>
          <div style={{ fontSize: "9px" }}>Thank you for choosing Jbenz Bistro!</div>
          <div style={{ fontSize: "8px", color: "#888", marginTop: "6px" }}>
            {format(new Date(), "MMM dd, yyyy hh:mm a")}
          </div>
          <div style={{ fontSize: "8px", letterSpacing: "4px", marginTop: "8px", color: "#bbb" }}>
            ||||||||||||||||||||||||||||||||
          </div>
        </div>

        {/* ── SCREEN-ONLY BUTTONS ── */}
        <div className="no-print" style={{ display: "flex", gap: "8px", marginTop: "16px", justifyContent: "center" }}>
          <button
            onClick={() => window.print()}
            style={{ background: "#1a1a1a", color: "white", border: "none", padding: "8px 20px", borderRadius: "6px", fontSize: "12px", cursor: "pointer", fontFamily: "sans-serif" }}
          >
            🖨️ Print
          </button>
          <button
            onClick={() => window.close()}
            style={{ background: "#e5e5e5", color: "#333", border: "none", padding: "8px 20px", borderRadius: "6px", fontSize: "12px", cursor: "pointer", fontFamily: "sans-serif" }}
          >
            ✕ Close
          </button>
        </div>
      </div>
    </>
  );
}
