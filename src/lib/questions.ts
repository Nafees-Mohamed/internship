import { supabase } from "@/lib/supabase";
import { memoryStore } from "@/lib/store";

export async function getQuestionsPage(offset: number, limit: number) {
  try {
    const { data, error } = await supabase
      .from("questions")
      .select("id, body, author, created_at, votes(count)")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit);

    if (error) throw new Error(error.message);

    const rows = (data ?? []).map((q) => ({
      id: q.id,
      body: q.body,
      author: q.author,
      votes: q.votes?.[0]?.count ?? 0,
    }));

    const hasMore = rows.length > limit;
    return { questions: rows.slice(0, limit), hasMore };
  } catch (err) {
    console.warn("Supabase fetch failed, falling back to memory store:", (err as Error).message);
    return memoryStore.getQuestionsPage(offset, limit);
  }
}

export async function searchQuestions(q: string, limit: number) {
  try {
    const { data, error } = await supabase
      .from("questions")
      .select("id, body, author, created_at, votes(count)")
      .textSearch("body", q, { type: "websearch", config: "english" })
      .limit(limit);

    if (!error && data) {
      return data.map((row) => ({
        id: row.id,
        body: row.body,
        author: row.author,
        votes: row.votes?.[0]?.count ?? 0,
      }));
    }

    const { data: fallbackData, error: fallbackError } = await supabase
      .from("questions")
      .select("id, body, author, created_at, votes(count)")
      .ilike("body", `%${q}%`)
      .limit(limit);

    if (fallbackError) throw new Error(fallbackError.message);

    return (fallbackData ?? []).map((row) => ({
      id: row.id,
      body: row.body,
      author: row.author,
      votes: row.votes?.[0]?.count ?? 0,
    }));
  } catch (err) {
    console.warn("Supabase search failed, falling back to memory store:", (err as Error).message);
    return memoryStore.searchQuestions(q, limit);
  }
}
