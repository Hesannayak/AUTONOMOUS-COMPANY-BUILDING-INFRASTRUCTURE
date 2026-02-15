import { z, type ZodType } from 'zod';
import { createLogger } from '@acbi/utils';

/**
 * A tool that agents can invoke during execution.
 * Tools are the bridge between agents and external systems
 * (APIs, databases, code execution, etc.).
 */
export interface Tool {
  name: string;
  description: string;
  parameters: ZodType;
  execute: (input: unknown) => Promise<unknown>;
}

/**
 * Registry for tools available to agents.
 * Each service registers tools that its agents can use.
 */
export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools = new Map<string, Tool>();
  private logger = createLogger('tool-registry');

  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
    this.logger.info({ tool: tool.name }, `Registered tool: ${tool.name}`);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  async invoke(name: string, input: unknown): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    // Validate input
    const parsed = tool.parameters.parse(input);

    this.logger.debug({ tool: name }, `Invoking tool: ${name}`);
    const result = await tool.execute(parsed);
    return result;
  }

  list(): Array<{ name: string; description: string }> {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
    }));
  }

  /**
   * Get tool definitions formatted for LLM function calling.
   */
  getToolDefinitions(
    names?: string[],
  ): Array<{ name: string; description: string; parameters: Record<string, unknown> }> {
    const tools = names
      ? names.map((n) => this.tools.get(n)).filter(Boolean) as Tool[]
      : Array.from(this.tools.values());

    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: this.zodToJsonSchema(tool.parameters),
    }));
  }

  private zodToJsonSchema(schema: ZodType): Record<string, unknown> {
    // Simple zod-to-JSON-schema conversion for LLM tool definitions
    // In production, use zod-to-json-schema library
    if (schema instanceof z.ZodObject) {
      const shape = schema.shape as Record<string, ZodType>;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        properties[key] = { type: this.getZodType(value) };
        if (!value.isOptional()) {
          required.push(key);
        }
      }

      return { type: 'object', properties, required };
    }

    return { type: 'object', properties: {} };
  }

  private getZodType(schema: ZodType): string {
    if (schema instanceof z.ZodString) return 'string';
    if (schema instanceof z.ZodNumber) return 'number';
    if (schema instanceof z.ZodBoolean) return 'boolean';
    if (schema instanceof z.ZodArray) return 'array';
    return 'string';
  }
}
