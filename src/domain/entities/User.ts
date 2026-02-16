export type UserRole = 'admin' | 'faculty' | 'student' | 'public';

export class User {
    constructor(
        public readonly id: string,
        public readonly username: string,
        public readonly role: UserRole,
        public readonly name: string,
        public readonly email?: string,
        public readonly isActive: boolean = true,
        public readonly lastLogin?: Date,
        public readonly permissions: string[] = [],
        public readonly assignedClasses: string[] = []
    ) { }

    static create(data: {
        id: string;
        username: string;
        role: UserRole;
        name: string;
        email?: string;
        isActive?: boolean;
        lastLogin?: Date;
        permissions?: string[];
        assignedClasses?: string[];
    }): User {
        return new User(
            data.id,
            data.username,
            data.role,
            data.name,
            data.email,
            data.isActive ?? true,
            data.lastLogin,
            data.permissions || [],
            data.assignedClasses || []
        );
    }

    hasPermission(permission: string): boolean {
        return this.permissions.includes(permission) || this.role === 'admin';
    }

    canAccessAdminFeatures(): boolean {
        return this.role === 'admin' || this.role === 'faculty';
    }

    canModifyStudentData(): boolean {
        return this.role === 'admin' || this.role === 'faculty';
    }

    canViewAllStudents(): boolean {
        return this.role === 'admin' || this.role === 'faculty';
    }

    updateLastLogin(): User {
        return new User(
            this.id,
            this.username,
            this.role,
            this.name,
            this.email,
            this.isActive,
            new Date(),
            this.permissions,
            this.assignedClasses
        );
    }

    deactivate(): User {
        return new User(
            this.id,
            this.username,
            this.role,
            this.name,
            this.email,
            false,
            this.lastLogin,
            this.permissions
        );
    }

    addPermission(permission: string): User {
        if (this.permissions.includes(permission)) {
            return this;
        }

        return new User(
            this.id,
            this.username,
            this.role,
            this.name,
            this.email,
            this.isActive,
            this.lastLogin,
            [...this.permissions, permission]
        );
    }

    removePermission(permission: string): User {
        return new User(
            this.id,
            this.username,
            this.role,
            this.name,
            this.email,
            this.isActive,
            this.lastLogin,
            this.permissions.filter(p => p !== permission)
        );
    }
}

export interface LoginCredentials {
    username: string;
    password: string;
}

export interface AuthResult {
    success: boolean;
    user?: User;
    token?: string;
    refreshToken?: string;
    error?: string;
}

export interface SessionValidation {
    isValid: boolean;
    user?: User;
    expiresAt?: Date;
}

export interface TokenRefresh {
    success: boolean;
    token?: string;
    refreshToken?: string;
    expiresAt?: Date;
}