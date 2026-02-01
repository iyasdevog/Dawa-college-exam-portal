import { User, LoginCredentials, AuthResult, SessionValidation, TokenRefresh } from '../../domain/entities/User';
import { IUserRepository } from '../../domain/interfaces/IUserRepository';
import { configurationService } from '../services/ConfigurationService';

export interface IAuthenticationService {
    authenticate(credentials: LoginCredentials): Promise<AuthResult>;
    validateSession(token: string): Promise<SessionValidation>;
    refreshToken(refreshToken: string): Promise<TokenRefresh>;
    logout(sessionId: string): Promise<void>;
}

export interface SessionData {
    userId: string;
    username: string;
    role: string;
    issuedAt: number;
    expiresAt: number;
    sessionId: string;
}

export class AuthenticationService implements IAuthenticationService {
    private activeSessions = new Map<string, SessionData>();
    private loginAttempts = new Map<string, { count: number; lastAttempt: number; lockedUntil?: number }>();

    constructor(private userRepository: IUserRepository) { }

    async authenticate(credentials: LoginCredentials): Promise<AuthResult> {
        try {
            // Check rate limiting
            const rateLimitResult = this.checkRateLimit(credentials.username);
            if (!rateLimitResult.allowed) {
                return {
                    success: false,
                    error: `Account locked. Try again in ${Math.ceil(rateLimitResult.retryAfter / 60000)} minutes.`
                };
            }

            // For now, use hardcoded admin credentials (will be replaced with proper user management)
            if (credentials.username === 'admin' && credentials.password === '1234') {
                const user = User.create({
                    id: 'admin-001',
                    username: 'admin',
                    role: 'admin',
                    name: 'System Administrator',
                    email: 'admin@aicdawa.edu'
                });

                const sessionData = this.createSession(user);
                const token = this.generateToken(sessionData);
                const refreshToken = this.generateRefreshToken(sessionData);

                // Clear login attempts on successful login
                this.loginAttempts.delete(credentials.username);

                return {
                    success: true,
                    user: user.updateLastLogin(),
                    token,
                    refreshToken
                };
            }

            // Try to validate against user repository
            const user = await this.userRepository.validateCredentials(credentials);
            if (user) {
                const sessionData = this.createSession(user);
                const token = this.generateToken(sessionData);
                const refreshToken = this.generateRefreshToken(sessionData);

                // Update last login
                await this.userRepository.updateLastLogin(user.id);

                // Clear login attempts on successful login
                this.loginAttempts.delete(credentials.username);

                return {
                    success: true,
                    user: user.updateLastLogin(),
                    token,
                    refreshToken
                };
            }

            // Record failed attempt
            this.recordFailedAttempt(credentials.username);

            return {
                success: false,
                error: 'Invalid credentials'
            };
        } catch (error) {
            console.error('Authentication error:', error);
            return {
                success: false,
                error: 'Authentication service unavailable'
            };
        }
    }

    async validateSession(token: string): Promise<SessionValidation> {
        try {
            const sessionData = this.decodeToken(token);
            if (!sessionData) {
                return { isValid: false };
            }

            // Check if session exists and is not expired
            const activeSession = this.activeSessions.get(sessionData.sessionId);
            if (!activeSession || activeSession.expiresAt < Date.now()) {
                if (activeSession) {
                    this.activeSessions.delete(sessionData.sessionId);
                }
                return { isValid: false };
            }

            // Get user from repository
            const user = await this.userRepository.findById(sessionData.userId);
            if (!user || !user.isActive) {
                return { isValid: false };
            }

            return {
                isValid: true,
                user,
                expiresAt: new Date(activeSession.expiresAt)
            };
        } catch (error) {
            console.error('Session validation error:', error);
            return { isValid: false };
        }
    }

    async refreshToken(refreshToken: string): Promise<TokenRefresh> {
        try {
            const sessionData = this.decodeRefreshToken(refreshToken);
            if (!sessionData) {
                return { success: false };
            }

            const activeSession = this.activeSessions.get(sessionData.sessionId);
            if (!activeSession) {
                return { success: false };
            }

            // Create new session with extended expiry
            const user = await this.userRepository.findById(sessionData.userId);
            if (!user || !user.isActive) {
                return { success: false };
            }

            const newSessionData = this.createSession(user);
            const newToken = this.generateToken(newSessionData);
            const newRefreshToken = this.generateRefreshToken(newSessionData);

            // Remove old session
            this.activeSessions.delete(sessionData.sessionId);

            return {
                success: true,
                token: newToken,
                refreshToken: newRefreshToken,
                expiresAt: new Date(newSessionData.expiresAt)
            };
        } catch (error) {
            console.error('Token refresh error:', error);
            return { success: false };
        }
    }

    async logout(sessionId: string): Promise<void> {
        try {
            this.activeSessions.delete(sessionId);
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    private createSession(user: User): SessionData {
        const securityConfig = configurationService.getSecurityConfig();
        const sessionId = this.generateSessionId();
        const now = Date.now();
        const expiresAt = now + securityConfig.sessionTimeout;

        const sessionData: SessionData = {
            userId: user.id,
            username: user.username,
            role: user.role,
            issuedAt: now,
            expiresAt,
            sessionId
        };

        this.activeSessions.set(sessionId, sessionData);
        return sessionData;
    }

    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private generateToken(sessionData: SessionData): string {
        // Simple token generation (in production, use proper JWT)
        const payload = {
            userId: sessionData.userId,
            username: sessionData.username,
            role: sessionData.role,
            sessionId: sessionData.sessionId,
            exp: sessionData.expiresAt
        };

        return btoa(JSON.stringify(payload));
    }

    private generateRefreshToken(sessionData: SessionData): string {
        // Simple refresh token generation
        const payload = {
            userId: sessionData.userId,
            sessionId: sessionData.sessionId,
            type: 'refresh',
            exp: sessionData.expiresAt + (7 * 24 * 60 * 60 * 1000) // 7 days
        };

        return btoa(JSON.stringify(payload));
    }

    private decodeToken(token: string): SessionData | null {
        try {
            const payload = JSON.parse(atob(token));
            if (payload.exp < Date.now()) {
                return null;
            }
            return payload;
        } catch {
            return null;
        }
    }

    private decodeRefreshToken(refreshToken: string): SessionData | null {
        try {
            const payload = JSON.parse(atob(refreshToken));
            if (payload.type !== 'refresh' || payload.exp < Date.now()) {
                return null;
            }
            return payload;
        } catch {
            return null;
        }
    }

    private checkRateLimit(username: string): { allowed: boolean; retryAfter: number } {
        const securityConfig = configurationService.getSecurityConfig();
        const attempts = this.loginAttempts.get(username);

        if (!attempts) {
            return { allowed: true, retryAfter: 0 };
        }

        // Check if account is locked
        if (attempts.lockedUntil && attempts.lockedUntil > Date.now()) {
            return { allowed: false, retryAfter: attempts.lockedUntil - Date.now() };
        }

        // Check if max attempts exceeded
        if (attempts.count >= securityConfig.maxLoginAttempts) {
            const lockUntil = Date.now() + securityConfig.lockoutDuration;
            this.loginAttempts.set(username, {
                ...attempts,
                lockedUntil: lockUntil
            });
            return { allowed: false, retryAfter: securityConfig.lockoutDuration };
        }

        return { allowed: true, retryAfter: 0 };
    }

    private recordFailedAttempt(username: string): void {
        const attempts = this.loginAttempts.get(username) || { count: 0, lastAttempt: 0 };

        this.loginAttempts.set(username, {
            count: attempts.count + 1,
            lastAttempt: Date.now(),
            lockedUntil: attempts.lockedUntil
        });
    }

    // Cleanup expired sessions (should be called periodically)
    cleanupExpiredSessions(): void {
        const now = Date.now();
        for (const [sessionId, session] of this.activeSessions.entries()) {
            if (session.expiresAt < now) {
                this.activeSessions.delete(sessionId);
            }
        }
    }

    // Get active session count (for monitoring)
    getActiveSessionCount(): number {
        this.cleanupExpiredSessions();
        return this.activeSessions.size;
    }
}