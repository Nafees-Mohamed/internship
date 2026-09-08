import { supabase } from "@/lib/supabase";
import { memoryStore } from "@/lib/store";

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
        return Response.json(memoryStore.getVoter(voterId));
      }
      console.warn("Supabase voter fetch failed, using memory store:", error.message);
      return Response.json(memoryStore.getVoter(voterId));
    }

    return Response.json(data);
  } catch (err: any) {
    console.warn("Supabase voter network error, using memory store:", err.message);
    const { searchParams } = new URL(req.url);
    const voterId = searchParams.get("voterId") || "";
    return Response.json(memoryStore.getVoter(voterId));
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
      console.warn("Supabase register voter failed, using memory store:", error.message);
      memoryStore.registerVoter(voterId, username.trim());
      return Response.json({ ok: true });
    }

    // Synchronize memory store as well
    memoryStore.registerVoter(voterId, username.trim());
    return Response.json({ ok: true });
  } catch (err: any) {
    console.warn("Supabase register voter network error, using memory store:", err.message);
    const { voterId, username } = await req.json().catch(() => ({ voterId: "", username: "" }));
    if (voterId && username) {
      memoryStore.registerVoter(voterId, username);
    }
    return Response.json({ ok: true });
  }
}
