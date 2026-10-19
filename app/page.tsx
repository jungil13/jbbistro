import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import PromoSection from "@/components/PromoSection";
import Services from "@/components/Services";
import ReserveCTA from "@/components/ReserveCTA";
import Footer from "@/components/Footer";

export default async function Home() {
  return (
    <>
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
