import { GoogleGenAI, Type } from "@google/genai";
import { Asset } from "../types.ts";

// Parse unstructured text into structured asset data
export const parseAssetsFromText = async (text: string): Promise<Partial<Asset>[]> => {
  // Always initialize with the specific API key from environment
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
              siteID: { type: Type.STRING, description: "The location or Site ID" },
              country: { type: Type.STRING, description: "The country where the asset is located" },
              status: { 
                type: Type.STRING, 
                description: "The status of the asset. Must be one of: Normal, RMA Requested, RMA Shipped, RMA Eligible, RMA Not Eligible, Deprecated, Unknown" 
              }
            },
            required: ["model", "serialNumber", "siteID", "country", "status"],
            propertyOrdering: ["model", "serialNumber", "siteID", "country", "status"]
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text.trim()) as Partial<Asset>[];
    }
    return [];
  } catch (error) {
    console.error("Gemini parse error:", error);
    throw new Error("Failed to parse asset data using AI.");
  }
};