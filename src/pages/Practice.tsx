import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { SessionSetup, SessionConfig } from "@/components/practice/SessionSetup";
import { SubtopicLanding } from "@/components/practice/SubtopicLanding";
import { LearningRoom } from "@/components/practice/LearningRoom";
import { PracticeRoom } from "@/components/practice/PracticeRoom";

type AppView = "setup" | "landing" | "learning" | "practice";

interface SubtopicDetails {
  config: SessionConfig;
  h5pUrl?: string | null;
}

const Practice = () => {
  const [view, setView] = useState<AppView>("setup");
  const [subtopicDetails, setSubtopicDetails] = useState<SubtopicDetails | null>(null);

  const handleSubtopicSelect = (config: SessionConfig, h5pUrl?: string | null) => {
    setSubtopicDetails({ config, h5pUrl });
    setView("landing");
  };

  const handleLearn = () => setView("learning");
  const handlePractise = () => setView("practice");
  const handleBackToLanding = () => setView("landing");
  const handleBackToSetup = () => {
    setSubtopicDetails(null);
    setView("setup");
  };

  // Full screen views — no navbar
  if (view === "learning" && subtopicDetails?.h5pUrl) {
    return (
      <LearningRoom
        subtopicName={subtopicDetails.config.subtopicName}
        h5pUrl={subtopicDetails.h5pUrl}
        onExit={handleBackToLanding}
        onPractise={handlePractise}
      />
    );
  }

  if (view === "practice" && subtopicDetails) {
    return (
      <PracticeRoom
        config={subtopicDetails.config}
        onExit={handleBackToLanding}
      />
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="px-6 py-12">
        {view === "landing" && subtopicDetails ? (
          <SubtopicLanding
            subtopicName={subtopicDetails.config.subtopicName}
            topic={subtopicDetails.config.topic}
            subject={subtopicDetails.config.subject}
            tier={subtopicDetails.config.tier}
            gradeBand={subtopicDetails.config.gradeBand}
            h5pUrl={subtopicDetails.h5pUrl}
            onLearn={handleLearn}
            onPractise={handlePractise}
            onBack={handleBackToSetup}
          />
        ) : (
          <SessionSetup onStart={handleSubtopicSelect} />
        )}
      </div>
    </div>
  );
};

export default Practice;

