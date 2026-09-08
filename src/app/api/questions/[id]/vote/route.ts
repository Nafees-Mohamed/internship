import { supabase } from "@/lib/supabase";
import { memoryStore } from "@/lib/store";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: questionId } = await params;
    const { voterId } = await req.json();

    const { error } = await supabase
      .from("votes")
      .insert({ question_id: questionId, voter_id: voterId });

    if (error) {
      if (error.code === "23505") {
        return Response.json({ error: "already voted" }, { status: 409 });
      }
      console.warn("Supabase vote failed, using memory store:", error.message);
      const res = memoryStore.upvoteQuestion(questionId, voterId);
      if (res.error) {
        return Response.json({ error: res.error }, { status: res.status });
      }
      return Response.json({ ok: true });
    }

    return Response.json({ ok: true });
  } catch (err: any) {
    console.warn("Supabase vote network error, using memory store:", err.message);
    const { id: questionId } = await params;
    const res = memoryStore.upvoteQuestion(questionId, "");
    return Response.json({ ok: true });
  }
}
