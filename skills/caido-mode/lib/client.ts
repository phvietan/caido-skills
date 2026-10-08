/**
 * Caido SDK client with URL-keyed (multi-instance) auth.
 *
 * Credentials live in ~/.config/caido-client/settings.json, keyed by
 * instance URL so two Caido instances on one machine never clobber each other:
 *
 *   {
 *     "default": "http://localhost:8080",
 *     "instances": {
 *       "http://localhost:8080": { "pat": "...", "proxy": "...", "cachedToken": {...} },
 *       "http://localhost:8081": { "pat": "...", "cachedToken": {...} }
 *     }
 *   }
 *
 * Active instance = CAIDO_URL env → stored `default` → http://localhost:8080.
 * The old Claude-specific file and legacy flat shape are migrated on read.
 */

import { Client, type TokenCache, type CachedToken } from "@caido/sdk-client";
import { CaidoGlobalSettings, CaidoInstance } from "./settings";
import gql from "graphql-tag";
import * as G from "./graphql";
import type { JsonValue } from "./types";

/**
 * Keep the SDK's chatter (e.g. "[caido] Loaded token from cache") off stdout so command
 * output stays pure JSON. Warnings/errors still surface on stderr.
 */
export const QUIET_LOGGER = {
  debug() {},
  info() {},
  warn: (message: string, ...args: unknown[]) =>
    console.error(message, ...args),
  error: (message: string, ...args: unknown[]) =>
    console.error(message, ...args),
};

const TAMPER_RULE_FIELDS = `id name enable { rank } collection { id name }`;

export class CaidoClient {
  private static sdkClient: Client | null = null;

  private constructor(private readonly sdk: Client) {}

  /** SDK TokenCache adapter, kept private because callers only deal with CaidoClient. */
  private static tokenCache(instance: CaidoInstance): TokenCache {
    let cachedToken: CachedToken | null = null;
    return {
      async load(): Promise<CachedToken | undefined> {
        if (cachedToken) return cachedToken;
        if (
          instance.cachedToken?.accessToken &&
          instance.isCachedTokenValid()
        ) {
          cachedToken = instance.cachedToken;
          return cachedToken;
        }
        return undefined;
      },
      async save(token: CachedToken): Promise<void> {
        cachedToken = token;
        instance.update({ cachedToken: token });
      },
      async clear(): Promise<void> {
        cachedToken = null;
        instance.clearCachedToken();
      },
    };
  }

  private get graphql() {
    return this.sdk.graphql;
  }
  async connect(options: Parameters<Client["connect"]>[0]) {
    return this.sdk.connect(options);
  }
  async health() {
    return this.sdk.health();
  }
  async viewer() {
    return this.sdk.user.viewer();
  }
  async plugins(): Promise<any> {
    const result: any = await this.graphql.query(G.PLUGIN_PACKAGES_QUERY, {});
    return result.pluginPackages;
  }
  async runActiveWorkflow(workflowId: string, requestId: string): Promise<any> {
    const result: any = await this.graphql.mutation(
      CaidoClient.RUN_ACTIVE_WORKFLOW,
      { id: workflowId, input: { requestId } },
    );
    const payload = result.runActiveWorkflow;
    if (payload?.error) {
      throw new Error(
        `Caido rejected the workflow run: ${payload.error.__typename}`,
      );
    }
    return payload.task;
  }
  async callPluginFunction(
    packageManifestId: string,
    backendManifestId: string,
    functionName: string,
    args: JsonValue[],
  ): Promise<unknown> {
    const pluginPackage =
      await this.sdk.plugin.pluginPackage(packageManifestId);
    if (!pluginPackage) {
      throw new Error(`Plugin package not found: ${packageManifestId}`);
    }
    return pluginPackage.callFunction({
      manifestId: backendManifestId,
      name: functionName,
      arguments: args,
    });
  }
  async listFindings(limit: number) {
    return this.sdk.finding.list().first(limit);
  }
  async getFinding(id: string) {
    return this.sdk.finding.get(id);
  }
  async createFinding(requestId: string, options: any) {
    return this.sdk.finding.create(requestId, options);
  }
  async updateFinding(id: string, options: any) {
    return this.sdk.finding.update(id, options);
  }
  async listScopes() {
    return this.sdk.scope.list();
  }
  async getScope(id: string) {
    return this.sdk.scope.get(id);
  }
  async createScope(options: any) {
    return this.sdk.scope.create(options);
  }
  async updateScope(id: string, options: any) {
    return this.sdk.scope.update(id, options);
  }
  async deleteScope(id: string) {
    return this.sdk.scope.delete(id);
  }
  async listFilters() {
    return this.sdk.filter.list();
  }
  async getFilter(id: string) {
    return this.sdk.filter.get(id);
  }
  async createFilter(options: any) {
    return this.sdk.filter.create(options);
  }
  async updateFilter(id: string, options: any) {
    return this.sdk.filter.update(id, options);
  }
  async deleteFilter(id: string) {
    return this.sdk.filter.delete(id);
  }
  async listEnvironments() {
    return this.sdk.environment.list();
  }
  async getEnvironment(id: string) {
    return this.sdk.environment.get(id);
  }
  async createEnvironment(options: any) {
    return this.sdk.environment.create(options);
  }
  async selectEnvironment(id?: string) {
    return this.sdk.environment.select(id);
  }
  async deleteEnvironment(id: string) {
    return this.sdk.environment.delete(id);
  }
  async listProjects() {
    return this.sdk.project.list();
  }
  async selectProject(id: string) {
    return this.sdk.project.select(id);
  }
  async listHostedFiles() {
    return this.sdk.hostedFile.list();
  }
  async deleteHostedFile(id: string) {
    return this.sdk.hostedFile.delete(id);
  }
  async listTasks() {
    return this.sdk.task.list();
  }
  async cancelTask(id: string) {
    return this.sdk.task.cancel(id);
  }
  async interceptOptions(): Promise<any> {
    const result: any = await this.graphql.query(G.INTERCEPT_OPTIONS_QUERY, {});
    return result.interceptOptions;
  }
  async setIntercept(enabled: boolean): Promise<any> {
    const document = enabled ? G.RESUME_INTERCEPT : G.PAUSE_INTERCEPT;
    const result: any = await this.graphql.mutation(document, {});
    return result[enabled ? "resumeIntercept" : "pauseIntercept"];
  }
  async searchRequests(
    filter: string,
    limit: number,
    descending: boolean,
    after?: string,
  ) {
    let builder = this.sdk.request.list().filter(filter).first(limit);
    if (descending) builder = builder.descending("req", "id");
    if (after) builder = builder.after(after);
    return builder;
  }
  async recentRequests(limit: number) {
    return this.sdk.request.list().descending("req", "id").first(limit);
  }
  async getRequest(id: string, options: any = { raw: true }) {
    return this.sdk.request.get(id, options);
  }
  async getReplaySession(id: string) {
    return this.sdk.replay.sessions.get(id);
  }
  async listReplaySessions(after?: string, limit = 100) {
    const builder = this.sdk.replay.sessions.list();
    return after ? builder.after(after).first(limit) : builder.first(limit);
  }
  async createReplaySession(options: any) {
    return this.sdk.replay.sessions.create(options);
  }
  async renameReplaySession(id: string, name: string) {
    return this.sdk.replay.sessions.rename(id, name);
  }
  async moveReplaySession(id: string, collectionId: string) {
    return this.sdk.replay.sessions.move(id, collectionId);
  }
  async deleteReplaySessions(ids: string[]) {
    return this.sdk.replay.sessions.delete(ids);
  }
  async getReplayEntry(id: string) {
    return this.sdk.replay.entries.get(id);
  }
  async listReplayEntries(session: any, includeRaw: boolean, limit: number) {
    return session
      .entries()
      .includeRaw(
        includeRaw ? { request: true, response: true, replay: true } : false,
      )
      .first(limit);
  }
  async sendReplay(id: string, options: any) {
    return this.sdk.replay.send(id, options);
  }
  async listReplayCollections(after?: string, limit = 100) {
    const builder = this.sdk.replay.collections.list();
    return after ? builder.after(after).first(limit) : builder.first(limit);
  }
  async createReplayCollection(name: string) {
    return this.sdk.replay.collections.create({ name });
  }
  async renameReplayCollection(id: string, name: string) {
    return this.sdk.replay.collections.rename(id, name);
  }
  async deleteReplayCollection(id: string) {
    return this.sdk.replay.collections.delete(id);
  }
  async createRawReplaySession(input: unknown): Promise<any> {
    const result: any = await this.graphql.mutation(
      G.CREATE_REPLAY_SESSION_RAW,
      { input },
    );
    return result.createReplaySession.session;
  }
  async createAutomateSession(requestId: string): Promise<any> {
    const result: any = await this.graphql.mutation(G.CREATE_AUTOMATE_SESSION, {
      input: { requestSource: { id: requestId } },
    });
    return result.createAutomateSession.session;
  }
  async getAutomateSession(id: string): Promise<any> {
    const result: any = await this.graphql.query(G.GET_AUTOMATE_SESSION, {
      id,
    });
    return result.automateSession;
  }
  async startAutomateTask(id: string): Promise<any> {
    const result: any = await this.graphql.mutation(G.START_AUTOMATE_TASK, {
      automateSessionId: id,
    });
    return result.startAutomateTask.automateTask;
  }

  public static withAuth(instance: CaidoInstance, pat: string): CaidoClient {
    return new CaidoClient(
      new Client({
        url: instance.url,
        auth: { pat, cache: this.tokenCache(instance) },
        logger: QUIET_LOGGER,
      }),
    );
  }

  private static readonly CREATE_TAMPER_RULE = gql`
    mutation($input: CreateTamperRuleInput!) {
      createTamperRule(input: $input) {
        rule { ${TAMPER_RULE_FIELDS} }
        error { __typename }
      }
    }
  `;

  private static readonly RUN_ACTIVE_WORKFLOW = gql`
    mutation ($id: ID!, $input: RunActiveWorkflowInput!) {
      runActiveWorkflow(id: $id, input: $input) {
        task {
          id
          createdAt
          workflow {
            id
            name
          }
        }
        error {
          __typename
        }
      }
    }
  `;

  public static async getClient(): Promise<CaidoClient> {
    if (this.sdkClient) return new CaidoClient(this.sdkClient);

    const instance = CaidoGlobalSettings.activeInstance();
    const config = instance.loadConfig();
    const sdk = new Client({
      url: config.url,
      auth: { pat: config.pat, cache: this.tokenCache(instance) },
      logger: QUIET_LOGGER,
    });

    try {
      await sdk.connect({
        ready: { retries: 3, timeout: 5000, interval: 1000 },
      });
    } catch (err: any) {
      if (err.message?.includes("not ready")) {
        console.error("Error: Caido instance is not ready. Is Caido running?");
        console.error(`  Tried: ${config.url}`);
      } else {
        console.error(`Connection error: ${err.message}`);
      }
      process.exit(1);
    }

    this.sdkClient = sdk;
    return new CaidoClient(sdk);
  }

  /** Create a Tamper rule and return the created rule payload. */
  async createTamperRule(input: unknown): Promise<any> {
    const result: any = await this.graphql.mutation(
      CaidoClient.CREATE_TAMPER_RULE,
      { input },
    );
    const payload = result.createTamperRule;
    if (payload?.error) {
      throw new Error(`Caido rejected the rule: ${payload.error.__typename}`);
    }
    return payload;
  }

  async tamperRuleCollections(): Promise<any> {
    return this.graphql.query(G.TAMPER_RULE_COLLECTIONS, {});
  }

  async updateTamperRule(id: string, input: unknown): Promise<any> {
    const result: any = await this.graphql.mutation(G.UPDATE_TAMPER_RULE, {
      id,
      input,
    });
    const payload = result.updateTamperRule;
    if (payload?.error) {
      throw new Error(`Caido rejected the update: ${payload.error.__typename}`);
    }
    return payload;
  }

  async deleteTamperRule(id: string): Promise<string> {
    const result: any = await this.graphql.mutation(G.DELETE_TAMPER_RULE, {
      id,
    });
    return result.deleteTamperRule.deletedId;
  }

  async toggleTamperRule(id: string, enabled: boolean): Promise<any> {
    const result: any = await this.graphql.mutation(G.TOGGLE_TAMPER_RULE, {
      id,
      enabled,
    });
    const payload = result.toggleTamperRule;
    if (payload?.error) {
      throw new Error(`Caido rejected the toggle: ${payload.error.__typename}`);
    }
    return payload.rule;
  }

  async renameTamperRule(id: string, name: string): Promise<any> {
    const result: any = await this.graphql.mutation(G.RENAME_TAMPER_RULE, {
      id,
      name,
    });
    return result.renameTamperRule.rule;
  }

  async moveTamperRule(id: string, collectionId: string): Promise<any> {
    const result: any = await this.graphql.mutation(G.MOVE_TAMPER_RULE, {
      id,
      collectionId,
    });
    return result.moveTamperRule.rule;
  }

  async testTamperRule(input: unknown): Promise<any> {
    const result: any = await this.graphql.mutation(G.TEST_TAMPER_RULE, {
      input,
    });
    const payload = result.testTamperRule;
    if (payload?.error) {
      throw new Error(`Rule could not be applied: ${payload.error.__typename}`);
    }
    return payload;
  }

  async createTamperRuleCollection(name: string): Promise<any> {
    const result: any = await this.graphql.mutation(
      G.CREATE_TAMPER_RULE_COLLECTION,
      { input: { name } },
    );
    return result.createTamperRuleCollection.collection;
  }

  async renameTamperRuleCollection(id: string, name: string): Promise<any> {
    const result: any = await this.graphql.mutation(
      G.RENAME_TAMPER_RULE_COLLECTION,
      { id, name },
    );
    return result.renameTamperRuleCollection.collection;
  }

  async deleteTamperRuleCollection(id: string): Promise<string> {
    const result: any = await this.graphql.mutation(
      G.DELETE_TAMPER_RULE_COLLECTION,
      { id },
    );
    return result.deleteTamperRuleCollection.deletedId;
  }
}
