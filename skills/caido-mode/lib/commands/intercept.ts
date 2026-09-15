/** Intercept commands: status, enable, disable */

import { CaidoClient } from "../client";

export async function cmdInterceptStatus() {
  const client = await CaidoClient.getClient();
  try {
    const result = await client.interceptOptions();
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.log(
      JSON.stringify(
        { error: err.message, hint: "Intercept may not be available" },
        null,
        2,
      ),
    );
  }
}

export async function cmdInterceptSet(enabled: boolean) {
  const client = await CaidoClient.getClient();
  try {
    const result = await client.setIntercept(enabled);
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error(
      `Failed to ${enabled ? "enable" : "disable"} intercept: ${err.message}`,
    );
  }
}
