import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { question, userChoice, correctChoice } = await req.json();

    if (!question || !correctChoice) {
      return Response.json(
        { error: "question and correctChoice are required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Fallback explanation if API key is not configured
      const isCorrect = userChoice === correctChoice;
      const fallbackMsg = isCorrect
        ? `Great job! "${correctChoice}" is the correct answer to "${question}".`
        : `The correct answer is "${correctChoice}". You selected "${userChoice || "No answer (Time expired)"}".`;
      return Response.json({ explanation: fallbackMsg });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const candidateModels = [
      "gemini-1.5-flash",
      "gemini-2.0-flash",
      "gemini-2.5-flash",
      "gemini-flash",
    ];

    const isUserCorrect = userChoice === correctChoice;
    const prompt = `You are an educational tutor in an interactive quiz app.
Question: "${question}"
Correct Answer: "${correctChoice}"
User's Answer: "${userChoice || "No answer submitted (Time ran out)"}"

Task: Provide a concise, clear 2-3 sentence explanation explaining:
1. Why "${correctChoice}" is the correct answer.
2. ${
      isUserCorrect
        ? "Reinforce why the user's choice was right."
        : `Why "${userChoice || "Time expired"}" was incorrect.`
    }

Format: Return ONLY the explanation text. Keep it friendly, encouraging, and informative. Do not use quotes or introductory headings.`;

    let lastErr = null;
    for (const modelName of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const explanation = response.text().trim();
        if (explanation) {
          return Response.json({ explanation });
        }
      } catch (e: any) {
        lastErr = e;
      }
    }

    // Secondary fallback if AI generation errors out
    const isCorrect = userChoice === correctChoice;
    const fallbackMsg = isCorrect
      ? `Correct! "${correctChoice}" is the right choice for "${question}".`
      : `The correct answer is "${correctChoice}". You chose "${userChoice || "No answer"}".`;
    return Response.json({ explanation: fallbackMsg });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
