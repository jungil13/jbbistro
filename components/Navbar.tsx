"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { User, Bell, LogOut, ChevronDown } from "lucide-react";

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  role: string;
}

export default function Navbar() {
  const supabase = createClient();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const [authUser, setAuthUser] = useState<{ id: string; email: string } | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Detect auth state
  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setAuthUser({ id: user.id, email: user.email ?? "" });
        const { data: prof } = await supabase
          .from("profiles")
          .select("first_name, last_name, photo_url, role")
          .eq("id", user.id)
          .single();
        if (prof) setUserProfile(prof);
      }
    };
    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setAuthUser({ id: session.user.id, email: session.user.email ?? "" });
      } else {
        setAuthUser(null);
        setUserProfile(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAuthUser(null);
    setUserProfile(null);
    setDropOpen(false);
    router.push("/");
    router.refresh();
  };

  const initials =
    [userProfile?.first_name, userProfile?.last_name]
      .filter(Boolean)
      .map((s) => s![0])
      .join("")
      .toUpperCase() || authUser?.email?.[0]?.toUpperCase() || "?";

  const displayName =
    [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(" ") ||
    authUser?.email?.split("@")[0] ||
    "My Account";

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-[100] px-8 transition-all duration-300 ${
        scrolled
          ? "bg-[rgba(61,10,20,0.97)] shadow-[0_2px_20px_rgba(0,0,0,0.4)]"
          : "bg-[rgba(61,10,20,0.75)] backdrop-blur-md"
      }`}
    >
      <nav className="max-w-[1200px] mx-auto flex items-center gap-8 h-[68px]">
        {/* Logo */}
        <Link
          href="/"
          className="no-underline font-playfair text-2xl font-bold flex-shrink-0"
        >
          <span className="text-white">Jbenz</span>
          <span className="text-gold"> Bistro</span>
        </Link>

        {/* Hamburger (mobile) */}
        <button
          className="md:hidden flex flex-col gap-[5px] bg-transparent border-none cursor-pointer p-1 ml-auto"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span className="block w-6 h-0.5 bg-white rounded-sm transition-all duration-300" />
          <span className="block w-6 h-0.5 bg-white rounded-sm transition-all duration-300" />
          <span className="block w-6 h-0.5 bg-white rounded-sm transition-all duration-300" />
        </button>

        {/* Nav Links */}
        <ul
          className={`
            list-none gap-8 mx-auto
            md:flex
            ${
              menuOpen
                ? "flex flex-col absolute top-[68px] left-0 right-0 bg-[#3d0a14] px-8 py-6 gap-5"
                : "hidden"
            }
          `}
        >
          {[
            { label: "Home", href: "/" },
            { label: "Services", href: "/services" },
            { label: "Contact", href: "/contact" },
            { label: "Reserve", href: "/reserve" },
          ].map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="text-white/85 no-underline text-sm font-medium tracking-wide transition-colors duration-200 hover:text-gold capitalize"
              >
                {item.label}
              </Link>
            </li>
          ))}

          {/* Mobile Auth Links */}
          {menuOpen && (
            <>
              <li className="w-full border-t border-white/10 my-2 md:hidden" />
              {authUser ? (
                <>
                  <li className="md:hidden">
                    <Link
                      href="/profile"
                      onClick={() => setMenuOpen(false)}
                      className="text-white/85 no-underline text-sm font-medium tracking-wide transition-colors duration-200 hover:text-gold flex items-center gap-2"
                    >
                      <User size={14} className="text-gold" />
                      My Profile
                    </Link>
                  </li>
                  {userProfile?.role === "admin" && (
                    <li className="md:hidden">
                      <Link
                        href="/admin"
                        onClick={() => setMenuOpen(false)}
                        className="text-white/85 no-underline text-sm font-medium tracking-wide transition-colors duration-200 hover:text-gold flex items-center gap-2"
                      >
                        <span className="w-3.5 h-3.5 rounded bg-red-800 flex items-center justify-center">
                          <span className="text-white text-[8px] font-bold">A</span>
                        </span>
                        Admin Dashboard
                      </Link>
                    </li>
                  )}
                  {(userProfile?.role === "manager" || userProfile?.role === "admin") && (
                    <li className="md:hidden">
                      <Link
                        href="/manager"
                        onClick={() => setMenuOpen(false)}
                        className="text-white/85 no-underline text-sm font-medium tracking-wide transition-colors duration-200 hover:text-gold flex items-center gap-2"
                      >
                        <span className="w-3.5 h-3.5 rounded bg-blue-700 flex items-center justify-center">
                          <span className="text-white text-[8px] font-bold">M</span>
                        </span>
                        Manager Panel
                      </Link>
                    </li>
                  )}
                  <li className="md:hidden">
                    <button
                      onClick={() => {
                        handleLogout();
                        setMenuOpen(false);
                      }}
                      className="text-red-400 bg-transparent border-none text-left p-0 text-sm font-medium tracking-wide transition-colors duration-200 hover:text-red-500 flex items-center gap-2 w-full cursor-pointer"
                    >
                      <LogOut size={14} />
                      Sign Out
                    </button>
                  </li>
                </>
              ) : (
                <li className="md:hidden">
                  <Link
                    href="/login"
                    onClick={() => setMenuOpen(false)}
                    className="text-gold no-underline text-sm font-medium tracking-wide transition-colors duration-200 hover:text-white flex items-center gap-2"
                  >
                    <User size={14} />
                    Log In / Register
                  </Link>
                </li>
              )}
            </>
          )}
        </ul>

        {/* Auth Section */}
        {authUser ? (
          <div className="hidden md:block relative" ref={dropRef}>
            <button
              onClick={() => setDropOpen(!dropOpen)}
              className="flex items-center gap-2 group"
            >
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/20 flex-shrink-0">
                {userProfile?.photo_url ? (
                  <img
                    src={userProfile.photo_url}
                    alt="avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: "#c9a84c" }}
                  >
                    {initials}
                  </div>
                )}
              </div>
              <span className="text-white/85 text-sm font-medium max-w-[100px] truncate group-hover:text-white transition-colors">
                {displayName}
              </span>
              <ChevronDown
                size={14}
                className={`text-white/50 transition-transform ${dropOpen ? "rotate-180" : ""}`}
              />
            </button>

            {/* Dropdown */}
            {dropOpen && (
              <div className="absolute right-0 top-full mt-3 w-52 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-gray-50">
                  <p className="text-xs font-semibold text-gray-800 truncate">{displayName}</p>
                  <p className="text-[11px] text-gray-400 truncate">{authUser.email}</p>
                  <span
                    className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
                    style={{
                      background: "rgba(61,10,20,0.08)",
                      color: "#3d0a14",
                    }}
                  >
                    {userProfile?.role ?? "customer"}
                  </span>
                </div>

                <div className="py-1">
                  <Link
                    href="/profile"
                    onClick={() => setDropOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors no-underline"
                  >
                    <User size={14} className="text-gray-400" />
                    My Profile
                  </Link>
                  <Link
                    href="/profile#notifications"
                    onClick={() => { setDropOpen(false); }}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors no-underline"
                  >
                    <Bell size={14} className="text-gray-400" />
                    Notifications
                  </Link>
                  {userProfile?.role === "admin" && (
                    <Link
                      href="/admin"
                      onClick={() => setDropOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors no-underline"
                    >
                      <span className="w-3.5 h-3.5 rounded bg-red-800 flex items-center justify-center">
                        <span className="text-white text-[8px] font-bold">A</span>
                      </span>
                      Admin Dashboard
                    </Link>
                  )}
                  {(userProfile?.role === "manager" || userProfile?.role === "admin") && (
                    <Link
                      href="/manager"
                      onClick={() => setDropOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors no-underline"
                    >
                      <span className="w-3.5 h-3.5 rounded bg-blue-700 flex items-center justify-center">
                        <span className="text-white text-[8px] font-bold">M</span>
                      </span>
                      Manager Panel
                    </Link>
                  )}
                </div>

                <div className="border-t border-gray-100 py-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="hidden md:inline-block border border-gold text-gold px-4 py-1.5 rounded text-sm font-medium hover:bg-gold hover:text-burgundy-dark transition-all"
          >
            Log In
          </Link>
        )}
      </nav>
    </header>
  );
}
