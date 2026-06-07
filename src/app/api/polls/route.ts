import { supabase } from "@/lib/supabase";

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
      return Response.json({ error: error.message }, { status: 500 });
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
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { question, options } = await req.json();

    if (!question || !question.trim() || !options || !Array.isArray(options) || options.length < 2) {
      return Response.json({ error: "question and at least 2 options are required" }, { status: 400 });
    }

    // 1. Insert the poll
    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .insert({ question: question.trim() })
      .select()
      .single();

    if (pollError) {
      return Response.json({ error: pollError.message }, { status: 500 });
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
      return Response.json({ error: optionsError.message }, { status: 500 });
    }

    return Response.json({ id: poll.id, question: poll.question });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
