# Claude Code on the Creator Micro 2

The included Work Louder layer puts shortcuts on the keypad. A local Mac helper lights the six agent keys and opens the Claude Desktop Code session assigned to each one.

[Download the setup kit for macOS](https://github.com/avinashrao/creator-micro-claude-code/releases/latest/download/creator-micro-claude-code.zip) and unzip it before following the steps below.

## Set up your Mac

1. Connect the Creator Micro 2 with a USB data cable. Open Work Louder Input and select the keypad. [Work Louder setup and Input download](https://www.worklouder.cc/setup/creator-micro-2)
2. Open Claude Desktop, select **Code**, and start or open a **local** session on this Mac. The helper follows up to six recent, unarchived local Code sessions. [Claude Desktop guide](https://code.claude.com/docs/en/desktop)
3. Install Node.js 20 or newer and Apple's Command Line Tools if needed. `node --version` checks Node. `xcode-select --install` installs the tools used to build the included USB bridge. [Node.js download](https://nodejs.org/en/download)

## Import the layer

In Input, choose the profile you use. Beside its layer numbers, click **+ → Import layer**, then choose **Claude Code-layer.json** from this folder. Save or sync the change to the device. Input adds the layer to that profile. The import uses the Mac US shortcut layout. If you use another layout, review the bracket shortcuts for Back and Forward.

Input allows six layers per profile and shows the add button when there is room. If your profile is full, use a profile with an available slot. Tap the keypad's bottom-left sensor to cycle to the imported layer. Its position can vary.

## Start the session lights

Unzip the kit. In Terminal, type `cd ` with a trailing space, drag the extracted folder into Terminal, and press Return. Then run

```sh
node setup.mjs
```

The installer builds the included bridge on your Mac, detects the keypad, checks the six agent keys, and starts the helper at login. It keeps its own copy under `~/Library/Application Support/Claude Code Keypad Lights`. You can move the downloaded folder afterward. If several keypads are connected, the installer lists their serials. Run `node setup.mjs SERIAL` to choose one. The helper uses your existing local Claude session data and needs no API key.

## Try it

Let a local session finish a turn while you're looking at a different session. Switch to the Claude layer and tap its green key. That conversation should open and its key should dim. Double-tap a session key to bring Claude to the foreground. The assignments follow recent activity and can change as sessions work.

| Key color | Session state |
|---|---|
| Pulsing blue | Working |
| Amber | Waiting for input or approval |
| Green | Turn finished since the last view |
| Red | Error reported |
| Dim white | Idle |
| Off | Unassigned |

| Control | Action in the Claude Code tab |
|---|---|
| Top pair, then next row of four | Select sessions 1–6, left to right |
| Next row of four | Fast mode, approve once, reject or stop, fork |
| Bottom row | Dictation on the left, unassigned middle switch under the wide cap, Send on the right |
| Dial | Turn one notch to step reasoning effort up or down from the focused prompt with menus closed. Tap sends Return. Hold opens the effort menu. |
| Joystick | Up opens permission modes, including Plan. Down toggles the sidebar. Left goes back and right goes forward. |

## Check or remove the setup

`node setup.mjs --check` builds a temporary bridge and checks the connected keypad's six session bindings. It leaves the stored keymap and login items alone. If the keys stay dark, check that a local Code session exists and read the helper's latest status with

```sh
tail -n 10 "$HOME/Library/Logs/local.creator-micro.claude-code-lights.log"
```

To stop the helper, run

```sh
launchctl bootout "gui/$(id -u)/local.creator-micro.claude-code-lights"
```

To remove it permanently, also move `~/Library/LaunchAgents/local.creator-micro.claude-code-lights.plist` and `~/Library/Application Support/Claude Code Keypad Lights` to the Trash. The imported layer can be removed separately in Input.

The session integration uses Claude Desktop's local metadata and session links. A future app update could change them. The helper includes MIT-licensed code from [claude-code-keypad](https://github.com/00cyre/claude-code-keypad) and [creator-micro-kit](https://github.com/00cyre/creator-micro-kit/tree/a563b88c2dc251371dd4c670690a01f8980fc338). Both license notices are included.
