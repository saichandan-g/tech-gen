import { GoogleGenerativeAI } from "@google/generative-ai";
import { Mistral } from "@mistralai/mistralai";

export type AIProvider = 'mistral' | 'gemini';

export interface ProviderConfig {
  apiKey: string;
  provider: AIProvider;
  model: string;
}

// Define available models for fallback (provider-specific, no cross-provider fallback)
export const AVAILABLE_MODELS = {
  gemini: ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
  mistral: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'],
};

// Get next model in fallback chain (same provider only)
export function getNextFallbackModel(
  provider: AIProvider,
  currentModel: string
): { provider: AIProvider; model: string } | null {
  const models = AVAILABLE_MODELS[provider];
  const currentIndex = models.indexOf(currentModel);

  // Try next model in same provider only
  if (currentIndex >= 0 && currentIndex < models.length - 1) {
    return {
      provider,
      model: models[currentIndex + 1],
    };
  }

  // No more models available in this provider
  return null;
}

export async function callAIProviderWithFallback(
  initialConfig: ProviderConfig,
  prompt: string,
  systemPrompt?: string,
  apiKeys?: Record<string, string>
): Promise<string | null> {
  let currentConfig = initialConfig;
  let attemptCount = 0;
  const maxAttempts = AVAILABLE_MODELS[initialConfig.provider].length;

  while (attemptCount < maxAttempts) {
    try {
      attemptCount++;
      console.log(
        `🔄 Attempt ${attemptCount}/${maxAttempts}: Using ${currentConfig.provider} - ${currentConfig.model}`
      );
      
      const result = await callAIProvider(currentConfig, prompt, systemPrompt);
      console.log(`✅ Success with ${currentConfig.provider} - ${currentConfig.model}`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `❌ Failed with ${currentConfig.provider} - ${currentConfig.model}:`,
        errorMessage
      );

      if (attemptCount >= maxAttempts) {
        console.error(`❌ All ${maxAttempts} attempts exhausted for ${initialConfig.provider}`);
        throw error;
      }

      // Get next model in same provider
      const fallback = getNextFallbackModel(currentConfig.provider, currentConfig.model);
      if (!fallback) {
        console.error(`❌ No fallback model available for ${initialConfig.provider}`);
        throw error;
      }

      currentConfig = {
        ...currentConfig,
        ...fallback,
      };

      console.log(`🔄 Trying fallback: ${fallback.provider} - ${fallback.model}`);
      // Add a small delay before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  throw new Error(`Failed to get response from ${initialConfig.provider} models`);
}

export async function callAIProvider(
  config: ProviderConfig,
  prompt: string,
  systemPrompt?: string
): Promise<string | null> {
  if (config.provider === 'gemini') {
    try {
      console.log("🤖 Calling Gemini API with model:", config.model);
      const genAI = new GoogleGenerativeAI(config.apiKey);
      const model = genAI.getGenerativeModel({
        model: config.model,
        systemInstruction: systemPrompt || undefined,
      });

      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.3,
          topP: 1.0,
          topK: 1,
        },
      });

      const response = result.response;
      
      // ✅ Detailed logging for debugging
      console.log("📊 Gemini Response Details:");
      console.log("   - Status:", response.candidates?.[0]?.finishReason);
      console.log("   - SafetyRatings:", response.candidates?.[0]?.safetyRatings);
      
      // ✅ FIX #1: Robust response extraction with fallback
      let text: string | null = null;
      try {
        text = response.text();
      } catch (extractError) {
        console.error("⚠️ Failed to extract text using response.text():", extractError);
        // Try alternative extraction
        const candidates = response.candidates?.[0];
        if (candidates?.content?.parts?.[0]) {
          text = candidates.content.parts[0]?.text || null;
          console.log("✅ Successfully extracted text from candidates.content.parts");
        }
      }
      
      console.log("✅ Gemini response received, length:", text?.length);
      
      // ✅ Better empty response handling
      if (!text || text.trim().length === 0) {
        const finishReason = response.candidates?.[0]?.finishReason;
        const safetyRatings = response.candidates?.[0]?.safetyRatings;
        
        console.error("❌ Gemini returned empty response");
        console.error("   Finish Reason:", finishReason);
        console.error("   Safety Ratings:", safetyRatings);
        
        // ✅ Handle MAX_TOKENS
        if (finishReason === 'MAX_TOKENS') {
          throw new Error('Response exceeded max tokens. The prompt or expected output is too large. Try reducing complexity.');
        }
        
        // Check if it was blocked by safety filter
        if (finishReason === 'SAFETY') {
          throw new Error('Response blocked by safety filter. Try rephrasing your prompt.');
        }
        
        throw new Error('Empty response from Gemini API');
      }
      
      return text;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("❌ Gemini API error:", errorMessage);
      console.error("   Full error details:", error);
      
      // Let error propagate naturally for retry logic to handle
      throw error;
    }
  } else if (config.provider === 'mistral') {
    try {
      console.log("🤖 Calling Mistral API with model:", config.model);
      const client = new Mistral({ apiKey: config.apiKey });
      const chatResponse = await client.chat.complete({
        model: config.model,
        messages: [
          ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
          { role: 'user' as const, content: prompt },
        ] as any,
      });
      
      if (!chatResponse.choices || chatResponse.choices.length === 0) {
        throw new Error('No choices in Mistral response');
      }
      
      const choice = chatResponse.choices[0];
      const content = choice?.message?.content;
      
      if (!content) {
        throw new Error('Empty content in Mistral response');
      }
      
      // Handle both string and array content types
      const textContent = typeof content === 'string' ? content : 
        Array.isArray(content) ? content.map((c: any) => typeof c === 'string' ? c : (c.text || '')).join('') : 
        '';
      
      console.log("✅ Mistral response received, length:", textContent?.length);
      
      if (!textContent) {
        throw new Error('No text content in Mistral response');
      }
      
      return textContent;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("❌ Mistral API error:", errorMessage);
      throw new Error(`Mistral API error: ${errorMessage}`);
    }
  }
  
  throw new Error(`Unsupported provider: ${config.provider}`);
}

export function getProviderFromModel(modelSelection: string): AIProvider | null {
  const lower = modelSelection.toLowerCase();

  if (lower.includes('mistral')) {
    return 'mistral';
  } else if (lower.includes('gemini') || lower.includes('google')) {
    return 'gemini';
  }

  return null;
}

export function getModelFromSelection(modelSelection: string): string {
  const lower = modelSelection.toLowerCase();

  if (lower.includes('mistral-small')) return 'mistral-small-latest';
  if (lower.includes('mistral-medium')) return 'mistral-medium-latest';
  if (lower.includes('mistral-large')) return 'mistral-large-latest';
  if (lower.includes('mistral')) return 'mistral-small-latest';

  if (lower.includes('gemini')) return 'gemini-2.5-flash';
  if (lower.includes('google')) return 'gemini-2.5-flash';

  return modelSelection;
}
