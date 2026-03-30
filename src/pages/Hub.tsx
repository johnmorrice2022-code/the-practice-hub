import { Navbar } from "@/components/Navbar";

const Hub = () => (
  <div className="min-h-screen">
    <Navbar />
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold">The <span className="text-accent-amber">Hub</span></h1>
      <p className="mt-2 text-muted-foreground">Admin panel is being built.</p>
    </div>
  </div>
);

export default Hub;
