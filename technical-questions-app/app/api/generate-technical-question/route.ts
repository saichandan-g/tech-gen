import { type NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/rds"; // Removed resetTechnicalQuestionsSequence
import { callAIProviderWithFallback, getProviderFromModel, getModelFromSelection, AIProvider, ProviderConfig } from "../../api/utils";

// This function would be adapted to insert general technical questions
async function insertTechnicalQuestion(question: any, originalTopic: string) {
  const sql = `
    INSERT INTO technical_questions (
      question_text, question_type, tech_stack, difficulty, topic
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id;
  `;

  // Helper function to normalize tech stack string
  const normalizeTechStack = (techStack: string | null | undefined): string | null => {
    if (!techStack) return null;
    return techStack.split(",")
      .map(s => s.trim())
      .map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
      .join(", ");
  };

  const params = [
    question.question,
    question.question_type || "short_answer", // Default to "short_answer" if not provided by AI
    normalizeTechStack(question.tech_stack), // Normalize tech stack
    (() => {
      const difficulty = question.difficulty;
      if (!difficulty) throw new Error("Difficulty is missing from AI response.");
      const normalizedDifficulty = difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase();
      if (!["Easy", "Medium", "Hard"].includes(normalizedDifficulty)) {
        throw new Error(`Invalid difficulty received from AI: ${difficulty}. Normalized: ${normalizedDifficulty}`);
      }
      return normalizedDifficulty;
    })(), // Normalize and validate difficulty, throw error on invalid
    (() => {
      // Strict validation: AI generated topic must EXACTLY match original requested topic
      if (question.topic !== originalTopic) {
        throw new Error(`AI generated topic "${question.topic}" does not match requested topic "${originalTopic}". Please ensure the AI model adheres strictly to the provided topic.`);
      }
      return originalTopic;
    })(), // Validate topic, throw error on mismatch
  ];
  const { rows, error } = await query(sql, params);
  if (error) {
    throw error;
  }
  return rows[0];
}

function extractJSONArray(raw: string): any[] {
  const s = raw.trim();
  const firstBracket = s.indexOf("[");
  const lastBracket = s.lastIndexOf("]");
  if (firstBracket === -1 || lastBracket === -1 || lastBracket < firstBracket) {
    const firstBrace = s.indexOf("{");
    const lastBrace = s.lastIndexOf("}");
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

const promptTemplate = (topic: string, difficulty: string, count: number, techStack?: string, questionType?: string) => `
  Generate ${count} *highly unique and distinct* technical interview question(s) strictly about the topic: "${topic}" with ${difficulty} difficulty.
  The difficulty MUST be one of \'Easy\', \'Medium\', or \'Hard\'.
  ${techStack ? `Focus on the ${techStack} technology stack.` : ""}
  ${questionType ? `The question type should be ${questionType}.` : ""}
  Ensure all generated questions are strictly confined to the given topic and do not include sub-topics or related concepts outside the exact scope of "${topic}".
  Return ONLY a JSON array with this structure:
  [
    {
      "question": "Question text",
      "topic": "${topic}", // Ensure this is EXACTLY "${topic}"
      "difficulty": "${difficulty}", // Ensure this is \'Easy\', \'Medium\', or \'Hard\'
      "tech_stack": "${techStack || ""}",
      "question_type": "${questionType || "short_answer"}"
    }
  ]
`;

async function generateTechnicalQuestions(topic: string, difficulty: string, selectedAIModel: string, apiKey: string, numberOfQuestions: number, techStack?: string, questionType?: string) {
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
    promptTemplate(topic, difficulty, numberOfQuestions, techStack, questionType),
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
    const { topic, difficulty, selectedAIModel, apiKey, numberOfQuestions = 1, techStack, questionType } = body;

    if (!topic || !difficulty || !selectedAIModel || !apiKey) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const questions = await generateTechnicalQuestions(topic, difficulty, selectedAIModel, apiKey, numberOfQuestions, techStack, questionType);
    
    const insertedIds = [];
    for (const question of questions) {
      // Add techStack and questionType to question object if provided in the request body
      if (techStack) {
        question.tech_stack = techStack;
      }
      if (questionType) {
        question.question_type = questionType;
      }
      const result = await insertTechnicalQuestion(question, topic);
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
