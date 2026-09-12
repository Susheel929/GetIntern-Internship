/* ===========================================================
   VALIDATORS
   Native regex-backed defensive validation. No Yup, no Formik,
   no framework schema abstraction — every rule below is a plain
   JS RegExp inspected by hand-written functions.
   =========================================================== */

const VALIDATION_PATTERNS = {
  // General-purpose free text search: letters (incl. accented),
  // numbers, spaces, and a small safe punctuation set. Rejects
  // angle brackets, quotes, backticks, semicolons, ampersands —
  // the characters that matter for HTML/script injection and
  // most SQL-meta-character abuse.
  SAFE_QUERY: /^[\p{L}\p{N}\s\-.,'()]{1,80}$/u,

  // City names: letters, spaces, hyphens, apostrophes only.
  CITY_NAME: /^[\p{L}\s\-']{1,60}$/u,

  // RFC-5322-*lite* email check. Deliberately not the full RFC
  // grammar (nobody hand-rolls that correctly) — this is the
  // pragmatic subset every production form actually uses.
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,

  // Detection list for common injection payload shapes. This is
  // a BLOCKLIST used only for flagging + logging; the ALLOWLIST
  // patterns above are what actually gate submission.
  SCRIPT_INJECTION: /<\s*script|javascript\s*:|on\w+\s*=|<\s*iframe|<\s*img[^>]+onerror/i,

  SQL_META: /('|--|;|\/\*|\*\/|\bunion\b|\bselect\b|\bdrop\b|\binsert\b)/i,
};

/**
 * Strip characters that have no legitimate place in a plain-text
 * search/city/name field, regardless of what the allowlist regex
 * above already rejects. Defense in depth: even if a caller skips
 * the validate step, sanitize() alone neutralizes the sharp edges.
 */
function sanitizeInput(rawValue) {
  if (typeof rawValue !== "string") return "";
  return rawValue
    .replace(/[<>"'`;]/g, "")   // strip HTML/script/SQL-meta delimiters
    .replace(/\s+/g, " ")        // collapse whitespace runs
    .trim()
    .slice(0, 120);              // hard length cap regardless of field
}

/**
 * Core validation result shape used everywhere in the UI layer:
 * { valid: boolean, reason: string, flagged: boolean }
 * `flagged` is true when the raw input matched an injection
 * signature — surfaced distinctly in the UI/log from a plain
 * "too short" style failure.
 */
function validateField(rawValue, patternKey, { required = true } = {}) {
  const value = typeof rawValue === "string" ? rawValue : "";
  const trimmed = value.trim();

  if (!trimmed) {
    return { valid: !required, reason: required ? "This field is required." : "", flagged: false };
  }

  const injectionHit = VALIDATION_PATTERNS.SCRIPT_INJECTION.test(value) || VALIDATION_PATTERNS.SQL_META.test(value);

  const pattern = VALIDATION_PATTERNS[patternKey];
  if (!pattern) {
    throw new Error(`validateField: unknown pattern key "${patternKey}"`);
  }

  const matchesAllowlist = pattern.test(trimmed);

  if (injectionHit) {
    return {
      valid: false,
      reason: "Blocked: input matches a known script/SQL injection pattern.",
      flagged: true,
    };
  }

  if (!matchesAllowlist) {
    return {
      valid: false,
      reason: reasonForPattern(patternKey),
      flagged: false,
    };
  }

  return { valid: true, reason: "Looks good.", flagged: false };
}

function reasonForPattern(patternKey) {
  switch (patternKey) {
    case "SAFE_QUERY":
      return "Use letters, numbers, spaces, and basic punctuation only (1–80 chars).";
    case "CITY_NAME":
      return "City names use letters, spaces, hyphens, or apostrophes only.";
    case "EMAIL":
      return "Enter a valid email address, e.g. name@example.com.";
    default:
      return "Invalid input.";
  }
}

/**
 * Convenience wrapper used by voice command parsing, where we
 * want a sanitized-and-validated value in one call, or null if
 * it fails validation (voice flow silently discards bad matches
 * rather than trying to render inline field errors for a field
 * that isn't focused).
 */
function sanitizeAndValidate(rawValue, patternKey) {
  const clean = sanitizeInput(rawValue);
  const result = validateField(clean, patternKey, { required: true });
  return result.valid ? clean : null;
}
