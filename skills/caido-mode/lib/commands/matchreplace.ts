/**
 * Match & Replace (Caido "Tamper" rules).
 *
 * A rule = one SECTION (which part of the request/response) × one OPERATION
 * (raw/update/add/remove) × a MATCHER (value/regex/full/name) × a REPLACER
 * (term/workflow), plus optional condition (HTTPQL/StreamQL scope) and sources.
 *
 * The schema is a deeply-nested exclusive union; `buildTamperSection` constructs
 * the exact `TamperSectionInput` and is unit-tested for every section/operation.
 * Structures were validated against a live instance via `testTamperRule`.
 */

import { CaidoClient } from "../client";
import { resolveRaw, ensureHeaderCrlf } from "./replay";

// ── Section / operation specification ──

type MatcherKind = "raw" | "name" | "none";
interface OpSpec {
  opField: string;
  matcher: MatcherKind;
  replacer: boolean;
}
interface SectionSpec {
  field: string;
  ops: Record<string, OpSpec>;
}

// raw op = matcher(value|regex|full) + replacer; name op (header/query update/add) = matcher{name} + replacer;
// remove = matcher{name} only; method/status update + sni raw = replacer only (no matcher).
const RAW: OpSpec = { opField: "raw", matcher: "raw", replacer: true };
const HEADER_QUERY_OPS: Record<string, OpSpec> = {
  raw: RAW,
  update: { opField: "update", matcher: "name", replacer: true },
  add: { opField: "add", matcher: "name", replacer: true },
  remove: { opField: "remove", matcher: "name", replacer: false },
};

export const SECTIONS: Record<string, SectionSpec> = {
  // ── request ──
  "req-method": {
    field: "requestMethod",
    ops: { update: { opField: "update", matcher: "none", replacer: true } },
  },
  "req-path": { field: "requestPath", ops: { raw: RAW } },
  "req-query": { field: "requestQuery", ops: HEADER_QUERY_OPS },
  "req-body": { field: "requestBody", ops: { raw: RAW } },
  "req-first-line": { field: "requestFirstLine", ops: { raw: RAW } },
  "req-header": { field: "requestHeader", ops: HEADER_QUERY_OPS },
  "req-all": { field: "requestAll", ops: { raw: RAW } },
  "req-sni": {
    field: "requestSNI",
    ops: { raw: { opField: "raw", matcher: "none", replacer: true } },
  },
  // ── response ──
  "resp-body": { field: "responseBody", ops: { raw: RAW } },
  "resp-status": {
    field: "responseStatusCode",
    ops: { update: { opField: "update", matcher: "none", replacer: true } },
  },
  "resp-first-line": { field: "responseFirstLine", ops: { raw: RAW } },
  "resp-header": { field: "responseHeader", ops: HEADER_QUERY_OPS },
  "resp-all": { field: "responseAll", ops: { raw: RAW } },
  // ── websocket ──
  "ws-up": { field: "streamWsMessageUpstream", ops: { raw: RAW } },
  "ws-down": { field: "streamWsMessageDownstream", ops: { raw: RAW } },
};

const SOURCES = [
  "AUTOMATE",
  "INTERCEPT",
  "REPLAY",
  "WORKFLOW",
  "SAMPLE",
  "PLUGIN",
  "IMPORT",
];

export interface MrRuleOpts {
  section: string;
  operation?: string;
  matchValue?: string;
  matchRegex?: string;
  matchFull?: boolean;
  matchName?: string;
  replace?: string;
  workflowId?: string;
  name?: string;
  condition?: string;
  sources?: string[];
}

function defaultOp(spec: SectionSpec): string {
  return spec.ops.raw ? "raw" : Object.keys(spec.ops)[0];
}

export function listSections(): string {
  return Object.entries(SECTIONS)
    .map(([k, s]) => `${k} (${Object.keys(s.ops).join("/")})`)
    .join(", ");
}

/** Build the TamperSectionInput from CLI options. Throws Error on any invalid combination. */
export function buildTamperSection(o: MrRuleOpts): any {
  const spec = SECTIONS[o.section];
  if (!spec)
    throw new Error(
      `Unknown --section "${o.section}".\nValid: ${listSections()}`,
    );

  const opKey = o.operation ?? defaultOp(spec);
  const op = spec.ops[opKey];
  if (!op)
    throw new Error(
      `--operation "${opKey}" is not valid for section "${o.section}". Valid: ${Object.keys(spec.ops).join(", ")}`,
    );

  const opPayload: any = {};

  // Matcher
  if (op.matcher === "raw") {
    const picked = [
      o.matchValue != null,
      o.matchRegex != null,
      !!o.matchFull,
    ].filter(Boolean).length;
    if (picked !== 1) {
      throw new Error(
        `section "${o.section}" / "${opKey}" needs exactly one matcher: --match-value <str> | --match-regex <re> | --match-full`,
      );
    }
    if (o.matchValue != null)
      opPayload.matcher = { value: { value: o.matchValue } };
    else if (o.matchRegex != null)
      opPayload.matcher = { regex: { regex: o.matchRegex } };
    else opPayload.matcher = { full: { full: true } };
  } else if (op.matcher === "name") {
    if (!o.matchName)
      throw new Error(
        `section "${o.section}" / "${opKey}" needs --match-name <header/param name>`,
      );
    opPayload.matcher = { name: o.matchName };
  } else if (
    o.matchValue != null ||
    o.matchRegex != null ||
    o.matchFull ||
    o.matchName != null
  ) {
    throw new Error(
      `section "${o.section}" / "${opKey}" takes no matcher (it targets the whole section)`,
    );
  }

  // Replacer
  if (op.replacer) {
    const hasTerm = o.replace != null;
    const hasWf = !!o.workflowId;
    if (hasTerm === hasWf) {
      throw new Error(
        `section "${o.section}" / "${opKey}" needs exactly one replacer: --replace <term> | --workflow <id>`,
      );
    }
    opPayload.replacer = hasTerm
      ? { term: { term: o.replace } }
      : { workflow: { id: o.workflowId } };
  } else if (o.replace != null || o.workflowId) {
    throw new Error(
      `section "${o.section}" / "${opKey}" takes no replacer (a remove operation only matches)`,
    );
  }

  return { [spec.field]: { operation: { [op.opField]: opPayload } } };
}

function normalizeSources(sources?: string[]): string[] | undefined {
  if (!sources || !sources.length) return undefined;
  return sources.map((s) => {
    const up = s.trim().toUpperCase();
    if (!SOURCES.includes(up))
      throw new Error(`Unknown source "${s}". Valid: ${SOURCES.join(", ")}`);
    return up;
  });
}

/** Build CreateTamperRuleInput (or, without collectionId, UpdateTamperRuleInput). */
export function buildRuleInput(o: MrRuleOpts, collectionId?: string): any {
  const input: any = { section: buildTamperSection(o) };
  if (o.name) input.name = o.name;
  if (collectionId) input.collectionId = collectionId;
  if (o.condition) {
    // WS rules scope with StreamQL; HTTP rules with HTTPQL.
    input.condition = o.section.startsWith("ws-")
      ? { streamQL: { code: o.condition } }
      : { HTTPQL: { code: o.condition } };
  }
  // `sources` is required by Caido; default to its own default (proxy/intercept traffic).
  input.sources = normalizeSources(o.sources) ?? ["INTERCEPT"];
  return input;
}

// ── Collection resolution ──

async function resolveTamperCollectionId(
  client: any,
  idOrName: string,
): Promise<string | undefined> {
  const r: any = await client.tamperRuleCollections();
  for (const c of r.tamperRuleCollections) {
    if (c.id === idOrName || c.name === idOrName) return c.id;
  }
  return undefined;
}

async function requireTamperCollection(
  client: any,
  ref: string,
): Promise<string> {
  const id = await resolveTamperCollectionId(client, ref);
  if (!id) {
    console.error(`M&R collection "${ref}" not found.`);
    console.error(`List:    caido-client mr-collections`);
    console.error(`Create:  caido-client create-mr-collection "${ref}"`);
    process.exit(1);
  }
  return id;
}

/** collectionId is required on create; fall back to Caido's "Default Collection" (or the first one). */
async function defaultTamperCollectionId(client: any): Promise<string> {
  const r: any = await client.tamperRuleCollections();
  const cols = r.tamperRuleCollections;
  if (!cols.length) {
    console.error(
      'No M&R collections exist. Create one: create-mr-collection "<name>"',
    );
    process.exit(1);
  }
  const def = cols.find((c: any) => /^default/i.test(c.name)) ?? cols[0];
  return def.id;
}

const b64 = (s: string) => Buffer.from(s, "utf-8").toString("base64");
const unb64 = (s: string | undefined | null) =>
  s ? Buffer.from(s, "base64").toString("utf-8") : "";
const isEnabled = (rule: any) => rule?.enable != null;

function fmtRule(rule: any) {
  return {
    id: rule.id,
    name: rule.name,
    enabled: isEnabled(rule),
    collection: rule.collection?.name,
  };
}

// ── Commands ──

export async function cmdMrRules() {
  const client = await CaidoClient.getClient();
  const r: any = await client.tamperRuleCollections();
  const rules: any[] = [];
  for (const c of r.tamperRuleCollections) {
    for (const rule of c.rules || []) {
      rules.push({
        id: rule.id,
        name: rule.name,
        enabled: isEnabled(rule),
        collection: c.name,
      });
    }
  }
  console.log(JSON.stringify({ rules, count: rules.length }, null, 2));
}

export async function cmdMrCollections() {
  const client = await CaidoClient.getClient();
  const r: any = await client.tamperRuleCollections();
  const results = r.tamperRuleCollections.map((c: any) => ({
    id: c.id,
    name: c.name,
    ruleCount: (c.rules || []).length,
  }));
  console.log(JSON.stringify({ results, count: results.length }, null, 2));
}

export async function cmdCreateMrRule(o: MrRuleOpts, collectionRef?: string) {
  const client = await CaidoClient.getClient();
  // collectionId is required by Caido; default to the "Default Collection".
  const collectionId = collectionRef
    ? await requireTamperCollection(client, collectionRef)
    : await defaultTamperCollectionId(client);
  const input = buildRuleInput(o, collectionId);
  const payload = await client.createTamperRule(input);
  console.log(
    JSON.stringify(
      { created: fmtRule(payload.rule), section: input.section },
      null,
      2,
    ),
  );
}

export async function cmdUpdateMrRule(id: string, o: MrRuleOpts) {
  const client = await CaidoClient.getClient();
  const input = buildRuleInput(o); // no collectionId in UpdateTamperRuleInput
  const payload = await client.updateTamperRule(id, input);
  console.log(
    JSON.stringify(
      { updated: fmtRule(payload.rule), section: input.section },
      null,
      2,
    ),
  );
}

export async function cmdDeleteMrRule(id: string) {
  const client = await CaidoClient.getClient();
  const deleted = await client.deleteTamperRule(id);
  console.log(JSON.stringify({ deleted }, null, 2));
}

export async function cmdToggleMrRule(id: string, enabled: boolean) {
  const client = await CaidoClient.getClient();
  const rule = await client.toggleTamperRule(id, enabled);
  console.log(
    JSON.stringify({ rule: fmtRule(rule), enabled: isEnabled(rule) }, null, 2),
  );
}

export async function cmdRenameMrRule(id: string, name: string) {
  const client = await CaidoClient.getClient();
  const rule = await client.renameTamperRule(id, name);
  console.log(JSON.stringify({ renamed: fmtRule(rule) }, null, 2));
}

export async function cmdMoveMrRule(id: string, collectionRef: string) {
  const client = await CaidoClient.getClient();
  const collectionId = await requireTamperCollection(client, collectionRef);
  const rule = await client.moveTamperRule(id, collectionId);
  console.log(JSON.stringify({ moved: fmtRule(rule) }, null, 2));
}

export async function cmdTestMrRule(o: MrRuleOpts, raw: string) {
  const client = await CaidoClient.getClient();
  const section = buildTamperSection(o);
  const resolved = ensureHeaderCrlf(await resolveRaw(raw));
  const payload = await client.testTamperRule({ raw: b64(resolved), section });
  console.log(JSON.stringify({ section, result: unb64(payload.raw) }, null, 2));
}

export async function cmdCreateMrCollection(name: string) {
  const client = await CaidoClient.getClient();
  const collection = await client.createTamperRuleCollection(name);
  console.log(JSON.stringify(collection, null, 2));
}

export async function cmdRenameMrCollection(ref: string, name: string) {
  const client = await CaidoClient.getClient();
  const id = await requireTamperCollection(client, ref);
  const collection = await client.renameTamperRuleCollection(id, name);
  console.log(JSON.stringify({ renamed: collection }, null, 2));
}

export async function cmdDeleteMrCollection(ref: string) {
  const client = await CaidoClient.getClient();
  const id = await requireTamperCollection(client, ref);
  const deleted = await client.deleteTamperRuleCollection(id);
  console.log(JSON.stringify({ deleted }, null, 2));
}
