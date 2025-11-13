"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "./ui/button"; // Adjusted path
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"; // Adjusted path
import { Input } from "./ui/input"; // Adjusted path
import { Brain, Key } from "lucide-react";

interface AIModelSelectionProps {
  onModelSelected: (model: string, apiKey: string) => void;
}

const AI_MODELS_FILTERED = [
  { id: "mistral", name: "Mistral", icon: "/Mistral-Ai-Icon.svg" },
  { id: "gemini", name: "Gemini", icon: "/gemini-icon.svg" }
];

export function AIModelSelectionFiltered({ onModelSelected }: AIModelSelectionProps) {
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [testingModel, setTestingModel] = useState<boolean>(false);

  useEffect(() => {
    if (selectedModel) {
      setApiKey("");
      setError("");
      console.log(`🔄 Switched to ${selectedModel} - cleared API key and error state`);
    }
  }, [selectedModel]);

  const testModelConnectivity = async (): Promise<boolean> => {
    if (!selectedModel || !apiKey.trim()) {
      setError("Please select a model and enter your API key first");
      return false;
    }

    try {
      setTestingModel(true);
      setError("");

      console.log(`🧪 Testing ${selectedModel} connectivity...`);

      // This API route needs to be created in the new repository
      const res = await fetch("/api/hr-questions/test-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedAIModel: selectedModel,
          apiKey: apiKey.trim()
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to validate API key. Please check your credentials and try again.");
        return false;
      }

      console.log(`✅ ${selectedModel} connectivity test passed!`);
      return true;
    } catch (err) {
      console.error("Error testing model:", err);
      setError(err instanceof Error ? err.message : "Failed to test model connectivity");
      return false;
    } finally {
      setTestingModel(false);
    }
  };

  const handleContinue = async () => {
    if (!selectedModel || apiKey.trim() === "") {
      setError("Please select a model and enter your API key");
      return;
    }

    const isValid = await testModelConnectivity();
    if (!isValid) {
      return;
    }

    onModelSelected(selectedModel, apiKey.trim());
  };

  const selectedModelInfo = AI_MODELS_FILTERED.find(model => model.id === selectedModel);

  return (
    <div className="space-y-6 p-4">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
          <Brain className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
          Choose Your AI Model
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Select your preferred AI model and enter your API key to continue.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            AI Model
          </label>
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-full h-11">
              <SelectValue placeholder="Select an AI model..." />
            </SelectTrigger>
            <SelectContent>
              {AI_MODELS_FILTERED.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex items-center gap-3">
                    <Image
                      src={model.icon}
                      alt={model.name}
                      width={24}
                      height={24}
                    />
                    <span className="font-medium">{model.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedModelInfo && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
            <div className="flex items-center gap-3">
              <Image
                src={selectedModelInfo.icon}
                alt={selectedModelInfo.name}
                width={32}
                height={32}
              />
              <div>
                <h4 className="font-semibold text-blue-800 dark:text-blue-300">
                  {selectedModelInfo.name} Selected
                </h4>
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  Enter your API key to continue
                </p>
              </div>
            </div>
          </div>
        )}

        {selectedModel && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Key className="h-4 w-4" />
              API Key
            </label>
            <Input
              type="password"
              placeholder={`Enter your ${selectedModelInfo?.name} API key`}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="h-11"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4">
        <Button
          onClick={handleContinue}
          disabled={!selectedModel || apiKey.trim() === "" || testingModel}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {testingModel ? "Testing API Key..." : "Continue"}
        </Button>
      </div>
    </div>
  );
}
