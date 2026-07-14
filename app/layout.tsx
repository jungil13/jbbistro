import type { Metadata } from "next";
import "./globals.css";
import RealtimeToast from "@/components/admin/RealtimeToast";
import Script from "next/script";

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
        <RealtimeToast />
        <Script src="//code.tidio.co/ttqytjiss4wc5pjvkeybmcg8ihksjlce.js" strategy="afterInteractive" />
        <Script id="tidio-color-override" strategy="afterInteractive">
          {`
            (function() {
              function onTidioChatApiReady() {
                window.tidioChatApi.setColorPalette && window.tidioChatApi.setColorPalette('#EF4444');
              }
              if (window.tidioChatApi) {
                window.tidioChatApi.on("ready", onTidioChatApiReady);
              } else {
                document.addEventListener("tidioChat-ready", onTidioChatApiReady);
              }
            })();
          `}
        </Script>
      </body>
    </html>
  );
}
