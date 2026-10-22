"use client";

import { useEffect, useState, useTransition, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function getDestinationLabel(href: string, linkText?: string): string {
  const cleanText = linkText?.trim().replace(/\s+/g, " ");
  if (cleanText && cleanText.length > 1 && cleanText.length < 35 && !cleanText.includes("\n")) {
    return cleanText;
  }

  try {
    const url = new URL(href, window.location.origin);
    const path = url.pathname.toLowerCase();
    if (path === "/" || path === "") return "Home";
    if (path.startsWith("/reserve")) return "Reservation";
    if (path.startsWith("/announcements")) return "Announcements";
    if (path.startsWith("/menu")) return "Menu";
    if (path.startsWith("/promotions")) return "Promotions";
    if (path.startsWith("/services")) return "Services";
    if (path.startsWith("/reviews")) return "Reviews";
    if (path.startsWith("/contact")) return "Contact";
    if (path.startsWith("/profile")) return "Profile";
    if (path.startsWith("/login")) return "Sign In";
    if (path.startsWith("/admin")) return "Admin Portal";
    if (path.startsWith("/manager")) return "Manager Portal";
    if (path.startsWith("/receipt")) return "Receipt";
  } catch {
    // fallback
  }

  return "Page";
}

function LoaderContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [targetLabel, setTargetLabel] = useState<string>("Page");

  // When pathname or searchParams update, the new route has loaded!
  useEffect(() => {
    if (isLoading) {
      setProgress(100);
      const timer = setTimeout(() => {
        setIsLoading(false);
        setProgress(0);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    let progressInterval: NodeJS.Timeout;

    const handleDocumentClick = (e: MouseEvent) => {
      // Find closest anchor tag
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;

      const rawHref = anchor.getAttribute("href");
      if (!rawHref) return;

      // Ignore external, new tab, modified keys, mailto, tel, downloads, hash-only
      if (
        anchor.target === "_blank" ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey ||
        e.defaultPrevented ||
        anchor.hasAttribute("download") ||
        rawHref.startsWith("#") ||
        rawHref.startsWith("mailto:") ||
        rawHref.startsWith("tel:") ||
        rawHref.startsWith("javascript:")
      ) {
        return;
      }

      try {
        const currentUrl = new URL(window.location.href);
        const destinationUrl = new URL(anchor.href, window.location.href);

        // Check if origin is the same
        if (destinationUrl.origin !== currentUrl.origin) return;

        // Check if same page with same search params
        if (
          destinationUrl.pathname === currentUrl.pathname &&
          destinationUrl.search === currentUrl.search
        ) {
          return;
        }

        // Determine destination label
        const text =
          anchor.getAttribute("title") ||
          anchor.getAttribute("aria-label") ||
          anchor.innerText ||
          "";
        const label = getDestinationLabel(rawHref, text);
        setTargetLabel(label);

        // Start loading
        setIsLoading(true);
        setProgress(25);

        clearInterval(progressInterval);
        progressInterval = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 88) {
              clearInterval(progressInterval);
              return 88;
            }
            return prev + Math.floor(Math.random() * 14) + 8;
          });
        }, 120);
      } catch (err) {
        // Ignored
      }
    };

    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
      clearInterval(progressInterval);
    };
  }, []);

  // Safety fallback: if navigation takes longer than 7 seconds, dismiss loader
  useEffect(() => {
    if (isLoading) {
      const fallback = setTimeout(() => {
        setIsLoading(false);
        setProgress(0);
      }, 7000);
      return () => clearTimeout(fallback);
    }
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <>
      {/* Top Gradient Progress Bar */}
      <div
        className="fixed top-0 left-0 right-0 z-[999999] pointer-events-none h-[3px] bg-gradient-to-r from-[#3d0a14] via-[#c9a84c] to-[#f5d77f] shadow-[0_0_12px_rgba(201,168,76,0.9)] transition-all duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
        }}
      />

      {/* Floating Center Route Spinner Pill */}
      <div className="fixed inset-0 z-[999998] pointer-events-none flex items-center justify-center p-4 bg-black/10 backdrop-blur-[2px] transition-all duration-300">
        <div className="bg-[#3d0a14]/95 text-white border border-[#c9a84c]/50 shadow-[0_10px_35px_rgba(61,10,20,0.5)] rounded-2xl px-6 py-4 flex items-center gap-4 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
          {/* Dual-ring luxury animated spinner */}
          <div className="relative flex items-center justify-center flex-shrink-0">
            <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-[#c9a84c] border-r-[#c9a84c] animate-spin" />
            <div className="absolute w-2 h-2 rounded-full bg-[#c9a84c] animate-pulse" />
          </div>

          <div className="flex flex-col text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-white tracking-wide">
                Loading {targetLabel}
              </span>
              <span className="flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-[#c9a84c] animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1 h-1 rounded-full bg-[#c9a84c] animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1 h-1 rounded-full bg-[#c9a84c] animate-bounce" />
              </span>
            </div>
            <span className="text-[10px] text-[#c9a84c] font-medium tracking-wider uppercase">
              Jbenz Bistro
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

export default function RouteLoadingIndicator() {
  return (
    <Suspense fallback={null}>
      <LoaderContent />
    </Suspense>
  );
}
