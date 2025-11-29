import { GoogleGenAI, Type, Schema } from "@google/genai";

export interface GeminiResponse {
  answer: string;
  follow_up_queries: string[];
}

export const fetchGeminiResponseApi = async (
  query: string,
  context: string = ""
): Promise<GeminiResponse> => {
  try {
  
    const response = await fetch("http://localhost:8000/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: query,
        context: context,
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend API Error: ${response.statusText}`);
    }

    return (await response.json()) as GeminiResponse;
  } catch (error) {
    console.error("Failed to fetch response:", error);
    return {
      answer: "Unable to connect to the backend. Is the Python server running?",
      follow_up_queries: ["Check Server", "Retry", "Debug"],
    };
  }
};
