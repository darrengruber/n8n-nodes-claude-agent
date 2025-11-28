import {
    IExecuteFunctions,
    INodeExecutionData,
    NodeOperationError,
} from 'n8n-workflow';
import {
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

export interface RunContainerParams {
    image: string;
    entrypoint: string;
    command: string;
    socketPath: string;
    envVars: string[];
    binaryDataInput: boolean;
    binaryDataOutput: boolean;
    binaryFileMappings: { mappings: Array<{ binaryPropertyName: string; containerPath: string }> };
    outputFilePattern: string;
}

export async function executeContainerWithBinary(
    context: IExecuteFunctions,
    itemIndex: number,
    params: RunContainerParams
): Promise<INodeExecutionData> {
    let tempDir: string | null = null;
    const tempDirectories: string[] = [];

    try {
        // Validate and auto-detect Docker socket
        const socketDetection = detectDockerSocket(params.socketPath);
        const socketPath = socketDetection.path;

        // Validate image name
        const imageValidation = validateDockerImageName(params.image);
        if (!imageValidation.valid) {
            throw new NodeOperationError(
                context.getNode(),
                `Invalid Docker image: ${imageValidation.errors.join(', ')}`,
                { itemIndex }
            );
        }

        // Build container configuration
        const containerConfig: ContainerExecutionConfig = {
            image: params.image,
            entrypoint: params.entrypoint || undefined,
            command: params.command || undefined,
            environmentVariables: params.envVars,
            socketPath,
            autoRemove: true,
            pullPolicy: 'missing', // Only pull if image doesn't exist locally
        };

        // Prepare binary input if enabled
        if (params.binaryDataInput) {
            if (params.binaryFileMappings.mappings && params.binaryFileMappings.mappings.length > 0) {
                const preparedBinary = await prepareBinaryInput(
                    context,
                    itemIndex,
                    params.binaryFileMappings.mappings,
                );
                tempDir = preparedBinary.tempDir;
                tempDirectories.push(tempDir);

                // Build volume mounts (read-only for inputs)
                const volumes = preparedBinary.mountPoints.map(
                    (mp: { hostPath: string; containerPath: string }) =>
                        `${mp.hostPath}:${mp.containerPath}:ro`,
                );

                // Create output directory if binary output is enabled
                if (params.binaryDataOutput) {
                    await createOutputDirectory(tempDir);
                    volumes.push(`${tempDir}/output:/output:rw`);
                }

                containerConfig.volumes = volumes;

                // Calculate resource limits based on file sizes
                const resourceLimits = calculateResourceLimits(preparedBinary.fileSizes);
                containerConfig.memory = resourceLimits.memory;
                containerConfig.cpuQuota = resourceLimits.cpuQuota;
            }
        } else if (params.binaryDataOutput) {
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
                // Optional: Log pull progress
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
                    image: params.image,
                    command: containerConfig.command,
                    entrypoint: containerConfig.entrypoint,
                    environmentVariablesCount: params.envVars.length,
                    socketPath,
                    binaryInput: params.binaryDataInput,
                    binaryOutput: params.binaryDataOutput,
                },
            },
            pairedItem: {
                item: itemIndex,
            },
        };

        // Collect binary output if enabled
        if (params.binaryDataOutput && tempDir) {
            const outputBinary = await collectBinaryOutput(context, tempDir, params.outputFilePattern);

            if (Object.keys(outputBinary).length > 0) {
                executionData.binary = outputBinary;
                (executionData.json.container as any).outputFilesCount = Object.keys(outputBinary).length;
            }
        }

        return executionData;

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
                `Image: ${params.image}`
            );
        }

        // Re-throw as NodeOperationError to be handled by caller (who checks continueOnFail)
        throw new NodeOperationError(
            context.getNode(),
            errorMessage,
            { itemIndex }
        );
    } finally {
        // Always cleanup temporary directories
        await Promise.allSettled(tempDirectories.map((dir) => cleanupTempDirectory(dir)));
    }
}
