import {
  ApiError,
  apiRequest,
  configureApiAuth,
  configureApiTokenProvider,
} from "../api/http";
import type { AuthUser, TokenResponse } from "../api/auth";

export const REFRESH_KEY = "linkit-refresh-token";
export type UiRole = "Client" | "Freelancer" | "Admin";
export interface SessionSnapshot {
  status: "loading" | "authenticated" | "anonymous" | "error";
  user: AuthUser | null;
  error: string | null;
}
let state: SessionSnapshot = { status: "loading", user: null, error: null };
let accessToken: string | null = null;
let refreshToken: string | null = null;
let expiresAt = 0;
let generation = 0;
let refreshFlight: Promise<boolean> | null = null;
let initializeFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();
export const getSessionSnapshot = () => state;
export const getAccessToken = () => accessToken;
export const getAccessExpiry = () => expiresAt;
export const sessionGeneration = () => generation;
export function subscribeSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function emit(next: SessionSnapshot) {
  state = next;
  listeners.forEach((listener) => listener());
}
export function uiRole(user: AuthUser | null): UiRole | null {
  if (!user) return null;
  return user.roles.includes("ADMIN")
    ? "Admin"
    : user.roles.includes("CLIENT")
      ? "Client"
      : user.roles.includes("FREELANCER")
        ? "Freelancer"
        : null;
}
export function canUseDashboard(user: AuthUser | null, role: UiRole): boolean {
  return (
    !!user &&
    user.roles.includes(role.toUpperCase() as AuthUser["roles"][number])
  );
}
function clearCredentials() {
  generation++;
  accessToken = null;
  refreshToken = null;
  expiresAt = 0;
  try {
    sessionStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem("itlink-session");
  } catch {}
}
export function clearSession(message: string | null = null) {
  clearCredentials();
  emit({ status: "anonymous", user: null, error: message });
}
function store(pair: TokenResponse) {
  if (
    !pair.accessToken ||
    !pair.refreshToken ||
    pair.tokenType !== "Bearer" ||
    !(pair.expiresIn > 0)
  )
    throw new ApiError(0, "Phản hồi xác thực không hợp lệ.");
  try {
    sessionStorage.setItem(REFRESH_KEY, pair.refreshToken);
  } catch {
    throw new ApiError(
      0,
      "Không thể lưu phiên trong tab này. Vui lòng cho phép sessionStorage.",
    );
  }
  accessToken = pair.accessToken;
  refreshToken = pair.refreshToken;
  expiresAt = Date.now() + pair.expiresIn * 1000;
}
export async function refreshSession(): Promise<boolean> {
  if (refreshFlight) return refreshFlight;
  if (!refreshToken) return false;
  const epoch = generation;
  const credential = refreshToken;
  const operation = (async () => {
    try {
      const pair = await apiRequest<TokenResponse>("/api/auth/refresh", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ refreshToken: credential }),
      });
      if (epoch !== generation) {
        await apiRequest<void>("/api/auth/logout", {
          method: "POST",
          auth: false,
          body: JSON.stringify({ refreshToken: pair.refreshToken }),
        });
        return false;
      }
      store(pair);
      await verifyUser(epoch);
      return true;
    } catch (error) {
      if (
        epoch === generation &&
        error instanceof ApiError &&
        error.status === 401
      )
        clearSession("Phiên đã hết hạn. Vui lòng đăng nhập lại.");
      throw error;
    }
  })();
  refreshFlight = operation;
  try {
    return await operation;
  } finally {
    if (refreshFlight === operation) refreshFlight = null;
  }
}
async function verifyUser(epoch: number): Promise<AuthUser> {
  const user = await apiRequest<AuthUser>("/api/auth/me", { retry401: false });
  if (epoch !== generation)
    throw new ApiError(401, "Phiên xác thực đã thay đổi.");
  if (user.status !== "ACTIVE" || !Array.isArray(user.roles) || !uiRole(user))
    throw new ApiError(403, "Tài khoản không có vai trò được hỗ trợ.");
  emit({ status: "authenticated", user, error: null });
  return user;
}
export async function establishSession(
  pair: TokenResponse,
  expected = generation,
): Promise<AuthUser> {
  if (expected !== generation) {
    await apiRequest<void>("/api/auth/logout", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ refreshToken: pair.refreshToken }),
    });
    throw new ApiError(401, "Yêu cầu xác thực đã bị hủy.");
  }
  const epoch = ++generation;
  store(pair);
  try {
    return await verifyUser(epoch);
  } catch (error) {
    if (epoch === generation) {
      if (error instanceof ApiError && error.status === 401)
        clearSession("Phiên không còn hợp lệ. Vui lòng đăng nhập lại.");
      else
        emit({
          status: "error",
          user: null,
          error:
            error instanceof Error
              ? error.message
              : "Không thể xác nhận tài khoản.",
        });
    }
    throw error;
  }
}
export function initializeSession(): Promise<void> {
  if (initializeFlight) return initializeFlight;
  initializeFlight = (async () => {
    const epoch = generation;
    try {
      localStorage.removeItem("itlink-session");
      refreshToken = sessionStorage.getItem(REFRESH_KEY);
      if (!refreshToken) {
        emit({ status: "anonymous", user: null, error: null });
        return;
      }
      await refreshSession();
    } catch (error) {
      if (epoch === generation)
        emit({
          status: "error",
          user: null,
          error:
            error instanceof Error
              ? error.message
              : "Không thể khôi phục phiên.",
        });
    }
  })();
  return initializeFlight;
}
export async function logoutSession(): Promise<boolean> {
  const pending = refreshFlight;
  const credential = refreshToken;
  clearSession();
  let revoked = true;
  if (credential) {
    try {
      await apiRequest<void>("/api/auth/logout", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ refreshToken: credential }),
      });
    } catch {
      revoked = false;
    }
  }

  if (pending) {
    try {
      await pending;
    } catch {
      revoked = false;
    }
  }
  return revoked;
}
configureApiTokenProvider(getAccessToken);
configureApiAuth(refreshSession, (token) => {
  if (token === accessToken)
    clearSession("Phiên đã hết hạn. Vui lòng đăng nhập lại.");
});
