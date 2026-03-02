import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";

export type TelegramProfile = {
  type: "telegram";
  name: string;
  botToken: string;
  chatId: string;
  createdAt: string;
};

export type NntConfig = {
  defaultProfile: string | null;
  profiles: Record<string, TelegramProfile>;
};

const DEFAULT_CONFIG: NntConfig = {
  defaultProfile: null,
  profiles: {},
};

const CONFIG_FILENAME = "nnt.json";
const DEFAULT_CONFIG_DIR = join(homedir(), ".config", "nnt");
const LEGACY_CONFIG_PATH = join(homedir(), ".nnt", "config");

export function getConfigDir(): string {
  const dir = process.env.NNT_CONFIG_DIR;
  if (dir && dir.trim() !== "") {
    return resolve(dir);
  }

  return DEFAULT_CONFIG_DIR;
}

export function getConfigPath(): string {
  return join(getConfigDir(), CONFIG_FILENAME);
}

export function getLegacyConfigPath(): string {
  return LEGACY_CONFIG_PATH;
}

export async function loadConfig(): Promise<NntConfig> {
  const path = getConfigPath();

  try {
    const raw = await readFile(path, "utf8");
    return parseConfig(raw);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      try {
        const legacyRaw = await readFile(getLegacyConfigPath(), "utf8");
        const parsed = parseConfig(legacyRaw);

        try {
          await saveConfig(parsed);
        } catch {
          // Best effort migration only.
        }

        return parsed;
      } catch (legacyError) {
        if (isNodeError(legacyError) && legacyError.code === "ENOENT") {
          return { ...DEFAULT_CONFIG };
        }

        throw legacyError;
      }
    }

    throw error;
  }
}

export async function saveConfig(config: NntConfig): Promise<void> {
  const dir = getConfigDir();
  const path = getConfigPath();

  await mkdir(dir, { recursive: true });
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, {
    mode: 0o600,
  });

  try {
    await chmod(path, 0o600);
  } catch {
    // Best effort only.
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error;
}

function parseConfig(raw: string): NntConfig {
  const parsed = JSON.parse(raw) as Partial<NntConfig>;

  return {
    defaultProfile:
      typeof parsed.defaultProfile === "string" ? parsed.defaultProfile : null,
    profiles: parsed.profiles ?? {},
  };
}
