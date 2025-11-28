import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
    NodeOperationError,
} from 'n8n-workflow';

import { mainProperties } from './Description';
import {
    processEnvironmentVariables,
    validateDockerImageName,
    formatDockerError,
    isDockerConnectionError
} from './GenericFunctions';
import { executeContainer, ContainerExecutionConfig } from './ContainerHelpers';
import { detectDockerSocket } from './utils/socketDetector';
import {
    prepareBinaryInput,
    collectBinaryOutput,
    calculateResourceLimits,
    cleanupTempDirectory,
    createOutputDirectory,
} from './BinaryDataHelpers';

export class RunContainer implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Run Container',
        name: 'runContainer',
        icon: { light: 'file:img/runContainer.svg', dark: 'file:img/runContainer.dark.svg' },
        group: ['transform'],
        version: 1,
        description: 'Runs a Docker container',
        defaults: {
            name: 'Run Container',
        },
        inputs: ['main'],
        outputs: ['main'],
        properties: mainProperties,
        usableAsTool: true,
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];
        const tempDirectories: string[] = [];

        try {
            for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
                let tempDir: string | null = null;
                try {
                    // Get socket path with auto-detection
                    let socketPath = this.getNodeParameter('socketPath', itemIndex, '/var/run/docker.sock') as string;

                    // Validate and auto-detect Docker socket
                    const socketDetection = detectDockerSocket(socketPath);
                    socketPath = socketDetection.path;

                    // Get container parameters
                    const image = this.getNodeParameter('image', itemIndex) as string;
                    const entrypoint = this.getNodeParameter('entrypoint', itemIndex, '') as string;
                    const command = this.getNodeParameter('command', itemIndex, '') as string;

                    // Validate image name
                    const imageValidation = validateDockerImageName(image);
                    if (!imageValidation.valid) {
                        throw new NodeOperationError(
                            this.getNode(),
                            `Invalid Docker image: ${imageValidation.errors.join(', ')}`,
                            { itemIndex }
                        );
                    }

                    // Process environment variables
                    const envResult = await processEnvironmentVariables.call(this, itemIndex);

                    // Check if binary data input/output is enabled
                    const binaryDataInput = this.getNodeParameter(
                        'binaryDataInput',
                        itemIndex,
                        false,
                    ) as boolean;
                    const binaryDataOutput = this.getNodeParameter(
                        'binaryDataOutput',
                        itemIndex,
                        false,
                    ) as boolean;

                    // Build container configuration
                    const containerConfig: ContainerExecutionConfig = {
                        image,
                        entrypoint: entrypoint || undefined,
                        command: command || undefined,
                        environmentVariables: envResult.variables,
                        socketPath,
                        autoRemove: true,
                        pullPolicy: 'missing', // Only pull if image doesn't exist locally
                    };

                    // Prepare binary input if enabled
                    if (binaryDataInput) {
                        const binaryFileMappings = this.getNodeParameter(
                            'binaryFileMappings',
                            itemIndex,
                            { mappings: [] },
                        ) as { mappings: Array<{ binaryPropertyName: string; containerPath: string }> };

                        if (binaryFileMappings.mappings && binaryFileMappings.mappings.length > 0) {
                            const preparedBinary = await prepareBinaryInput(
                                this,
                                itemIndex,
                                binaryFileMappings.mappings,
                            );
                            tempDir = preparedBinary.tempDir;
                            tempDirectories.push(tempDir);

                            // Build volume mounts (read-only for inputs)
                            const volumes = preparedBinary.mountPoints.map(
                                (mp: { hostPath: string; containerPath: string }) =>
                                    `${mp.hostPath}:${mp.containerPath}:ro`,
                            );

                            // Create output directory if binary output is enabled
                            if (binaryDataOutput) {
                                await createOutputDirectory(tempDir);
                                volumes.push(`${tempDir}/output:/output:rw`);
                            }

                            containerConfig.volumes = volumes;

                            // Calculate resource limits based on file sizes
                            const resourceLimits = calculateResourceLimits(preparedBinary.fileSizes);
                            containerConfig.memory = resourceLimits.memory;
                            containerConfig.cpuQuota = resourceLimits.cpuQuota;
                        }
                    } else if (binaryDataOutput) {
                        // Binary output without input - create temp dir and output directory
                        const fs = await import('fs/promises');
                        const path = await import('path');
                        const os = await import('os');
                        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'n8n-docker-output-'));
                        tempDirectories.push(tempDir);

                        await createOutputDirectory(tempDir);
                        containerConfig.volumes = [`${tempDir}/output:/output:rw`];
                    }

                    // Execute container
                    const result = await executeContainer(
                        containerConfig,
                        (progress) => {
                            // Optional: Log pull progress for debugging
                            // This could be enhanced to send progress to n8n UI in the future
                            if (progress.status && progress.status !== 'Downloading') {
                                // console.log(`Docker pull progress: ${progress.status}`);
                            }
                        }
                    );

                    // Prepare result
                    const executionData: INodeExecutionData = {
                        json: {
                            stdout: result.stdout,
                            stderr: result.stderr,
                            exitCode: result.exitCode,
                            success: result.success,
                            hasOutput: result.hasOutput,
                            container: {
                                image,
                                command: containerConfig.command,
                                entrypoint: containerConfig.entrypoint,
                                environmentVariablesCount: envResult.count,
                                socketPath,
                                binaryInput: binaryDataInput,
                                binaryOutput: binaryDataOutput,
                            },
                        },
                        pairedItem: {
                            item: itemIndex,
                        },
                    };

                    // Collect binary output if enabled
                    if (binaryDataOutput && tempDir) {
                        const outputPattern = this.getNodeParameter(
                            'outputFilePattern',
                            itemIndex,
                            '*',
                        ) as string;
                        const outputBinary = await collectBinaryOutput(this, tempDir, outputPattern);

                        if (Object.keys(outputBinary).length > 0) {
                            executionData.binary = outputBinary;
                            (executionData.json.container as any).outputFilesCount = Object.keys(outputBinary).length;
                        }
                    }

                    returnData.push(executionData);

                } catch (error) {
                    // Handle different types of errors appropriately
                    let errorMessage: string;

                    if (isDockerConnectionError(error)) {
                        errorMessage = formatDockerError(
                            error,
                            'connection',
                            'Make sure Docker is running and accessible'
                        );
                    } else {
                        errorMessage = formatDockerError(
                            error,
                            'container execution',
                            `Image: ${this.getNodeParameter('image', itemIndex, 'unknown')}`
                        );
                    }

                    if (this.continueOnFail()) {
                        returnData.push({
                            json: {
                                error: errorMessage,
                                success: false,
                                exitCode: -1,
                                stdout: '',
                                stderr: errorMessage
                            },
                            pairedItem: {
                                item: itemIndex,
                            },
                        });
                    } else {
                        const node = this.getNode();
                        throw new NodeOperationError(
                            node || { id: 'unknown', description: { name: 'RunContainer' } },
                            errorMessage,
                            {
                                itemIndex,
                            },
                        );
                    }
                }
            }

            return [returnData];
        } finally {
            // Always cleanup temporary directories
            await Promise.allSettled(tempDirectories.map((dir) => cleanupTempDirectory(dir)));
        }
    }
}

// Export the runContainer function for backward compatibility and reuse by RunContainerTool
export async function runContainer(
    socketPath: string,
    image: string,
    entrypoint: string,
    command: string,
    envVars: string[],
): Promise<{ stdout: Buffer; stderr: Buffer; statusCode: number }> {
    // Use the new container execution system for backward compatibility
    const containerConfig: ContainerExecutionConfig = {
        image,
        entrypoint: entrypoint || undefined,
        command: command || undefined,
        environmentVariables: envVars,
        socketPath,
        autoRemove: true,
        pullPolicy: 'missing'
    };

    const result = await executeContainer(containerConfig);

    // Convert back to the expected format for backward compatibility
    return {
        stdout: Buffer.from(result.stdout),
        stderr: Buffer.from(result.stderr),
        statusCode: result.exitCode
    };
}