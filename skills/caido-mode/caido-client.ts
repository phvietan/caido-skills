#!/usr/bin/env bun
/**
 * Caido SDK Client
 * Clean multi-file CLI built entirely on @caido/sdk-client.
 * No raw fetch — uses SDK methods + client.graphql.query/mutation with gql documents.
 */

import { Command, Option } from "commander";
import { DEFAULT_OUTPUT_OPTS, type OutputOpts } from "./lib/types";

// Commands
import {
  cmdSearch,
  cmdRecent,
  cmdGet,
  cmdGetResponse,
  cmdRaw,
  cmdExportCurl,
  cmdExportCurlConfig,
} from "./lib/commands/requests";
import {
  cmdReplay,
  cmdSendRaw,
  cmdEdit,
  cmdGetSession,
  cmdReplayEntries,
  cmdEditSession,
  cmdReplaySessions,
  cmdCreateSession,
  cmdRenameSession,
  cmdMoveSession,
  cmdDeleteSessions,
  cmdReplayCollections,
  cmdCreateCollection,
  cmdRenameCollection,
  cmdDeleteCollection,
  cmdCreateAutomateSession,
  cmdFuzz,
} from "./lib/commands/replay";
import type {
  ConnectionOverrides,
  NameChange,
  EditTarget,
} from "./lib/commands/replay";
import {
  cmdFindings,
  cmdGetFinding,
  cmdCreateFinding,
  cmdUpdateFinding,
} from "./lib/commands/findings";
import {
  cmdScopes,
  cmdCreateScope,
  cmdUpdateScope,
  cmdDeleteScope,
  cmdFilters,
  cmdCreateFilter,
  cmdUpdateFilter,
  cmdDeleteFilter,
  cmdEnvs,
  cmdCreateEnv,
  cmdSelectEnv,
  cmdEnvSet,
  cmdDeleteEnv,
  cmdProjects,
  cmdSelectProject,
  cmdHostedFiles,
  cmdDeleteHostedFile,
  cmdTasks,
  cmdCancelTask,
} from "./lib/commands/management";
import { cmdInterceptStatus, cmdInterceptSet } from "./lib/commands/intercept";
import {
  cmdMrRules,
  cmdMrCollections,
  cmdCreateMrRule,
  cmdUpdateMrRule,
  cmdDeleteMrRule,
  cmdToggleMrRule,
  cmdRenameMrRule,
  cmdMoveMrRule,
  cmdTestMrRule,
  cmdCreateMrCollection,
  cmdRenameMrCollection,
  cmdDeleteMrCollection,
} from "./lib/commands/matchreplace";
import type { MrRuleOpts } from "./lib/commands/matchreplace";
import {
  cmdViewer,
  cmdPlugins,
  cmdHealth,
  cmdSetup,
  cmdAuthStatus,
} from "./lib/commands/info";
import { CAIDO_CLIENT_VERSION } from "./lib/version";
import { cmdCallPlugin, cmdRunWorkflow } from "./lib/commands/automation";

const DEBUG = process.env.DEBUG === "1";

type CliValues = Record<string, string | boolean | string[] | undefined>;

const STRING_OPTIONS = [
  "args",
  "after",
  "alias",
  "allow",
  "body",
  "collection",
  "condition",
  "connect-host",
  "connect-port",
  "dedupe-key",
  "deny",
  "description",
  "host",
  "limit",
  "match-name",
  "match-regex",
  "match-value",
  "max-body",
  "max-body-chars",
  "method",
  "name",
  "new-name",
  "operation",
  "op",
  "out",
  "path",
  "port",
  "proxy",
  "query",
  "reporter",
  "section",
  "session",
  "sni",
  "sources",
  "title",
  "workflow",
] as const;

const BOOLEAN_OPTIONS = [
  "asc",
  "ascending",
  "compact",
  "config",
  "connect-no-tls",
  "connect-tls",
  "cookie-jar",
  "desc",
  "disable",
  "enable",
  "headers-only",
  "hidden",
  "ids-only",
  "latest",
  "match-full",
  "no-name-change",
  "no-request",
  "no-tls",
  "nonach",
  "off",
  "oldest",
  "on",
  "recent",
  "response",
  "tls",
  "visible",
] as const;

const MULTIPLE_STRING_OPTIONS = [
  "exclude",
  "remove-header",
  "replace",
  "set-header",
] as const;

interface CliInvocation {
  command: string;
  args: string[];
  values: CliValues;
}

const COMMANDS: Record<string, string> = {
  search: "Search HTTP history with HTTPQL",
  recent: "Show recent HTTP requests",
  get: "Get a request and response",
  "get-response": "Get a response",
  raw: "Print a raw request or response",
  replay: "Create and send a replay session",
  "send-raw": "Send a raw HTTP request",
  edit: "Edit a request and send it through Replay",
  "export-curl": "Export a request as curl",
  "get-session": "Get a replay session",
  "replay-entries": "List replay session entries",
  "session-entries": "Alias for replay-entries",
  "edit-session": "Edit and send a replay session",
  "create-session": "Create a replay session",
  "rename-session": "Rename a replay session",
  "move-session": "Move a replay session",
  sessions: "List replay sessions",
  "replay-sessions": "Alias for sessions",
  "delete-sessions": "Delete replay sessions",
  collections: "List replay collections",
  "replay-collections": "Alias for collections",
  "create-collection": "Create a replay collection",
  "rename-collection": "Rename a replay collection",
  "delete-collection": "Delete a replay collection",
  "create-automate-session": "Create an Automate session",
  fuzz: "Start an Automate task",
  findings: "List findings",
  "get-finding": "Get a finding",
  "create-finding": "Create a finding from a request",
  "update-finding": "Update a finding",
  projects: "List projects",
  "select-project": "Select the active project",
  scopes: "List scopes",
  "create-scope": "Create a scope",
  "update-scope": "Update a scope",
  "delete-scope": "Delete a scope",
  filters: "List HTTPQL filter presets",
  "create-filter": "Create a filter preset",
  "update-filter": "Update a filter preset",
  "delete-filter": "Delete a filter preset",
  envs: "List environments",
  "create-env": "Create an environment",
  "select-env": "Select an environment",
  "env-set": "Set an environment variable",
  "delete-env": "Delete an environment",
  "hosted-files": "List hosted files",
  "delete-hosted-file": "Delete a hosted file",
  tasks: "List active tasks",
  "cancel-task": "Cancel a task",
  "intercept-status": "Show intercept status",
  "intercept-enable": "Enable interception",
  "intercept-disable": "Disable interception",
  "mr-rules": "List Match & Replace rules",
  "mr-collections": "List Match & Replace collections",
  "create-mr-rule": "Create a Match & Replace rule",
  "update-mr-rule": "Update a Match & Replace rule",
  "delete-mr-rule": "Delete a Match & Replace rule",
  "toggle-mr-rule": "Enable or disable a Match & Replace rule",
  "rename-mr-rule": "Rename a Match & Replace rule",
  "move-mr-rule": "Move a Match & Replace rule",
  "test-mr-rule": "Test a Match & Replace rule",
  "create-mr-collection": "Create a Match & Replace collection",
  "rename-mr-collection": "Rename a Match & Replace collection",
  "delete-mr-collection": "Delete a Match & Replace collection",
  viewer: "Show the authenticated Caido user",
  plugins: "List installed plugins",
  health: "Check Caido health",
  setup: "Configure authentication for a Caido instance",
  "auth-status": "Show authentication status",
  "run-workflow": "Run an active workflow with a saved request",
  "call-plugin":
    "Call a plugin backend function with JSON arguments or a request ID",
};

const OUTPUT_OPTIONS = [
  "max-body",
  "max-body-chars",
  "no-request",
  "headers-only",
  "compact",
];
const CONNECTION_OPTIONS = [
  "sni",
  "connect-host",
  "connect-port",
  "connect-tls",
  "connect-no-tls",
];
const EDIT_OPTIONS = [
  "method",
  "path",
  "body",
  "set-header",
  "remove-header",
  "replace",
];
const MR_OPTIONS = [
  "section",
  "operation",
  "op",
  "match-value",
  "match-regex",
  "match-full",
  "match-name",
  "replace",
  "workflow",
  "name",
  "condition",
  "sources",
];

const COMMAND_OPTIONS: Record<string, string[]> = {
  "call-plugin": ["args"],
  search: [
    "limit",
    "after",
    "ids-only",
    "asc",
    "ascending",
    "oldest",
    "desc",
    "latest",
    "recent",
    "compact",
  ],
  recent: ["limit", "compact"],
  get: OUTPUT_OPTIONS,
  "get-response": OUTPUT_OPTIONS,
  raw: ["out", "response"],
  replay: [
    "name",
    "raw",
    "collection",
    ...OUTPUT_OPTIONS,
    ...CONNECTION_OPTIONS,
  ],
  "send-raw": [
    "host",
    "port",
    "tls",
    "no-tls",
    "raw",
    "name",
    "collection",
    ...OUTPUT_OPTIONS,
    ...CONNECTION_OPTIONS,
  ],
  edit: [
    ...EDIT_OPTIONS,
    "session",
    "no-name-change",
    "nonach",
    "new-name",
    "name",
    "collection",
    ...OUTPUT_OPTIONS,
    ...CONNECTION_OPTIONS,
  ],
  "export-curl": ["config", "out", "cookie-jar", "exclude"],
  "get-session": OUTPUT_OPTIONS,
  "replay-entries": ["limit", "raw", ...OUTPUT_OPTIONS],
  "session-entries": ["limit", "raw", ...OUTPUT_OPTIONS],
  "edit-session": [
    ...EDIT_OPTIONS,
    "no-name-change",
    "nonach",
    "new-name",
    ...OUTPUT_OPTIONS,
    ...CONNECTION_OPTIONS,
  ],
  "create-session": ["name", "collection"],
  sessions: ["limit"],
  "replay-sessions": ["limit"],
  collections: ["limit"],
  "replay-collections": ["limit"],
  findings: ["limit"],
  "create-finding": ["title", "description", "reporter", "dedupe-key"],
  "update-finding": ["title", "description", "hidden", "visible"],
  "create-scope": ["allow", "deny"],
  "update-scope": ["name", "allow", "deny"],
  "create-filter": ["query", "alias"],
  "update-filter": ["name", "query", "alias"],
  "create-mr-rule": [...MR_OPTIONS, "collection"],
  "update-mr-rule": MR_OPTIONS,
  "toggle-mr-rule": ["on", "enable", "off", "disable"],
  "test-mr-rule": ["raw", ...MR_OPTIONS],
  setup: ["proxy"],
};

const OPTION_DESCRIPTIONS: Record<string, string> = {
  args: "JSON array of function arguments; use [] for no arguments",
  alias: "short alias for the filter preset",
  allow: "comma-separated allowed host patterns",
  deny: "comma-separated denied host patterns",
  body: "replacement request body; an empty string clears it",
  condition: "HTTPQL condition (StreamQL for WebSocket rules)",
  "connect-host": "override connection destination host",
  "connect-port": "override connection destination port",
  "connect-tls": "use TLS for the override connection",
  "connect-no-tls": "use plain HTTP for the override connection",
  "dedupe-key": "finding deduplication key",
  description: "finding description",
  host: "target hostname (required for send-raw)",
  "match-name": "header or query parameter name to match",
  "match-regex": "regular expression matcher",
  "match-value": "literal string matcher",
  "match-full": "match the entire selected section",
  "max-body": "maximum body lines (default: 200; 0 means unlimited)",
  "max-body-chars":
    "maximum body characters (default: 5000; 0 means unlimited)",
  method: "replacement HTTP method, e.g. POST",
  "new-name": "rename the existing replay session",
  operation: "rule operation: raw, update, add, or remove",
  op: "alias for --operation",
  path: "replacement request path",
  port: "target port (default: 443)",
  reporter: "finding reporter (default: caido-mode)",
  section: "required rule section, e.g. req-header, req-body, resp-body",
  session: "existing replay session name or ID",
  sni: "TLS Server Name Indication override",
  sources: "comma-separated rule sources (default: INTERCEPT)",
  title: "finding title (required when creating)",
  workflow: "workflow ID used as a rule replacer",
  asc: "sort oldest first",
  ascending: "alias for --asc",
  oldest: "alias for --asc",
  desc: "sort newest first (default)",
  latest: "alias for --desc",
  recent: "alias for --desc",
  config: "export a reusable curl config instead of a command",
  "cookie-jar": "use a read/write cookie jar with --config",
  disable: "alias for --off",
  enable: "alias for --on",
  "headers-only": "omit response body",
  hidden: "hide the finding",
  visible: "unhide the finding",
  "ids-only": "output request IDs only",
  "no-name-change": "keep the existing replay session name",
  nonach: "alias for --no-name-change",
  "no-request": "omit request raw data from output",
  "no-tls": "use plain HTTP",
  tls: "use TLS (default)",
  off: "disable the rule",
  on: "enable the rule",
  response: "dump the raw response instead of the request",
  exclude: "header to omit from curl config (repeatable)",
  "remove-header": "header name to remove (repeatable)",
  "set-header": "header as Name:Value (repeatable)",
  replace:
    "edit: from:::to (repeatable); M&R: replacement text (empty allowed)",
  limit: "maximum number of results",
  after: "pagination cursor",
  compact: "use compact output",
  raw: "raw HTTP content (or include raw data for replay-entries)",
  name: "name for the created object",
  collection: "collection name or ID",
  query: "HTTPQL query",
  out: "output file",
  proxy: "Caido proxy address",
};

// Exact positional syntax and shell arguments for the generated examples.
const COMMAND_USAGE: Record<string, [string, string]> = {
  search: ["[filter]", "'req.host.eq:\"example.com\"' --limit 10"],
  recent: ["", "--limit 10 --compact"],
  get: ["<request-id>", "123 --headers-only"],
  "get-response": ["<request-id>", "123 --max-body 50"],
  raw: ["<request-id>", "123 --out /tmp/request.txt"],
  replay: ["<request-id>", '123 --name "Login replay"'],
  "send-raw": [
    "",
    '--host example.com --raw @/tmp/request.txt --name "Raw test"',
  ],
  edit: ["<request-id>", '123 --path /api/profile --name "Profile test"'],
  "export-curl": ["<request-id>", "123 --config --out /tmp/auth.cfg"],
  "get-session": ["<session>", '"Login replay"'],
  "replay-entries": ["<session>", '"Login replay" --limit 10 --raw'],
  "session-entries": ["<session>", '"Login replay" --limit 10 --raw'],
  "edit-session": [
    "<session>",
    '"Login replay" --path /api/profile --no-name-change',
  ],
  "create-session": ["<request-id>", '123 --name "Login replay"'],
  "rename-session": ["<session> <new-name>", '"Login replay" "Login test"'],
  "move-session": ["<session> <collection>", '"Login replay" "Auth tests"'],
  sessions: ["", "--limit 10"],
  "replay-sessions": ["", "--limit 10"],
  "delete-sessions": ["<session-ids>", "123,124"],
  collections: ["", "--limit 10"],
  "replay-collections": ["", "--limit 10"],
  "create-collection": ["<name>", '"Auth tests"'],
  "rename-collection": [
    "<collection> <new-name>",
    '"Auth tests" "Login tests"',
  ],
  "delete-collection": ["<collection>", '"Auth tests"'],
  "create-automate-session": ["<request-id>", "123"],
  fuzz: ["<session-id>", "123"],
  findings: ["", "--limit 10"],
  "get-finding": ["<finding-id>", "123"],
  "create-finding": [
    "<request-id>",
    '123 --title "IDOR" --description "Cross-account access"',
  ],
  "update-finding": ["<finding-id>", '123 --title "Confirmed IDOR" --visible'],
  projects: ["", ""],
  "select-project": ["<project-id>", "11111111-1111-4111-8111-111111111111"],
  scopes: ["", ""],
  "create-scope": ["<name>", '"Example" --allow "*.example.com"'],
  "update-scope": ["<scope-id>", '123 --allow "api.example.com"'],
  "delete-scope": ["<scope-id>", "123"],
  filters: ["", ""],
  "create-filter": [
    "<name>",
    "'API traffic' --query 'req.path.cont:\"/api/\"' --alias api",
  ],
  "update-filter": ["<filter-id>", '123 --name "API requests"'],
  "delete-filter": ["<filter-id>", "123"],
  envs: ["", ""],
  "create-env": ["<name>", '"Staging"'],
  "select-env": ["[env-id]", "123"],
  "env-set": [
    "<env-id> <variable-name> <value>",
    "123 baseUrl https://example.com",
  ],
  "delete-env": ["<env-id>", "123"],
  "hosted-files": ["", ""],
  "delete-hosted-file": ["<file-id>", "123"],
  tasks: ["", ""],
  "cancel-task": ["<task-id>", "123"],
  "intercept-status": ["", ""],
  "intercept-enable": ["", ""],
  "intercept-disable": ["", ""],
  "mr-rules": ["", ""],
  "mr-collections": ["", ""],
  "create-mr-rule": [
    "",
    '--section req-header --operation remove --match-name If-None-Match --name "Drop conditional header"',
  ],
  "update-mr-rule": [
    "<rule-id>",
    "123 --section req-header --operation remove --match-name If-None-Match",
  ],
  "delete-mr-rule": ["<rule-id>", "123"],
  "toggle-mr-rule": ["<rule-id>", "123 --on"],
  "rename-mr-rule": ["<rule-id> <new-name>", '123 "Drop conditional header"'],
  "move-mr-rule": ["<rule-id> <collection>", '123 "Header rules"'],
  "test-mr-rule": [
    "",
    "--raw @/tmp/request.txt --section req-header --operation remove --match-name If-None-Match",
  ],
  "create-mr-collection": ["<name>", '"Header rules"'],
  "rename-mr-collection": [
    "<collection> <new-name>",
    '"Header rules" "Request rules"',
  ],
  "delete-mr-collection": ["<collection>", '"Header rules"'],
  viewer: ["", ""],
  plugins: ["", ""],
  health: ["", ""],
  setup: ["<pat> [url]", "YOUR_PAT http://localhost:8080"],
  "auth-status": ["", ""],
  "run-workflow": [
    "<workflow-id> <request-id>",
    "11111111-1111-4111-8111-111111111111 123",
  ],
  "call-plugin": [
    "<package-manifest-id> <backend-manifest-id> <function-name> [request-id]",
    "my-plugin backend processRequest 123",
  ],
};

function addCommandOptions(command: Command, commandName: string): void {
  const stringNames = new Set<string>(STRING_OPTIONS);
  const booleanNames = new Set<string>(BOOLEAN_OPTIONS);
  const multipleNames = new Set<string>(MULTIPLE_STRING_OPTIONS);
  for (const name of new Set(COMMAND_OPTIONS[commandName] ?? [])) {
    const description = OPTION_DESCRIPTIONS[name];
    if (!description) throw new Error(`Missing option description: ${name}`);
    let option: Option;
    if (name === "raw") {
      option = new Option(
        commandName === "replay-entries" || commandName === "session-entries"
          ? "--raw"
          : "--raw <value>",
        description,
      );
    } else if (multipleNames.has(name)) {
      option = new Option(`--${name} <value>`, description).argParser(
        (value, previous: string[] = []) => [...previous, value],
      );
    } else if (stringNames.has(name)) {
      option = new Option(`--${name} <value>`, description);
    } else if (booleanNames.has(name)) {
      option = new Option(`--${name}`, description);
    } else {
      throw new Error(`Unknown CLI option registered: ${name}`);
    }
    const required: Record<string, string[]> = {
      replay: ["name"],
      "send-raw": ["host", "raw", "name"],
      "create-session": ["name"],
      "create-finding": ["title"],
      "create-filter": ["query"],
      "create-mr-rule": ["section"],
      "update-mr-rule": ["section"],
      "test-mr-rule": ["section", "raw"],
    };
    if (required[commandName]?.includes(name)) option.makeOptionMandatory();
    command.addOption(option);
  }
}

export function createProgram(
  onCommand: (invocation: CliInvocation) => void,
): Command {
  const program = new Command()
    .name("caido-client")
    .version(CAIDO_CLIENT_VERSION)
    .description("Standalone Caido SDK CLI")
    .showHelpAfterError();

  for (const [name, description] of Object.entries(COMMANDS)) {
    const usage = COMMAND_USAGE[name];
    if (!usage) throw new Error(`Missing command usage: ${name}`);
    const command = program.command(name).description(description);
    for (const argument of usage[0].split(" ").filter(Boolean)) {
      command.argument(argument, argument.slice(1, -1).replaceAll("-", " "));
    }
    command.addHelpText(
      "after",
      `\nExample (replace sample IDs/names with your own):\n  caido-client ${name}${usage[1] ? " " + usage[1] : ""}\n`,
    );
    addCommandOptions(command, name);
    const notes: Record<string, string> = {
      edit: "New session: --name is required. With --session: use --no-name-change or --new-name.",
      "edit-session":
        "Use exactly one naming intent: --no-name-change/--nonach or --new-name.",
      "run-workflow":
        "Requires an active workflow. Returns a task ID; submission does not mean execution has finished.",
      "call-plugin":
        "Use manifest IDs from plugins, not installation UUIDs. Supply a request ID or --args, not both.\n\nJSON argument examples (use your plugin's documented backend functions):\n  caido-client call-plugin my-plugin backend getStatus --args '[]'\n  caido-client call-plugin my-plugin backend analyze --args '[\"123\", {\"headers\": true}]'",
      fuzz: "Configure payload markers and wordlists in the Caido UI before starting.",
      "select-env": "Omit env-id to deselect the current environment.",
      "toggle-mr-rule": "Pass exactly one of --on/--enable or --off/--disable.",
    };
    if (notes[name]) command.addHelpText("after", `\n${notes[name]}\n`);
    command.action((...actionArgs: unknown[]) => {
      const invoked = actionArgs.at(-1) as Command;
      const values = invoked.opts() as CliValues;
      // Translate Commander's negated-option representation for existing handlers.
      for (const negative of ["no-request", "no-name-change", "no-tls"]) {
        const key = negative
          .slice(3)
          .replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        if (values[key] === false) values[negative] = true;
      }
      onCommand({
        command: name,
        args: invoked.processedArgs as string[],
        values,
      });
    });
  }
  return program;
}

function stringOption(values: CliValues, name: string): string | undefined {
  const value =
    values[name] ??
    values[name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())];
  return Array.isArray(value)
    ? value.at(-1)
    : typeof value === "string"
      ? value
      : undefined;
}

function stringOptions(values: CliValues, name: string): string[] {
  const value =
    values[name] ??
    values[name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())];
  return Array.isArray(value)
    ? value
    : typeof value === "string"
      ? [value]
      : [];
}

function boolOption(values: CliValues, ...names: string[]): boolean {
  return names.some(
    (name) =>
      (values[name] ??
        values[name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())]) === true,
  );
}

function numberOption(
  values: CliValues,
  name: string,
  fallback?: number,
): number | undefined {
  const value = stringOption(values, name);
  return value === undefined ? fallback : Number.parseInt(value, 10);
}

function parseConnectionOverrides(values: CliValues): ConnectionOverrides {
  const overrides: ConnectionOverrides = {};
  overrides.sni = stringOption(values, "sni");
  overrides.connectHost = stringOption(values, "connect-host");
  overrides.connectPort = numberOption(values, "connect-port");
  if (boolOption(values, "connect-tls")) overrides.connectTls = true;
  if (boolOption(values, "connect-no-tls")) overrides.connectTls = false;
  return overrides;
}

function parseOutputOptions(values: CliValues): OutputOpts {
  const opts = { ...DEFAULT_OUTPUT_OPTS };
  const maxBody = numberOption(values, "max-body");
  const maxBodyChars = numberOption(values, "max-body-chars");
  if (maxBody !== undefined) {
    opts.maxBodyLines = maxBody;
    if (maxBody === 0) opts.maxBodyChars = 0;
  }
  if (maxBodyChars !== undefined) opts.maxBodyChars = maxBodyChars;
  if (boolOption(values, "no-request")) opts.noRequest = true;
  if (boolOption(values, "headers-only")) opts.headersOnly = true;
  if (boolOption(values, "compact")) {
    opts.noRequest = true;
    opts.maxBodyLines = 50;
    opts.maxBodyChars = 5000;
  }
  return opts;
}

function requireName(values: CliValues, ctx: string): string {
  const name = stringOption(values, "name");
  if (!name) {
    console.error(`Error: --name "<session name>" is required when ${ctx}.`);
    console.error(
      `Replay sessions must be named so they are identifiable on handoff (never refer to them by ID).`,
    );
    process.exit(1);
  }
  return name;
}

/**
 * Editing an existing replay session requires explicit name intent:
 * --no-name-change / --nonach  OR  --new-name "<name>". Exactly one.
 */
function requireNameChange(values: CliValues): NameChange {
  const keep = boolOption(values, "no-name-change", "nonach");
  const newName = stringOption(values, "new-name");
  if (keep && newName !== undefined) {
    console.error(
      "Error: pass only one of --no-name-change/--nonach or --new-name, not both.",
    );
    process.exit(1);
  }
  if (!keep && newName === undefined) {
    console.error(
      "Error: editing a replay session requires explicit name intent.",
    );
    console.error(
      "  Keep the current name:  --no-name-change   (alias --nonach)",
    );
    console.error('  Set a new name:         --new-name "descriptive name"');
    process.exit(1);
  }
  return keep ? { kind: "keep" } : { kind: "rename", name: newName! };
}

/** Parse Match & Replace rule options. --replace/--match-value accept empty strings. */
function parseMrOpts(values: CliValues): MrRuleOpts {
  const sources = stringOption(values, "sources");
  return {
    section: stringOption(values, "section") ?? "",
    operation: stringOption(values, "operation") ?? stringOption(values, "op"),
    matchValue: stringOption(values, "match-value"),
    matchRegex: stringOption(values, "match-regex"),
    matchFull: boolOption(values, "match-full"),
    matchName: stringOption(values, "match-name"),
    replace: stringOption(values, "replace"),
    workflowId: stringOption(values, "workflow"),
    name: stringOption(values, "name"),
    condition: stringOption(values, "condition"),
    sources: sources
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

async function main() {
  let invocation: CliInvocation | undefined;
  const program = createProgram((parsed) => {
    invocation = parsed;
  });
  if (process.argv.length === 2) process.argv.push("--help");
  await program.parseAsync(process.argv);
  if (!invocation) return;
  const { command, values } = invocation;
  const args = [command, ...invocation.args];

  switch (command) {
    // ── HTTP History ──
    case "search": {
      const filter = args[1] || "";
      const limit = numberOption(values, "limit", 20)!;
      const after = stringOption(values, "after");
      const idsOnly = boolOption(values, "ids-only");
      const desc = !boolOption(values, "asc", "ascending", "oldest");
      const compact = boolOption(values, "compact");
      await cmdSearch(filter, limit, after, idsOnly, desc, compact);
      break;
    }

    case "recent": {
      await cmdRecent(
        numberOption(values, "limit", 20)!,
        boolOption(values, "compact"),
      );
      break;
    }

    case "get": {
      if (!args[1]) {
        console.error("Error: request-id required");
        process.exit(1);
      }
      await cmdGet(args[1], parseOutputOptions(values));
      break;
    }

    case "get-response": {
      if (!args[1]) {
        console.error("Error: request-id required");
        process.exit(1);
      }
      await cmdGetResponse(args[1], parseOutputOptions(values));
      break;
    }

    case "raw": {
      if (!args[1]) {
        console.error("Error: request-id required");
        process.exit(1);
      }
      await cmdRaw(args[1], {
        out: stringOption(values, "out"),
        response: boolOption(values, "response"),
      });
      break;
    }

    case "replay": {
      if (!args[1]) {
        console.error("Error: request-id required");
        process.exit(1);
      }
      const name = requireName(
        values,
        "creating a replay session with `replay`",
      );
      await cmdReplay(
        args[1],
        stringOption(values, "raw"),
        name,
        parseOutputOptions(values),
        parseConnectionOverrides(values),
        stringOption(values, "collection"),
      );
      break;
    }

    case "send-raw": {
      const host = stringOption(values, "host");
      const port = numberOption(values, "port", 443)!;
      const tls = !boolOption(values, "no-tls");
      const raw = stringOption(values, "raw");
      if (!host || !raw) {
        console.error("Error: --host and --raw are required");
        process.exit(1);
      }
      const name = requireName(
        values,
        "creating a replay session with `send-raw`",
      );
      await cmdSendRaw(
        host,
        port,
        tls,
        raw,
        name,
        parseOutputOptions(values),
        parseConnectionOverrides(values),
        stringOption(values, "collection"),
      );
      break;
    }

    case "edit": {
      if (!args[1]) {
        console.error("Error: request-id required");
        process.exit(1);
      }
      const sessionRef = stringOption(values, "session");
      // Existing session → require name-change intent. New session → require --name.
      const target: EditTarget = sessionRef
        ? {
            kind: "session",
            ref: sessionRef,
            nameChange: requireNameChange(values),
          }
        : {
            kind: "new",
            name: requireName(values, "`edit` creates a new replay session"),
            collectionRef: stringOption(values, "collection"),
          };
      await cmdEdit(
        args[1],
        {
          method: stringOption(values, "method"),
          path: stringOption(values, "path"),
          body: stringOption(values, "body"),
          setHeaders: stringOptions(values, "set-header"),
          removeHeaders: stringOptions(values, "remove-header"),
          replacements: stringOptions(values, "replace"),
        },
        target,
        parseOutputOptions(values),
        parseConnectionOverrides(values),
      );
      break;
    }

    case "export-curl": {
      if (!args[1]) {
        console.error("Error: request-id required");
        process.exit(1);
      }
      if (boolOption(values, "config"))
        await cmdExportCurlConfig(args[1], {
          out: stringOption(values, "out"),
          cookieJar: boolOption(values, "cookie-jar"),
          exclude: stringOptions(values, "exclude"),
        });
      else await cmdExportCurl(args[1]);
      break;
    }

    // ── Replay Tab Lookup ──
    case "get-session": {
      if (!args[1]) {
        console.error("Error: session id or name required");
        process.exit(1);
      }
      await cmdGetSession(args[1], parseOutputOptions(values));
      break;
    }

    case "replay-entries":
    case "session-entries": {
      if (!args[1]) {
        console.error("Error: session id or name required");
        process.exit(1);
      }
      await cmdReplayEntries(
        args[1],
        numberOption(values, "limit", 20)!,
        parseOutputOptions(values),
        boolOption(values, "raw"),
      );
      break;
    }

    case "edit-session": {
      if (!args[1]) {
        console.error("Error: session id or name required");
        process.exit(1);
      }
      await cmdEditSession(
        args[1],
        {
          method: stringOption(values, "method"),
          path: stringOption(values, "path"),
          body: stringOption(values, "body"),
          setHeaders: stringOptions(values, "set-header"),
          removeHeaders: stringOptions(values, "remove-header"),
          replacements: stringOptions(values, "replace"),
        },
        requireNameChange(values),
        parseOutputOptions(values),
        parseConnectionOverrides(values),
      );
      break;
    }

    // ── Replay Sessions ──
    case "create-session": {
      if (!args[1]) {
        console.error("Error: request-id required");
        process.exit(1);
      }
      const name = requireName(values, "creating a replay session");
      await cmdCreateSession(args[1], name, stringOption(values, "collection"));
      break;
    }

    case "rename-session": {
      if (!args[1] || !args[2]) {
        console.error("Error: session (id or name) and new name required");
        process.exit(1);
      }
      await cmdRenameSession(args[1], args[2]);
      break;
    }

    case "move-session": {
      if (!args[1] || !args[2]) {
        console.error("Error: session and collection (id or name) required");
        process.exit(1);
      }
      await cmdMoveSession(args[1], args[2]);
      break;
    }

    case "sessions":
    case "replay-sessions": {
      await cmdReplaySessions(numberOption(values, "limit"));
      break;
    }

    case "delete-sessions": {
      if (!args[1]) {
        console.error("Error: comma-separated session IDs required");
        process.exit(1);
      }
      await cmdDeleteSessions(args[1].split(",").map((s) => s.trim()));
      break;
    }

    // ── Replay Collections ──
    case "collections":
    case "replay-collections": {
      await cmdReplayCollections(numberOption(values, "limit"));
      break;
    }

    case "create-collection": {
      if (!args[1]) {
        console.error("Error: collection name required (names are mandatory)");
        process.exit(1);
      }
      await cmdCreateCollection(args[1]);
      break;
    }

    case "rename-collection": {
      if (!args[1] || !args[2]) {
        console.error("Error: collection (id or name) and new name required");
        process.exit(1);
      }
      await cmdRenameCollection(args[1], args[2]);
      break;
    }

    case "delete-collection": {
      if (!args[1]) {
        console.error("Error: collection (id or name) required");
        process.exit(1);
      }
      await cmdDeleteCollection(args[1]);
      break;
    }

    // ── Automate & Fuzzing ──
    case "create-automate-session": {
      if (!args[1]) {
        console.error("Error: request-id required");
        process.exit(1);
      }
      await cmdCreateAutomateSession(args[1]);
      break;
    }

    case "fuzz": {
      if (!args[1]) {
        console.error("Error: session-id required");
        process.exit(1);
      }
      await cmdFuzz(args[1], []);
      break;
    }

    // ── Findings ──
    case "findings": {
      await cmdFindings(numberOption(values, "limit", 20)!);
      break;
    }

    case "get-finding": {
      if (!args[1]) {
        console.error("Error: finding-id required");
        process.exit(1);
      }
      await cmdGetFinding(args[1]);
      break;
    }

    case "create-finding": {
      if (!args[1]) {
        console.error("Error: request-id required");
        process.exit(1);
      }
      const title = stringOption(values, "title");
      if (!title) {
        console.error("Error: --title required");
        process.exit(1);
      }
      await cmdCreateFinding(
        args[1],
        title,
        stringOption(values, "description"),
        stringOption(values, "reporter"),
        stringOption(values, "dedupe-key"),
      );
      break;
    }

    case "update-finding": {
      if (!args[1]) {
        console.error("Error: finding-id required");
        process.exit(1);
      }
      const hidden = boolOption(values, "hidden")
        ? true
        : boolOption(values, "visible")
          ? false
          : undefined;
      await cmdUpdateFinding(
        args[1],
        stringOption(values, "title"),
        stringOption(values, "description"),
        hidden,
      );
      break;
    }

    // ── Projects ──
    case "projects": {
      await cmdProjects();
      break;
    }
    case "select-project": {
      if (!args[1]) {
        console.error("Error: project id required");
        process.exit(1);
      }
      await cmdSelectProject(args[1]);
      break;
    }

    // ── Scopes ──
    case "scopes": {
      await cmdScopes();
      break;
    }
    case "create-scope": {
      if (!args[1]) {
        console.error("Error: scope name required");
        process.exit(1);
      }
      const allow =
        stringOption(values, "allow")
          ?.split(",")
          .map((s) => s.trim()) ?? [];
      const deny =
        stringOption(values, "deny")
          ?.split(",")
          .map((s) => s.trim()) ?? [];
      await cmdCreateScope(args[1], allow, deny);
      break;
    }
    case "update-scope": {
      if (!args[1]) {
        console.error("Error: scope id required");
        process.exit(1);
      }
      const sName = stringOption(values, "name");
      const sAllowValue = stringOption(values, "allow");
      const sDenyValue = stringOption(values, "deny");
      const sAllow = sAllowValue?.split(",").map((s) => s.trim());
      const sDeny = sDenyValue?.split(",").map((s) => s.trim());
      await cmdUpdateScope(args[1], sName, sAllow, sDeny);
      break;
    }
    case "delete-scope": {
      if (!args[1]) {
        console.error("Error: scope id required");
        process.exit(1);
      }
      await cmdDeleteScope(args[1]);
      break;
    }

    // ── Filters ──
    case "filters": {
      await cmdFilters();
      break;
    }
    case "create-filter": {
      if (!args[1]) {
        console.error("Error: filter name required");
        process.exit(1);
      }
      const fQuery = stringOption(values, "query");
      const fAlias = stringOption(values, "alias");
      if (!fQuery) {
        console.error("Error: --query required");
        process.exit(1);
      }
      await cmdCreateFilter(args[1], fQuery, fAlias);
      break;
    }
    case "update-filter": {
      if (!args[1]) {
        console.error("Error: filter id required");
        process.exit(1);
      }
      await cmdUpdateFilter(
        args[1],
        stringOption(values, "name"),
        stringOption(values, "query"),
        stringOption(values, "alias"),
      );
      break;
    }
    case "delete-filter": {
      if (!args[1]) {
        console.error("Error: filter id required");
        process.exit(1);
      }
      await cmdDeleteFilter(args[1]);
      break;
    }

    // ── Environments ──
    case "envs": {
      await cmdEnvs();
      break;
    }
    case "create-env": {
      if (!args[1]) {
        console.error("Error: environment name required");
        process.exit(1);
      }
      await cmdCreateEnv(args[1]);
      break;
    }
    case "select-env": {
      await cmdSelectEnv(args[1]);
      break;
    }
    case "env-set": {
      if (!args[1] || !args[2] || args[3] === undefined) {
        console.error("Error: env-set requires <env-id> <var-name> <value>");
        process.exit(1);
      }
      await cmdEnvSet(args[1], args[2], args[3]);
      break;
    }
    case "delete-env": {
      if (!args[1]) {
        console.error("Error: environment id required");
        process.exit(1);
      }
      await cmdDeleteEnv(args[1]);
      break;
    }

    // ── Hosted Files ──
    case "hosted-files": {
      await cmdHostedFiles();
      break;
    }
    case "delete-hosted-file": {
      if (!args[1]) {
        console.error("Error: hosted file id required");
        process.exit(1);
      }
      await cmdDeleteHostedFile(args[1]);
      break;
    }

    // ── Tasks ──
    case "tasks": {
      await cmdTasks();
      break;
    }
    case "cancel-task": {
      if (!args[1]) {
        console.error("Error: task id required");
        process.exit(1);
      }
      await cmdCancelTask(args[1]);
      break;
    }

    // ── Intercept ──
    case "intercept-status": {
      await cmdInterceptStatus();
      break;
    }
    case "intercept-enable": {
      await cmdInterceptSet(true);
      break;
    }
    case "intercept-disable": {
      await cmdInterceptSet(false);
      break;
    }

    // ── Match & Replace (Tamper) ──
    case "mr-rules": {
      await cmdMrRules();
      break;
    }
    case "mr-collections": {
      await cmdMrCollections();
      break;
    }

    case "create-mr-rule": {
      await cmdCreateMrRule(
        parseMrOpts(values),
        stringOption(values, "collection"),
      );
      break;
    }
    case "update-mr-rule": {
      if (!args[1]) {
        console.error("Error: rule id required");
        process.exit(1);
      }
      await cmdUpdateMrRule(args[1], parseMrOpts(values));
      break;
    }
    case "delete-mr-rule": {
      if (!args[1]) {
        console.error("Error: rule id required");
        process.exit(1);
      }
      await cmdDeleteMrRule(args[1]);
      break;
    }
    case "toggle-mr-rule": {
      if (!args[1]) {
        console.error("Error: rule id required");
        process.exit(1);
      }
      const off = boolOption(values, "off", "disable");
      const on = boolOption(values, "on", "enable");
      if (off === on) {
        console.error(
          "Error: pass exactly one of --on/--enable or --off/--disable",
        );
        process.exit(1);
      }
      await cmdToggleMrRule(args[1], on);
      break;
    }
    case "rename-mr-rule": {
      if (!args[1] || !args[2]) {
        console.error("Error: rule id and new name required");
        process.exit(1);
      }
      await cmdRenameMrRule(args[1], args[2]);
      break;
    }
    case "move-mr-rule": {
      if (!args[1] || !args[2]) {
        console.error("Error: rule id and collection (name or id) required");
        process.exit(1);
      }
      await cmdMoveMrRule(args[1], args[2]);
      break;
    }
    case "test-mr-rule": {
      const mrRaw = stringOption(values, "raw");
      if (!mrRaw) {
        console.error(
          "Error: --raw <str|@file|-> required (the request/response to tamper)",
        );
        process.exit(1);
      }
      await cmdTestMrRule(parseMrOpts(values), mrRaw);
      break;
    }

    case "create-mr-collection": {
      if (!args[1]) {
        console.error("Error: collection name required");
        process.exit(1);
      }
      await cmdCreateMrCollection(args[1]);
      break;
    }
    case "rename-mr-collection": {
      if (!args[1] || !args[2]) {
        console.error("Error: collection (id or name) and new name required");
        process.exit(1);
      }
      await cmdRenameMrCollection(args[1], args[2]);
      break;
    }
    case "delete-mr-collection": {
      if (!args[1]) {
        console.error("Error: collection (id or name) required");
        process.exit(1);
      }
      await cmdDeleteMrCollection(args[1]);
      break;
    }

    // ── Info ──
    case "viewer": {
      await cmdViewer();
      break;
    }
    case "plugins": {
      await cmdPlugins();
      break;
    }
    case "health": {
      await cmdHealth();
      break;
    }

    // ── Setup & Auth ──
    case "setup": {
      const pat = args[1];
      if (!pat) {
        console.error("Usage: caido-client setup <pat> [url] [--proxy <addr>]");
        console.error(
          "\nGet a PAT from: Caido → Settings → Developer → Personal Access Tokens",
        );
        process.exit(1);
      }
      const url = args[2] || process.env.CAIDO_URL || "http://localhost:8080";
      await cmdSetup(pat, url, stringOption(values, "proxy"));
      break;
    }
    case "auth-status": {
      await cmdAuthStatus();
      break;
    }

    case "run-workflow": {
      if (!args[1] || !args[2]) {
        console.error(
          "Usage: caido-client run-workflow <workflow-id> <request-id>",
        );
        process.exit(1);
      }
      await cmdRunWorkflow(args[1], args[2]);
      break;
    }

    case "call-plugin": {
      if (!args[1] || !args[2] || !args[3]) {
        console.error(
          "Usage: caido-client call-plugin <package-manifest-id> <backend-manifest-id> <function-name> [request-id] [--args '<JSON-array>']",
        );
        process.exit(1);
      }
      await cmdCallPlugin(
        args[1],
        args[2],
        args[3],
        args[4],
        stringOption(values, "args"),
      );
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      program.outputHelp();
      process.exit(1);
  }
}

if (import.meta.main)
  main().catch((e) => {
    console.error(`Error: ${e.message}`);
    if (DEBUG) console.error(e.stack);
    process.exit(1);
  });
