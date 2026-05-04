const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:OPENAI|ANTHROPIC|GITHUB)_API_KEY\s*=\s*[^\s'"]+/g, "$1=[REDACTED]"],
  [/\bAWS_SECRET_ACCESS_KEY\s*=\s*[^\s'"]+/g, "AWS_SECRET_ACCESS_KEY=[REDACTED]"],
  [/\bghp_[A-Za-z0-9]{20,}\b/g, "[REDACTED_GITHUB_TOKEN]"],
  [/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[REDACTED_OPENAI_KEY]"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{10,}\b/g, "[REDACTED_JWT]"]
];

export function redactSecrets(content: string): string {
  return SECRET_PATTERNS.reduce((current, [pattern, replacement]) => {
    return current.replace(pattern, replacement);
  }, content);
}
