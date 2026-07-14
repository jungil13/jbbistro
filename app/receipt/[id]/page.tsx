"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";

export default function ReceiptPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const supabase = createClient();
  const [reservation, setReservation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const { data } = await supabase
        .from("reservations")
        .select("*, services(name, type)")
        .eq("id", id)
        .single();
        
      setReservation(data);
      setLoading(false);
      
      if (data) {
        setTimeout(() => {
          window.print();
        }, 500);
      }
    }
    load();
  }, [id]);

  if (loading) return <div className="p-10 text-center font-mono">Loading receipt...</div>;
  if (!reservation) return <div className="p-10 text-center font-mono">Receipt not found or access denied.</div>;

  return (
    <div className="max-w-md mx-auto p-8 bg-white text-black font-mono print:p-0 print:max-w-none">
      {/* Print styles to hide non-print elements globally if needed, though this page is standalone */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background: white; }
          @page { margin: 0; }
        }
      `}} />

      <div className="text-center mb-6 border-b-2 border-black pb-6 border-dashed">
        <h1 className="text-2xl font-bold uppercase tracking-widest mb-1">Jbenz Bistro</h1>
        <p className="text-sm">Official Receipt</p>
      </div>

      <div className="space-y-4 mb-6 text-sm">
        <div className="flex justify-between">
          <span className="font-bold">Code:</span>
          <span>{reservation.reservation_code}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-bold">Date:</span>
          <span>{format(new Date(reservation.date), "MMM dd, yyyy")}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-bold">Time:</span>
          <span>{reservation.time_start}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-bold">Customer:</span>
          <span>{reservation.customer_name || 'Walk-in / Guest'}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-bold">Guests:</span>
          <span>{reservation.guests}</span>
        </div>
      </div>

      <div className="border-y-2 border-black border-dashed py-4 mb-6 text-sm">
        <div className="flex justify-between mb-2">
          <span className="font-bold uppercase tracking-wider">Service</span>
          <span className="font-bold uppercase tracking-wider">Amount</span>
        </div>
        <div className="flex justify-between items-start">
          <div className="max-w-[70%]">
            <p className="font-bold">{reservation.services?.name ?? "Service"}</p>
            <p className="text-xs uppercase">{reservation.services?.type ?? ""}</p>
          </div>
          <span>₱{reservation.total_amount?.toLocaleString() ?? 0}</span>
        </div>
      </div>

      <div className="flex justify-between items-end mb-8">
        <span className="text-lg font-bold uppercase">Total</span>
        <span className="text-xl font-bold">₱{reservation.total_amount?.toLocaleString() ?? 0}</span>
      </div>

      <div className="text-center space-y-2 text-xs border-t-2 border-black border-dashed pt-6">
        <p className="font-bold uppercase">Status: {reservation.status}</p>
        <p>Thank you for choosing Jbenz Bistro!</p>
        <p className="mt-4 text-[10px]">Printed on {format(new Date(), "MMM dd, yyyy hh:mm a")}</p>
      </div>

      <div className="mt-8 text-center print:hidden">
        <button 
          onClick={() => window.close()} 
          className="bg-gray-200 text-black px-4 py-2 rounded text-sm hover:bg-gray-300 transition-colors"
        >
          Close Window
        </button>
      </div>
    </div>
  );
}
