// ============================================
// Code Sandbox - Sandboxed Code Execution
// Phase 3: Will use Docker/Firecracker for real isolation.
// For now, this is a placeholder that simulates execution results.
// ============================================

import { createLogger } from '@acbi/utils';

const logger = createLogger('code-execution-service:sandbox');

export type SupportedLanguage = 'typescript' | 'javascript' | 'python';

export interface ExecutionResult {
  output: string;
  exitCode: number;
  stderr: string;
  executionTimeMs: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 300_000; // 5 minutes

export class CodeSandbox {
  private readonly supportedLanguages: SupportedLanguage[] = ['typescript', 'javascript', 'python'];

  /**
   * Execute code in a sandboxed environment.
   *
   * Phase 3: This will run code inside a Docker container or Firecracker microVM
   * with strict resource limits (CPU, memory, network, filesystem).
   * For now, it logs the request and returns simulated results.
   */
  async execute(
    code: string,
    language: SupportedLanguage,
    timeout: number = DEFAULT_TIMEOUT_MS,
  ): Promise<ExecutionResult> {
    const effectiveTimeout = Math.min(Math.max(timeout, 1000), MAX_TIMEOUT_MS);

    if (!this.supportedLanguages.includes(language)) {
      return {
        output: '',
        exitCode: 1,
        stderr: `Unsupported language: ${language}. Supported: ${this.supportedLanguages.join(', ')}`,
        executionTimeMs: 0,
      };
    }

    logger.info(
      {
        language,
        codeLength: code.length,
        timeout: effectiveTimeout,
      },
      'Simulating code execution (sandbox placeholder)',
    );

    // Simulate execution time
    const simulatedTimeMs = Math.floor(Math.random() * 500) + 50;
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      output: `[SIMULATED] Code execution completed successfully.\nLanguage: ${language}\nCode length: ${code.length} characters\nTimeout: ${effectiveTimeout}ms`,
      exitCode: 0,
      stderr: '',
      executionTimeMs: simulatedTimeMs,
    };
  }

  /**
   * Validate code without executing it (syntax check, type check for TS).
   *
   * Phase 3: Will run actual linters/compilers inside a sandbox.
   * For now, performs basic validation checks.
   */
  async validate(code: string, language: SupportedLanguage): Promise<ValidationResult> {
    if (!this.supportedLanguages.includes(language)) {
      return {
        valid: false,
        errors: [`Unsupported language: ${language}. Supported: ${this.supportedLanguages.join(', ')}`],
        warnings: [],
      };
    }

    if (!code || code.trim().length === 0) {
      return {
        valid: false,
        errors: ['Code is empty'],
        warnings: [],
      };
    }

    logger.info(
      { language, codeLength: code.length },
      'Validating code (placeholder)',
    );

    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic syntax checks (placeholder heuristics)
    if (language === 'typescript' || language === 'javascript') {
      const openBraces = (code.match(/\{/g) || []).length;
      const closeBraces = (code.match(/\}/g) || []).length;
      if (openBraces !== closeBraces) {
        errors.push(`Mismatched braces: ${openBraces} opening, ${closeBraces} closing`);
      }

      const openParens = (code.match(/\(/g) || []).length;
      const closeParens = (code.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        errors.push(`Mismatched parentheses: ${openParens} opening, ${closeParens} closing`);
      }

      if (code.includes('eval(')) {
        warnings.push('Use of eval() detected - this is a security risk');
      }
    }

    if (language === 'python') {
      if (code.includes('exec(') || code.includes('eval(')) {
        warnings.push('Use of exec()/eval() detected - this is a security risk');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get list of supported languages.
   */
  getSupportedLanguages(): SupportedLanguage[] {
    return [...this.supportedLanguages];
  }
}
