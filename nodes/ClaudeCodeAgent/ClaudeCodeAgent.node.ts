import type {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
    ILoadOptionsFunctions,
    INodePropertyOptions,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { query } from '@anthropic-ai/claude-agent-sdk';

export class ClaudeCodeAgent implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Claude Code Agent',
        name: 'claudeCodeAgent',
        icon: { light: 'file:claudeCodeAgent.svg', dark: 'file:claudeCodeAgent.dark.svg' },
        group: ['transform'],
        version: 1,
        description: 'Agent powered by Claude Code SDK',
        defaults: {
            name: 'Claude Code Agent',
        },
        inputs: [NodeConnectionTypes.Main],
        outputs: [NodeConnectionTypes.Main],
        credentials: [
            {
                name: 'anthropicApi',
                required: true,
            },
        ],
        properties: [
            {
                displayName: 'Text',
                name: 'text',
                type: 'string',
                default: '',
                placeholder: 'What would you like the agent to do?',
                description: 'The instruction for the agent',
                typeOptions: {
                    rows: 4,
                },
            },
            {
                displayName: 'Model',
                name: 'model',
                type: 'options',
                typeOptions: {
                    loadOptionsMethod: 'getModels',
                },
                default: 'claude-3-5-sonnet-20241022',
                description: 'The model to use',
                options: [],
            },
            {
                displayName: 'Options',
                name: 'options',
                type: 'collection',
                placeholder: 'Add Option',
                default: {},
                options: [
                    {
                        displayName: 'System Message',
                        name: 'systemMessage',
                        type: 'string',
                        default: '',
                        description: 'System message to send to the agent',
                    },
                    {
                        displayName: 'Verbose',
                        name: 'verbose',
                        type: 'boolean',
                        default: false,
                        description: 'Whether to return detailed execution logs',
                    },
                ],
            },
        ],
    };

    methods = {
        loadOptions: {
            async getModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
                const credentials = await this.getCredentials('anthropicApi');
                const apiKey = credentials.apiKey as string;
                const baseUrl = (credentials.baseUrl as string) || (credentials.url as string) || 'https://api.anthropic.com';

                try {
                    const response = await this.helpers.request({
                        method: 'GET',
                        url: `${baseUrl}/v1/models`,
                        headers: {
                            'x-api-key': apiKey,
                            'anthropic-version': '2023-06-01',
                        },
                        json: true,
                    });

                    return (response.data as Array<{ id: string; display_name?: string }>).map((model) => ({
                        name: model.display_name || model.id,
                        value: model.id,
                    }));
                } catch (error) {
                    // Fallback to default models if API call fails
                    return [
                        { name: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20241022' },
                        { name: 'Claude 3 Opus', value: 'claude-3-opus-20240229' },
                        { name: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307' },
                    ];
                }
            },
        },
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];

        // Retrieve credentials
        const credentials = await this.getCredentials('anthropicApi');

        if (credentials?.apiKey) {
            process.env.ANTHROPIC_API_KEY = credentials.apiKey as string;
        }

        if (credentials?.baseUrl) {
            process.env.ANTHROPIC_BASE_URL = credentials.baseUrl as string;
        } else if (credentials?.url) {
            // Fallback if credential uses 'url' instead of 'baseUrl'
            process.env.ANTHROPIC_BASE_URL = credentials.url as string;
        }

        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            try {
                const prompt = this.getNodeParameter('text', itemIndex, '') as string;
                const model = this.getNodeParameter('model', itemIndex, 'claude-3-5-sonnet-20241022') as string;
                const options = this.getNodeParameter('options', itemIndex, {}) as {
                    systemMessage?: string;
                    verbose?: boolean;
                };

                // Execute the Claude Code Agent
                const generator = query({
                    prompt,
                    options: {
                        model,
                        systemPrompt: options.systemMessage,
                        // Using bypassPermissions to allow automation without interaction
                        permissionMode: 'bypassPermissions',
                    },
                });

                let finalResult: string | undefined;
                const logs: string[] = [];

                for await (const message of generator) {
                    if (options.verbose) {
                        logs.push(JSON.stringify(message));
                    }

                    if (message.type === 'result') {
                        if (message.subtype === 'success') {
                            finalResult = message.result;
                        } else if (message.subtype === 'error_during_execution' || message.subtype === 'error_max_turns' || message.subtype === 'error_max_budget_usd' || message.subtype === 'error_max_structured_output_retries') {
                            throw new Error(`Claude Code Agent failed: ${message.subtype}. Errors: ${message.errors?.join(', ')}`);
                        }
                    }
                }

                if (finalResult === undefined) {
                    throw new Error('Claude Code Agent finished without a result.');
                }

                const jsonResult: { result: string; logs?: string[] } = {
                    result: finalResult,
                };

                if (options.verbose) {
                    jsonResult.logs = logs;
                }

                returnData.push({
                    json: jsonResult,
                    pairedItem: {
                        item: itemIndex,
                    },
                });

            } catch (error) {
                if (this.continueOnFail()) {
                    returnData.push({ json: { error: error.message }, error, pairedItem: itemIndex });
                } else {
                    if (error.context) {
                        error.context.itemIndex = itemIndex;
                        throw error;
                    }
                    throw new NodeOperationError(this.getNode(), error, {
                        itemIndex,
                    });
                }
            }
        }

        return [returnData];
    }
}
