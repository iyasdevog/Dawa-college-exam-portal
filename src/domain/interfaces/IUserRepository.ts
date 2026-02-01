import { User, LoginCredentials } from '../entities/User';

export interface IUserRepository {
    // Basic CRUD operations
    findById(id: string): Promise<User | null>;
    findByUsername(username: string): Promise<User | null>;
    findAll(): Promise<User[]>;
    save(user: User): Promise<string>;
    update(id: string, updates: Partial<User>): Promise<void>;
    delete(id: string): Promise<void>;

    // Authentication operations
    validateCredentials(credentials: LoginCredentials): Promise<User | null>;
    updateLastLogin(userId: string): Promise<void>;

    // Permission operations
    getUserPermissions(userId: string): Promise<string[]>;
    hasPermission(userId: string, permission: string): Promise<boolean>;
}