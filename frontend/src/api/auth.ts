import { apiRequest } from "./http";
import {
  establishSession,
  logoutSession,
  refreshSession,
  sessionGeneration,
} from "../auth/session";
export type AuthRole = "ADMIN" | "CLIENT" | "FREELANCER";
export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  phoneNumber: string | null;
  avatarUrl: string | null;
  status: "ACTIVE" | "LOCKED" | "DISABLED";
  roles: AuthRole[];
}
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  refreshExpiresAt: string;
  user: AuthUser;
}
export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  role: "CLIENT" | "FREELANCER";
}
export interface LoginInput {
  email: string;
  password: string;
}
export function passwordError(password: string): string | null {
  return password.length < 12 ||
    password.length > 72 ||
    new TextEncoder().encode(password).length > 72
    ? "Mật khẩu cần 12–72 ký tự và không quá 72 byte UTF-8."
    : null;
}
export const authApi = {
  async register(input: RegisterInput): Promise<AuthUser> {
    const invalid = passwordError(input.password);
    if (invalid) throw new Error(invalid);
    const epoch = sessionGeneration();
    const { email, password, fullName, role } = input;
    return establishSession(
      await apiRequest<TokenResponse>("/api/auth/register", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ email, password, fullName, role }),
      }),
      epoch,
    );
  },
  async login(input: LoginInput): Promise<AuthUser> {
    const epoch = sessionGeneration();
    return establishSession(
      await apiRequest<TokenResponse>("/api/auth/login", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ email: input.email, password: input.password }),
      }),
      epoch,
    );
  },
  requestPasswordCode: (email: string) =>
    apiRequest<{ message: string }>("/api/auth/password/request", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ email }),
    }),
  resetPassword: (email: string, code: string, newPassword: string) =>
    apiRequest<{ message: string }>("/api/auth/password/confirm", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ email, code, newPassword }),
    }),
  me: () => apiRequest<AuthUser>("/api/auth/me"),
  refresh: refreshSession,
  logout: logoutSession,
};
