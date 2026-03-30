import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export interface SessionConfig {
  subject: string;
  topic: string;
  subtopicId: string;
  subtopicName: string;
  tier: string;
  gradeBand: string;
}

interface Subtopic {
  id: string;
  subject: string;
  topic: string;
  subtopic_name: string;
  tier: string;
  grade_band: string;
}

interface SessionSetupProps {
  onStart: (config: SessionConfig) => void;
}

export function SessionSetup({ onStart }: SessionSetupProps) {
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  const [loading, setLoading] = useState(true);

  const [subject, setSubject] = useState("");
  const [tier, setTier] = useState("");
  const [gradeBand, setGradeBand] = useState("");
  const [topic, setTopic] = useState("");
  const [subtopicId, setSubtopicId] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("subtopics")
        .select("id, subject, topic, subtopic_name, tier, grade_band")
        .eq("active", true)
        .order("sort_order");
      setSubtopics(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  // Derive unique values at each level
  const subjects = [...new Set(subtopics.map((s) => s.subject))];

  const tiers = [
    ...new Set(
      subtopics.filter((s) => s.subject === subject).map((s) => s.tier)
    ),
  ];

  const gradeBands = [
    ...new Set(
      subtopics
        .filter((s) => s.subject === subject && s.tier === tier)
        .map((s) => s.grade_band)
    ),
  ];

  const needsGradeBand = tier === "Higher" && gradeBands.length > 1;

  const topics = [
    ...new Set(
      subtopics
        .filter(
          (s) =>
            s.subject === subject &&
            s.tier === tier &&
            (needsGradeBand ? s.grade_band === gradeBand : true)
        )
        .map((s) => s.topic)
    ),
  ];

  const availableSubtopics = subtopics.filter(
    (s) =>
      s.subject === subject &&
      s.tier === tier &&
      s.topic === topic &&
      (needsGradeBand ? s.grade_band === gradeBand : true)
  );

  // Reset downstream when upstream changes
  const handleSubjectChange = (val: string) => {
    setSubject(val);
    setTier("");
    setGradeBand("");
    setTopic("");
    setSubtopicId("");
  };

  const handleTierChange = (val: string) => {
    setTier(val);
    setGradeBand("");
    setTopic("");
    setSubtopicId("");
  };

  const handleGradeBandChange = (val: string) => {
    setGradeBand(val);
    setTopic("");
    setSubtopicId("");
  };

  const handleTopicChange = (val: string) => {
    setTopic(val);
    setSubtopicId("");
  };

  const selectedSubtopic = subtopics.find((s) => s.id === subtopicId);

  const canStart = subject && tier && topic && subtopicId && (!needsGradeBand || gradeBand);

  const handleStart = () => {
    if (!selectedSubtopic) return;
    onStart({
      subject,
      topic,
      subtopicId: selectedSubtopic.id,
      subtopicName: selectedSubtopic.subtopic_name,
      tier,
      gradeBand: selectedSubtopic.grade_band,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">
          Start a <span className="text-accent-amber">Jam Session</span>
        </h1>
        <p className="text-muted-foreground text-sm">
          Choose your subject, tier, and topic to begin.
        </p>
      </div>

      <div className="bg-card rounded-xl p-6 card-shadow space-y-4">
        {/* Subject */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Subject</label>
          <Select value={subject} onValueChange={handleSubjectChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select subject" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tier */}
        {subject && (
          <div className="space-y-1.5 animate-fade-in">
            <label className="text-sm font-medium text-foreground">Tier</label>
            <Select value={tier} onValueChange={handleTierChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select tier" />
              </SelectTrigger>
              <SelectContent>
                {tiers.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Grade Band (Higher only) */}
        {needsGradeBand && (
          <div className="space-y-1.5 animate-fade-in">
            <label className="text-sm font-medium text-foreground">Grade Band</label>
            <Select value={gradeBand} onValueChange={handleGradeBandChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select grade band" />
              </SelectTrigger>
              <SelectContent>
                {gradeBands.map((gb) => (
                  <SelectItem key={gb} value={gb}>{gb}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Topic */}
        {tier && (!needsGradeBand || gradeBand) && (
          <div className="space-y-1.5 animate-fade-in">
            <label className="text-sm font-medium text-foreground">Topic</label>
            <Select value={topic} onValueChange={handleTopicChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select topic" />
              </SelectTrigger>
              <SelectContent>
                {topics.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Subtopic */}
        {topic && (
          <div className="space-y-1.5 animate-fade-in">
            <label className="text-sm font-medium text-foreground">Subtopic</label>
            <Select value={subtopicId} onValueChange={setSubtopicId}>
              <SelectTrigger>
                <SelectValue placeholder="Select subtopic" />
              </SelectTrigger>
              <SelectContent>
                {availableSubtopics.map((st) => (
                  <SelectItem key={st.id} value={st.id}>
                    {st.subtopic_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Start */}
        <Button
          onClick={handleStart}
          disabled={!canStart}
          className="w-full mt-2"
          size="lg"
        >
          Start Jam Session
        </Button>
      </div>
    </div>
  );
}
