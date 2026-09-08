import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text || !text.trim()) {
      return Response.json({ error: "Text is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Gemini API key is not configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const candidateModels = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.5-flash", "gemini-flash"];

    const prompt = `You are a helpful assistant for a Q&A and Polling app. Fix any spelling or grammar mistakes in the following question draft, and rephrase it to make it sound clear, concise, and professional. Return ONLY the improved question text. Do not add any introductory or concluding text, quotation marks, or explanations.
Draft: "${text}"`;

    let lastErr = null;
    for (const modelName of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const improvedText = response.text().trim();
        if (improvedText) {
          return Response.json({ text: improvedText });
        }
      } catch (e: any) {
        lastErr = e;
      }
    }

    return Response.json(
      { error: lastErr?.message || "Failed to generate improved draft with AI." },
      { status: 500 }
    );
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

