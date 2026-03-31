import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { SessionSetup, SessionConfig } from "@/components/practice/SessionSetup";
import { SubtopicLanding } from "@/components/practice/SubtopicLanding";
import { PracticeRoom } from "@/components/practice/PracticeRoom";

type AppView = "setup" | "landing" | "practice";

interface SubtopicDetails {
  config: SessionConfig;
  h5pUrl?: string | null;
}

const Practice = () => {
  const [view, setView] = useState<AppView>("setup");
  const [subtopicDetails, setSubtopicDetails] = useState<SubtopicDetails | null>(null);
  const [searchParams] = useSearchParams();

  // Handle deep link — ?subtopic=completing-the-square
  useEffect(() => {
    const slug = searchParams.get("subtopic");
    if (!slug) return;

    async function loadFromSlug() {
      const { data } = await supabase
        .from("subtopics")
        .select("*")
        .eq("slug", slug)
        .eq("active", true)
        .single();

      if (!data) return;

      setSubtopicDetails({
        config: {
          subject: data.subject,
          topic: data.topic,
          subtopicId: data.id,
          subtopicName: data.subtopic_name,
          tier: data.tier,
          gradeBand: data.grade_band,
        },
        h5pUrl: data.h5p_url,
      });
      setView("landing");
    }

    loadFromSlug();
  }, [searchParams]);

  const handleSubtopicSelect = (config: SessionConfig, h5pUrl?: string | null) => {
    setSubtopicDetails({ config, h5pUrl });
    setView("landing");
  };

  const handlePractise = () => setView("practice");
  const handleBackToSetup = () => {
    setSubtopicDetails(null);
    setView("setup");
  };
  const handleBackToLanding = () => setView("landing");

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


