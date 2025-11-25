export interface ToolParameter {
    name: string;
    required: boolean;
    type?: 'string' | 'number' | 'boolean' | 'json';
    description?: string;
    sendIn: 'path' | 'env';
    key?: string;
}

export type ParameterInputType = 'model' | 'keypair' | 'json';
export type SendIn = 'path' | 'env';
