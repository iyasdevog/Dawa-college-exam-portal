/**
 * Simplified Data Service
 * Direct Firebase/API calls without complex circuit breakers.
 */
export class EnhancedDataService {

    async executeFirebaseOperation<T>(
        operation: () => Promise<T>,
        operationName: string
    ): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            console.error(`[DataService] Error in ${operationName}:`, error);
            throw error;
        }
    }

    async executeApiRequest<T = any>(
        url: string,
        method: string = 'GET',
        body?: any,
        headers?: Record<string, string>
    ): Promise<T> {
        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                },
                body: body ? JSON.stringify(body) : undefined
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`[DataService] API Request failed for ${url}:`, error);
            throw error;
        }
    }
}

export const enhancedDataService = new EnhancedDataService();