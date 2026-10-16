import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import CustomerRatings from "@/components/CustomerRatings";
import PromoSection from "@/components/PromoSection";
import Services from "@/components/Services";
import ReserveCTA from "@/components/ReserveCTA";
import Footer from "@/components/Footer";

import { getRatingsAction } from "@/app/actions/ratings";

export default async function Home() {
  const ratingsRes = await getRatingsAction();
  const initialRatings = ratingsRes?.success ? ratingsRes.data : [];

  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <CustomerRatings initialRatings={initialRatings} />
        <PromoSection />
        <Services />
        <ReserveCTA />
      </main>
      <Footer />
    </>
  );
}
