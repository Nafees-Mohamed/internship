import { supabase } from "@/lib/supabase";

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

    // 1. Check if the option belongs to this poll
    const { data: option, error: optionError } = await supabase
      .from("poll_options")
      .select("is_correct, poll_id")
      .eq("id", optionId)
      .single();

    if (optionError || !option || option.poll_id !== pollId) {
      return Response.json({ error: "Invalid option or poll mismatch" }, { status: 400 });
    }

    // 2. Insert into poll_responses
    const { error: responseError } = await supabase
      .from("poll_responses")
      .insert({ poll_id: pollId, option_id: optionId, voter_id: voterId });

    if (responseError) {
      if (responseError.code === "23505") {
        // Unique constraint violation (already voted)
        return Response.json({ error: "You have already voted on this poll" }, { status: 409 });
      }
      return Response.json({ error: responseError.message }, { status: 500 });
    }

    // 3. Award points if correct (10 points for correct, 0 for incorrect to register them)
    const pointsAwarded = option.is_correct ? 10 : 0;
    
    const { error: rpcError } = await supabase.rpc("increment_voter_points", {
      v_id: voterId,
      pts: pointsAwarded,
    });

    if (rpcError) {
      // Log error but don't fail the response since the vote was recorded
      console.error("Failed to update points:", rpcError.message);
    }

    return Response.json({
      ok: true,
      isCorrect: option.is_correct,
      pointsAwarded,
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
