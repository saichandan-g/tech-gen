import { type NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres";
import { callAIProviderWithFallback, getProviderFromModel, getModelFromSelection, AIProvider, ProviderConfig } from '../../api/utils';

// This function would be adapted to insert general technical questions
async function insertTechnicalQuestion(pool: any, question: any) {
  // Placeholder for actual insertion logic for technical questions
  // For now, we'll just log it and return a dummy ID
  console.log("Inserting technical question:", question);
  // Example: INSERT INTO technical_questions (question_text, topic, difficulty) VALUES ($1, $2, $3)
  // For now, we'll just return a dummy ID
  return { id: Math.floor(Math.random() * 1000) };
}

function extractJSONArray(raw: string): any[] {
  const s = raw.trim();
  const firstBracket = s.indexOf('[');
  const lastBracket = s.lastIndexOf(']');
  if (firstBracket === -1 || lastBracket === -1 || lastBracket < firstBracket) {
    const firstBrace = s.indexOf('{');
    const lastBrace = s.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonString = s.substring(firstBrace, lastBrace + 1);
      try {
        return [JSON.parse(jsonString)];
      } catch (e) {
        throw new Error("Failed to parse JSON object from response");
      }
    }
    throw new Error("Invalid response format: No JSON array or object found");
  }
  const jsonString = s.substring(firstBracket, lastBracket + 1);
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    throw new Error("Failed to parse JSON array from response");
  }
}

const systemPrompt = "You are a JSON generator for technical interview questions. Respond with a JSON array of questions.";

const promptTemplate = (topic: string, difficulty: string, count: number) => `
  Generate ${count} technical interview question(s) about ${topic} with ${difficulty} difficulty.
  Return ONLY a JSON array with this structure:
  [
    {
      "question": "Question text",
      "topic": "${topic}",
      "difficulty": "${difficulty}"
    }
  ]
`;

async function generateTechnicalQuestions(topic: string, difficulty: string, selectedAIModel: string, apiKey: string, numberOfQuestions: number) {
  const provider = getProviderFromModel(selectedAIModel);
  if (!provider) {
    throw new Error(`Unsupported AI model: ${selectedAIModel}`);
  }
  const modelName = getModelFromSelection(selectedAIModel);
  const providerConfig: ProviderConfig = {
    apiKey: apiKey.trim(),
    provider,
    model: modelName,
  };
  const text = await callAIProviderWithFallback(
    providerConfig,
    promptTemplate(topic, difficulty, numberOfQuestions),
    systemPrompt
  );
  if (!text) {
    throw new Error("Failed to generate text from AI provider.");
  }
  return extractJSONArray(text);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic, difficulty, selectedAIModel, apiKey, numberOfQuestions = 1 } = body;

    if (!topic || !difficulty || !selectedAIModel || !apiKey) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const questions = await generateTechnicalQuestions(topic, difficulty, selectedAIModel, apiKey, numberOfQuestions);
    
    const pool = getPool();
    const insertedIds = [];
    for (const question of questions) {
      const result = await insertTechnicalQuestion(pool, question);
      insertedIds.push(result.id);
    }

    return NextResponse.json({
      message: "Technical questions generated successfully",
      ids: insertedIds,
      questions: questions
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ message: "Internal Server Error", error: err?.message }, { status: 500 });
  }
}
