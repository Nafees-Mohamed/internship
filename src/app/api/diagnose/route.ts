export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  return Response.json({
    SUPABASE_URL: supabaseUrl ? `Present (length: ${supabaseUrl.length})` : "Missing",
    SUPABASE_SERVICE_ROLE_KEY: supabaseServiceKey ? `Present (length: ${supabaseServiceKey.length})` : "Missing",
    GEMINI_API_KEY: geminiApiKey ? `Present (length: ${geminiApiKey.length})` : "Missing",
    NODE_ENV: process.env.NODE_ENV || "not set",
  });
}
