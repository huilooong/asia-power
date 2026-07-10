# 启动台 F9 — Filco 外接键盘专用（CEO）

## 结论

**在 Filco 上按 F9（或 fn+F9 / 若顶排发媒体键）应打开启动台。** Mac 内置键盘仍不会绑 F9。

## 2026-07-01 修复（第二轮）

| 根因（最可能） | 已改 |
|----------------|------|
| Karabiner 的 `open_application` 打开 `com.apple.apps.launcher` 在 macOS 26 上不可靠 | 改为 **`shell_command`** 调用 `~/.config/karabiner/scripts/open-launchpad.sh`（内含 `open -b` + 备用路径） |
| Filco 顶排有时不是标准 `f9` 键码，而是 **fastforward / 下一曲** | 同规则下增加 **f9、fn+f9、fastforward、fn+fastforward、scan_next_track**，且全部 **仅 Filco**（`device_if`） |
| 设备「修改事件」未显式开启 | `devices` 里对 **2652/34050** 及 **2652 全系** 设 **`ignore: false`** |

Filco ID（已用 `karabiner_cli --list-connected-devices` 核对）：**Convertible 2 TKL**，vendor **2652**，product **34050**，蓝牙。

## 请你验证（10 秒）

| 操作 | 预期 |
|------|------|
| **Filco 按 F9** | 出现启动台 |
| Filco **fn+F9** 或顶排「快进/下一曲」若你平时这样用 | 也应出现启动台 |
| **Mac 内置键盘 F9** | **不**出现启动台 |

## 若仍无反应

1. **系统设置 → 隐私与安全性 → 辅助功能**：**Karabiner-Elements**、**Karabiner-Menu** 打开  
2. 同一页 **自动化**（若有）：允许 Karabiner 相关项  
3. 终端自查设备：`"/Library/Application Support/org.pqrs/Karabiner-Elements/bin/karabiner_cli" --list-connected-devices`

---

*更新：2026-07-01 · shell_command + 多键码 · AsiaPower*
