import { GoogleGenAI, Type } from "@google/genai";
import { Asset, AssetStatus } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Parse unstructured text into structured asset data
export const parseAssetsFromText = async (text: string): Promise<Partial<Asset>[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract asset information from the following text. 
      The text may contain multiple assets. 
      Infer the Status from the comments if possible.
      Valid statuses are: "Normal", "RMA Requested", "RMA Shipped", "RMA Eligible", "RMA Not Eligible", "Deprecated", "Unknown".
      If no specific status context is found, default to "Normal".
      
      Text to process:
      "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              model: { type: Type.STRING, description: "The model name or number of the asset" },
              serialNumber: { type: Type.STRING, description: "The serial number" },
              siteId: { type: Type.STRING, description: "The location or Site ID" },
              comments: { type: Type.STRING, description: "Any notes, issues, or descriptions" },
              status: { 
                type: Type.STRING, 
                enum: Object.values(AssetStatus),
                description: "The status of the asset" 
              }
            },
            required: ["model", "serialNumber", "siteId", "status"]
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as Partial<Asset>[];
    }
    return [];
  } catch (error) {
    console.error("Gemini parse error:", error);
    throw new Error("Failed to parse asset data using AI.");
  }
};

// Generate a summary report of the assets
export const generateAssetReport = async (assets: Asset[]): Promise<string> => {
  if (assets.length === 0) return "No assets to analyze.";

  try {
    const dataStr = JSON.stringify(assets.map(a => ({
      model: a.model,
      site: a.siteId,
      status: a.status,
      issue: a.comments
    })));

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Analyze this asset dataset and provide a brief executive summary suitable for a dashboard.
      Focus on:
      1. Total count and breakdown by Site ID.
      2. Identify any patterns in Status/RMA (e.g., specific models failing often).
      3. Actionable recommendations.
      
      Keep it concise (max 200 words). Use Markdown for formatting.
      
      Dataset:
      ${dataStr}`
    });

    return response.text || "Analysis failed to generate text.";
  } catch (error) {
    console.error("Gemini analysis error:", error);
    return "Could not generate AI report at this time.";
  }
};