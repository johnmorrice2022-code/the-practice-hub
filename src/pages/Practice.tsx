
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { SessionSetup, SessionConfig } from "@/components/practice/SessionSetup";
import { SubtopicLanding } from "@/components/practice/SubtopicLanding";
import { LearningContent } from "@/components/learn/LearningContent";
import { PracticeRoom } from "@/components/practice/PracticeRoom";

type AppView = "setup" | "landing" | "learning" | "practice";

interface SubtopicDetails {
  config: SessionConfig;
  h5pUrl?: string | null;
  learningSections?: any[] | null;
}

const Practice = () => {
  const [view, setView] = useState<AppView>("setup");
  const [subtopicDetails, setSubtopicDetails] = useState<SubtopicDetails | null>(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const slug = searchParams.get("subtopic");
    if (!slug) return;

    async function loadFromSlug() {
      const { data } = await supabase
        .from("subtopics")
        .select("*")
        .eq("slug", slug)
        .single();

      if (!data) return;

      // Also fetch learning content
      const { data: learning } = await supabase
        .from("learning_content")
        .select("sections")
        .eq("subtopic_id", data.id)
        .single();

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
        learningSections: learning?.sections || null,
      });
      setView("landing");
    }

    loadFromSlug();
  }, [searchParams]);

  const handleSubtopicSelect = async (config: SessionConfig, h5pUrl?: string | null) => {
    // Fetch learning content for this subtopic
    const { data: learning } = await supabase
      .from("learning_content")
      .select("sections")
      .eq("subtopic_id", config.subtopicId)
      .single();

    setSubtopicDetails({
      config,
      h5pUrl,
      learningSections: learning?.sections || null,
    });
    setView("landing");
  };

  const handleLearn = () => setView("learning");
  const handlePractise = () => setView("practice");
  const handleBackToLanding = () => setView("landing");
  const handleBackToSetup = () => {
    setSubtopicDetails(null);
    setView("setup");
  };

  if (view === "learning" && subtopicDetails?.learningSections) {
    return (
      <LearningContent
        subtopicName={subtopicDetails.config.subtopicName}
        sections={subtopicDetails.learningSections}
        onComplete={handlePractise}
        onExit={handleBackToLanding}
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
            hasLearningContent={!!(subtopicDetails.learningSections?.length)}
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
