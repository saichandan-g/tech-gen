import { type NextRequest, NextResponse } from "next/server";
import { query, resetTechnicalQuestionsSequence } from "@/lib/rds";
import { callAIProviderWithFallback, getProviderFromModel, getModelFromSelection, AIProvider, ProviderConfig } from '../../api/utils';

async function insertMCQ(mcq: any) {
  const sql = `
    INSERT INTO technical_questions (
      question_text, question_type, tech_stack, difficulty, topic,
      option_a, option_b, option_c, option_d, correct_answer
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id;
  `;
  const params = [
    mcq.question,
    'mcq', // question_type
    mcq.tech_stack || mcq.topic, // Use tech_stack if provided, otherwise fallback to topic
    (() => {
      if (!mcq.difficulty) return 'Medium';
      const normalized = mcq.difficulty.charAt(0).toUpperCase() + mcq.difficulty.slice(1).toLowerCase();
      return ['Easy', 'Medium', 'Hard'].includes(normalized) ? normalized : 'Medium';
    })(),
    mcq.topic,
    mcq.options.A,
    mcq.options.B,
    mcq.options.C,
    mcq.options.D,
    mcq.correct_answer,
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

const promptTemplate = (
  topic: string,
  difficulty: string,
  count: number,
  techStack?: string
) => `
  Generate ${count} *highly unique and diverse* multiple-choice question(s) ONLY within the scope of the ${techStack || topic} technology stack.

  🎯 STRICT REQUIREMENT:
  - The questions MUST be exclusively related to "${techStack || topic}".
  - Do NOT include questions from any other domain, technology, cloud provider, or general concepts outside "${techStack || topic}".
  - If a question cannot be written within "${techStack || topic}", SKIP it and generate another one within the correct scope.

  Difficulty MUST be exactly one of: "Easy", "Medium", "Hard".
  Generate questions with ${difficulty} difficulty.

  ${techStack ? `The questions MUST directly involve ${techStack} features, services, components, APIs, configurations, or best practices.` : ''}

  Ensure:
  - All questions are unique.
  - No repetitions.
  - Wide coverage of subtopics inside the SAME technology stack.
  - NO CROSS-TOPIC content.

  Return ONLY a valid JSON array with this exact structure:
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
      "difficulty": "${difficulty}",
      "tech_stack": "${techStack || ''}"
    }
  ]
`;


async function generateMCQs(topic: string, difficulty: string, selectedAIModel: string, apiKey: string, numberOfQuestions: number, techStack?: string) {
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
    promptTemplate(topic, difficulty, numberOfQuestions, techStack),
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
    const { topic, difficulty, selectedAIModel, apiKey, numberOfQuestions = 1, techStack } = body;

    if (!topic || !difficulty || !selectedAIModel || !apiKey) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const mcqs = await generateMCQs(topic, difficulty, selectedAIModel, apiKey, numberOfQuestions, techStack);

    const insertedIds = [];
    for (const mcq of mcqs) {
      // Add techStack to mcq object if provided in the request body
      if (techStack) {
        mcq.tech_stack = techStack;
      }
      const result = await insertMCQ(mcq);
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
