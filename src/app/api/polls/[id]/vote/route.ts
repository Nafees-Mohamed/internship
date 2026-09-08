import { supabase } from "@/lib/supabase";
import { memoryStore } from "@/lib/store";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pollId } = await params;
    const { optionId, voterId } = await req.json();

    if (!optionId || !voterId) {
      return Response.json({ error: "optionId and voterId are required" }, { status: 400 });
    }

    const { data: option, error: optionError } = await supabase
      .from("poll_options")
      .select("is_correct, poll_id")
      .eq("id", optionId)
      .single();

    if (optionError || !option || option.poll_id !== pollId) {
      console.warn("Supabase poll option check failed, checking memory store:", optionError?.message);
      const res = memoryStore.votePoll(pollId, optionId, voterId);
      if (res.error) {
        return Response.json({ error: res.error }, { status: res.status });
      }
      return Response.json(res);
    }

    const { error: responseError } = await supabase
      .from("poll_responses")
      .insert({ poll_id: pollId, option_id: optionId, voter_id: voterId });

    if (responseError) {
      if (responseError.code === "23505") {
        return Response.json({ error: "You have already voted on this poll" }, { status: 409 });
      }
      console.warn("Supabase response insert failed, using memory store:", responseError.message);
      const res = memoryStore.votePoll(pollId, optionId, voterId);
      if (res.error) {
        return Response.json({ error: res.error }, { status: res.status });
      }
      return Response.json(res);
    }

    const pointsAwarded = option.is_correct ? 10 : 0;
    
    const { error: rpcError } = await supabase.rpc("increment_voter_points", {
      v_id: voterId,
      pts: pointsAwarded,
    });

    if (rpcError) {
      memoryStore.incrementVoterPoints(voterId, pointsAwarded);
    }


    return Response.json({
      ok: true,
      isCorrect: option.is_correct,
      pointsAwarded,
    });
  } catch (err: any) {
    console.warn("Supabase poll vote network error, using memory store:", err.message);
    const { id: pollId } = await params;
    const { optionId, voterId } = await req.json().catch(() => ({ optionId: "", voterId: "" }));
    const res = memoryStore.votePoll(pollId, optionId, voterId);
    if (res.error) {
      return Response.json({ error: res.error }, { status: res.status });
    }
    return Response.json(res);
  }
}
