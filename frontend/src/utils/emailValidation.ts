export interface EmailValidationResult {
  valid: boolean;
  normalizedEmail: string;
  message?: string;
  suggestion?: string;
}

const LOCAL_PART_REGEX = /^[A-Za-z0-9]+([._%+-][A-Za-z0-9]+)*$/;
const DOMAIN_PART_REGEX = /^([A-Za-z0-9]+(-[A-Za-z0-9]+)*\.)+[A-Za-z]{2,24}$/;

const DOMAIN_TYPO_SUGGESTIONS: Record<string, string> = {
  "gmai.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmaul.com": "gmail.com",
  "gmaik.com": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmail.om": "gmail.com",
  "gmail.comm": "gmail.com",
  "gmail.vom": "gmail.com",
  "gmail.xom": "gmail.com",
  "gmail.vn": "gmail.com",
  "gmail.net": "gmail.com",
  "gmail.org": "gmail.com",
  "gmai.vn": "gmail.com",
  "gmai.co": "gmail.com",
  "fmail.com": "gmail.com",
  "hmail.com": "gmail.com",

  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yhoo.com": "yahoo.com",
  "yaho.vn": "yahoo.com.vn",
  "yahoo.con": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "yahoo.cm": "yahoo.com",

  "outlok.com": "outlook.com",
  "outllok.com": "outlook.com",
  "outook.com": "outlook.com",
  "outlook.con": "outlook.com",
  "outlook.co": "outlook.com",
  "outlook.cm": "outlook.com",
  "hotmai.com": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "hotmail.cm": "hotmail.com",

  "iclod.com": "icloud.com",
  "icoud.com": "icloud.com",
  "icloud.con": "icloud.com",
  "icloud.co": "icloud.com",
  "icloud.cm": "icloud.com",

  "fpt.edu.v": "fpt.edu.vn",
  "fpt.edu.con": "fpt.edu.vn",
  "fpt.edu.com": "fpt.edu.vn",
};

const MAJOR_EMAIL_PROVIDERS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.com.vn",
  "outlook.com",
  "outlook.com.vn",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "protonmail.com",
  "proton.me",
  "zoho.com",
  "yandex.com",
  "gmx.com",
  "mail.com",
  "linkit.vn",
  "fpt.edu.vn",
  "ptit.edu.vn",
  "stu.ptit.edu.vn",
  "hust.edu.vn",
  "sis.hust.edu.vn",
  "vnu.edu.vn",
  "uit.edu.vn",
  "hcmut.edu.vn",
  "hcmus.edu.vn",
  "ueh.edu.vn",
  "neu.edu.vn",
  "ftu.edu.vn",
]);

const PROTECTED_PROVIDER_TARGETS = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "protonmail.com",
];

const DISPOSABLE_OR_RESERVED_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "test.com",
  "testing.com",
  "invalid.com",
  "localhost",
  "localhost.com",
  "email.com",
  "domain.com",
  "abc.com",
  "xyz.com",
  "fake.com",
  "none.com",
  "mailinator.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "guerrillamail.com",
  "yopmail.com",
  "trashmail.com",
  "sharklasers.com",
  "getnada.com",
  "fakeinbox.com",
  "throwawaymail.com",
  "maildrop.cc",
  "dispostable.com",
]);

const INVALID_TLDS = new Set([
  "con",
  "comm",
  "cm",
  "om",
  "vom",
  "xom",
  "c",
  "v",
  "vnn",
  "local",
  "invalid",
  "test",
  "localhost",
  "example",
  "internal",
  "lan",
]);

const VALID_TLDS = new Set([
  "com",
  "vn",
  "net",
  "org",
  "edu",
  "gov",
  "io",
  "co",
  "ai",
  "dev",
  "app",
  "tech",
  "info",
  "biz",
  "me",
  "us",
  "uk",
  "ca",
  "au",
  "de",
  "fr",
  "jp",
  "kr",
  "sg",
  "cn",
  "tw",
  "hk",
  "th",
  "id",
  "my",
  "ph",
  "in",
  "eu",
  "xyz",
  "online",
  "site",
  "store",
  "cloud",
  "digital",
  "solutions",
  "systems",
  "company",
  "group",
  "pro",
  "name",
  "mobi",
  "asia",
  "mil",
  "int",
  "gg",
  "tv",
  "cc",
  "ws",
  "ly",
  "to",
  "sh",
  "fm",
  "am",
  "it",
  "nl",
  "es",
  "ch",
  "se",
  "no",
  "fi",
  "dk",
  "pl",
  "cz",
  "at",
  "be",
  "ie",
  "nz",
  "br",
  "mx",
  "ar",
  "cl",
  "za",
  "ae",
  "sa",
  "il",
  "tr",
  "ru",
  "ua",
  "work",
  "agency",
  "studio",
  "design",
  "software",
  "engineering",
  "academy",
  "center",
  "club",
  "community",
  "email",
  "finance",
  "global",
  "health",
  "law",
  "legal",
  "life",
  "live",
  "media",
  "network",
  "news",
  "one",
  "page",
  "plus",
  "press",
  "services",
  "space",
  "support",
  "team",
  "today",
  "tools",
  "world",
  "zone",
]);

function levenshteinDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[a.length][b.length];
}

export function validateEmailAddress(
  rawEmail: string,
  options?: { isRegistration?: boolean },
): EmailValidationResult {
  const isRegistration = options?.isRegistration ?? true;
  const trimmed = (rawEmail || "").trim().toLowerCase();

  if (!trimmed) {
    return {
      valid: false,
      normalizedEmail: "",
      message: "Vui lòng nhập địa chỉ email.",
    };
  }
  if (trimmed.length > 255) {
    return {
      valid: false,
      normalizedEmail: trimmed,
      message: "Địa chỉ email tối đa 255 ký tự.",
    };
  }
  if (trimmed.includes(" ")) {
    return {
      valid: false,
      normalizedEmail: trimmed,
      message: "Địa chỉ email không được chứa khoảng trắng.",
    };
  }

  const firstAt = trimmed.indexOf("@");
  const lastAt = trimmed.lastIndexOf("@");
  if (firstAt <= 0 || firstAt !== lastAt || firstAt === trimmed.length - 1) {
    return {
      valid: false,
      normalizedEmail: trimmed,
      message:
        "Email không đúng định dạng (phải có dạng ten@tenmien.com, ví dụ: abc@gmail.com).",
    };
  }

  const localPart = trimmed.slice(0, firstAt);
  const domain = trimmed.slice(firstAt + 1);

  if (localPart.length > 64) {
    return {
      valid: false,
      normalizedEmail: trimmed,
      message: "Phần tên tài khoản email (trước @) tối đa 64 ký tự.",
    };
  }
  if (
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..")
  ) {
    return {
      valid: false,
      normalizedEmail: trimmed,
      message: "Phần tên tài khoản email (trước @) không hợp lệ.",
    };
  }
  if (!LOCAL_PART_REGEX.test(localPart)) {
    return {
      valid: false,
      normalizedEmail: trimmed,
      message: "Email không đúng định dạng (ví dụ: abc@gmail.com).",
    };
  }

  if (!domain.includes(".")) {
    return {
      valid: false,
      normalizedEmail: trimmed,
      message:
        "Tên miền email thiếu phần mở rộng (ví dụ: @gmail.com, @company.vn).",
    };
  }
  if (domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) {
    return {
      valid: false,
      normalizedEmail: trimmed,
      message: `Tên miền email '@${domain}' không đúng định dạng.`,
    };
  }
  if (!DOMAIN_PART_REGEX.test(domain)) {
    return {
      valid: false,
      normalizedEmail: trimmed,
      message: `Tên miền email '@${domain}' không đúng định dạng (ví dụ: abc@gmail.com).`,
    };
  }

  const suggestedDomain = DOMAIN_TYPO_SUGGESTIONS[domain];
  if (suggestedDomain) {
    const suggestion = `${localPart}@${suggestedDomain}`;
    return {
      valid: false,
      normalizedEmail: trimmed,
      suggestion,
      message: `Tên miền email '@${domain}' không hợp lệ hoặc bị viết sai. Ý của bạn có phải là '${suggestion}'?`,
    };
  }

  if (!MAJOR_EMAIL_PROVIDERS.has(domain)) {
    for (const target of PROTECTED_PROVIDER_TARGETS) {
      if (levenshteinDistance(domain, target) === 1) {
        const suggestion = `${localPart}@${target}`;
        return {
          valid: false,
          normalizedEmail: trimmed,
          suggestion,
          message: `Tên miền email '@${domain}' không hợp lệ hoặc bị viết sai. Ý của bạn có phải là '${suggestion}'?`,
        };
      }
    }
  }

  if (isRegistration && DISPOSABLE_OR_RESERVED_DOMAINS.has(domain)) {
    return {
      valid: false,
      normalizedEmail: trimmed,
      message: `Tên miền email '@${domain}' là tên miền ảo hoặc không được phép đăng ký. Vui lòng sử dụng email thật.`,
    };
  }

  const labels = domain.split(".");
  const tld = labels[labels.length - 1];
  if (INVALID_TLDS.has(tld) || !/^[a-z]{2,24}$/.test(tld)) {
    return {
      valid: false,
      normalizedEmail: trimmed,
      message: `Phần mở rộng tên miền '.${tld}' trong '@${domain}' không hợp lệ.`,
    };
  }
  for (let i = 0; i < labels.length - 1; i++) {
    const label = labels[i];
    if (
      label.length < 2 &&
      !domain.endsWith(".edu.vn") &&
      !domain.endsWith(".gov.vn")
    ) {
      return {
        valid: false,
        normalizedEmail: trimmed,
        message: `Tên miền email '@${domain}' không hợp lệ.`,
      };
    }
  }

  return {
    valid: true,
    normalizedEmail: trimmed,
  };
}
