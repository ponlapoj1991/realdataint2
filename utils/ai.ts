

import { GoogleGenAI } from "@google/genai";
import { DashboardWidget, AISettings, AIProvider } from "../types";

export interface DataSummary {
  totalRows: number;
  channelDistribution: Record<string, number>;
  sentimentDistribution: Record<string, number>;
  topTags: { name: string; value: number }[];
  projectName: string;
}

// --- FACTORY: Dynamic AI Client Handling ---

const getGeminiResponse = async (apiKey: string, model: string, prompt: string, jsonMode = false) => {
    const ai = new GoogleGenAI({ apiKey });
    const config: any = {};
    if (jsonMode) config.responseMimeType = "application/json";
    
    const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: config
    });
    return response.text;
};

const getOpenAIResponse = async (apiKey: string, model: string, prompt: string, jsonMode = false) => {
    // Simple fetch implementation for OpenAI to avoid extra SDK dependency
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }],
            response_format: jsonMode ? { type: "json_object" } : undefined
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(`OpenAI Error: ${err.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
};

const getClaudeResponse = async (apiKey: string, model: string, prompt: string, jsonMode = false) => {
    // Claude REST API (Note: Browser calls might fail CORS unless proxy is used, but implementing for completeness)
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true' // Required for browser-side
        },
        body: JSON.stringify({
            model: model,
            max_tokens: 4000,
            messages: [{ role: 'user', content: prompt }]
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(`Claude Error: ${err.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.content[0].text;
};

// Main Dispatcher
const generateAIContent = async (settings: AISettings | undefined, prompt: string, jsonMode = false): Promise<string | null> => {
    // Fallback to environment key (Gemini) if no settings provided (backward compatibility/demo mode)
    const provider = settings?.provider || AIProvider.GEMINI;
    const apiKey = settings?.apiKey || process.env.API_KEY;
    const model = settings?.model || 'gemini-2.5-flash';

    if (!apiKey) {
        throw new Error("No API Key configured. Please go to Project Settings to set up your AI provider.");
    }

    try {
        switch (provider) {
            case AIProvider.GEMINI:
                return await getGeminiResponse(apiKey, model, prompt, jsonMode);
            case AIProvider.OPENAI:
                return await getOpenAIResponse(apiKey, model, prompt, jsonMode);
            case AIProvider.CLAUDE:
                return await getClaudeResponse(apiKey, model, prompt, jsonMode);
            default:
                throw new Error("Unsupported AI Provider");
        }
    } catch (error) {
        console.error("AI Generation Error:", error);
        throw error;
    }
};


// --- EXPORTED FUNCTIONS ---

export const analyzeProjectData = async (summary: DataSummary, settings?: AISettings): Promise<string> => {
  try {
    const prompt = `
      Acting as a Senior Data Analyst for a Social Listening Agency in Thailand.
      Analyze the following dataset summary for project: "${summary.projectName}".
      
      Dataset Summary:
      ${JSON.stringify(summary, null, 2)}

      Please provide a strategic insight report in Thai Language (ภาษาไทย) covering:
      1. **Executive Summary**: Overview of the data volume and main platform sources.
      2. **Sentiment Deep Dive**: Analyze the public sentiment ratio. Why is it positive/negative? (Hypothetical based on stats).
      3. **Top Interest (Tags)**: What are people talking about most? Group related tags if possible.
      4. **Recommendations**: Actionable steps for the client.

      Format the output using Markdown with clear headers and bullet points. Keep it professional, concise, and insightful.
    `;

    const text = await generateAIContent(settings, prompt);
    return text || "ไม่สามารถสร้างบทวิเคราะห์ได้ในขณะนี้";
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
};

export const generateWidgetFromPrompt = async (
  userPrompt: string, 
  availableColumns: string[],
  sampleData: any[],
  settings?: AISettings
): Promise<DashboardWidget | null> => {
  try {
    const prompt = `
      You are an expert Data Visualization Architect using a custom dashboard engine.
      
      Your goal: Create a JSON configuration for a dashboard widget based on the user's request.
      
      User Request: "${userPrompt}"
      
      Available Data Columns: ${JSON.stringify(availableColumns)}
      Sample Data (First 3 rows): ${JSON.stringify(sampleData.slice(0, 3))}
      
      Widget Schema Rules:
      - id: Generate a random string.
      - title: A professional short title for the chart.
      - type: One of ['bar', 'pie', 'line', 'area', 'kpi', 'wordcloud', 'table'].
      - dimension: The column to group by (X-Axis). MUST be one of the Available Columns.
      - measure: One of ['count', 'sum', 'avg'].
      - measureCol: The column to calculate (Y-Axis). Required if measure is 'sum' or 'avg'. MUST be a numeric column from Available Columns.
      - stackBy: Optional. Only for 'bar' type. A column to stack the bars by (e.g., Sentiment).
      - limit: Number of rows to display (e.g., 5, 10, 20).
      - width: 'half' or 'full'.
      
      Heuristics:
      - If user asks for "Trend" or "Time", use 'line' or 'area' type and find a Date column.
      - If user asks for "Ratio" or "Proportion", use 'pie'.
      - If user asks for "Sentiment", try to stack by Sentiment if possible, or group by Sentiment.
      - If the request is ambiguous, pick the best visualization type.
      
      RETURN ONLY THE RAW JSON OBJECT. NO MARKDOWN BLOCK. NO EXPLANATION.
    `;

    const jsonText = await generateAIContent(settings, prompt, true);
    if (!jsonText) return null;

    // Clean potential markdown wrappers if non-Gemini providers add them despite instructions
    const cleanJson = jsonText.replace(/```json\n?|\n?```/g, '').trim();
    
    const widgetConfig = JSON.parse(cleanJson) as DashboardWidget;
    
    if (!widgetConfig.id) widgetConfig.id = `gen-${Date.now()}`;
    
    return widgetConfig;

  } catch (error) {
    console.error("AI Chart Gen Error:", error);
    return null;
  }
};

export const processAiAgentAction = async (
  inputData: string[],
  userInstruction: string,
  settings?: AISettings
): Promise<string[]> => {
  try {
    if (inputData.length === 0) return [];
    
    const BATCH_SIZE = 30; 
    const results: string[] = [];
    
    for (let i = 0; i < inputData.length; i += BATCH_SIZE) {
        const batch = inputData.slice(i, i + BATCH_SIZE);
        
        const prompt = `
          Task: ${userInstruction}
          
          Input Data (JSON Array):
          ${JSON.stringify(batch)}
          
          Requirements:
          1. Analyze each item in the input array based on the Task.
          2. Return ONLY a JSON Array of strings containing the result for each item.
          3. The output array MUST have exactly ${batch.length} items.
          4. If an item is empty or cannot be analyzed, return null or an empty string for that index.
          5. Do not include any markdown formatting, just the raw JSON array.
        `;
    
        // Retry logic
        let retries = 2;
        let batchSuccess = false;
        
        while (retries > 0 && !batchSuccess) {
            try {
                const jsonText = await generateAIContent(settings, prompt, true);
                if (!jsonText) throw new Error("Empty response");
            
                // Cleanup
                const cleanJson = jsonText.replace(/```json\n?|\n?```/g, '').trim();
                const batchResult = JSON.parse(cleanJson);
                
                if (Array.isArray(batchResult) && batchResult.length === batch.length) {
                    results.push(...batchResult.map(String));
                    batchSuccess = true;
                } else {
                    throw new Error("Invalid array length returned");
                }
            } catch (e) {
                console.warn(`Batch failed, retrying... (${retries} left)`, e);
                retries--;
                if (retries === 0) {
                    results.push(...Array(batch.length).fill("Error")); 
                }
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    return results;

  } catch (error) {
    console.error("AI Agent Action Error:", error);
    throw error;
  }
};

export const askAiAgent = async (
    contextData: string[],
    question: string,
    settings?: AISettings
): Promise<string> => {
    try {
        const safeContext = contextData.slice(0, 200);
        
        const prompt = `
          Context Data (First 200 rows of selection):
          ${JSON.stringify(safeContext)}
          
          User Question: "${question}"
          
          Answer the user's question based strictly on the provided Context Data.
          Answer in Thai (ภาษาไทย).
        `;
    
        const text = await generateAIContent(settings, prompt);
        return text || "ไม่สามารถวิเคราะห์ข้อมูลได้";
    } catch (error: any) {
        return `เกิดข้อผิดพลาด: ${error.message}`;
    }
};