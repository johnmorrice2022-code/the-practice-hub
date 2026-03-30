import { Navbar } from "@/components/Navbar";
import { LandingHero } from "@/components/LandingHero";
import { HowItWorks } from "@/components/HowItWorks";
import { WhyHubJam } from "@/components/WhyHubJam";
import { FounderSection } from "@/components/FounderSection";
import { Testimonials } from "@/components/Testimonials";
import { PricingCards } from "@/components/PricingCards";
import { Footer } from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <LandingHero />
      <HowItWorks />
      <WhyHubJam />
      <FounderSection />
      <Testimonials />
      <PricingCards />
      <Footer />
    </div>
  );
};

export default Index;
