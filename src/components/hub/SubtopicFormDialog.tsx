import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCreateSubtopic, useUpdateSubtopic, type Subtopic } from "@/hooks/useSubtopics";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingSubtopic: Subtopic | null;
}

const EMPTY = {
  subject: "Maths",
  topic: "",
  subtopic_name: "",
  exam_board: "AQA",
  tier: "Higher",
  grade_band: "7-9",
  description: "",
  sort_order: 0,
  prompt_config: "{}",
  difficulty_profile: "{}",
};

export function SubtopicFormDialog({ open, onOpenChange, editingSubtopic }: Props) {
  const createSubtopic = useCreateSubtopic();
  const updateSubtopic = useUpdateSubtopic();
  const { toast } = useToast();
  const isEditing = !!editingSubtopic;

  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (editingSubtopic) {
      setForm({
        subject: editingSubtopic.subject,
        topic: editingSubtopic.topic,
        subtopic_name: editingSubtopic.subtopic_name,
        exam_board: editingSubtopic.exam_board,
        tier: editingSubtopic.tier,
        grade_band: editingSubtopic.grade_band,
        description: editingSubtopic.description ?? "",
        sort_order: editingSubtopic.sort_order,
        prompt_config: JSON.stringify(editingSubtopic.prompt_config ?? {}, null, 2),
        difficulty_profile: JSON.stringify(editingSubtopic.difficulty_profile ?? {}, null, 2),
      });
    } else {
      setForm(EMPTY);
    }
  }, [editingSubtopic, open]);

  const set = (key: string, value: string | number) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let promptConfig = {};
    let difficultyProfile = {};
    try {
      promptConfig = JSON.parse(form.prompt_config);
      difficultyProfile = JSON.parse(form.difficulty_profile);
    } catch {
      toast({ title: "Invalid JSON", description: "Check prompt_config or difficulty_profile fields.", variant: "destructive" });
      return;
    }

    const payload = {
      subject: form.subject,
      topic: form.topic,
      subtopic_name: form.subtopic_name,
      exam_board: form.exam_board,
      tier: form.tier,
      grade_band: form.grade_band,
      description: form.description || null,
      sort_order: Number(form.sort_order),
      prompt_config: promptConfig,
      difficulty_profile: difficultyProfile,
    };

    try {
      if (isEditing) {
        await updateSubtopic.mutateAsync({ id: editingSubtopic.id, ...payload });
        toast({ title: "Subtopic updated" });
      } else {
        await createSubtopic.mutateAsync(payload);
        toast({ title: "Subtopic created" });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit subtopic" : "Add subtopic"}</DialogTitle>
        </DialogHeader>

        <form className="space-y-4 mt-2" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Subject</label>
              <select value={form.subject} onChange={(e) => set("subject", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm">
                <option>Maths</option>
                <option>Physics</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Exam board</label>
              <select value={form.exam_board} onChange={(e) => set("exam_board", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm">
                <option>AQA</option>
                <option>Edexcel</option>
                <option>OCR</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Topic</label>
            <input value={form.topic} onChange={(e) => set("topic", e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Subtopic name</label>
            <input value={form.subtopic_name} onChange={(e) => set("subtopic_name", e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm" required />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Tier</label>
              <select value={form.tier} onChange={(e) => set("tier", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm">
                <option>Foundation</option>
                <option>Higher</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Grade band</label>
              <select value={form.grade_band} onChange={(e) => set("grade_band", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm">
                <option>4-6</option>
                <option>7-9</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Sort order</label>
              <input type="number" value={form.sort_order} onChange={(e) => set("sort_order", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
              rows={2} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Prompt config (JSON)</label>
            <textarea value={form.prompt_config} onChange={(e) => set("prompt_config", e.target.value)}
              rows={3} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono resize-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Difficulty profile (JSON)</label>
            <textarea value={form.difficulty_profile} onChange={(e) => set("difficulty_profile", e.target.value)}
              rows={3} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono resize-none" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="hero">{isEditing ? "Save changes" : "Create subtopic"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
