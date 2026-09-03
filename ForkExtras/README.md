# maniac911/Surge — Fork 扩展说明

本 Fork 保持 `SukkaW/Surge` 的规则源与构建代码不变，以便继续使用 GitHub 的 **Sync fork** 跟随上游。

额外增加 `.github/workflows/fork-binary-rules.yml`，每天两次从 Sukka 官方已生成规则获取输入，并将二进制规则发布到本仓库独立的 `rules-dist` 分支。

## 为什么不把 Sukka 全部官方文本产物复制到本仓库

Sukka 官方生成仓库体积很大，并且已经提供稳定的 Ruleset Server / mirror。重复提交 `List/`、`Clash/`、`LegacyClashPremium/`、`Surfboard/`、`sing-box/*.json` 会显著增大 Fork、增加同步冲突，却不会改善规则内容。

因此：

- Surge / Stash / Surfboard / Clash Premium / Mihomo classical：继续使用 Sukka 官方发布格式。
- Mihomo 的 `domain` / `ipcidr`：可优先使用本 Fork 自动生成的 MRS。
- sing-box：可优先使用本 Fork 自动生成的 SRS。

## Binary branch

分支：`rules-dist`

Raw URL 基础地址：

```text
https://raw.githubusercontent.com/maniac911/Surge/rules-dist/
```

### sing-box SRS

目录：

```text
SRS/domainset/
SRS/non_ip/
SRS/ip/
```

示例：

```text
https://raw.githubusercontent.com/maniac911/Surge/rules-dist/SRS/non_ip/ai.srs
https://raw.githubusercontent.com/maniac911/Surge/rules-dist/SRS/non_ip/global.srs
https://raw.githubusercontent.com/maniac911/Surge/rules-dist/SRS/ip/china_ip.srs
```

sing-box 1.14 批量 tag 示例：

```json
{
  "type": "remote",
  "tag": ["ai", "telegram", "global"],
  "format": "binary",
  "url": "https://raw.githubusercontent.com/maniac911/Surge/rules-dist/SRS/non_ip/{tag}.srs",
  "update_interval": "12h"
}
```

注意：Sukka 的 `domainset`、`non_ip`、`ip` 是不同语义类别，不要为了减少配置行数把三类混为一组。

### Mihomo MRS

Domain MRS：

```text
https://raw.githubusercontent.com/maniac911/Surge/rules-dist/MRS/domainset/cdn.mrs
https://raw.githubusercontent.com/maniac911/Surge/rules-dist/MRS/domainset/speedtest.mrs
https://raw.githubusercontent.com/maniac911/Surge/rules-dist/MRS/domainset/reject.mrs
```

示例：

```yaml
rule-providers:
  cdn_domainset:
    type: http
    behavior: domain
    format: mrs
    url: https://raw.githubusercontent.com/maniac911/Surge/rules-dist/MRS/domainset/cdn.mrs
    path: ./ruleset/cdn.mrs
    interval: 43200
```

China IP MRS：

```text
https://raw.githubusercontent.com/maniac911/Surge/rules-dist/MRS/ipcidr/china_ip.mrs
https://raw.githubusercontent.com/maniac911/Surge/rules-dist/MRS/ipcidr/china_ip_ipv6.mrs
```

```yaml
rule-providers:
  china_ip:
    type: http
    behavior: ipcidr
    format: mrs
    url: https://raw.githubusercontent.com/maniac911/Surge/rules-dist/MRS/ipcidr/china_ip.mrs
    path: ./ruleset/china_ip.mrs
    interval: 43200
```

## 为什么不是所有 Mihomo 规则都生成 MRS

Mihomo MRS 只适用于 `behavior: domain` 和 `behavior: ipcidr`。

Sukka 的很多 `Clash/non_ip/*.txt` 与 `Clash/ip/*.txt` 属于 `behavior: classical`，里面可能混合 `DOMAIN`、`IP-CIDR`、端口等不同类型规则，不能安全转换成 MRS。因此这些规则继续使用 Sukka 官方 classical text 是正确做法。

## Surge / Mihomo / sing-box 的顺序

保持 Sukka 的核心顺序：

```text
domainset
  ↓
non_ip
  ↓
ip
  ↓
FINAL / MATCH
```

不要把 IP rule-set 放到 domain/non_ip 之前，否则可能提前触发 DNS 解析，削弱 Sukka 原本避免 DNS 污染的设计。

## 自动更新

`Fork Binary Rules` 每天 UTC 06:47 与 18:47 运行，即在 Sukka 官方常规构建之后更新。

流程：

```text
Sukka official generated rules
        ↓
compile SRS + safe MRS
        ↓
rules-dist branch
        ↓
sing-box / Mihomo remote rule-set auto update
```

上游自带的 `Build` 与 `Toggle Dist Repo Visibility` 会在 Fork Binary Rules 运行时被禁用，因为它们是为 Sukka 自己的 GitLab / Cloudflare / `SukkaLab/ruleset.skk.moe` 部署设计的，依赖上游私有 Secrets，不适用于本 Fork。
