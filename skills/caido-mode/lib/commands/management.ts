/** Management commands: scopes, filters, environments, projects, hosted files, tasks */

import { CaidoClient } from "../client";

// ── Scopes ──

export async function cmdScopes() {
  const client = await CaidoClient.getClient();
  const scopes = await client.listScopes();
  console.log(JSON.stringify(scopes, null, 2));
}

export async function cmdCreateScope(
  name: string,
  allow: string[],
  deny: string[],
) {
  const client = await CaidoClient.getClient();
  const scope = await client.createScope({
    name,
    allowlist: allow,
    denylist: deny,
  });
  console.log(JSON.stringify(scope, null, 2));
}

export async function cmdUpdateScope(
  scopeId: string,
  name?: string,
  allow?: string[],
  deny?: string[],
) {
  const client = await CaidoClient.getClient();
  const existing = await client.getScope(scopeId);

  if (!existing) {
    console.error(`Scope ${scopeId} not found`);
    process.exit(1);
  }

  const scope = await client.updateScope(scopeId, {
    name: name ?? existing.name,
    allowlist: allow ?? existing.allowlist,
    denylist: deny ?? existing.denylist,
  });
  console.log(JSON.stringify(scope, null, 2));
}

export async function cmdDeleteScope(scopeId: string) {
  const client = await CaidoClient.getClient();
  await client.deleteScope(scopeId);
  console.log(JSON.stringify({ deleted: scopeId }, null, 2));
}

// ── Filters ──

export async function cmdFilters() {
  const client = await CaidoClient.getClient();
  const filters = await client.listFilters();
  console.log(JSON.stringify(filters, null, 2));
}

export async function cmdCreateFilter(
  name: string,
  query: string,
  alias?: string,
) {
  const client = await CaidoClient.getClient();
  const filter = await client.createFilter({
    name,
    clause: query,
    alias: alias ?? "",
  });
  console.log(JSON.stringify(filter, null, 2));
}

export async function cmdUpdateFilter(
  filterId: string,
  name?: string,
  query?: string,
  alias?: string,
) {
  const client = await CaidoClient.getClient();
  const existing = await client.getFilter(filterId);

  if (!existing) {
    console.error(`Filter ${filterId} not found`);
    process.exit(1);
  }

  const filter = await client.updateFilter(filterId, {
    name: name ?? existing.name,
    clause: query ?? existing.clause,
    alias: alias ?? existing.alias,
  });
  console.log(JSON.stringify(filter, null, 2));
}

export async function cmdDeleteFilter(filterId: string) {
  const client = await CaidoClient.getClient();
  await client.deleteFilter(filterId);
  console.log(JSON.stringify({ deleted: filterId }, null, 2));
}

// ── Environments ──

export async function cmdEnvs() {
  const client = await CaidoClient.getClient();
  const envs = await client.listEnvironments();
  console.log(JSON.stringify(envs, null, 2));
}

export async function cmdCreateEnv(name: string) {
  const client = await CaidoClient.getClient();
  // SDK's environment.create calls `options.variables.map(...)` and the
  // schema requires a non-null variables list, so pass an empty array.
  const env = await client.createEnvironment({ name, variables: [] });
  console.log(JSON.stringify({ id: env.id, name: env.name }, null, 2));
}

export async function cmdSelectEnv(envId?: string) {
  const client = await CaidoClient.getClient();
  await client.selectEnvironment(envId);
  console.log(JSON.stringify({ selected: envId || null }, null, 2));
}

export async function cmdEnvSet(envId: string, varName: string, value: string) {
  const client = await CaidoClient.getClient();
  const env = await client.getEnvironment(envId);

  if (!env) {
    console.error(`Environment ${envId} not found`);
    process.exit(1);
  }

  // Check if variable exists
  const existing = env.variables.find((v) => v.name === varName);
  if (existing) {
    await env.updateVariable(varName, { value });
  } else {
    await env.addVariable({ name: varName, value, kind: "PLAIN" });
  }

  console.log(
    JSON.stringify(
      {
        envId,
        variable: varName,
        value,
        action: existing ? "updated" : "created",
      },
      null,
      2,
    ),
  );
}

export async function cmdDeleteEnv(envId: string) {
  const client = await CaidoClient.getClient();
  await client.deleteEnvironment(envId);
  console.log(JSON.stringify({ deleted: envId }, null, 2));
}

// ── Projects ──

export async function cmdProjects() {
  const client = await CaidoClient.getClient();
  const projects = await client.listProjects();
  console.log(JSON.stringify(projects, null, 2));
}

export async function cmdSelectProject(projectId: string) {
  const client = await CaidoClient.getClient();
  await client.selectProject(projectId);
  console.log(JSON.stringify({ selected: projectId }, null, 2));
}

// ── Hosted Files ──

export async function cmdHostedFiles() {
  const client = await CaidoClient.getClient();
  const files = await client.listHostedFiles();
  console.log(JSON.stringify(files, null, 2));
}

export async function cmdDeleteHostedFile(fileId: string) {
  const client = await CaidoClient.getClient();
  await client.deleteHostedFile(fileId);
  console.log(JSON.stringify({ deleted: fileId }, null, 2));
}

// ── Tasks ──

export async function cmdTasks() {
  const client = await CaidoClient.getClient();
  const tasks = await client.listTasks();
  console.log(JSON.stringify(tasks, null, 2));
}

export async function cmdCancelTask(taskId: string) {
  const client = await CaidoClient.getClient();
  await client.cancelTask(taskId);
  console.log(JSON.stringify({ cancelled: taskId }, null, 2));
}
