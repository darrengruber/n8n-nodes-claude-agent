import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
    NodeConnectionTypes,
} from 'n8n-workflow';
import { claudeAgentExecute } from './ClaudeAgentExecute';

// Cache busting: Increment the node version when you want to force icon reload
// n8n uses the version property to handle caching internally
export class ClaudeAgent implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Claude Agent',
        name: 'claudeAgent',
        icon: 'file:img/claudeAgent.v2.svg',
        group: ['transform'],
        version: 2,
        description: 'Use the Claude Code SDK to run an AI agent',
        defaults: {
            name: 'Claude Agent',
        },
        inputs: [
            {
                displayName: '',
                type: NodeConnectionTypes.Main,
            },
            {
                displayName: 'Chat Model',
                type: NodeConnectionTypes.AiLanguageModel,
                required: true,
                maxConnections: 1,
                filter: {
                    nodes: ['@n8n/n8n-nodes-langchain.lmChatAnthropic'],
                },
            },
            {
                displayName: 'Memory',
                type: NodeConnectionTypes.AiMemory,
            },
            {
                displayName: 'Tools',
                type: NodeConnectionTypes.AiTool,
            },
            {
                displayName: 'Output Parser',
                type: NodeConnectionTypes.AiOutputParser,
                maxConnections: 1,
            },
        ],
        outputs: [NodeConnectionTypes.Main],
        properties: [
            {
                displayName: 'Tool Description',
                name: 'toolDescription',
                type: 'string',
                default: 'Runs a Claude AI agent with access to tools and memory. Use this tool to execute complex tasks that require AI reasoning, tool usage, and context awareness. Provide a clear prompt describing what you want the agent to do.',
                description: 'Explain to LLM what this tool does and when to use it',
                typeOptions: {
                    rows: 3,
                },
                displayOptions: {
                    show: {
                        '@tool': [true],
                    },
                },
            },
            {
                displayName: 'Source for Prompt (User Message)',
                name: 'promptType',
                type: 'options',
                options: [
                    {
                        name: 'Connected Chat Trigger Node',
                        value: 'auto',
                        description:
                            "Looks for an input field called 'chatInput' that is coming from a directly connected Chat Trigger",
                    },
                    {
                        name: 'Connected Guardrails Node',
                        value: 'guardrails',
                        description:
                            "Looks for an input field called 'guardrailsInput' that is coming from a directly connected Guardrails Node",
                    },
                    {
                        name: 'Define below',
                        value: 'define',
                        description: 'Use an expression to reference data in previous nodes or enter static text',
                    },
                ],
                default: 'auto',
            },
            {
                displayName: 'Prompt (User Message)',
                name: 'text',
                type: 'string',
                required: true,
                default: '={{ $json.chatInput }}',
                typeOptions: {
                    rows: 2,
                },
                displayOptions: {
                    show: {
                        promptType: ['auto'],
                    },
                },
            },
            {
                displayName: 'Prompt (User Message)',
                name: 'text',
                type: 'string',
                required: true,
                default: '={{ $json.guardrailsInput }}',
                typeOptions: {
                    rows: 2,
                },
                displayOptions: {
                    show: {
                        promptType: ['guardrails'],
                    },
                },
            },
            {
                displayName: 'Prompt (User Message)',
                name: 'text',
                type: 'string',
                required: true,
                default: '',
                placeholder: 'e.g. Hello, how can you help me?',
                typeOptions: {
                    rows: 2,
                },
                displayOptions: {
                    show: {
                        promptType: ['define'],
                        '@tool': [false],
                    },
                },
            },
            {
                displayName: 'Prompt (User Message)',
                name: 'text',
                type: 'string',
                required: true,
                default: '',
                placeholder: 'The prompt or question to send to the Claude agent',
                description: 'Describe what you want the agent to do',
                typeOptions: {
                    rows: 2,
                },
                displayOptions: {
                    show: {
                        '@tool': [true],
                    },
                },
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
                        typeOptions: {
                            rows: 4,
                        },
                    },
                    {
                        displayName: 'Max Turns',
                        name: 'maxTurns',
                        type: 'number',
                        default: 30,
                        description: 'Maximum number of conversational turns the agent can take',
                    },
                    {
                        displayName: 'Verbose',
                        name: 'verbose',
                        type: 'boolean',
                        default: false,
                        description: 'Whether to return detailed execution logs',
                    },
                    {
                        displayName: 'Working Directory',
                        name: 'workingDirectory',
                        type: 'string',
                        default: '',
                        placeholder: '/path/to/project or leave empty for current directory',
                        description: 'The starting directory for the agent (optional, defaults to current directory)',
                    },
                ],
            },
            {
                displayName: 'Require Specific Output Format',
                name: 'hasOutputParser',
                type: 'boolean',
                default: false,
                noDataExpression: true,
            },
            {
                displayName: `Connect an <a data-action='openSelectiveNodeCreator' data-action-parameter-connectiontype='${NodeConnectionTypes.AiOutputParser}'>output parser</a> on the canvas to specify the output format you require`,
                name: 'notice',
                type: 'notice',
                default: '',
                displayOptions: {
                    show: {
                        hasOutputParser: [true],
                    },
                },
            },
        ],
    };



    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        return await claudeAgentExecute.call(this);
    }
}
