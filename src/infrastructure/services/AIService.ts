import { configurationService } from './ConfigurationService';
import { loadAILibrary } from './dynamicImports';

export interface AIAnalysisResult {
    summary: string;
    insights: string[];
    recommendations: string[];
    motivationalMessage?: string;
}

export interface StudentPerformanceData {
    studentName: string;
    className: string;
    subjects: Array<{
        name: string;
        ta: number;
        ce: number;
        total: number;
        maxTotal: number;
        status: string;
    }>;
    grandTotal: number;
    average: number;
    rank: number;
    performanceLevel: string;
}

export class AIService {
    private genAI: any = null;
    private model: any = null;
    private openai: any = null;

    constructor() {
        // Don't initialize immediately - use lazy loading
    }

    private async initializeAI(): Promise<void> {
        if (this.genAI || this.openai) {
            return; // Already initialized
        }

        try {
            const geminiConfig = configurationService.getGeminiConfig();
            const openAIConfig = configurationService.getOpenAIConfig();

            if (!geminiConfig?.apiKey && !openAIConfig?.apiKey) {
                console.warn('No AI API keys configured. AI features will be disabled.');
                return;
            }

            if (openAIConfig?.apiKey) {
                const { loadOpenAILibrary } = await import('./dynamicImports');
                const { OpenAI } = await loadOpenAILibrary();
                this.openai = new OpenAI({ apiKey: openAIConfig.apiKey, dangerouslyAllowBrowser: true });
                console.log('OpenAI service initialized successfully');
            }

            if (geminiConfig?.apiKey) {
                const { loadAILibrary } = await import('./dynamicImports');
                const { GoogleGenerativeAI } = await loadAILibrary();
                this.genAI = new GoogleGenerativeAI(geminiConfig.apiKey);
                this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
                console.log('Gemini service initialized successfully');
            }
        } catch (error) {
            console.error('Failed to initialize AI service:', error);
            throw error;
        }
    }

    public isAvailable(): boolean {
        return !!this.genAI || !!this.openai;
    }

    async analyzeStudentPerformance(studentData: StudentPerformanceData): Promise<AIAnalysisResult> {
        try {
            await this.initializeAI();

            if (!this.isAvailable()) {
                return this.getFallbackAnalysis(studentData);
            }

            const prompt = this.buildStudentAnalysisPrompt(studentData);
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            return this.parseAIResponse(text, studentData);
        } catch (error) {
            console.error('AI analysis failed:', error);
            return this.getFallbackAnalysis(studentData);
        }
    }

    async analyzeClassPerformance(classData: {
        className: string;
        totalStudents: number;
        passedStudents: number;
        averageScore: number;
        subjectStatistics: Array<{
            subjectName: string;
            averageScore: number;
            passRate: number;
        }>;
    }): Promise<AIAnalysisResult> {
        try {
            await this.initializeAI();

            if (!this.isAvailable()) {
                return this.getFallbackClassAnalysis(classData);
            }

            const prompt = this.buildClassAnalysisPrompt(classData);
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            return this.parseAIResponse(text);
        } catch (error) {
            console.error('AI class analysis failed:', error);
            return this.getFallbackClassAnalysis(classData);
        }
    }

    async extractTimetable(rawText: string, subjects: Array<{ id: string; name: string }>): Promise<any[]> {
        try {
            await this.initializeAI();

            if (!this.isAvailable()) {
                throw new Error('AI Service not available');
            }

            const subjectsList = subjects.map(s => `"${s.name}" (ID: ${s.id})`).join(', ');
            const prompt = `
                Extract a structured timetable from the following raw text. 
                Available Subjects: ${subjectsList}
                
                Rules:
                1. Identify the day of the week (Monday, Tuesday, etc.)
                2. Identify the subject and map it to one of the provided Subject IDs.
                3. Identify start and end times in 24h format (HH:mm).
                4. Return ONLY a JSON array of objects with keys: day, subjectId, startTime, endTime.
                5. If a subject name is close to one in the list, use that ID.
                
                Raw Text:
                ${rawText}
            `;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text().trim();

            // Extract JSON from response (sometimes AI adds markdown blocks)
            const jsonMatch = text.match(/\[.*\]/s);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            throw new Error('Could not parse AI response as JSON');
        } catch (error) {
            console.error('AI Timetable extraction failed:', error);
            throw error;
        }
    }

    async extractTimetableFromMedia(base64Data: string, mimeType: string, subjects: Array<{ id: string; name: string }>): Promise<any[]> {
        try {
            await this.initializeAI();

            if (!this.isAvailable()) {
                throw new Error('AI Service not available');
            }

            const visionModel = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

            const subjectsList = subjects.map(s => `"${s.name}" (ID: ${s.id})`).join(', ');
            const prompt = `
                Extract a structured timetable from the provided document/image. 
                Available Subjects: ${subjectsList}
                
                Rules:
                1. Identify the day of the week (Monday, Tuesday, etc.)
                2. Identify the subject and map it to one of the provided Subject IDs.
                3. Identify start and end times in 24h format (HH:mm).
                4. Return ONLY a JSON array of objects with keys: day, subjectId, startTime, endTime.
                5. If a subject name is close to one in the list, use that ID.
            `;

            let text = '';
            try {
                if (this.genAI) {
                    try {
                        const documentPart = {
                            inlineData: {
                                data: base64Data,
                                mimeType
                            }
                        };
                        const visionModel = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
                        const result = await visionModel.generateContent([prompt, documentPart]);
                        const response = await result.response;
                        text = response.text().trim();
                    } catch (geminiError: any) {
                        if (this.openai) {
                            console.warn('Gemini failed, falling back to OpenAI:', geminiError.message);
                            const response = await this.openai.chat.completions.create({
                                model: 'gpt-4o',
                                messages: [
                                    {
                                        role: "user",
                                        content: [
                                            { type: "text", text: prompt },
                                            {
                                                type: "image_url",
                                                image_url: { url: `data:${mimeType};base64,${base64Data}` }
                                            }
                                        ]
                                    }
                                ],
                                max_tokens: 2000
                            });
                            text = response.choices[0]?.message?.content || "";
                        } else {
                            throw geminiError;
                        }
                    }
                } else if (this.openai) {
                    const response = await this.openai.chat.completions.create({
                        model: 'gpt-4o',
                        messages: [
                            {
                                role: "user",
                                content: [
                                    { type: "text", text: prompt },
                                    {
                                        type: "image_url",
                                        image_url: { url: `data:${mimeType};base64,${base64Data}` }
                                    }
                                ]
                            }
                        ],
                        max_tokens: 2000
                    });
                    text = response.choices[0]?.message?.content || "";
                } else {
                    throw new Error("No AI Client available");
                }
            } catch (err: any) {
                throw new Error(`AI Model execution error: ${err.message}`);
            }

            const jsonMatch = text.match(/\[.*\]/s);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            throw new Error('Could not parse AI response as JSON');
        } catch (error) {
            console.error('AI Timetable extraction from media failed:', error);
            throw error;
        }
    }


    async generateMotivationalMessage(
        studentName: string,
        performanceLevel: string,
        improvements: string[]
    ): Promise<string> {
        try {
            await this.initializeAI();

            if (!this.isAvailable()) {
                return this.getFallbackMotivationalMessage(performanceLevel);
            }

            const prompt = `Generate a motivational message for ${studentName}, a student with ${performanceLevel} performance. 
      Areas for improvement: ${improvements.join(', ')}. 
      Keep it encouraging, Islamic in tone, and under 100 words.`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text().trim();
        } catch (error) {
            console.error('AI motivational message generation failed:', error);
            return this.getFallbackMotivationalMessage(performanceLevel);
        }
    }

    private buildStudentAnalysisPrompt(studentData: StudentPerformanceData): string {
        const subjectDetails = studentData.subjects.map(subject =>
            `${subject.name}: ${subject.total}/${subject.maxTotal} (${Math.round((subject.total / subject.maxTotal) * 100)}%) - ${subject.status}`
        ).join('\n');

        return `Analyze this Islamic college student's academic performance:

Student: ${studentData.studentName}
Class: ${studentData.className}
Overall Performance: ${studentData.performanceLevel}
Grand Total: ${studentData.grandTotal}
Average: ${studentData.average}%
Class Rank: ${studentData.rank}

Subject-wise Performance:
${subjectDetails}

Please provide:
1. A brief summary of the student's performance
2. Key insights about strengths and weaknesses
3. Specific recommendations for improvement
4. A motivational message appropriate for an Islamic educational context

Keep the analysis concise and constructive.`;
    }

    private buildClassAnalysisPrompt(classData: any): string {
        const subjectDetails = classData.subjectStatistics.map(subject =>
            `${subject.subjectName}: Average ${subject.averageScore}%, Pass Rate ${subject.passRate}%`
        ).join('\n');

        return `Analyze this Islamic college class performance:

Class: ${classData.className}
Total Students: ${classData.totalStudents}
Passed Students: ${classData.passedStudents}
Class Average: ${classData.averageScore}%

Subject-wise Statistics:
${subjectDetails}

Please provide:
1. Overall class performance summary
2. Subject-wise insights
3. Recommendations for improving class performance
4. Areas that need attention

Keep the analysis professional and actionable.`;
    }

    private parseAIResponse(text: string, studentData?: StudentPerformanceData): AIAnalysisResult {
        // Simple parsing - in production, you might want more sophisticated parsing
        const lines = text.split('\n').filter(line => line.trim());

        let summary = '';
        const insights: string[] = [];
        const recommendations: string[] = [];
        let motivationalMessage = '';

        let currentSection = '';

        for (const line of lines) {
            const trimmedLine = line.trim();

            if (trimmedLine.toLowerCase().includes('summary')) {
                currentSection = 'summary';
                continue;
            } else if (trimmedLine.toLowerCase().includes('insight')) {
                currentSection = 'insights';
                continue;
            } else if (trimmedLine.toLowerCase().includes('recommendation')) {
                currentSection = 'recommendations';
                continue;
            } else if (trimmedLine.toLowerCase().includes('motivational')) {
                currentSection = 'motivational';
                continue;
            }

            if (trimmedLine && !trimmedLine.match(/^\d+\./)) {
                switch (currentSection) {
                    case 'summary':
                        summary += trimmedLine + ' ';
                        break;
                    case 'insights':
                        if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•')) {
                            insights.push(trimmedLine.substring(1).trim());
                        } else {
                            insights.push(trimmedLine);
                        }
                        break;
                    case 'recommendations':
                        if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•')) {
                            recommendations.push(trimmedLine.substring(1).trim());
                        } else {
                            recommendations.push(trimmedLine);
                        }
                        break;
                    case 'motivational':
                        motivationalMessage += trimmedLine + ' ';
                        break;
                }
            }
        }

        return {
            summary: summary.trim() || 'Performance analysis completed.',
            insights: insights.length > 0 ? insights : ['Analysis completed successfully.'],
            recommendations: recommendations.length > 0 ? recommendations : ['Continue current study approach.'],
            motivationalMessage: motivationalMessage.trim() || (studentData ? this.getFallbackMotivationalMessage(studentData.performanceLevel) : undefined)
        };
    }

    private getFallbackAnalysis(studentData: StudentPerformanceData): AIAnalysisResult {
        const passedSubjects = studentData.subjects.filter(s => s.status === 'Passed').length;
        const failedSubjects = studentData.subjects.length - passedSubjects;

        let summary = `${studentData.studentName} has achieved ${studentData.performanceLevel} performance with an average of ${studentData.average}%.`;

        const insights = [
            `Passed ${passedSubjects} out of ${studentData.subjects.length} subjects`,
            `Current class rank: ${studentData.rank}`,
            `Overall performance level: ${studentData.performanceLevel}`
        ];

        const recommendations = [];
        if (failedSubjects > 0) {
            recommendations.push(`Focus on improving performance in ${failedSubjects} failed subject(s)`);
        }
        if (studentData.average < 70) {
            recommendations.push('Increase study time and seek additional help from faculty');
        }
        recommendations.push('Maintain consistent study schedule and regular revision');

        return {
            summary,
            insights,
            recommendations,
            motivationalMessage: this.getFallbackMotivationalMessage(studentData.performanceLevel)
        };
    }

    private getFallbackClassAnalysis(classData: any): AIAnalysisResult {
        const passRate = Math.round((classData.passedStudents / classData.totalStudents) * 100);

        return {
            summary: `Class ${classData.className} has ${classData.totalStudents} students with a ${passRate}% pass rate and ${classData.averageScore}% average.`,
            insights: [
                `${classData.passedStudents} students passed out of ${classData.totalStudents}`,
                `Class average score: ${classData.averageScore}%`,
                `Pass rate: ${passRate}%`
            ],
            recommendations: [
                passRate < 70 ? 'Focus on improving overall class performance' : 'Maintain current teaching standards',
                'Identify and support struggling students',
                'Continue regular assessments and feedback'
            ]
        };
    }

    private getFallbackMotivationalMessage(performanceLevel: string): string {
        const messages = {
            'Excellent': 'Masha\'Allah! Your excellent performance reflects your dedication. Continue this path of knowledge and may Allah bless your efforts.',
            'Good': 'Alhamdulillah for your good progress! With continued effort and Allah\'s guidance, you can achieve even greater success.',
            'Average': 'Your efforts are recognized. With increased focus and trust in Allah, you can improve significantly. Keep striving!',
            'Needs Improvement': 'Every challenge is an opportunity to grow. Seek Allah\'s help, increase your efforts, and success will follow.',
            'Failed': 'This is a test from Allah. Learn from this experience, seek help, and remember that with patience and effort, you can overcome any difficulty.'
        };

        return messages[performanceLevel as keyof typeof messages] || 'May Allah guide you in your educational journey and grant you success.';
    }

    isAvailable(): boolean {
        return this.genAI !== null && this.model !== null;
    }

    getStatus(): { available: boolean; error?: string } {
        if (!this.isAvailable()) {
            return {
                available: false,
                error: 'AI service not initialized. Check Gemini API key configuration.'
            };
        }

        return { available: true };
    }
}

// Export singleton instance
export const aiService = new AIService();