import { GoogleGenAI, Type } from "@google/genai";
import { Asset, AssetStatus } from "../types";

// Parse unstructured text into structured asset data
export const parseAssetsFromText = async (text: string): Promise<Partial<Asset>[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract asset information from the following text. 
      The text may contain multiple assets. 
      Extract or infer the Country (e.g., "Germany", "UK", "USA") for each asset.
      Infer the Status from the context if possible.
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
              country: { type: Type.STRING, description: "The country where the asset is located" },
              status: { 
                type: Type.STRING, 
                enum: Object.values(AssetStatus),
                description: "The status of the asset" 
              }
            },
            required: ["model", "serialNumber", "siteId", "country", "status"]
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
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const dataStr = JSON.stringify(assets.map(a => ({
      model: a.model,
      site: a.siteId,
      country: a.country,
      status: a.status
    })));

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Analyze this asset dataset and provide a brief executive summary suitable for a dashboard.
      Focus on:
      1. Total count and breakdown by Country and Site ID.
      2. Identify any patterns in Status/RMA geographically or by model.
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