export const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL ?? "")
  .trim()
  .replace(/\/+$/, "");

export class ApiError extends Error {
  readonly code: string;
  readonly errors: Record<string, string>;
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
    public readonly headers = new Headers(),
  ) {
    super(message);
    this.name = "ApiError";
    const dto =
      details && typeof details === "object"
        ? (details as Record<string, unknown>)
        : {};
    this.code =
      typeof dto.code === "string"
        ? dto.code
        : status === 0
          ? "NETWORK_ERROR"
          : "HTTP_ERROR";
    this.errors =
      dto.errors && typeof dto.errors === "object"
        ? (dto.errors as Record<string, string>)
        : {};
  }
}
export interface ApiResponse<T> {
  data: T;
  headers: Headers;
  status: number;
  etag: string | null;
}
export interface RequestOptions extends RequestInit {
  auth?: boolean;
  retry401?: boolean;
  parseJson?: (raw: string) => unknown;
}
let tokenProvider: () => string | null = () => null;
let refreshProvider: () => Promise<boolean> = async () => false;
let unauthorized: (token: string | null) => void = () => {};
export function configureApiTokenProvider(provider: () => string | null): void {
  tokenProvider = provider;
}
export function configureApiAuth(
  refresh: () => Promise<boolean>,
  expired: (token: string | null) => void,
): void {
  refreshProvider = refresh;
  unauthorized = expired;
}
const publicAuth = new Set([
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
  "/api/auth/logout",
]);
async function send(
  path: string,
  options: RequestOptions,
  token: string | null,
): Promise<Response> {
  if (
    typeof window !== "undefined" &&
    (window.location.pathname === "/preview-v2" ||
      (import.meta.env?.DEV && window.location.pathname === "/dev-demo"))
  )
    throw new ApiError(0, "Chế độ demo không gửi yêu cầu tới API thật.");

  if (!path.startsWith("/") || path.startsWith("//"))
    throw new ApiError(0, "Đường dẫn API không hợp lệ.");
  const headers = new Headers(options.headers);
  if (
    options.body != null &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  )
    headers.set("Content-Type", "application/json");
  headers.delete("Authorization");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const { auth: _auth, retry401: _retry, parseJson: _parse, ...init } = options;
  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      credentials: "omit",
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new ApiError(
      0,
      "Không thể kết nối máy chủ. Kiểm tra kết nối, địa chỉ API và CORS.",
    );
  }
}
async function response(
  path: string,
  options: RequestOptions,
): Promise<Response> {
  const protectedRequest =
    options.auth !== false && !publicAuth.has(path.split("?")[0]);
  let used = protectedRequest ? tokenProvider() : null;
  let result = await send(path, options, used);
  if (result.status === 401 && protectedRequest && options.retry401 !== false) {
    const current = tokenProvider();
    if ((current && current !== used) || (await refreshProvider())) {
      used = tokenProvider();
      result = await send(path, options, used);
    }
    if (result.status === 401) unauthorized(used);
  }
  return result;
}
async function failure(result: Response): Promise<never> {
  let data: unknown;
  try {
    data = await result.json();
  } catch {
    data = null;
  }
  const dto =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const fallback: Record<number, string> = {
    401: "Phiên đăng nhập không còn hợp lệ.",
    403: "Bạn không có quyền thực hiện thao tác này.",
    409: "Dữ liệu đã thay đổi hoặc thao tác xung đột. Vui lòng tải lại.",
    412: "Phiên bản dữ liệu đã thay đổi. Vui lòng tải lại.",
    422: "Dữ liệu chưa hợp lệ. Vui lòng kiểm tra các trường nhập.",
  };
  throw new ApiError(
    result.status,
    typeof dto.message === "string"
      ? dto.message
      : fallback[result.status] || `Yêu cầu thất bại (HTTP ${result.status}).`,
    data,
    result.headers,
  );
}
export async function apiRequestWithMeta<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const result = await response(path, options);
  if (!result.ok) return failure(result);
  let raw: string;
  try {
    raw = await result.text();
  } catch {
    throw new ApiError(
      0,
      "Kết nối bị gián đoạn khi đọc phản hồi; chưa xác nhận kết quả thao tác.",
    );
  }
  let data: unknown = null;
  if (raw) {
    try {
      data = options.parseJson ? options.parseJson(raw) : JSON.parse(raw);
    } catch {
      throw new ApiError(
        result.status,
        "Phản hồi máy chủ không đúng định dạng JSON.",
      );
    }
  }
  return {
    data: data as T,
    status: result.status,
    headers: result.headers,
    etag: result.headers.get("ETag"),
  };
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  return (await apiRequestWithMeta<T>(path, options)).data;
}
export async function apiFetchBlob(
  path: string,
  options: RequestOptions = {},
): Promise<Blob> {
  const result = await response(path, options);
  if (!result.ok) return failure(result);
  return result.blob();
}
export function pageQuery(page = 0, size = 20): string {
  if (
    !Number.isInteger(page) ||
    page < 0 ||
    !Number.isInteger(size) ||
    size < 1 ||
    size > 100
  )
    throw new Error("page phải >= 0 và size từ 1 đến 100");
  return new URLSearchParams({
    page: String(page),
    size: String(size),
  }).toString();
}
