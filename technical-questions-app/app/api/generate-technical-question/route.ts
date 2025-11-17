import { type NextRequest, NextResponse } from "next/server";
import { query, resetTechnicalQuestionsSequence } from "@/lib/rds";
import { callAIProviderWithFallback, getProviderFromModel, getModelFromSelection, AIProvider, ProviderConfig } from '../../api/utils';

// This function would be adapted to insert general technical questions
async function insertTechnicalQuestion(question: any) {
  const sql = `
    INSERT INTO technical_questions (
      question_text, question_type, tech_stack, difficulty, topic
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id;
  `;
  const params = [
    question.question,
    question.question_type || 'short_answer', // Default to 'short_answer' if not provided by AI
    question.tech_stack || null,
    ['Easy', 'Medium', 'Hard'].includes(question.difficulty) ? question.difficulty : 'Medium', // Validate difficulty
    question.topic,
  ];
  const { rows, error } = await query(sql, params);
  if (error) {
    throw error;
  }
  return rows[0];
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

const promptTemplate = (topic: string, difficulty: string, count: number, techStack?: string, questionType?: string) => `
  Generate ${count} *highly unique and diverse* technical interview question(s) about ${topic} with ${difficulty} difficulty.
  The difficulty MUST be one of 'Easy', 'Medium', or 'Hard'.
  ${techStack ? `Focus on the ${techStack} technology stack.` : ''}
  ${questionType ? `The question type should be ${questionType}.` : ''}
  Ensure all generated questions are distinct, do not repeat, and cover a wide range of sub-topics or aspects within the given topic.
  Return ONLY a JSON array with this structure:
  [
    {
      "question": "Question text",
      "topic": "${topic}",
      "difficulty": "${difficulty}", // Ensure this is 'Easy', 'Medium', or 'Hard'
      "tech_stack": "${techStack || ''}",
      "question_type": "${questionType || 'short_answer'}"
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
    // Attempt to reset the sequence before any insertions
    await resetTechnicalQuestionsSequence();

    const body = await request.json();
    const { topic, difficulty, selectedAIModel, apiKey, numberOfQuestions = 1, techStack, questionType } = body;

    if (!topic || !difficulty || !selectedAIModel || !apiKey) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
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
      const result = await insertTechnicalQuestion(question);
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
