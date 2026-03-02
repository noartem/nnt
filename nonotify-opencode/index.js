const ONE_MINUTE_MS = 60_000;
const FIVE_MINUTES_MS = 5 * 60_000;

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function defaultProfileReader() {
  return process.env.NNT_PROFILE?.trim() || undefined;
}

async function createDefaultNotifier() {
  const { Notifier } = await import("nonotify");
  return new Notifier();
}

export async function createNonotifyOpencodeHooks({ client }, options = {}) {
  const pendingPermissions = new Map();
  const notifiedLongMessages = new Set();
  const notifier = options.notifier ?? (await createDefaultNotifier());
  const approvalDelayMs = options.approvalDelayMs ?? ONE_MINUTE_MS;
  const longReplyMs = options.longReplyMs ?? FIVE_MINUTES_MS;
  const schedule = options.schedule ?? setTimeout;
  const cancel = options.cancel ?? clearTimeout;
  const readProfile = options.readProfile ?? defaultProfileReader;
  let notificationsDisabled = false;

  const log = async (level, message, extra = {}) => {
    await client.app.log({
      body: {
        service: "nonotify-opencode",
        level,
        message,
        extra,
      },
    });
  };

  const sendNotification = async (title, lines) => {
    if (notificationsDisabled) return;

    const message = [`[OpenCode] ${title}`, ...lines].join("\n");
    const profile = readProfile();

    try {
      await notifier.send({ message, profile });
    } catch (error) {
      notificationsDisabled = true;
      await log("warn", "Failed to send nonotify alert. Alerts are now disabled.", {
        error: String(error),
      });
    }
  };

  const startPermissionTimer = (event) => {
    const properties = event.properties ?? {};
    const requestID = properties.id;

    if (!requestID) return;

    const previous = pendingPermissions.get(requestID);
    if (previous) cancel(previous.timeout);

    const timeout = schedule(async () => {
      const pending = pendingPermissions.get(requestID);
      if (!pending) return;

      pendingPermissions.delete(requestID);

      const permissionName = pending.permission || "unknown";
      const patterns = pending.patterns.length > 0 ? pending.patterns.join(", ") : "none";

      await sendNotification("Approval pending > 1 minute", [
        `session: ${pending.sessionID}`,
        `permission: ${permissionName}`,
        `patterns: ${patterns}`,
      ]);
    }, approvalDelayMs);

    pendingPermissions.set(requestID, {
      sessionID: properties.sessionID || "unknown",
      permission: properties.permission || properties.type,
      patterns: Array.isArray(properties.patterns)
        ? properties.patterns
        : Array.isArray(properties.pattern)
          ? properties.pattern
          : properties.pattern
            ? [String(properties.pattern)]
            : [],
      timeout,
    });
  };

  const stopPermissionTimer = (event) => {
    const properties = event.properties ?? {};
    const requestID = properties.requestID || properties.permissionID;

    if (!requestID) return;

    const pending = pendingPermissions.get(requestID);
    if (!pending) return;

    cancel(pending.timeout);
    pendingPermissions.delete(requestID);
  };

  const maybeNotifyLongReply = async (event) => {
    const info = event.properties?.info;
    if (!info || info.role !== "assistant") return;

    const messageID = info.id;
    if (!messageID || notifiedLongMessages.has(messageID)) return;

    const created = Number(info.time?.created);
    const completed = Number(info.time?.completed);
    if (!Number.isFinite(created) || !Number.isFinite(completed)) return;

    const duration = completed - created;
    if (duration <= longReplyMs) return;

    notifiedLongMessages.add(messageID);

    await sendNotification("Long reply completed", [
      `duration: ${formatDuration(duration)}`,
      `session: ${info.sessionID}`,
      `agent: ${info.agent || "unknown"}`,
    ]);
  };

  const cleanupSessionPermissions = (event) => {
    const sessionID = event.properties?.sessionID;
    if (!sessionID) return;

    for (const [requestID, pending] of pendingPermissions.entries()) {
      if (pending.sessionID !== sessionID) continue;
      cancel(pending.timeout);
      pendingPermissions.delete(requestID);
    }
  };

  return {
    event: async ({ event }) => {
      switch (event.type) {
        case "permission.asked":
        case "permission.updated":
          startPermissionTimer(event);
          return;
        case "permission.replied":
          stopPermissionTimer(event);
          return;
        case "message.updated":
          await maybeNotifyLongReply(event);
          return;
        case "session.deleted":
          cleanupSessionPermissions(event);
          return;
        default:
          return;
      }
    },
  };
}

export const NonotifyOpencodePlugin = async (input) => {
  return createNonotifyOpencodeHooks(input);
};

export default NonotifyOpencodePlugin;
