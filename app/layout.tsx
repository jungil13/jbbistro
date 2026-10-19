import type { Metadata } from "next";
import "./globals.css";
import RealtimeToast from "@/components/admin/RealtimeToast";
import TidioChat from "@/components/TidioChat";
import AuthRedirectHandler from "@/components/AuthRedirectHandler";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import RouteLoadingIndicator from "@/components/RouteLoadingIndicator";

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
        <RouteLoadingIndicator />
        <AuthRedirectHandler />
        <AnnouncementBanner />
        {children}
        <RealtimeToast />
        <TidioChat />
      </body>
    </html>
  );
}
