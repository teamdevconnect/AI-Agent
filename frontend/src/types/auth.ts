export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company?: string;
<<<<<<< HEAD
  role: 'owner' | 'admin' | 'member';
=======
  roles: string[];
  assignedAgentId?: string;
>>>>>>> 6a60a8648 (Initial AI Agent source code)
  avatarUrl?: string;
  timezone?: string;
  language?: string;
  createdAt: string;
}

export interface AuthSession {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
  marketingConsent: boolean;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  email: string;
  otp: string;
  password: string;
  confirmPassword: string;
}

export type OAuthProvider = 'google' | 'microsoft' | 'github';
