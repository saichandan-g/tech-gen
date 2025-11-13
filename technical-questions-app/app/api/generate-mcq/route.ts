import { type NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres";
import { callAIProviderWithFallback, getProviderFromModel, getModelFromSelection, AIProvider, ProviderConfig } from '../../api/utils';

async function insertMCQ(pool: any, mcq: any) {
  const sql = `
    INSERT INTO mcq_questions (question, options, correct_answer, topic, difficulty)
    VALUES ($1, $2::jsonb, $3, $4, $5)
    RETURNING id;
  `;
  const params = [mcq.question, JSON.stringify(mcq.options), mcq.correct_answer, mcq.topic, mcq.difficulty];
  const res = await pool.query(sql, params);
  return res.rows[0];
}

function extractJSONArray(raw: string): any[] {
  const s = raw.trim();
  const firstBracket = s.indexOf('[');
  const lastBracket = s.lastIndexOf(']');
  if (firstBracket === -1 || lastBracket === -1 || lastBracket < firstBracket) {
    // Fallback for single object
    const firstBrace = s.indexOf('{');
    const lastBrace = s.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonString = s.substring(firstBrace, lastBrace + 1);
      try {
        return [JSON.parse(jsonString)]; // Return as an array with one element
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

const systemPrompt = "You are a JSON generator for multiple-choice questions. Respond with a JSON array of questions.";

const promptTemplate = (topic: string, difficulty: string, count: number) => `
  Generate ${count} multiple-choice question(s) about ${topic} with ${difficulty} difficulty.
  Return ONLY a JSON array with this structure:
  [
    {
      "question": "Question text",
      "options": {
        "A": "Option A text",
        "B": "Option B text",
        "C": "Option C text",
        "D": "Option D text"
      },
      "correct_answer": "A", // Must be one of "A", "B", "C", "D"
      "topic": "${topic}",
      "difficulty": "${difficulty}"
    }
  ]
`;

async function generateMCQs(topic: string, difficulty: string, selectedAIModel: string, apiKey: string, numberOfQuestions: number) {
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

    const mcqs = await generateMCQs(topic, difficulty, selectedAIModel, apiKey, numberOfQuestions);
    
    const pool = getPool();
    const insertedIds = [];
    for (const mcq of mcqs) {
      const result = await insertMCQ(pool, mcq);
      insertedIds.push(result.id);
    }

    return NextResponse.json({
      message: "MCQs generated successfully",
      ids: insertedIds,
      mcqs: mcqs,
      requestedQuestions: numberOfQuestions // Include the requested number of questions
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ message: "Internal Server Error", error: err?.message }, { status: 500 });
  }
}
