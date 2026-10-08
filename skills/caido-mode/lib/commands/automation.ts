/** Dispatch saved requests into active workflows or plugin backend functions. */

import { CaidoClient } from "../client";

import type { JsonValue } from "../types";

export function pluginArguments(
  requestId?: string,
  jsonArgs?: string,
): JsonValue[] {
  if (requestId !== undefined && jsonArgs !== undefined) {
    throw new Error("Use either a positional request ID or --args, not both.");
  }
  if (jsonArgs === undefined) {
    if (requestId === undefined)
      throw new Error(
        "Provide a request ID or --args (use --args '[]' for no arguments).",
      );
    return [requestId];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonArgs);
  } catch {
    throw new Error("--args must be a valid JSON array.");
  }
  if (!Array.isArray(parsed)) throw new Error("--args must be a JSON array.");
  function validate(value: unknown): void {
    if (value === null)
      throw new Error("The Caido SDK does not support null plugin arguments.");
    if (typeof value === "number" && !Number.isFinite(value))
      throw new Error("Plugin arguments must contain finite numbers.");
    if (Array.isArray(value)) value.forEach(validate);
    else if (typeof value === "object")
      Object.values(value as object).forEach(validate);
  }
  parsed.forEach(validate);
  return parsed as JsonValue[];
}

export async function cmdRunWorkflow(workflowId: string, requestId: string) {
  const client = await CaidoClient.getClient();
  const task = await client.runActiveWorkflow(workflowId, requestId);
  console.log(JSON.stringify({ workflowId, requestId, task }, null, 2));
}

export async function cmdCallPlugin(
  packageManifestId: string,
  backendManifestId: string,
  functionName: string,
  requestId?: string,
  jsonArgs?: string,
) {
  const args = pluginArguments(requestId, jsonArgs);
  const client = await CaidoClient.getClient();
  const result = await client.callPluginFunction(
    packageManifestId,
    backendManifestId,
    functionName,
    args,
  );
  console.log(
    JSON.stringify(
      {
        packageManifestId,
        backendManifestId,
        functionName,
        requestId,
        arguments: args,
        result: result ?? null,
      },
      null,
      2,
    ),
  );
}
