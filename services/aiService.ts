
import { GoogleGenAI } from "@google/genai";
import { StudentRecord } from "../types.ts";

/**
 * Analyze student performance using Gemini 3 Flash model.
 * @param student The student record to analyze.
 * @returns A string containing motivational feedback.
 */
export const analyzePerformance = async (student: StudentRecord): Promise<string> => {
  // Always use process.env.API_KEY directly as a named parameter in the constructor.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Analyze the following student result from Islamic Da'wa Academy and provide a short, 
    motivational 2-sentence summary/remark in English for the parent.
    
    Student: ${student.name}
    Class: ${student.className}
    Grand Total: ${student.grandTotal}
    Average: ${student.average}%
    Rank: ${student.rank}
    Status: ${student.performanceLevel}
    
    Subjects and scores: ${Object.entries(student.marks).map(([s, m]) => `${s}: ${(m as any).total}`).join(', ')}
  `;

  try {
    // Correct method: use ai.models.generateContent directly.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: "You are a professional academic advisor at an Islamic Academy. Provide encouraging and helpful feedback.",
        temperature: 0.7,
      },
    });
    // Accessing .text as a property (not a method) from GenerateContentResponse.
    return response.text || "Keep working hard and strive for excellence in all your studies.";
  } catch (error) {
    console.error("AI Analysis failed:", error);
    return "Consistently working on weak areas will lead to better results. Keep up the effort.";
  }
};
