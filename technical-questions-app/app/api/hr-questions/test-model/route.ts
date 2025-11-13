import { NextResponse } from 'next/server';
import { callAIProvider, AIProvider, ProviderConfig, getProviderFromModel, getModelFromSelection } from '../../../api/utils'; // Adjusted path to utils

interface TestModelBody {
  selectedAIModel: string;
  apiKey: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TestModelBody;
    const { selectedAIModel, apiKey } = body;

    if (!selectedAIModel || !apiKey) {
      return NextResponse.json(
        { success: false, error: 'Model and API key are required' },
        { status: 400 }
      );
    }

    console.log(`🧪 [PREFLIGHT TEST] Testing model: ${selectedAIModel}`);

    const provider = getProviderFromModel(selectedAIModel);
    if (!provider) {
      return NextResponse.json(
        { success: false, error: `Unsupported model: ${selectedAIModel}` },
        { status: 400 }
      );
    }

    const model = getModelFromSelection(selectedAIModel);

    const providerConfig: ProviderConfig = {
      apiKey: apiKey.trim(),
      provider,
      model,
    };

    const testPrompt = 'Say "test successful" in exactly these words and nothing else.';
    const testSystemPrompt = 'You are a helpful assistant. Respond with exactly what the user asks.';

    console.log(`🔗 Calling ${provider} API for connectivity test...`);

    try {
      const response = await callAIProvider(providerConfig, testPrompt, testSystemPrompt);

      if (!response || response.trim() === '') {
        return NextResponse.json(
          {
            success: false,
            error: 'No response from AI provider. Please check your API key and try again.',
            provider,
          },
          { status: 500 }
        );
      }

      console.log(`✅ [PREFLIGHT TEST] Success! Provider ${provider} is working.`);
      return NextResponse.json({
        success: true,
        message: `${provider} API connection successful`,
        provider,
        model,
      });
    } catch (apiError) {
      const errorMessage = apiError instanceof Error ? apiError.message : String(apiError);
      console.error(`❌ [PREFLIGHT TEST] API error:`, errorMessage);

      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('invalid_api_key')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Your API key is invalid or expired. Please check your credentials.',
            provider,
            details: 'Authentication failed (401)',
          },
          { status: 401 }
        );
      }
      // Generic error for other API failures
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          provider,
          details: 'API connection failed',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ [PREFLIGHT TEST] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unexpected error during preflight test',
      },
      { status: 500 }
    );
  }
}
