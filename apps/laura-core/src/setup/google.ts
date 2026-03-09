/**
 * laura setup google
 *
 * Step 1 of G Suite wiring: OAuth2 authentication via gws (googleworkspace/cli).
 * A single browser consent covers Gmail, Calendar, Drive, and all G Suite APIs.
 *
 * What this does:
 *   1. Verifies gws is installed
 *   2. Runs `gws auth login` — opens browser for OAuth2 consent
 *   3. Exports credentials to ~/.laura/google-credentials.json
 *   4. Sets GOOGLE_APPLICATION_CREDENTIALS in .env
 *   5. Validates the credentials work against the Gmail API
 *
 * After this step, run: npm run setup google pubsub
 */

import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { GoogleAuth } from "google-auth-library";
import { setEnvVars } from "./env-writer.js";

const execAsync = promisify(execFile);

const LAURA_DIR = join(homedir(), ".laura");
const CREDENTIALS_PATH = join(LAURA_DIR, "google-credentials.json");
const ENV_PATH = join(fileURLToPath(new URL(".", import.meta.url)), "../../.env");

// ---------------------------------------------------------------------------
// gws helpers
// ---------------------------------------------------------------------------

async function checkGws(): Promise<void> {
  try {
    await execAsync("gws", ["--version"]);
  } catch {
    throw new Error(
      "gws (Google Workspace CLI) is not installed or not in PATH.\n\n" +
        "Install it:\n" +
        "  npm install -g @google/workspace-cli\n" +
        "  # or: https://github.com/googleworkspace/cli#installation\n",
    );
  }
}

/** Run `gws auth login` interactively (opens browser). */
async function gwsAuthLogin(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("gws", ["auth", "login"], {
      stdio: "inherit", // let the user interact
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`gws auth login exited with code ${code}`));
    });
    child.on("error", reject);
  });
}

/** Export credentials from gws in authorized_user JSON format. */
async function gwsExportCredentials(): Promise<string> {
  try {
    const { stdout } = await execAsync("gws", ["auth", "export", "--unmasked"]);
    return stdout.trim();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to export gws credentials: ${msg}\n\n` +
        "Try running 'gws auth login' manually first.",
    );
  }
}

// ---------------------------------------------------------------------------
// Credential validation
// ---------------------------------------------------------------------------

async function validateCredentials(): Promise<string> {
  const auth = new GoogleAuth({
    keyFilename: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
  });

  try {
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    if (!token.token) throw new Error("No access token returned");

    // Fetch the authenticated user's email to confirm scope
    const { google } = await import("googleapis");
    const gmail = google.gmail({ version: "v1", auth: auth as never });
    const profile = await gmail.users.getProfile({ userId: "me" });
    return profile.data.emailAddress ?? "unknown";
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Credential validation failed: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function setupGoogleAuth({ banner = true } = {}): Promise<void> {
  if (banner) console.log("▶ laura setup google (auth)\n");

  // 1. Check gws is installed
  console.log("  Checking gws...");
  await checkGws();
  console.log("  ✓ gws found");

  // 2. Check if credentials already exist
  if (existsSync(CREDENTIALS_PATH)) {
    const raw = await readFile(CREDENTIALS_PATH, "utf-8");
    const creds = JSON.parse(raw) as { client_id?: string };
    if (creds.client_id) {
      console.log(`  ✓ Credentials already exist at ${CREDENTIALS_PATH}`);
      console.log("    Re-authenticating to refresh...\n");
    }
  }

  // 3. gws auth login — browser consent
  console.log("  Opening browser for Google OAuth2 consent...");
  console.log("  (Grant access to Gmail, Calendar, and Drive when prompted)\n");
  await gwsAuthLogin();
  console.log("\n  ✓ OAuth2 consent complete");

  // 4. Export credentials
  console.log("  Exporting credentials...");
  const credentialsJson = await gwsExportCredentials();

  // Validate it's proper JSON before writing
  JSON.parse(credentialsJson);

  // 5. Write to ~/.laura/google-credentials.json
  await mkdir(LAURA_DIR, { recursive: true });
  await writeFile(CREDENTIALS_PATH, credentialsJson, { encoding: "utf-8", mode: 0o600 });
  console.log(`  ✓ Credentials saved to ${CREDENTIALS_PATH}`);

  // 6. Set GOOGLE_APPLICATION_CREDENTIALS in .env
  await setEnvVars(ENV_PATH, {
    GOOGLE_APPLICATION_CREDENTIALS: CREDENTIALS_PATH,
  });
  console.log("  ✓ GOOGLE_APPLICATION_CREDENTIALS written to .env");

  // 7. Validate credentials work
  console.log("  Validating credentials...");
  const email = await validateCredentials();
  console.log(`  ✓ Authenticated as ${email}`);

  if (banner) console.log(`
Done. Google auth is configured.

  Account : ${email}
  Creds   : ${CREDENTIALS_PATH}

Next step: run 'npm run setup google pubsub' to wire Gmail Pub/Sub.
`);
}
