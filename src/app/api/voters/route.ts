import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const voterId = searchParams.get("voterId");

    if (!voterId) {
      return Response.json({ error: "voterId is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("voters")
      .select("username, points")
      .eq("voter_id", voterId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // Not found in DB, return default values
        return Response.json({ username: "Anonymous Voter", points: 0 });
      }
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { voterId, username } = await req.json();

    if (!voterId || !username || !username.trim()) {
      return Response.json({ error: "voterId and username are required" }, { status: 400 });
    }

    const { error } = await supabase.rpc("register_voter", {
      v_id: voterId,
      u_name: username.trim(),
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
