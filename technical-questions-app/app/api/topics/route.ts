import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const TOPICS_FILE = path.join(process.cwd(), "public", "topics.json");
const CUSTOM_TOPICS_FILE = path.join(process.cwd(), "public", "custom-topics.json");

interface TopicsData {
  topics: string[];
  databases: string[];
}

interface CustomTopicsData {
  customTopics: string[];
}

const ensureCustomTopicsFile = () => {
  if (!fs.existsSync(CUSTOM_TOPICS_FILE)) {
    const initialData: CustomTopicsData = { customTopics: [] };
    fs.writeFileSync(CUSTOM_TOPICS_FILE, JSON.stringify(initialData, null, 2));
  }
};

export async function GET() {
  try {
    ensureCustomTopicsFile();

    const topicsData = JSON.parse(
      fs.readFileSync(TOPICS_FILE, "utf-8")
    ) as TopicsData;
    const customTopicsData = JSON.parse(
      fs.readFileSync(CUSTOM_TOPICS_FILE, "utf-8")
    ) as CustomTopicsData;

    const allTopics = [
      ...topicsData.topics.filter((t) => t !== "Custom Topic"),
      ...customTopicsData.customTopics,
      "Custom Topic",
    ];

    return NextResponse.json({
      topics: allTopics,
      databases: topicsData.databases,
    });
  } catch (error) {
    console.error("Error reading topics:", error);
    return NextResponse.json(
      { error: "Failed to read topics" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { customTopic } = await request.json();

    if (!customTopic || typeof customTopic !== "string") {
      return NextResponse.json(
        { error: "Invalid custom topic" },
        { status: 400 }
      );
    }

    const trimmedTopic = customTopic.trim();

    const topicsData = JSON.parse(
      fs.readFileSync(TOPICS_FILE, "utf-8")
    ) as TopicsData;

    ensureCustomTopicsFile();

    const customTopicsData = JSON.parse(
      fs.readFileSync(CUSTOM_TOPICS_FILE, "utf-8")
    ) as CustomTopicsData;

    const topicExists = 
      topicsData.topics.includes(trimmedTopic) ||
      customTopicsData.customTopics.includes(trimmedTopic);

    if (!topicExists) {
      customTopicsData.customTopics.push(trimmedTopic);
      fs.writeFileSync(
        CUSTOM_TOPICS_FILE,
        JSON.stringify(customTopicsData, null, 2)
      );
    }

    const allTopics = [
      ...topicsData.topics.filter((t) => t !== "Custom Topic"),
      ...customTopicsData.customTopics,
      "Custom Topic",
    ];

    return NextResponse.json({
      success: true,
      topics: allTopics,
      databases: topicsData.databases,
      message: topicExists ? "Topic already exists" : "Topic added successfully",
    });
  } catch (error) {
    console.error("Error adding custom topic:", error);
    return NextResponse.json(
      { error: "Failed to add custom topic" },
      { status: 500 }
    );
  }
}
