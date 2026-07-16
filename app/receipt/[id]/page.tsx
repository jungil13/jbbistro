"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { formatDate, formatTime, formatDateTime } from "@/lib/dateUtils";
import { getReceiptData } from "@/app/actions/receipt";

export default function ReceiptPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const isModal = searchParams.get('modal') === 'true';
  const [reservation, setReservation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const data = await getReceiptData(id);
      setReservation(data);
      setLoading(false);
      if (data && !isModal) {
        setTimeout(() => window.print(), 600);
      }
    }
    load();
  }, [id, isModal]);

  if (loading) return <div style={{ padding: "24px", textAlign: "center", fontFamily: "monospace" }}>Loading receipt…</div>;
  if (!reservation) return <div style={{ padding: "24px", textAlign: "center", fontFamily: "monospace" }}>Receipt not found.</div>;

  const payment = Array.isArray(reservation.payments) ? reservation.payments[0] : reservation.payments;

  const row = (label: string, value: string) => (
    <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px", gap: "6px" }}>
      <span style={{ fontWeight: "bold", flexShrink: 0 }}>{label}:</span>
      <span style={{ textAlign: "right", wordBreak: "break-all" }}>{value}</span>
    </div>
  );

  const membership = reservation.notes?.includes("Membership:") 
    ? reservation.notes.split("Membership: ")[1]?.split("\n")[0] 
    : null;

  const menuTotal = reservation.reservation_menu?.reduce(
    (sum: number, rm: any) => sum + ((rm.menu_items?.price ?? 0) * rm.quantity),
    0
  ) ?? 0;

  let servicePrice = reservation.total_amount ?? 0;
  let grandTotal = reservation.total_amount ?? 0;

  if (menuTotal > 0) {
    if (reservation.total_amount >= menuTotal) {
      servicePrice = reservation.total_amount - menuTotal;
      grandTotal = reservation.total_amount;
    } else {
      servicePrice = reservation.total_amount;
      grandTotal = reservation.total_amount + menuTotal;
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;900&family=Playfair+Display:ital,wght@0,700;1,700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #e5e7eb; }
        body { display: flex; justify-content: center; align-items: flex-start; padding: 40px 20px; min-height: 100vh; }

        .receipt-container {
          background: #ffffff;
          width: 80mm;
          margin: 0 auto;
          font-family: 'Outfit', sans-serif;
          font-size: 12px;
          line-height: 1.5;
          color: #1a1a1a;
          padding: 24px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          position: relative;
        }
        
        .receipt-container::before {
          content: "";
          position: absolute;
          top: -4px; left: 0; right: 0;
          height: 4px;
          background: #8b1327; /* deep red accent */
        }

        .header { text-align: center; margin-bottom: 24px; }
        .logo { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; letter-spacing: 1px; color: #3d0a14; }
        .logo span { color: #c9a84c; }
        .tagline { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px; }
        .receipt-title { font-size: 10px; font-weight: 700; margin-top: 16px; letter-spacing: 2px; color: #c9a84c; text-transform: uppercase; border-bottom: 1px solid #f3f4f6; padding-bottom: 12px; }

        .section { margin-bottom: 20px; }
        .row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11px; }
        .row .label { color: #6b7280; font-weight: 400; }
        .row .value { font-weight: 600; text-align: right; color: #111827; }
        .row .value.highlight { color: #c9a84c; font-weight: 700; }

        .service-box { background: #fafafa; border-radius: 8px; padding: 12px; margin-bottom: 20px; border: 1px solid #f3f4f6; }
        .service-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
        .service-name { font-weight: 700; font-size: 13px; color: #111827; }
        .service-type { font-size: 9px; text-transform: uppercase; color: #8b1327; font-weight: 700; letter-spacing: 0.5px; }
        .service-price { font-weight: 700; font-size: 13px; color: #111827; }

        .total-box { border-top: 2px dashed #e5e7eb; border-bottom: 2px dashed #e5e7eb; padding: 12px 0; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
        .total-label { font-size: 14px; font-weight: 900; letter-spacing: 1px; }
        .total-value { font-size: 18px; font-weight: 900; color: #8b1327; }

        .footer { text-align: center; margin-top: 24px; padding-top: 20px; border-top: 1px solid #f3f4f6; }
        .status-badge { display: inline-block; padding: 4px 12px; background: #111827; color: white; border-radius: 20px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
        .thank-you { font-family: 'Playfair Display', serif; font-size: 14px; font-style: italic; color: #3d0a14; }
        .timestamp { font-size: 9px; color: #9ca3af; margin-top: 8px; }
        .barcode { font-family: 'Libre Barcode 39', cursive; font-size: 32px; color: #111; margin-top: 12px; letter-spacing: -1px; }

        @media print {
          html, body { background: white !important; padding: 0 !important; margin: 0 !important; }
          .receipt-container { box-shadow: none; padding: 0; width: 72mm; }
          .no-print { display: none !important; }
        }
      `}} />

      <div>
        <div className="receipt-container">
          <div className="header">
            <div className="logo">Jbenz <span>Bistro</span></div>
            <div className="tagline">Fine Dining · Karaoke · Billiards</div>
            <div className="receipt-title">Official Receipt</div>
          </div>

          <div className="section">
            <div className="row">
              <span className="label">Reservation Code</span>
              <span className="value">{reservation.reservation_code ?? "—"}</span>
            </div>
            <div className="row">
              <span className="label">Customer</span>
              <span className="value">{reservation.customer_name || "Walk-in / Guest"}</span>
            </div>
            <div className="row">
              <span className="label">Date</span>
              <span className="value">{formatDate(reservation.date)}</span>
            </div>
            <div className="row">
              <span className="label">Time</span>
              <span className="value">{formatTime(reservation.time_start ?? "")}</span>
            </div>
            <div className="row">
              <span className="label">Guests</span>
              <span className="value">{reservation.guests} pax</span>
            </div>
            {membership && (
              <div className="row">
                <span className="label">Membership</span>
                <span className="value highlight">{membership.toUpperCase()}</span>
              </div>
            )}
          </div>

          <div className="service-box">
            <div className="service-header">
              <div>
                <div className="service-name">{reservation.services?.name ?? "Service"}</div>
                <div className="service-type">{reservation.services?.type ?? ""}</div>
              </div>
              <div className="service-price">₱{servicePrice.toLocaleString()}</div>
            </div>
          </div>

          {/* Pre-ordered Menu Items */}
          {reservation.reservation_menu && reservation.reservation_menu.length > 0 && (
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "9px", fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: "8px", borderBottom: "1px solid #f3f4f6", paddingBottom: "6px" }}>
                Pre-ordered Items
              </div>
              {reservation.reservation_menu.map((rm: any, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "11px" }}>
                  <span style={{ color: "#374151" }}>
                    {rm.quantity > 1 && <span style={{ color: "#9ca3af", marginRight: "4px" }}>×{rm.quantity}</span>}
                    {rm.menu_items?.name}
                  </span>
                  <span style={{ fontWeight: "600", color: "#111827" }}>
                    ₱{((rm.menu_items?.price ?? 0) * rm.quantity).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="total-box">
            <span className="total-label">TOTAL DUE</span>
            <span className="total-value">₱{grandTotal.toLocaleString()}</span>
          </div>

          {payment && (
            <div className="section">
              <div className="row">
                <span className="label">Payment Method</span>
                <span className="value" style={{ textTransform: "uppercase" }}>{payment.method ?? "—"}</span>
              </div>
              {payment.reference_number && (
                <div className="row">
                  <span className="label">Ref No.</span>
                  <span className="value">{payment.reference_number}</span>
                </div>
              )}
              <div className="row">
                <span className="label">Status</span>
                <span className="value">{payment.status?.toUpperCase() ?? "—"}</span>
              </div>
            </div>
          )}

          <div className="footer">
            <div className="status-badge">{reservation.status}</div>
            <div className="thank-you">Thank you for dining with us!</div>
            <div className="timestamp">{formatDateTime(new Date().toISOString())}</div>
            <div className="barcode">*JBZ-{reservation.reservation_code?.slice(0,6) || "RECEIPT"}*</div>
          </div>
        </div>

        <div className="no-print" style={{ display: "flex", gap: "12px", marginTop: "24px", justifyContent: "center" }}>
          <button
            onClick={() => window.print()}
            style={{ background: "#3d0a14", color: "white", border: "none", padding: "12px 24px", borderRadius: "8px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "'Outfit', sans-serif", boxShadow: "0 4px 12px rgba(61,10,20,0.2)" }}
          >
            Print Receipt
          </button>
          <button
            onClick={() => window.close()}
            style={{ background: "white", color: "#4b5563", border: "1px solid #e5e7eb", padding: "12px 24px", borderRadius: "8px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "'Outfit', sans-serif" }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
