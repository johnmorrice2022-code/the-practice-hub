import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { SessionSetup, SessionConfig } from "@/components/practice/SessionSetup";
import { PracticeRoom } from "@/components/practice/PracticeRoom";

const Practice = () => {
  const [sessionConfig, setSessionConfig] = useState<SessionConfig | null>(null);

  // When in a session, render only the PracticeRoom (no navbar)
  if (sessionConfig) {
    return (
      <PracticeRoom
        config={sessionConfig}
        onExit={() => setSessionConfig(null)}
      />
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="px-6 py-12">
        <SessionSetup onStart={setSessionConfig} />
      </div>
    </div>
  );
};

export default Practice;
