import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("voters")
      .select("voter_id, username, points")
      .order("points", { ascending: false })
      .limit(50);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ leaderboard: data ?? [] });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
