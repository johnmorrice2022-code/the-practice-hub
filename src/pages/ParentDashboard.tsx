import { Navbar } from "@/components/Navbar";

const ParentDashboard = () => (
  <div className="min-h-screen">
    <Navbar />
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold">Parent <span className="text-accent-amber">dashboard</span></h1>
      <p className="mt-2 text-muted-foreground">Your child's progress overview is being built.</p>
    </div>
  </div>
);

export default ParentDashboard;
