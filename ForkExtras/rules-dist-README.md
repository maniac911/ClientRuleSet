# maniac911/ClientRuleSet rules-dist

> 此分支由 GitHub Actions 自动生成，请不要直接修改生成的规则文件。源码、构建逻辑和自定义规则位于 `master` 分支。

## 通用规则顺序参考

这份顺序用于 **Surge / Mihomo / sing-box / Stash / Surfboard 等客户端的通用规则编排参考**，不是某一个客户端配置文件的逐行镜像。

核心原则：

1. **所有域名类 / `domainset` / `non_ip` 规则放在所有普通 IP 类规则之前。**
2. 同一业务内，**更具体的规则放在更宽泛的规则之前**，例如地区流媒体在总流媒体规则之前。
3. 拦截、安全、隐私类规则优先于普通业务分流。
4. 国内 / 直连 / 全局兜底类域名规则放在业务分流后部。
5. IP 规则整体置于域名 / non-IP 规则之后；`FINAL` / `MATCH` 放在全部规则最后。
6. 客户端专属前置逻辑（例如 FakeIP 地址段 `resolve`、TUN 特殊规则、进程规则等）**不属于这份通用 rule-set 顺序**，应由各客户端自行放置。

> 本顺序以 SukkaW/Surge 的规则组织原则为基础，并加入本 fork 使用的 Bilibili、Apple Podcasts、Apple TV、`geosite-cn`、扩展下载/IP 规则等自定义项。

### A. 域名 / domainset / non-IP 规则

| # | rule-set | 建议策略 / 用途 |
|---:|---|---|
| 1 | `reject_non_ip_drop` | 拦截 / Drop |
| 2 | `reject_domainset` | 拦截 |
| 3 | `reject_extra_domainset` | 扩展拦截（可选） |
| 4 | `reject_phishing` | 钓鱼 / 欺诈拦截（可选） |
| 5 | `reject_non_ip` | 拦截 |
| 6 | `reject_non_ip_no_drop` | 拦截 / No-Drop |
| 7 | `sogouinput` | 拦截 |
| 8 | `speedtest` | Speedtest 专用策略 |
| 9 | `bilibili_non_ip` | Bilibili 专用策略 |
| 10 | `apple_podcasts` | Apple Podcasts 专用策略 |
| 11 | `apple_tv` | Apple TV 专用策略 |
| 12 | `cdn_domainset` | CDN 策略 |
| 13 | `cdn_non_ip` | CDN 策略 |
| 14 | `stream_us_non_ip` | 北美流媒体 |
| 15 | `stream_eu_non_ip` | 欧洲流媒体 |
| 16 | `stream_jp_non_ip` | 日本流媒体 |
| 17 | `stream_kr_non_ip` | 韩国流媒体 |
| 18 | `stream_hk_non_ip` | 香港流媒体 |
| 19 | `stream_tw_non_ip` | 台湾流媒体 |
| 20 | `stream_non_ip` | 总流媒体规则 |
| 21 | `ai_non_ip` | AI |
| 22 | `apple_intelligence_non_ip` | Apple Intelligence / AI |
| 23 | `telegram_non_ip` | Telegram |
| 24 | `apple_cdn` | Apple 中国 CDN / 通常直连 |
| 25 | `apple_services` | Apple 服务 |
| 26 | `apple_cn_non_ip` | Apple 中国服务 / 通常直连 |
| 27 | `microsoft_cdn_non_ip` | Microsoft 中国 CDN / 通常直连 |
| 28 | `microsoft_non_ip` | Microsoft 服务 |
| 29 | `neteasemusic_non_ip` | 网易云音乐 |
| 30 | `game_download_domainset` | 游戏 / 大文件下载 |
| 31 | `download_domainset` | 下载域名 |
| 32 | `download_non_ip` | 下载 |
| 33 | `lan_non_ip` | 局域网 / DIRECT |
| 34 | `domestic_non_ip` | 国内域名 / DIRECT |
| 35 | `direct_non_ip` | 明确直连域名 |
| 36 | `geosite-cn` | 中国域名最后一层 DIRECT 兜底 |
| 37 | `global_non_ip` | 国际域名 / 代理兜底 |

### B. IP 规则

进入这一段之前，应保证普通域名 / domainset / non-IP 规则已经全部匹配完。

| # | rule-set | 建议策略 / 用途 |
|---:|---|---|
| 38 | `reject_ip` | IP 拦截 |
| 39 | `bilibili_ip` | Bilibili IP |
| 40 | `cdn_ip` | CDN IP |
| 41 | `stream_us_ip` | 北美流媒体 IP |
| 42 | `stream_eu_ip` | 欧洲流媒体 IP |
| 43 | `stream_jp_ip` | 日本流媒体 IP |
| 44 | `stream_kr_ip` | 韩国流媒体 IP |
| 45 | `stream_hk_ip` | 香港流媒体 IP |
| 46 | `stream_tw_ip` | 台湾流媒体 IP |
| 47 | `stream_ip` | 总流媒体 IP |
| 48 | `ai_ip` | AI IP |
| 49 | `telegram_ip` | Telegram IP |
| 50 | `apple_services_ip` | Apple 服务 IP |
| 51 | `neteasemusic_ip` | 网易云音乐 IP |
| 52 | `download_ip` | 下载 IP |
| 53 | `lan_ip` | 局域网 IP / DIRECT |
| 54 | `domestic_ip` | 国内业务 IP / DIRECT |
| 55 | `china_ip` | 中国大陆 IP 最终 DIRECT 兜底 |

### C. 最终兜底

所有 rule-set 之后再放客户端自己的最终规则，例如：

- Surge：`FINAL`
- Mihomo / Clash.Meta：`MATCH`
- sing-box：`route.final`

最终策略通常指向主代理策略组或你自己的默认出口。

## 顺序说明

### 为什么 Reject 放在业务规则前面

广告、追踪、恶意域名和钓鱼规则属于全局安全/隐私层。默认情况下应优先匹配，避免普通业务规则先命中后绕过拦截。

如果你**明确希望某个业务规则覆盖 Reject**，可以单独把该业务的精确例外放在 Reject 前面，但这属于自定义例外，不应作为通用默认顺序。

### 为什么地区流媒体在 `stream_non_ip` / `stream_ip` 前面

`stream_non_ip` 和 `stream_ip` 是更宽泛的总集合。地区规则必须先匹配，否则总集合可能提前命中，导致地区专用策略失效。

### 为什么 Apple Podcasts / Apple TV 放在通用流媒体之前

它们属于更具体的业务分流。放在通用流媒体规则之前，可以避免 Apple Podcasts / Apple TV 被更宽泛的 `stream_*` 规则提前捕获。

### 为什么 `geosite-cn` 放在 `global_non_ip` 前面

`geosite-cn` 用作中国域名的额外兜底，尤其补充 `.com`、`.net` 等并非 `.cn` 后缀的国内域名。因此应位于 `global_non_ip` 之前。

### 客户端专属规则不要混入通用顺序

例如下面这些都不属于通用 rule-set 顺序：

- sing-box FakeIP 地址段 `198.18.0.0/16 → resolve`
- Mihomo Fake-IP 特殊处理
- Surge `pre-matching` / `extended-matching` 参数
- TUN / DNS 劫持相关规则
- PROCESS-NAME / PROCESS-PATH 等进程规则
- 某个客户端独有的协议或 action

这些规则应根据客户端实现放在合适的位置，但不改变上面的通用 rule-set 主干顺序。

> 如果后续新增 rule-set，优先判断它属于“域名 / non-IP”还是“IP”，再按照“安全优先、具体优先、通用兜底靠后”的原则插入对应位置。
