
import { GoogleGenAI } from "@google/genai";
import { StudentRecord } from "../types.ts";

export const analyzePerformance = async (student: StudentRecord): Promise<string> => {
  // Use pre-configured API_KEY from environment
  const apiKey = (typeof process !== 'undefined' && process.env?.API_KEY) || "";
  const ai = new GoogleGenAI({ apiKey });
  
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
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: "You are a professional academic advisor at an Islamic Academy. Provide encouraging and helpful feedback.",
        temperature: 0.7,
      },
    });
    return response.text || "Keep working hard and strive for excellence in all your studies.";
  } catch (error) {
    console.error("AI Analysis failed:", error);
    return "Consistently working on weak areas will lead to better results. Keep up the effort.";
  }
};