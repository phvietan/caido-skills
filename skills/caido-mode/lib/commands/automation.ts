/** Dispatch saved requests into active workflows or plugin backend functions. */

import { CaidoClient } from "../client";

export async function cmdRunWorkflow(workflowId: string, requestId: string) {
  const client = await CaidoClient.getClient();
  const task = await client.runActiveWorkflow(workflowId, requestId);
  console.log(JSON.stringify({ workflowId, requestId, task }, null, 2));
}

export async function cmdCallPlugin(
  packageManifestId: string,
  backendManifestId: string,
  functionName: string,
  requestId: string,
) {
  const client = await CaidoClient.getClient();
  const result = await client.callPluginFunction(
    packageManifestId,
    backendManifestId,
    functionName,
    [requestId],
  );
  console.log(
    JSON.stringify(
      { packageManifestId, backendManifestId, functionName, requestId, result },
      null,
      2,
    ),
  );
}
