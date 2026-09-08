import { supabase } from "@/lib/supabase";
import { memoryStore } from "@/lib/store";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const voterId = searchParams.get("voterId");

    const { data, error } = await supabase
      .from("polls")
      .select(`
        id,
        question,
        created_at,
        options:poll_options(id, text, is_correct),
        responses:poll_responses(option_id, voter_id)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Supabase GET polls failed, using memory store:", error.message);
      return Response.json({ polls: memoryStore.getPolls(voterId) });
    }

    const formattedPolls = (data ?? []).map((poll: any) => {
      const voterResponse = poll.responses?.find((r: any) => r.voter_id === voterId);
      const hasVoted = !!voterResponse;

      const options = (poll.options ?? []).map((opt: any) => {
        const votesCount = (poll.responses ?? []).filter((r: any) => r.option_id === opt.id).length;
        return {
          id: opt.id,
          text: opt.text,
          votesCount,
          is_correct: hasVoted ? opt.is_correct : undefined,
        };
      });

      return {
        id: poll.id,
        question: poll.question,
        created_at: poll.created_at,
        options,
        votedOptionId: voterResponse?.option_id || null,
        totalVotes: poll.responses?.length ?? 0,
      };
    });

    return Response.json({ polls: formattedPolls });
  } catch (err: any) {
    console.warn("Supabase GET polls network error, using memory store:", err.message);
    const { searchParams } = new URL(req.url);
    const voterId = searchParams.get("voterId");
    return Response.json({ polls: memoryStore.getPolls(voterId) });
  }
}

export async function POST(req: Request) {
  try {
    const { question, options } = await req.json();

    if (!question || !question.trim() || !options || !Array.isArray(options) || options.length < 2) {
      return Response.json({ error: "question and at least 2 options are required" }, { status: 400 });
    }

    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .insert({ question: question.trim() })
      .select()
      .single();

    if (pollError) {
      console.warn("Supabase create poll failed, using memory store:", pollError.message);
      const created = memoryStore.createPoll(question.trim(), options);
      return Response.json(created);
    }

    const optionsToInsert = options.map((opt: any) => ({
      poll_id: poll.id,
      text: opt.text.trim(),
      is_correct: !!opt.is_correct,
    }));

    const { error: optionsError } = await supabase
      .from("poll_options")
      .insert(optionsToInsert);

    if (optionsError) {
      await supabase.from("polls").delete().eq("id", poll.id);
      console.warn("Supabase insert options failed, using memory store:", optionsError.message);
      const created = memoryStore.createPoll(question.trim(), options);
      return Response.json(created);
    }

    return Response.json({ id: poll.id, question: poll.question });
  } catch (err: any) {
    console.warn("Supabase POST poll error, using memory store:", err.message);
    try {
      const { question, options } = await req.json();
      const created = memoryStore.createPoll(question.trim(), options);
      return Response.json(created);
    } catch (e) {
      return Response.json({ error: "Failed to create poll" }, { status: 500 });
    }
  }
}
