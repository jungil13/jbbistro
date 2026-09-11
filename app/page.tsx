import Navbar from "@/components/Navbar";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import Hero from "@/components/Hero";
import PromoSection from "@/components/PromoSection";
import Services from "@/components/Services";
import ReserveCTA from "@/components/ReserveCTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <AnnouncementBanner />
      <Navbar />
      <main>
        <Hero />
        <PromoSection />
        <Services />
        <ReserveCTA />
      </main>
      <Footer />
    </>
  );
}
