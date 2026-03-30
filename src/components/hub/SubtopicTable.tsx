import type { Subtopic } from "@/hooks/useSubtopics";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

interface Props {
  subtopics: Subtopic[];
  onToggleActive: (id: string, active: boolean) => void;
  onEdit: (id: string) => void;
}

export function SubtopicTable({ subtopics, onToggleActive, onEdit }: Props) {
  if (subtopics.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-10 text-center">
        <p className="text-muted-foreground">No subtopics found. Add one to get started.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-raised">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Subject</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Topic</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Subtopic</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Board</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tier</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Grade</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Order</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Active</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {subtopics.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0 hover:bg-raised/50 transition-colors">
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    s.subject === "Physics"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}>
                    {s.subject}
                  </span>
                </td>
                <td className="px-4 py-3 text-foreground">{s.topic}</td>
                <td className="px-4 py-3 font-medium text-foreground">{s.subtopic_name}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.exam_board}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.tier}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.grade_band}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.sort_order}</td>
                <td className="px-4 py-3 text-center">
                  <Switch
                    checked={s.active}
                    onCheckedChange={() => onToggleActive(s.id, s.active)}
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(s.id)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
