import type { Metadata } from "next";
import "./globals.css";
import ChatBot from "@/components/ChatBot";
import RealtimeToast from "@/components/admin/RealtimeToast";

export const metadata: Metadata = {
  title: "Jbenz Bistro – Fine Dining, Karaoke & Billiards",
  description:
    "Experience the perfect blend of fine dining, entertainment, and luxury in an unforgettable atmosphere.",
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <ChatBot />
        <RealtimeToast />
      </body>
    </html>
  );
}
