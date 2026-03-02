# nonotify-opencode

`nonotify-opencode` is an OpenCode plugin that sends notifications through `nonotify` when:

- a permission request is pending for more than 1 minute
- an assistant reply completes after running for more than 5 minutes

## Installation (from npm)

1. Configure `nnt` at least once (if you have not done it yet):

```bash
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

- `NNT_PROFILE`: use a specific `nnt` profile for alerts.

Example:

```bash
export NNT_PROFILE=important
```

If sending fails (for example, no profile is configured), the plugin logs a warning and disables further alert attempts in the current process.
