import type { SecretFinding } from '../types';

interface SecretRule {
  name: string;
  regex: RegExp;
  severity: 'high' | 'medium';
}

export const SECRET_RULES: SecretRule[] = [
  {
    name: 'OpenAI / Anthropic Secret Key',
    regex: /(?:sk-(?:proj-|live-|ant-api-)?)[A-Za-z0-9_-]{20,}/g,
    severity: 'high',
  },
  {
    name: 'Google API / Gemini Key',
    regex: /AIza[0-9A-Za-z-_]{30,45}/g,
    severity: 'high',
  },
  {
    name: 'AWS Access Key ID',
    regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
    severity: 'high',
  },
  {
    name: 'AWS Secret Access Key',
    regex: /(?:aws_secret_access_key|aws_secret_key)\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})["']?/gi,
    severity: 'high',
  },
  {
    name: 'GitHub Personal Access Token',
    regex: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,255}/g,
    severity: 'high',
  },
  {
    name: 'RSA / SSH / PGP Private Key',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY(?: BLOCK)?-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY(?: BLOCK)?-----/g,
    severity: 'high',
  },
  {
    name: 'Generic Bearer Token / Password in Code',
    regex: /(?:bearer\s+[A-Za-z0-9\-._~+/]+=*)|(?:password|secret|passwd|api_key|apikey)\s*[:=]\s*["']([^"']{8,})["']/gi,
    severity: 'medium',
  },
  {
    name: 'Slack Token',
    regex: /xox[baprs]-[0-9a-zA-Z]{10,48}/g,
    severity: 'high',
  },
  {
    name: 'Stripe Secret Key',
    regex: /(?:sk|rk)_live_[0-9a-zA-Z]{24,99}/g,
    severity: 'high',
  },
];

/**
 * Scans a file's content for exposed secrets.
 */
export function scanFileForSecrets(filePath: string, content: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  if (!content) return findings;

  const lines = content.split('\n');

  // Check multi-line private keys first
  const privateKeyRule = SECRET_RULES.find(r => r.name.includes('Private Key'));
  if (privateKeyRule) {
    const matches = Array.from(content.matchAll(privateKeyRule.regex));
    for (const match of matches) {
      if (match.index !== undefined) {
        // Find line number
        const lineNumber = content.substring(0, match.index).split('\n').length;
        findings.push({
          id: `${filePath}:${lineNumber}:${privateKeyRule.name}`,
          filePath,
          line: lineNumber,
          ruleName: privateKeyRule.name,
          severity: privateKeyRule.severity,
          snippet: '-----BEGIN PRIVATE KEY----- ... [TRUNCATED] ... -----END PRIVATE KEY-----',
          matchedText: match[0],
        });
      }
    }
  }

  // Scan line by line for other patterns
  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i];
    // Ignore lines that are already redact placeholders or comments explaining templates
    if (lineText.includes('[REDACTED_SECRET]') || lineText.includes('your_api_key_here')) {
      continue;
    }

    for (const rule of SECRET_RULES) {
      if (rule.name.includes('Private Key')) continue; // already handled

      // reset regex index
      rule.regex.lastIndex = 0;
      const matches = Array.from(lineText.matchAll(rule.regex));
      for (const match of matches) {
        const secretStr = match[1] || match[0];
        // filter out obvious dummy words
        if (/^(true|false|null|undefined|sample|example|test|default|dummy|changeme)$/i.test(secretStr)) {
          continue;
        }

        const snippetStart = Math.max(0, (match.index || 0) - 15);
        const snippetEnd = Math.min(lineText.length, (match.index || 0) + secretStr.length + 15);
        const snippet = lineText.substring(snippetStart, snippetEnd).trim();

        findings.push({
          id: `${filePath}:${i + 1}:${rule.name}`,
          filePath,
          line: i + 1,
          ruleName: rule.name,
          severity: rule.severity,
          snippet: snippet.length > 60 ? snippet.substring(0, 60) + '...' : snippet,
          matchedText: secretStr,
        });
      }
    }
  }

  return findings;
}

/**
 * Replaces all matched secret strings with [REDACTED_SECRET] in the target text.
 */
export function redactSecretsFromContent(content: string): { redactedContent: string; redactionCount: number } {
  let result = content;
  let redactionCount = 0;

  for (const rule of SECRET_RULES) {
    rule.regex.lastIndex = 0;
    result = result.replace(rule.regex, (match, p1) => {
      redactionCount++;
      if (p1 && match.includes(p1)) {
        return match.replace(p1, '[REDACTED_SECRET]');
      }
      return '[REDACTED_SECRET]';
    });
  }

  return { redactedContent: result, redactionCount };
}
