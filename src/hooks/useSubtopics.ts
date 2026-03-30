import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Subtopic = Tables<"subtopics">;

export function useSubtopics() {
  return useQuery({
    queryKey: ["subtopics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subtopics")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as Subtopic[];
    },
  });
}

export function useCreateSubtopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (subtopic: TablesInsert<"subtopics">) => {
      const { data, error } = await supabase.from("subtopics").insert(subtopic).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subtopics"] }),
  });
}

export function useUpdateSubtopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"subtopics"> & { id: string }) => {
      const { data, error } = await supabase.from("subtopics").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subtopics"] }),
  });
}
