/**
 * 个人备份使用，该脚本适用与Mihomo Party和 Clash Verge Rev
 * Clash Verge Rev 全局扩展脚本（懒人配置）/ Mihomo Party 覆写脚本
 * URL: https://github.com/wanswu/my-backup
 *
 * --- 修改版说明 ---
 * @modifier Gemini
 * @version 2.3
 * @date 2026.10.19
 *
 * 主要变更:
 * 1. 将大部分公用服务规则从 RULE-SET 切换到 GEOSITE，以利用内核内置规则，提高效率。
 * 2. 保留 MyDirect、MyProxy 和 gfw 作为 RULE-SET，用于自定义和补充。
 * 3. 添加了完整的中文注释，便于理解和后续维护。
 *
 * --- 2.1 修改 ---
 * 4. 移除「🎞️ Emby」策略组，同时删除其 rule-provider 与对应规则（Emby 流量回归常规分流）。
 * 5. 新增「🧠 Claude」策略组，并加入 GEOSITE,anthropic 及 claude.ai / anthropic.com 分流规则。
 * 6. 将 🔍 Google、▶️ YouTube、🤖 OpenAI 三个策略组前置到「🐟 漏网之鱼」之后，便于切换。
 *
 * --- 2.2 修改 ---
 * 7.  [功能] 固定 mode="rule"：防止原始订阅处于 global 模式导致全部流量走代理。
 * 8.  [功能] 显式 find-process-mode="strict"：保证 PROCESS-NAME 规则不被静默失效。
 * 9.  [功能] fake-ip-filter 补全 NTP / STUN / P2P 条目，避免时间同步与游戏联机 NAT 打洞异常。
 * 10. [功能] proxy-providers 增加 health-check 节点健康检查；订阅 URL 仍为占位，务必替换为真实地址。
 * 11. [安全] 局域网共享时强制 authentication 认证。
 * 12. [清理] 删除无意义的 GEOIP 分流（twitter/facebook/google/netflix/private）。
 *     真实理由：fake-ip 模式下带 no-resolve 时目标是假 IP，域名流量命中不到；
 *     这些服务的域名分流已由上方 GEOSITE 覆盖。
 *     （注：telegram / twitter / netflix 等是社区 geoip 数据集中的「合法服务代码」，
 *       并非非法国家码；误删 telegram 的代价见 2.3 第 15 条。）
 * 13. [顺序] 本地/私有 IP 直连规则提前到 MyProxy 之前，避免内网域名被 MyProxy 送上代理。
 * 14. [补充] 本地 IPv6 直连补 ULA fc00::/7 与组播 ff00::/8。
 *
 * --- 2.3 修改（评审复核后的修正）---
 * 15. [修正] 加回 "GEOIP,telegram,💬 即时通讯,no-resolve"：Telegram 客户端会直连 DC 的裸 IP，
 *     没有域名可匹配 GEOSITE，删掉后会落到兜底直连导致连不上。此条正是 no-resolve 的正确用法。
 * 16. [安全] DNS 监听收紧为 127.0.0.1:53：mihomo 的 authentication 只覆盖代理端口，
 *     不保护 DNS 服务，原先 0.0.0.0:53 等于向同网段开放解析器。局域网需要共享 DNS 时按注释改回。
 * 17. [修正] authentication 密码改为纯 ASCII 占位符：Basic 认证对非 ASCII 支持差，中文密码易翻车。
 * 18. [注释] 修正 googlefcm 的顺序说明：两条规则目标组相同（都是 🔍 Google），顺序不影响结果。
 */
// =============================== 1. 订阅配置 ===============================
// 多订阅合并，这里添加额外的地址
const proxyProviders = {
  "p1": {
    "type": "http",
    // 订阅链接（占位，务必替换为真实订阅地址）
    "url": "https://baidu.com",
    // 自动更新时间 86400(秒) / 3600 = 24小时
    "interval": 86400,
    // 节点健康检查：定期探测，失效节点自动隔离，避免 AUTO / url-test 选中死节点
    "health-check": {
      "enable": true,
      "url": "https://www.gstatic.com/generate_204",
      "interval": 300
    },
    "override": {
      // 节点名称前缀 p1，用于区别不同机场的节点
      "additional-prefix": "p1 |"
    }
  },
  "p2": {
    "type": "http",
    // 订阅链接（占位，务必替换为真实订阅地址）
    "url": "https://google.com",
    "interval": 86400,
    "health-check": {
      "enable": true,
      "url": "https://www.gstatic.com/generate_204",
      "interval": 300
    },
    "override": {
      "additional-prefix": "p2 |"
    }
  },
}
// =============================== 2. 主入口函数 ===============================
// 程序入口，用于合并和覆写配置
const main = (config) => {
  // 检查原始配置中是否存在代理节点，如果没有则抛出错误
  const proxyCount = config?.proxies?.length ?? 0;
  const originalProviders = config?.["proxy-providers"] || {};
  const proxyProviderCount = typeof originalProviders === "object" ? Object.keys(originalProviders).length : 0;
  if (proxyCount === 0 && proxyProviderCount === 0) {
    throw new Error("配置文件中未找到任何代理");
  }
  // --- 配置合并与覆写 ---
  // 合并而非覆盖 proxy-providers
  config["proxy-providers"] = {
    ...originalProviders,  // 保留原有配置
    ...proxyProviders       // 合并新配置（同名则覆盖）
  };
  // 覆写原配置中DNS配置
  config["dns"] = dnsConfig;
  // 覆写原配置中的代理组
  config["proxy-groups"] = proxyGroupConfig;
  // 覆写原配置中的规则提供者 (rule-providers)
  config["rule-providers"] = ruleProviders;
  // 覆写原配置中的规则 (rules)
  config["rules"] = rules;
  //覆写通用配置
  config["mode"] = "rule"; // 固定为规则分流模式，防止原始订阅处于 global 使全部流量走代理
  config["find-process-mode"] = "strict"; // 保证 PROCESS-NAME 规则可用（基础配置若设 off 会静默失效）
  config["mixed-port"] = 7890;
  config["allow-lan"] = true;
  config["bind-address"] = "0.0.0.0"; // 允许局域网连接
  config["ipv6"] = true;
  config["unified-delay"] = true; // 显示统一的延迟信息
  // --- 安全：局域网共享必须认证 ---
  // 开启 allow-lan + 0.0.0.0 会把本机代理端口暴露给同网段所有设备。
  // 公司网络 / 公共 Wi-Fi 下等于对外提供开放代理，务必设置认证账号密码（格式 "用户名:密码"）。
  // 密码请改成纯 ASCII 的强密码：Basic 认证对非 ASCII 字符支持差，中文密码易导致客户端认证失败。
  // 若仅本机使用：把 bind-address 改为 "127.0.0.1"，并可去掉下面这行。
  config["authentication"] = ["admin:CHANGE_ME_STRONG_PASSWORD"];
  // 返回修改后的配置
  return config;
}
// =============================== 3. DNS 配置 ===============================
const dnsConfig = {
  "enable": true,
  "ipv6": true,
  // 仅监听本机：mihomo 的 authentication 不覆盖 DNS 服务，
  // 监听 0.0.0.0:53 等于向同网段开放一个无认证解析器（可被白嫖 / 用作放大攻击）。
  // 局域网内确实需要共享 DNS 时，再改回 "0.0.0.0:53"。
  "listen": "127.0.0.1:53",
  "prefer-h3": false,
  "respect-rules": true,
  "enhanced-mode": "fake-ip", // 使用 Fake-IP 模式
  "fake-ip-range": "198.18.0.1/16", // Fake-IP 的 IP 段
  "fake-ip-filter": [
    // 本地主机/设备
    "+.lan",
    "+.local",
    // Windows网络出现小地球图标（网络连接状态指示）
    "+.msftconnecttest.com",
    "+.msftncsi.com",
    // QQ快速登录检测失败
    "localhost.ptlogin2.qq.com",
    "localhost.sec.qq.com",
    // 微信快速登录检测失败
    "localhost.work.weixin.qq.com",
    // NTP 时间同步（fake-ip 会导致校时失败 / 证书时间异常）
    "time.*.com",
    "ntp.*.com",
    "+.time.windows.com",
    "+.pool.ntp.org",
    "time.*.apple.com",
    // STUN / P2P（WebRTC、游戏联机 NAT 打洞，fake-ip 会导致打洞异常）
    "+.stun.*.*",
    "+.stun.*.*.*",
    "+.stun.*.*.*.*",
    "+.stun.*.*.*.*.*",
    "srv.nintendo.net",
    "+.n.n.srv.nintendo.net",
    "+.stun.playstation.net",
    "xbox.*.*.microsoft.com",
    "+.xboxlive.com"
  ],
  "use-hosts": false,
  "use-system-hosts": false,
  "nameserver": ["https://1.1.1.1/dns-query", "https://dns.google/dns-query"], // 默认的域名解析服务器 (DoH)
  "default-nameserver": ["tls://223.5.5.5", "tls://119.29.29.29"],  // 默认DNS (DoT)，用于解析上面的 nameserver 的域名
  "proxy-server-nameserver": ['https://doh.pub/dns-query'], // 代理请求使用的DNS
  "direct-nameserver": ['https://doh.pub/dns-query', 'https://dns.alidns.com/dns-query'],   // 直连请求使用的DNS
};
// =============================== 4. 代理组配置 ===============================
// 代理组通用配置
const groupBaseOption = {
  "interval": 300, // 自动测速间隔
  "timeout": 3000, // 测速超时时间 (ms)
  "url": "https://www.gstatic.com/generate_204", // 测速链接
  "max-failed-times": 3, // 最大失败次数
  "hidden": false // 不隐藏
};
// 代理组规则（已为每个组名添加Emoji）
// 统一代理名称列表
const mainProxyList = ["🌍 Proxy", "🎯 DIRECT", "🚫 REJECT", "🇭🇰 香港总汇", "🇹🇼 台湾总汇", "🇯🇵 日本总汇", "🇰🇷 韩国总汇", "🇺🇸 美国总汇", "🇩🇪 德国总汇", "🇸🇬 新加坡总汇", "🇫🇷 法国总汇", "🇬🇧 英国总汇", "🌐 其他总汇"];
const directProxyList = ["🎯 DIRECT", "🌍 Proxy", "🚫 REJECT", "🇭🇰 香港总汇", "🇹🇼 台湾总汇", "🇯🇵 日本总汇", "🇰🇷 韩国总汇", "🇺🇸 美国总汇", "🇩🇪 德国总汇", "🇸🇬 新加坡总汇", "🇫🇷 法国总汇", "🇬🇧 英国总汇", "🌐 其他总汇"];
const defaultExcludeFilter = "(?i)GB|Traffic|Expire|Premium|频道|订阅|ISP|流量|到期|重置|限速|限量|限时|限流|限额|限制|永久|免费";
const proxyGroupConfig = [
  // --- 核心策略组 ---
  {
    ...groupBaseOption,
    "name": "🌍 Proxy",
    "type": "select",
    "proxies": ["🔄 AUTO", "🎯 DIRECT", "🚫 REJECT", "🇭🇰 香港总汇", "🇹🇼 台湾总汇", "🇯🇵 日本总汇", "🇰🇷 韩国总汇", "🇺🇸 美国总汇", "🇩🇪 德国总汇", "🇸🇬 新加坡总汇", "🇫🇷 法国总汇", "🇬🇧 英国总汇", "🌐 其他总汇"],
    "include-all": true,
  },
  {
    ...groupBaseOption,
    "name": "🔄 AUTO",
    "type": "url-test", // 自动选择延迟最低的节点
    "include-all": true,
    "tolerance": 50, // 延迟容差
    "exclude-filter": defaultExcludeFilter,
  },
  // --- 分流策略组 ---
  {
    ...groupBaseOption,
    "name": "🐟 漏网之鱼",
    "type": "select",
    "proxies": directProxyList,
    "include-all": true,
    "exclude-filter": defaultExcludeFilter,
  },
  // --- 三大主力策略组（前置，便于切换）---
  {
    ...groupBaseOption,
    "name": "🔍 Google",
    "type": "select",
    "proxies": mainProxyList,
    "include-all": true,
    "exclude-filter": defaultExcludeFilter,
  },
  {
    ...groupBaseOption,
    "name": "▶️ YouTube",
    "type": "select",
    "proxies": mainProxyList,
    "include-all": true,
    "exclude-filter": defaultExcludeFilter,
  },
  {
    ...groupBaseOption,
    "name": "🤖 OpenAI",
    "type": "select",
    "proxies": mainProxyList,
    "include-all": true,
    "exclude-filter": defaultExcludeFilter,
  },
  // --- Claude 策略组 ---
  {
    ...groupBaseOption,
    "name": "🧠 Claude",
    "type": "select",
    "proxies": mainProxyList,
    "include-all": true,
    "exclude-filter": defaultExcludeFilter,
  },
  {
    ...groupBaseOption,
    "name": "🍎 Apple",
    "type": "select",
    "proxies": directProxyList,
    "include-all": true,
    "exclude-filter": defaultExcludeFilter,
  },
  {
    ...groupBaseOption,
    "name": "💬 即时通讯",
    "type": "select",
    "proxies": mainProxyList,
    "include-all": true,
    "exclude-filter": defaultExcludeFilter,
  },
  {
    ...groupBaseOption,
    "name": "📺 BiliBili",
    "type": "select",
    "proxies": directProxyList,
    "include-all": true,
    "exclude-filter": defaultExcludeFilter,
  },
  {
    ...groupBaseOption,
    "name": "🎵 TikTok",
    "type": "select",
    "proxies": mainProxyList,
    "include-all": true,
    "exclude-filter": defaultExcludeFilter,
  },
  {
    ...groupBaseOption,
    "name": "🎧 Spotify",
    "type": "select",
    "proxies": mainProxyList,
    "include-all": true,
    "exclude-filter": defaultExcludeFilter,
  },
  {
    ...groupBaseOption,
    "name": "🎬 Netflix",
    "type": "select",
    "proxies": mainProxyList,
    "include-all": true,
    "exclude-filter": defaultExcludeFilter,
  },
  {
    ...groupBaseOption,
    "name": "🏰 Disney",
    "type": "select",
    "proxies": mainProxyList,
    "include-all": true,
    "exclude-filter": defaultExcludeFilter,
  },
  {
    ...groupBaseOption,
    "name": "☁️ OneDrive",
    "type": "select",
    "proxies": directProxyList,
    "include-all": true,
    "exclude-filter": defaultExcludeFilter,
  },
  {
    ...groupBaseOption,
    "name": "🪟 Microsoft",
    "type": "select",
    "proxies": directProxyList,
    "include-all": true,
    "exclude-filter": defaultExcludeFilter,
  },
  {
    ...groupBaseOption,
    "name": "🐦 Twitter",
    "type": "select",
    "proxies": mainProxyList,
    "include-all": true,
    "exclude-filter": defaultExcludeFilter,
  },
  {
    ...groupBaseOption,
    "name": "🎮 Steam",
    "type": "select",
    "proxies": directProxyList,
    "include-all": true,
    "exclude-filter": defaultExcludeFilter,
  },
  {
    ...groupBaseOption,
    "name": "🐱 Github",
    "type": "select",
    "proxies": mainProxyList,
    "include-all": true,
    "exclude-filter": defaultExcludeFilter,
  },
  {
    ...groupBaseOption,
    "name": "🌐 社交媒体",
    "type": "select",
    "proxies": mainProxyList,
    "include-all": true,
    "exclude-filter": defaultExcludeFilter,
  },
  {
    ...groupBaseOption,
    "name": "📺 Bahamut",
    "type": "select",
    "proxies": mainProxyList,
    "include-all": true,
    "exclude-filter": defaultExcludeFilter,
  },
  {
    ...groupBaseOption,
    "name": "🎮 游戏平台",
    "type": "select",
    "proxies": mainProxyList,
    "include-all": true,
    "exclude-filter": defaultExcludeFilter,
  },
  {
    ...groupBaseOption,
    "name": "🌎 国外媒体",
    "type": "select",
    "proxies": mainProxyList,
    "include-all": true,
    "exclude-filter": defaultExcludeFilter,
  },
  {
    ...groupBaseOption,
    "name": "🛒 国外电商",
    "type": "select",
    "proxies": mainProxyList,
    "include-all": true,
    "exclude-filter": defaultExcludeFilter,
  },
  // --- 地区 url-test 组 ---
  {
    ...groupBaseOption,
    "name": "🇭🇰 香港总汇",
    "type": "url-test",
    "include-all": true,
    "filter": "🇭🇰|香港|港|HK|hongkong|hong kong", // 节点名称过滤器
    "tolerance": 50,
  },
  {
    ...groupBaseOption,
    "name": "🇹🇼 台湾总汇",
    "type": "url-test",
    "include-all": true,
    "filter": "🇹🇼|台湾|台|TW|taiwan|taipei",
    "tolerance": 50,
  },
  {
    ...groupBaseOption,
    "name": "🇯🇵 日本总汇",
    "type": "url-test",
    "include-all": true,
    "filter": "🇯🇵|日本|JP|japan|tokyo|osaka",
    "tolerance": 50,
  },
  {
    ...groupBaseOption,
    "name": "🇰🇷 韩国总汇",
    "type": "url-test",
    "include-all": true,
    "filter": "🇰🇷|韩国|韩|KR|korea|seoul",
    "tolerance": 50,
  },
  {
    ...groupBaseOption,
    "name": "🇺🇸 美国总汇",
    "type": "url-test",
    "include-all": true,
    "filter": "🇺🇸|美国|美|US|united states|america|los angeles|san jose|silicon valley",
    "tolerance": 50,
  },
  {
    ...groupBaseOption,
    "name": "🇩🇪 德国总汇",
    "type": "url-test",
    "include-all": true,
    "filter": "🇩🇪|德国|德|DE|germany|frankfurt",
    "tolerance": 50,
  },
  {
    ...groupBaseOption,
    "name": "🇸🇬 新加坡总汇",
    "type": "url-test",
    "include-all": true,
    "filter": "🇸🇬|新加坡|新|SG|singapore",
    "tolerance": 50,
  },
  {
    ...groupBaseOption,
    "name": "🇫🇷 法国总汇",
    "type": "url-test",
    "include-all": true,
    "filter": "🇫🇷|法国|法|FR|france|paris",
    "tolerance": 50,
  },
  {
    ...groupBaseOption,
    "name": "🇬🇧 英国总汇",
    "type": "url-test",
    "include-all": true,
    "filter": "🇬🇧|英国|英|UK|united kingdom|london",
    "tolerance": 50,
  },
  {
    ...groupBaseOption,
    "name": "🌐 其他总汇",
    "type": "url-test",
    "include-all": true,
    "filter": "(?i)^(?!.*(🇭🇰|🇹🇼|🇯🇵|🇰🇷|🇸🇬|🇺🇸|🇬🇧|🇩🇪|🇫🇷|香港|台湾|日本|韩国|新加坡|美国|英国|德国|法国|港|台|日|韩|新|美|英|德|法|hk|tw|jp|kr|sg|us|uk|de|fr|hongkong|hong kong|taiwan|taipei|japan|tokyo|osaka|kyoto|korea|seoul|busan|singapore|united states|america|new york|los angeles|san jose|silicon valley|united kingdom|london|manchester|germany|frankfurt|berlin|france|paris)).*",
    "tolerance": 50,
  },
  // --- 基础策略组 ---
  {
    ...groupBaseOption,
    "name": "🎯 DIRECT",
    "type": "select",
    "proxies": ["DIRECT"]
  },
  {
    ...groupBaseOption,
    "name": "🚫 REJECT",
    "type": "select",
    "proxies": ["REJECT"]
  },
];
// =============================== 5. Rule-Provider 配置 (已修改) ===============================
// ---!!! 修改说明 !!!---
// 此处定义需要从网络动态更新的规则集。
// 原版中，所有分流规则（如Apple, Google等）都依赖于此处的定义。
// 新版已将这些公共服务规则的匹配方式改为 GEOSITE (见下方 rules 部分)。
// GEOSITE 是内核内置的域名列表，无需从网络下载，因此效率更高、更稳定。
// 我们仅在此处保留 GEOSITE 无法替代的、需要自定义或补充的规则集。
// 规则集通用配置
const ruleProviderCommon = {
  "type": "http",
  "format": "yaml",
  "interval": 86400, // 每天更新一次
  "proxy": "🌍 Proxy" // 指定用于更新规则集的代理，防止更新失败
};
// 规则集配置
const ruleProviders = {
  // 私有直连规则，用于定义必须直连的域名
  "MyDirect": {
    ...ruleProviderCommon,
    "behavior": "classical", // 行为：传统规则 (domain, ip-cidr etc.)
    "url": "https://raw.githubusercontent.com/shineben/MyClash/refs/heads/main/MyDirect.yaml",
    "path": "./ruleset/MyDirect.yaml"
  },
  // 私有代理规则，用于定义必须走代理的域名
  "MyProxy": {
    ...ruleProviderCommon,
    "behavior": "classical",
    "url": "https://raw.githubusercontent.com/shineben/MyClash/refs/heads/main/MyProxy.yaml",
    "path": "./ruleset/MyProxy.yaml"
  },
  // 修复：重新加入 gfw 规则集作为 GEOSITE,gfw 的补充
  "gfw-rule-set": {
    ...ruleProviderCommon,
    "behavior": "domain",
    "url": "https://fastly.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/gfw.txt",
    "path": "./ruleset/gfw.yaml"
  },
};
// =============================== 6. 规则 (Rules) 配置 (已修改) ===============================
// ---!!! 修改说明 !!!---
// 规则按从上到下的顺序进行匹配，一旦匹配成功，请求将按该规则处理，后续规则将被忽略。
// 1. **高优先级规则**: 首先处理私有IP、局域网和自定义规则，确保它们总是最先被匹配。
// 2. **GEOSITE 规则**: 接着使用高效的内置 GEOSITE 规则对各大主流网站进行分流。
// 3. **GEOIP 规则**: 只用于「目标本身就是裸 IP」的连接分流（域名流量命中不到，见下方说明）。
// 4. **补充规则**: 使用 gfw 和其他自定义 RULE-SET 作为补充。
// 5. **兜底规则**: 所有未匹配到的流量，都将交由“漏网之鱼”处理。
const rules = [
  // --- 1. 本地/私有IP直连（提前到 MyProxy 之前，避免内网域名被送上代理）---
  "IP-CIDR,192.168.0.0/16,🎯 DIRECT,no-resolve",
  "IP-CIDR,10.0.0.0/8,🎯 DIRECT,no-resolve",
  "IP-CIDR,172.16.0.0/12,🎯 DIRECT,no-resolve",
  "IP-CIDR,127.0.0.0/8,🎯 DIRECT,no-resolve",
  "IP-CIDR,100.64.0.0/10,🎯 DIRECT,no-resolve",
  "IP-CIDR,224.0.0.0/4,🎯 DIRECT,no-resolve",
  "IP-CIDR,fe80::/10,🎯 DIRECT,no-resolve",
  "IP-CIDR,::1/128,🎯 DIRECT,no-resolve",
  "IP-CIDR,fc00::/7,🎯 DIRECT,no-resolve",   // 新增：IPv6 ULA 唯一本地地址
  "IP-CIDR,ff00::/8,🎯 DIRECT,no-resolve",   // 新增：IPv6 组播
  "GEOSITE,private,🎯 DIRECT",
  // --- 2. 私有/自定义高优先级规则 ---
  "PROCESS-NAME,Antigravity.exe,🇺🇸 美国总汇",
  "RULE-SET,MyDirect,🎯 DIRECT",
  //"DOMAIN-SUFFIX,linux.do,🇸🇬 新加坡总汇",
  "RULE-SET,MyProxy,🌍 Proxy",
  // --- 3. 中国常用服务直连 ---
  "GEOSITE,google-cn,🎯 DIRECT",
  "GEOSITE,category-games@cn,🎯 DIRECT",
  "GEOSITE,category-game-platforms-download,🎯 DIRECT",
  "GEOSITE,category-public-tracker,🎯 DIRECT",
  // --- 4. GEOSITE 分类分流（优先级高，规则小）---
  "GEOSITE,category-communication,💬 即时通讯",
  "GEOSITE,category-social-media-!cn,🌐 社交媒体",
  "GEOSITE,apple,🍎 Apple",
  "GEOSITE,github,🐱 Github",
  "GEOSITE,docker,🌍 Proxy", // 新增：Docker 国际流量走代理
  "GEOSITE,youtube,▶️ YouTube",
  "GEOSITE,google,🔍 Google",
  "GEOSITE,googlefcm,🔍 Google", // 与上一条目标组相同（都是 🔍 Google），顺序不影响结果；保留以备 FCM 域名独立维护
  "GEOSITE,bilibili,📺 BiliBili",
  "DOMAIN-KEYWORD,copilot,🤖 OpenAI",
  "GEOSITE,openai,🤖 OpenAI",
  "GEOSITE,anthropic,🧠 Claude",
  "DOMAIN-SUFFIX,claude.ai,🧠 Claude",
  "DOMAIN-SUFFIX,anthropic.com,🧠 Claude",
  "GEOSITE,tiktok,🎵 TikTok",
  "GEOSITE,spotify,🎧 Spotify",
  "GEOSITE,bahamut,📺 Bahamut",
  "GEOSITE,netflix,🎬 Netflix",
  "GEOSITE,disney,🏰 Disney",
  "GEOSITE,onedrive,☁️ OneDrive",
  "GEOSITE,microsoft,🪟 Microsoft",
  "GEOSITE,twitter,🐦 Twitter",
  "GEOSITE,steam,🎮 Steam",
  "GEOSITE,category-games,🎮 游戏平台",
  "GEOSITE,category-entertainment,🌎 国外媒体",
  "GEOSITE,category-ecommerce,🛒 国外电商",
  // --- 5. 境外流量补充规则 ---
  "GEOSITE,gfw,🌍 Proxy",
  "RULE-SET,gfw-rule-set,🌍 Proxy",
  // --- 6. 中国大陆IP直连 + 裸 IP 兜底 ---
  // 原 twitter/facebook/google/netflix/private 等 GEOIP 规则已删除：fake-ip 模式下带 no-resolve 时，
  // 域名流量的目标 IP 是假 IP（198.18.0.0/16），GEOIP 命中不到；这些域名已由上方 GEOSITE 覆盖。
  // （这些代码是社区 geoip 数据集里的合法服务代码，不是非法国家码。）
  // 但 telegram 必须保留：Telegram 客户端会直连 DC 的裸 IP，没有域名可匹配 GEOSITE，
  // 删掉后会落到 "MATCH,🐟 漏网之鱼" 被直连，导致无法连接。
  "GEOIP,telegram,💬 即时通讯,no-resolve",
  "GEOSITE,cn,🎯 DIRECT",
  "GEOIP,CN,🎯 DIRECT,no-resolve",
  // --- 7. 兜底规则 ---
  "MATCH,🐟 漏网之鱼"
];
