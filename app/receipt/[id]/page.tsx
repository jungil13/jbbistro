"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { formatDate, formatTime, formatDateTime } from "@/lib/dateUtils";
import { getReceiptData } from "@/app/actions/receipt";
import { X, Printer } from "lucide-react";

export default function ReceiptPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const isModal = searchParams.get('modal') === 'true';
  const [reservation, setReservation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const handleClose = useCallback(() => {
    // 1. Post message to parent iframe if embedded in modal
    if (typeof window !== "undefined") {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "CLOSE_RECEIPT_MODAL" }, "*");
      }
      // 2. Try window.close()
      try {
        window.close();
      } catch (e) { }

      // 3. Fallback: navigate back if window didn't close
      setTimeout(() => {
        if (!window.closed) {
          if (window.history.length > 1) {
            router.back();
          } else {
            router.push("/profile");
          }
        }
      }, 150);
    }
  }, [router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!id) return;
      const data = await getReceiptData(id);
      if (!active) return;
      setReservation(data);
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f7f5f2", fontFamily: "sans-serif" }}>
        <div style={{ width: "42px", height: "42px", border: "3px solid #e5d3a1", borderTopColor: "#3d0a14", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }` }} />
        <p style={{ marginTop: "16px", fontSize: "13px", fontWeight: "700", color: "#3d0a14", letterSpacing: "0.5px" }}>Loading Official Receipt...</p>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f7f5f2", fontFamily: "sans-serif", padding: "20px", textAlign: "center" }}>
        <div style={{ background: "#ffffff", padding: "36px 28px", borderRadius: "16px", boxShadow: "0 10px 30px rgba(0,0,0,0.06)", maxWidth: "380px" }}>
          <h3 style={{ color: "#3d0a14", fontWeight: "800", fontSize: "20px", marginBottom: "8px" }}>Receipt Not Found</h3>
          <p style={{ color: "#6b7280", fontSize: "13px", lineHeight: "1.6", marginBottom: "22px" }}>The requested booking record could not be found or has been removed.</p>
          <button onClick={handleClose} style={{ background: "#3d0a14", color: "#c9a84c", border: "none", padding: "12px 24px", borderRadius: "10px", fontWeight: "700", cursor: "pointer", fontSize: "13px" }}>Close Receipt</button>
        </div>
      </div>
    );
  }

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

  const bundleMatch = reservation.notes?.match(/\[Bundle:\s*([^()\]]+?)(?:\s*\(([^)]+)\))?\]/i);
  const bundleName = bundleMatch ? bundleMatch[1].trim() : null;
  const bundlePriceStr = bundleMatch ? bundleMatch[2]?.trim() : null;

  const menuTotal = reservation.reservation_menu?.reduce(
    (sum: number, rm: any) => sum + ((rm.menu_items?.price ?? 0) * rm.quantity),
    0
  ) ?? 0;

  // Use the service's defined hourly_rate directly if present, preventing bundle/menu item deduction anomalies
  const servicePrice = reservation.services?.hourly_rate !== undefined && reservation.services?.hourly_rate !== null
    ? Number(reservation.services.hourly_rate)
    : (menuTotal > 0 && reservation.total_amount >= menuTotal ? reservation.total_amount - menuTotal : (reservation.total_amount ?? 0));

  const grandTotal = Number(reservation.total_amount ?? 0);
  const rawSum = servicePrice + menuTotal;
  const discountAmount = Math.max(0, rawSum - grandTotal);

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
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
        <div className="receipt-container" style={{ position: "relative" }}>
          <button
            onClick={handleClose}
            className="no-print"
            aria-label="Close receipt"
            title="Close receipt (Esc)"
            style={{
              position: "absolute",
              top: "10px",
              right: "10px",
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "#f3f4f6",
              border: "1px solid #e5e7eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#6b7280",
              zIndex: 10,
            }}
          >
            <X size={14} />
          </button>
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

          {/* Selected Meal Bundle */}
          {bundleName && (
            <div style={{ marginBottom: "16px", padding: "8px 12px", background: "#fef3c7", borderRadius: "8px", border: "1px dashed #f59e0b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "9px", fontWeight: "700", color: "#b45309", textTransform: "uppercase", letterSpacing: "1px" }}>Meal Bundle Package</div>
                <div style={{ fontSize: "11px", fontWeight: "700", color: "#78350f" }}>{bundleName}</div>
              </div>
              <div style={{ fontSize: "11px", fontWeight: "800", color: "#78350f" }}>{bundlePriceStr || "Included"}</div>
            </div>
          )}

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
              {/* Menu Subtotal */}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", paddingTop: "6px", borderTop: "1px dashed #e5e7eb", fontSize: "11px", fontWeight: "700", color: "#374151" }}>
                <span>Menu Subtotal</span>
                <span>₱{menuTotal.toLocaleString()}</span>
              </div>
            </div>
          )}

          {discountAmount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", fontSize: "11px", color: "#065f46", background: "#ecfdf5", border: "1px dashed #a7f3d0", padding: "8px 12px", borderRadius: "6px", fontWeight: "600" }}>
              <span>Bundle / Promo Savings</span>
              <span style={{ fontWeight: "700" }}>-₱{discountAmount.toLocaleString()}</span>
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
                <span className="value" style={{ textTransform: "uppercase" }}>
                  {payment.reference_number?.startsWith("pay_") || payment.gcash_number?.toLowerCase().includes("paymongo") || reservation.notes?.includes("PayMongo")
                    ? (payment.gcash_number ? payment.gcash_number.toUpperCase() : "PAYMONGO ONLINE GATEWAY")
                    : (payment.method ?? "—")}
                </span>
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
            <div className="barcode">*JBZ-{reservation.reservation_code?.slice(0, 6) || "RECEIPT"}*</div>
          </div>
        </div>

        <div className="no-print" style={{ display: "flex", gap: "10px", marginTop: "24px", justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => window.print()}
            style={{
              background: "#3d0a14",
              color: "white",
              border: "none",
              padding: "11px 22px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              fontFamily: "'Outfit', sans-serif",
              boxShadow: "0 4px 12px rgba(61,10,20,0.2)",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <Printer size={15} />
            <span>Print / Save PDF</span>
          </button>



          <button
            onClick={handleClose}
            style={{
              background: "white",
              color: "#4b5563",
              border: "1px solid #e5e7eb",
              padding: "11px 20px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              fontFamily: "'Outfit', sans-serif"
            }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
