# maniac911/ClientRuleSet rules-dist

> 此分支由 GitHub Actions 自动生成，请不要直接修改生成的规则文件。源码、构建逻辑和自定义规则位于 `master` 分支。

## 蓝莓桥 v8.3 桌面：`route.rules` 顺序

以下顺序来自 `蓝莓桥-v8.3-桌面.json`。sing-box 的路由规则按配置顺序自上而下匹配，因此**越靠前优先级越高**；命中后即执行对应动作/出站。

| # | 匹配项 / rule-set | 动作 / 出站 |
|---:|---|---|
| 1 | `ip_cidr: 198.18.0.0/16` | resolve |
| 2 | `bilibili_non_ip` | → 📺 哔哩哔哩 |
| 3 | `reject_non_ip_drop` | REJECT (drop) |
| 4 | `reject_domainset` | REJECT |
| 5 | `reject_extra_domainset` | REJECT |
| 6 | `reject_phishing` | REJECT |
| 7 | `reject_non_ip` | REJECT |
| 8 | `reject_non_ip_no_drop` | REJECT (no_drop) |
| 9 | `sogouinput` | REJECT |
| 10 | `speedtest` | → 📊 Speedtest |
| 11 | `apple_podcasts` | → 🎙 Apple Podcasts |
| 12 | `apple_tv` | → 📺 Apple TV |
| 13 | `cdn_domainset` | → 📦 CDN |
| 14 | `cdn_non_ip` | → 📦 CDN |
| 15 | `stream_us_non_ip` | → 🇺🇸 北美流媒体 |
| 16 | `stream_eu_non_ip` | → 🇪🇺 欧洲流媒体 |
| 17 | `stream_jp_non_ip` | → 🇯🇵 日本流媒体 |
| 18 | `stream_kr_non_ip` | → 🇰🇷 韩国流媒体 |
| 19 | `stream_hk_non_ip` | → 🇭🇰 香港流媒体 |
| 20 | `stream_tw_non_ip` | → 🇹🇼 台湾流媒体 |
| 21 | `stream_non_ip` | → 🎬 流媒体 |
| 22 | `ai_non_ip` | → 🤖 AI |
| 23 | `apple_intelligence_non_ip` | → 🤖 AI |
| 24 | `telegram_non_ip` | → ✈️ Telegram |
| 25 | `apple_cdn` | → DIRECT |
| 26 | `apple_services` | → 🍎 Apple |
| 27 | `apple_cn_non_ip` | → DIRECT |
| 28 | `microsoft_cdn_non_ip` | → DIRECT |
| 29 | `microsoft_non_ip` | → 🪟 Microsoft |
| 30 | `neteasemusic_non_ip` | → 🎵 网易云音乐 |
| 31 | `game_download_domainset` | → ⬇️ 下载 |
| 32 | `download_domainset` | → ⬇️ 下载 |
| 33 | `download_non_ip` | → ⬇️ 下载 |
| 34 | `lan_non_ip` | → DIRECT |
| 35 | `domestic_non_ip` | → DIRECT |
| 36 | `direct_non_ip` | → DIRECT |
| 37 | `geosite-cn` | → DIRECT |
| 38 | `global_non_ip` | → 🌐 国际网络 |
| 39 | `bilibili_ip` | → 📺 哔哩哔哩 |
| 40 | `reject_ip` | REJECT |
| 41 | `cdn_ip` | → 📦 CDN |
| 42 | `stream_us_ip` | → 🇺🇸 北美流媒体 |
| 43 | `stream_eu_ip` | → 🇪🇺 欧洲流媒体 |
| 44 | `stream_jp_ip` | → 🇯🇵 日本流媒体 |
| 45 | `stream_kr_ip` | → 🇰🇷 韩国流媒体 |
| 46 | `stream_hk_ip` | → 🇭🇰 香港流媒体 |
| 47 | `stream_tw_ip` | → 🇹🇼 台湾流媒体 |
| 48 | `stream_ip` | → 🎬 流媒体 |
| 49 | `ai_ip` | → 🤖 AI |
| 50 | `telegram_ip` | → ✈️ Telegram |
| 51 | `apple_services_ip` | → 🍎 Apple |
| 52 | `neteasemusic_ip` | → 🎵 网易云音乐 |
| 53 | `download_ip` | → ⬇️ 下载 |
| 54 | `lan_ip` | → DIRECT |
| 55 | `domestic_ip` | → DIRECT |
| 56 | `china_ip` | → DIRECT |

### 顺序要点

- `198.18.0.0/16` 的 FakeIP 地址段先执行 `resolve`。
- `bilibili_non_ip` 放在广告/拒绝规则之前。
- 广告、追踪、钓鱼等拒绝规则位于业务分流之前。
- 非 IP / 域名类规则整体位于 IP 类规则之前。
- `geosite-cn` 位于 `global_non_ip` 之前，作为国内域名的最后一层 `DIRECT` 兜底。
- IP 规则段从 `bilibili_ip` 开始，最后以 `china_ip → DIRECT` 收尾。

> 更新蓝莓桥配置中的 `route.rules` 顺序时，应同步更新这里的说明，避免 README 与实际配置不一致。
