import { Navbar } from "@/components/Navbar";

const History = () => (
  <div className="min-h-screen">
    <Navbar />
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold">Session <span className="text-accent-amber">history</span></h1>
      <p className="mt-2 text-muted-foreground">Past sessions and feedback will appear here.</p>
    </div>
  </div>
);

export default History;
