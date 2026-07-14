"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

// Add TypeScript declaration for Tidio
declare global {
  interface Window {
    tidioChatApi?: any;
  }
}

export default function TidioChat() {
  const pathname = usePathname();

  useEffect(() => {
    // Hide chat on admin, manager, and profile dashboards
    const isDashboard = pathname?.startsWith("/admin") || 
                        pathname?.startsWith("/manager") || 
                        pathname?.startsWith("/profile");

    const updateVisibility = () => {
      if (!window.tidioChatApi) return;
      
      if (isDashboard) {
        window.tidioChatApi.hide();
      } else {
        window.tidioChatApi.show();
      }
    };

    if (window.tidioChatApi) {
      window.tidioChatApi.on("ready", updateVisibility);
      updateVisibility();
    } else {
      document.addEventListener("tidioChat-ready", updateVisibility);
    }

    return () => {
      document.removeEventListener("tidioChat-ready", updateVisibility);
    };
  }, [pathname]);

  return (
    <>
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
    </>
  );
}
