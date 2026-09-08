import { supabase } from "@/lib/supabase";
import { getQuestionsPage, searchQuestions } from "@/lib/questions";
import { memoryStore } from "@/lib/store";

const PAGE_SIZE = 10;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();

    if (q) {
      const questions = await searchQuestions(q, PAGE_SIZE);
      return Response.json({ questions, hasMore: false });
    }

    const offset = Number(searchParams.get("offset") ?? 0);
    const { questions, hasMore } = await getQuestionsPage(offset, PAGE_SIZE);
    return Response.json({ questions, hasMore });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { body, author } = await req.json();

    if (!body || !body.trim()) {
      return Response.json({ error: "Question text is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("questions")
      .insert({ body: body.trim(), author })
      .select()
      .single();

    if (error) {
      console.warn("Supabase insert question failed, using memory store:", error.message);
      const created = memoryStore.addQuestion(body.trim(), author);
      return Response.json(created);
    }
    return Response.json(data);
  } catch (err: any) {
    console.warn("Supabase POST failed, using memory store fallback:", err.message);
    const { body, author } = await req.json().catch(() => ({ body: "", author: "" }));
    const created = memoryStore.addQuestion(body, author);
    return Response.json(created);
  }
}
