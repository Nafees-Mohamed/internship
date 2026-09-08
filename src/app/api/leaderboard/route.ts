import { supabase } from "@/lib/supabase";
import { memoryStore } from "@/lib/store";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("voters")
      .select("voter_id, username, points")
      .order("points", { ascending: false })
      .limit(50);

    if (error) {
      console.warn("Supabase leaderboard fetch failed, using memory store:", error.message);
      return Response.json({ leaderboard: memoryStore.getLeaderboard() });
    }

    return Response.json({ leaderboard: data ?? [] });
  } catch (err: any) {
    console.warn("Supabase leaderboard network error, using memory store:", err.message);
    return Response.json({ leaderboard: memoryStore.getLeaderboard() });
  }
}
