import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { DebugLogger } from './DebugLogger';

// Manual schema definitions for common n8n tools that might not have proper schema.shape
const TOOL_SCHEMAS: Record<string, any> = {
    'Calculator': {
        input: z.string().describe('A mathematical expression to evaluate, e.g., "2+2" or "sqrt(16)"'),
    },
};

export async function adaptToMcpTools(tools: any[], verbose: boolean = false, logger?: DebugLogger): Promise<any[]> {
    if (!tools || tools.length === 0) {
        return [];
    }

    return tools.map((t: any) => {
        // Assuming LangChain tool structure
        // t.schema is usually a Zod schema. We need the shape for the SDK tool definition.
        // If schema is missing or doesn't have shape, default to empty object.

        if (verbose && logger) {
            logger.log(`Processing tool: ${t.name}`);
            logger.log('Tool object keys:', Object.keys(t));
            logger.log('Schema type:', typeof t.schema);
            logger.log('Schema:', t.schema);
            if (t.schema) {
                logger.log('Schema keys:', Object.keys(t.schema));
                logger.log('Schema.shape:', t.schema.shape);
                logger.log('Schema._def:', t.schema._def);

                // Try to inspect deeper into Zod schema structure
                if (t.schema._def && t.schema._def.schema) {
                    logger.log('Schema._def.schema:', t.schema._def.schema);
                    if (t.schema._def.schema._def) {
                        logger.log('Schema._def.schema._def:', t.schema._def.schema._def);
                        if (t.schema._def.schema._def.shape) {
                            logger.log('Schema._def.schema._def.shape():', t.schema._def.schema._def.shape());
                        }
                    }
                }
            }
        }

        // Try multiple ways to extract the schema
        let schemaShape;

        // 1. Try getting shape from Zod schema directly
        if (t.schema && t.schema.shape) {
            schemaShape = t.schema.shape;
            if (verbose && logger) logger.log(`Using schema.shape for ${t.name}`);
        }
        // 2. Try extracting from ZodEffects wrapper (common in LangChain tools)
        else if (t.schema && t.schema._def && t.schema._def.schema && t.schema._def.schema._def && t.schema._def.schema._def.shape) {
            schemaShape = t.schema._def.schema._def.shape();
            if (verbose && logger) logger.log(`Using schema._def.schema._def.shape() for ${t.name}`, schemaShape);
        }
        // 3. Use manual schema for known tools
        else if (TOOL_SCHEMAS[t.name]) {
            schemaShape = TOOL_SCHEMAS[t.name];
            if (verbose && logger) logger.log(`Using manual schema for ${t.name}`);
        }
        // 4. Default to empty object (tool with no parameters)
        else {
            schemaShape = {};
            if (verbose && logger) logger.log(`Using empty schema for ${t.name}`);
        }

        return tool(t.name, t.description, schemaShape, async (args) => {
            try {
                // Try to use invoke if available (newer LangChain), fallback to call
                // invoke() handles input unification (e.g. string vs object) better than call()
                const method = t.invoke ? t.invoke.bind(t) : t.call.bind(t);

                // The SDK wraps tool calls with metadata (signal, _meta, requestId)
                // We need to extract the actual tool input and unwrap it properly
                let input = args;

                // Remove SDK metadata wrapper
                if (args && typeof args === 'object') {
                    const { signal, _meta, requestId, ...actualArgs } = args;

                    // If there's an 'input' field after unwrapping, use that
                    if ('input' in actualArgs) {
                        input = actualArgs.input;
                        if (verbose && logger) logger.log(`Unwrapped input field for ${t.name}: "${input}"`);
                    }
                    // Otherwise use the cleaned args
                    else if (Object.keys(actualArgs).length > 0) {
                        input = actualArgs;
                        if (verbose && logger) logger.log(`Using cleaned args for ${t.name}:`, actualArgs);
                    }
                    // If args is completely empty after removing metadata, keep original args
                    else {
                        if (verbose && logger) logger.log(`No input provided for ${t.name}, using original args`);
                    }
                }

                if (verbose && logger) {
                    logger.log(`Calling tool ${t.name} with original args:`, args);
                    logger.log(`Calling tool ${t.name} with processed input:`, input);
                }

                const result = await method(input);

                if (verbose && logger) {
                    logger.log(`Tool ${t.name} result:`, result);
                }

                return {
                    content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result) }],
                    isError: false,
                };
            } catch (err: any) {
                if (logger) {
                    logger.logError(`Tool ${t.name} execution failed`, err);
                } else {
                    console.error(`[ClaudeCodeAgent] Tool ${t.name} error:`, err);
                }
                return {
                    content: [{ type: 'text', text: `Error executing tool ${t.name}: ${err.message}` }],
                    isError: true,
                };
            }
        });
    });
}