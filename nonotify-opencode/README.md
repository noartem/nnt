# nonotify-opencode

[OpenCode](https://github.com/anomalyco/opencode) plugin that sends notifications through [nnt](https://github.com/noartem/nnt) when:

- a permission request is pending for more than 1 minute
- a question request (agent needs your input) is pending for more than 1 minute
- an agent reply completes after you run `/notify-next-reply` command

## Installation (from npm)

1. Configure `nnt` at least once (if you have not done it yet):

```bash
npm i -g nonotify
nnt profile add
```

2. Add the plugin package to your OpenCode config:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["nonotify-opencode"]
}
```

3. Restart OpenCode.

OpenCode installs npm plugins and their dependencies automatically at startup.

## Optional configuration

- Use plugin config in `opencode.json` to pick a profile:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["nonotify-opencode"],
  "nonotify-opencode": {
    "profile": "important",
    "approvalDelaySeconds": 60,
    "questionDelaySeconds": 60
  }
}
```

- `profile` defaults to your `nnt` default profile.
- `NNT_PROFILE`: fallback source when `profile` is not set in config.
- Timing values are in seconds.
- `approvalDelaySeconds`: wait before notifying about pending permission request (default `60`).
- `questionDelaySeconds`: wait before notifying about pending question request (default `60`).

When the `notify-next-reply` command is executed, the plugin waits for the next completed assistant message in that session and sends a completion alert.

