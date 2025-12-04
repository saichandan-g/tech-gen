"use client"

import { useState, type FormEvent, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CodeBlock } from "@/components/ui/code-block"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { AIModelSelectionFiltered } from "@/components/AIModelSelectionFiltered"
import { TECHNICAL_TOPICS, DATABASES } from "@/constants/topics"

// Helper function to render text with code blocks
const renderTextWithCodeBlocks = (text: string) => {
  const parts = [];
  const regex = /(```[\s\S]*?```)/g; // Regex to find triple backtick code blocks
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const [fullMatch] = match;
    const codeBlockContent = fullMatch.substring(3, fullMatch.length - 3).trim();

    if (match.index > lastIndex) {
      parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex, match.index)}</span>);
    }
    parts.push(<CodeBlock key={`code-${match.index}`}>{codeBlockContent}</CodeBlock>);
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex)}</span>);
  }
  return parts;
};

export default function GenerateMCQPage() {
  const [topic, setTopic] = useState(TECHNICAL_TOPICS[0])
  const [customTopic, setCustomTopic] = useState("")
  const [selectedDatabase, setSelectedDatabase] = useState(DATABASES[0])
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [numberOfQuestions, setNumberOfQuestions] = useState(1)
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null)

  const [selectedAIModel, setSelectedAIModel] = useState<string>("")
  const [aiApiKey, setAIApiKey] = useState<string>("")
  const [hasSelectedModel, setHasSelectedModel] = useState(false)

  const handleAIModelSelected = (model: string, apiKey: string) => {
    console.log(`✅ Selected AI Model: ${model}`);
    setSelectedAIModel(model);
    setAIApiKey(apiKey);
    setHasSelectedModel(true);
  };

  if (!hasSelectedModel) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="w-full max-w-md">
            <AIModelSelectionFiltered onModelSelected={handleAIModelSelected} />
          </div>
        </div>
      </div>
    )
  }

  const handleGenerateQuestions = async (event: FormEvent) => {
    event.preventDefault()
    setIsLoading(true)
    setResults(null)

    if (!selectedAIModel || !aiApiKey) {
      setResults({ error: "Please select an AI model and provide its API key." })
      setIsLoading(false)
      return
    }

    const apiUrl = "/api/generate-mcq";
    const requestBody = {
      topic: topic === "Custom Topic" ? customTopic : topic,
      techStack: topic === "Databases" ? selectedDatabase : undefined,
      difficulty: selectedDifficulty || "medium",
      selectedAIModel,
      apiKey: aiApiKey,
      numberOfQuestions,
    };

    console.log("📤 Sending request with:", {
      topic,
      model: selectedAIModel,
      difficulty: selectedDifficulty
    });

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (!response.ok) {
        setResults({
          error: data.error || `Error: ${response.status}`,
          details: data.details || null,
        })
        return
      }

      setResults({
        success: true,
        mcqs: data.mcqs,
        message: `Inserted ${data.mcqs.length} out of ${data.requestedQuestions} requested multiple-choice question(s)`,
        type: "mcq"
      })
    } catch (error) {
      setResults({
        error: "Failed to generate questions",
        details: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Question Generator
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Generate custom interview questions with Gemini or Mistral
          </p>
          <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-300">
              ✅ Using <strong>{selectedAIModel}</strong> for question generation
              <button
                onClick={() => setHasSelectedModel(false)}
                className="ml-2 text-xs px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded"
              >
                Change Model
              </button>
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column: Form */}
          <div className="lg:col-span-2">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Generation Settings</CardTitle>
                <CardDescription>
                  Configure parameters for question generation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleGenerateQuestions} className="space-y-6">


                  {/* Topic Selection */}
                  <div className="space-y-3">
                    <Label htmlFor="topic" className="text-base font-semibold">
                      Topic
                    </Label>
                    <Select value={topic} onValueChange={setTopic}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select a technical topic..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto"> {/* Added for scrolling */}
                        {TECHNICAL_TOPICS.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {topic === "Custom Topic" && (
                      <Input
                        placeholder="Enter your custom topic..."
                        value={customTopic}
                        onChange={(e) => setCustomTopic(e.target.value)}
                        className="mt-2"
                      />
                    )}
                    {topic === "Databases" && (
                      <div className="mt-2 space-y-2">
                        <Label htmlFor="database" className="text-sm font-medium">
                          Select Database
                        </Label>
                        <Select value={selectedDatabase} onValueChange={setSelectedDatabase}>
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Select a database..." />
                          </SelectTrigger>
                          <SelectContent>
                            {DATABASES.map((db) => (
                              <SelectItem key={db} value={db}>
                                {db}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>



                  {/* Difficulty Selection */}
                  <div className="space-y-3">
                    <Label htmlFor="difficulty" className="text-base font-semibold">
                      Difficulty Level (Optional)
                    </Label>
                    <Select value={selectedDifficulty || ""} onValueChange={setSelectedDifficulty}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select difficulty..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Number of Questions */}
                  <div className="space-y-3">
                    <Label htmlFor="numberOfQuestions" className="text-base font-semibold">
                      Number of Questions
                    </Label>
                    <Input
                      id="numberOfQuestions"
                      type="number"
                      min="1"
                      max="10"
                      value={numberOfQuestions}
                      onChange={(e) => setNumberOfQuestions(Number(e.target.value))}
                      className="h-10"
                    />
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  >
                    {isLoading ? "🔄 Generating..." : "✨ Generate Question(s)"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-1">
            <Card className="shadow-lg h-fit sticky top-8">
              <CardHeader>
                <CardTitle>Results</CardTitle>
              </CardHeader>
              <CardContent>
                {!results ? (
                  <p className="text-sm text-gray-500">
                    Configure your settings and click "Generate Question(s)" to see results here.
                  </p>
                ) : results.error ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-red-600">❌ Error</p>
                    <p className="text-xs text-red-500">{results.error}</p>
                    {results.details && (
                      <p className="text-xs text-red-400 mt-2">{results.details}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-green-600">✅ {results.message}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>


      </div>
    </div>
  )
}
