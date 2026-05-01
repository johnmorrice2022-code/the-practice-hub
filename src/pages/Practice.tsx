import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { supabase } from '@/integrations/supabase/client';
import {
  SessionSetup,
  SessionConfig,
} from '@/components/practice/SessionSetup';
import { SubtopicLanding } from '@/components/practice/SubtopicLanding';
import { LearningContent } from '@/components/learn/LearningContent';
import { CheckQuestions } from '@/components/learn/CheckQuestions';
import { PracticeRoom } from '@/components/practice/PracticeRoom';

type AppView = 'setup' | 'landing' | 'learning' | 'check' | 'practice';

interface SubtopicDetails {
  config: SessionConfig;
  h5pUrl?: string | null;
  tagline?: string | null;
  learningSections?: any[] | null;
  checkQuestions?: any[] | null;
}

const Practice = () => {
  const [view, setView] = useState<AppView>('setup');
  const [subtopicDetails, setSubtopicDetails] =
    useState<SubtopicDetails | null>(null);
  const [calculatorAllowed, setCalculatorAllowed] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const slug = searchParams.get('subtopic');
    if (!slug) return;
    loadFromSlug(slug);
  }, [searchParams]);

  const loadSubtopicData = async (
    subtopicId: string,
    subtopicData: any,
    h5pUrl?: string | null
  ) => {
    const [learningRes, checkRes] = await Promise.all([
      supabase
        .from('learning_content')
        .select('sections')
        .eq('subtopic_id', subtopicId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('check_questions')
        .select('*')
        .eq('subtopic_id', subtopicId)
        .order('question_order'),
    ]);

    return {
      config: {
        subject: subtopicData.subject,
        topic: subtopicData.topic,
        subtopicId: subtopicData.id,
        subtopicName: subtopicData.subtopic_name,
        tier: subtopicData.tier,
        gradeBand: subtopicData.grade_band,
      },
      h5pUrl: h5pUrl ?? subtopicData.h5p_url ?? null,
      tagline: subtopicData.tagline ?? null,
      learningSections: learningRes.data?.sections || null,
      checkQuestions: checkRes.data || null,
    };
  };

  const loadFromSlug = async (slug: string) => {
    const { data } = await supabase
      .from('subtopics')
      .select('*')
      .eq('slug', slug)
      .single();
    if (!data) return;
    const details = await loadSubtopicData(data.id, data);
    setSubtopicDetails(details);
    setView('landing');
  };

  const handleSubtopicSelect = async (
    config: SessionConfig,
    h5pUrl?: string | null
  ) => {
    const { data } = await supabase
      .from('subtopics')
      .select('*')
      .eq('id', config.subtopicId)
      .single();
    if (!data) return;
    const details = await loadSubtopicData(config.subtopicId, data, h5pUrl);
    setSubtopicDetails(details);
    setView('landing');
  };

  const handleLearn = () => setView('learning');
  const handleLearningComplete = () => {
    if (subtopicDetails?.checkQuestions?.length) {
      setView('check');
    } else {
      setView('practice');
    }
  };
  const handleCheckComplete = () => setView('practice');

  const handlePractise = (calcAllowed: boolean) => {
    setCalculatorAllowed(calcAllowed);
    setView('practice');
  };

  const handleBackToLanding = () => setView('landing');
  const handleBackToSetup = () => {
    setSubtopicDetails(null);
    setCalculatorAllowed(false);
    setView('setup');
  };

  if (view === 'learning' && subtopicDetails?.learningSections) {
    return (
      <LearningContent
        subtopicName={subtopicDetails.config.subtopicName}
        sections={subtopicDetails.learningSections}
        onComplete={handleLearningComplete}
        onExit={handleBackToLanding}
      />
    );
  }

  if (view === 'check' && subtopicDetails?.checkQuestions?.length) {
    return (
      <CheckQuestions
        subtopicName={subtopicDetails.config.subtopicName}
        questions={subtopicDetails.checkQuestions}
        onComplete={handleCheckComplete}
        onExit={handleBackToLanding}
      />
    );
  }

  if (view === 'practice' && subtopicDetails) {
    return (
      <PracticeRoom
        config={subtopicDetails.config}
        calculatorAllowed={calculatorAllowed}
        onExit={handleBackToLanding}
      />
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="px-6 py-12">
        {view === 'landing' && subtopicDetails ? (
          <SubtopicLanding
            subtopicName={subtopicDetails.config.subtopicName}
            topic={subtopicDetails.config.topic}
            subject={subtopicDetails.config.subject}
            tier={subtopicDetails.config.tier}
            gradeBand={subtopicDetails.config.gradeBand}
            tagline={subtopicDetails.tagline}
            h5pUrl={subtopicDetails.h5pUrl}
            hasLearningContent={!!subtopicDetails.learningSections?.length}
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
