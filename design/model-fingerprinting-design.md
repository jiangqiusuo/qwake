# Qwake 模型行为指纹能力设计

**状态：提案**
**范围：Qwake CLI 核心能力优先；官网与博客在核心稳定后调整。**

## 1. 背景与问题

Qwake 最初解决的是 AI 编码工具的本地定时唤醒与可观测性问题。随着 Codex 的五小时额度限制不再是核心约束，Qwake 需要一个仍然符合其 local-first 原则、并能解决真实工作流不确定性的新能力。

模型中转站、聚合服务和推理供应商常以模型名提供服务，但调用方很难确认实际行为是否长期一致。论文 [One Token Is Enough](https://arxiv.org/abs/2607.10252) 表明：模型对简单短问题的回答分布会呈现稳定且有区分度的行为特征。该方法可以为 endpoint 一致性提供低成本统计证据，但不能构成密码学意义的模型身份认证。

本设计将该方法定义为 Qwake 的**模型行为指纹**能力。它是 endpoint 审计与漂移观测工具，不是模型鉴定、反欺诈裁决或额度绕过功能。

## 2. 目标与非目标

### 目标

- 在本地采集 OpenAI-compatible endpoint 的可复现行为指纹。
- 将可信基准与后续审计以稳定、可迁移的数据格式保存。
- 只比较可比的采样条件，并在条件不匹配时拒绝给出强结论。
- 输出可解释的统计结论、逐 cell 差异和审计元数据。
- API key 只从环境变量读取，不进入配置、run、profile 或报告。
- 让 CLI 成为唯一核心；官网、博客、未来 Skill 都调用或解释同一套 CLI 契约。

### 非目标

- 不证明某 endpoint 使用了某组模型权重。
- 不规避供应商限制、访问控制、付费或服务条款。
- 不内置或上传真实 API key，不代管用户的 endpoint。
- V1 不提供云端共享数据库、全局模型排名或自动指控供应商替换模型。
- V1 不追求复刻论文的全部四语言、40-cell 研究设置与 EER。

## 3. 领域模型

术语以仓库根目录的 [CONTEXT.md](../CONTEXT.md) 为准。核心关系如下：

```text
Measurement configuration + Endpoint
        -> Collection run
        -> Reference profile (named, trusted)

Measurement configuration + Target endpoint
        -> Audit run
        -> Comparison(reference profile, audit profile)
        -> Verdict + evidence report
```

### 采样配置

`MeasurementConfiguration` 必须完整记录，并作为比较兼容性的依据：

- `protocolVersion`：probe、规范化和指标规则的版本。
- `preset`、`languages`、有序 `cellIds`：测量了哪些任务。
- `samplesPerCell`、`temperature`、`maxTokens`、`reasoningMode`。
- provider 协议类型；V1 为 `openai-compatible-chat-completions`。
- system prompt 的稳定版本或哈希。

`baseUrl`、请求模型名和响应中的 `rawModel` 是审计元数据，而不是兼容性条件；它们用于复查来源与路由变化。

### 数据实体

| 实体 | 不可变性 | 关键内容 |
| --- | --- | --- |
| `CollectionRun` | 不可变 | 采样配置、endpoint 元数据、每个样本、失败原因、延迟与 usage 摘要 |
| `ReferenceProfile` | 不可变且命名 | 来源 run、信任来源说明、分布、配置摘要、创建时间 |
| `Audit` | 不可变 | target run、reference profile、兼容性检查、比较结果、校准信息 |
| `Comparison` | 可重新计算 | 共享 cell、逐 cell JSD、加权总分、结论、限制说明 |

profile 名称是人类友好的引用，不得覆盖已有 profile；同名重建应生成明确版本，例如 `gpt-4o-official-2026-07-v2`。

## 4. CLI 设计

现有命令是 V0 API。正式能力采用以下稳定命令结构；兼容别名的保留期限在实现时写入 CHANGELOG。

```bash
# 收集一个不可变的 run
qwake fingerprint collect --endpoint <url> --api-key-env <name> --model <model> [measurement options]

# 从可信 run 创建命名基准，并要求说明可信来源
qwake fingerprint reference create --name <name> --from <run.json> --trust-note <text>

# 列出、查看、导出基准
qwake fingerprint reference list
qwake fingerprint reference show <name>

# 采样目标 endpoint，并与基准审计
qwake fingerprint audit --reference <name> --endpoint <url> --api-key-env <name> --model <model> [measurement options]

# 比较两个已有 profile 或 run，默认只输出比较证据
qwake fingerprint compare --left <name-or-path> --right <name-or-path>
```

保留 `--base-url` 作为 `--endpoint` 的兼容别名，避免破坏早期使用者。所有机器可读输出使用 `--json`；人类报告可选择 `--format terminal|markdown|json`。

## 5. 比较与结论规则

### 5.1 先检查可比性

在计算 JSD 前，Qwake 必须检查：

- `protocolVersion`、probe cell、语言和规范化规则一致。
- `temperature`、`maxTokens`、system prompt、reasoning 设置一致。
- 每个候选 cell 均达到最小有效样本数。
- 失败率没有超过阈值，且失败不集中在某个 cell。

不满足时返回 `inconclusive`，附带明确原因；不得将不兼容数据平均成一个距离。

### 5.2 分数与阈值

继续使用 Jensen-Shannon divergence 作为逐 cell 分数。V1 的总分为符合条件 cell 的等权平均，报告中必须列出 cell 数、有效样本数、无效/失败样本数和每个 cell 分数。

现有 `0.18` / `0.32` 阈值只能作为开发期提示，不能在正式文档中称作通用模型识别阈值。正式版本的阈值来源应为：

1. 同一可信 endpoint 的分片或重复采样分布，形成“预期自然波动”。
2. 已知不同 endpoint 的对照分布，形成“可分离差异”。
3. 按 protocol version、preset 与样本数保存的校准数据。

在没有校准数据前，CLI 输出 `observation` 结论并展示距离，而不是输出 `likely_match` 或 `likely_mismatch`。这是将实验工具升级为可信产品能力的必要条件。

## 6. 安全、隐私与成本

- API key 只从环境变量读取；错误文本、URL 和 usage 也需脱敏，避免被报告意外泄露。
- 默认保存规范化答案和必要元数据；原始回答、完整 URL、usage 明细应为显式 opt-in，方便控制本地敏感数据。
- 命令启动前显示预计请求数；默认 `mini` + 单语言 + 15 samples 为 120 次请求。
- 设置全局并发上限、单请求超时、总预算上限与失败比例中止条件，防止异常 endpoint 造成高额消耗。
- 所有 audit 仅测试用户有权访问的 endpoint；文档不得鼓励绕过服务限制或以结果指控供应商。

## 7. 实施阶段

### 阶段 A：让能力成为可靠的 Qwake 一级功能

1. 将 run/profile schema 升级为带 `protocolVersion` 与完整 measurement configuration 的 V2，同时保持 V1 可读取。
2. 把 profile 名称改为不可覆盖的版本化对象，并新增 reference 的信任来源说明。
3. 实现兼容性检查、失败率规则、请求成本预览、并发与总预算限制。
4. 将结论改为“校准前 observation / 校准后 verdict”，并提供清晰报告。
5. 为正常、漂移、不兼容、超时、拒绝、缓存与部分失败添加测试 fixture。

**验收标准**：用户能够在本地可靠地留下可复查证据；不兼容的比较不会产生误导性结论；每次 API 调用的成本与保存内容可预期。

### 阶段 B：校准与可重复性

1. 提供不含密钥的公开 fixture 和基准生成脚本。
2. 建立同 endpoint 重复采样与已知不同 endpoint 的小型校准集。
3. 以数据而非硬编码常数发布 preset 对应的解释阈值。
4. 增加 `qwake fingerprint doctor`，检查 endpoint 协议、单 token 约束和响应可解析性。

**验收标准**：结论阈值能追溯到版本化的校准数据；维护者可重复运行测试和更新基准。

### 阶段 C：工作流与产品层

1. 新增可选的定期 audit 调度与本地历史趋势，不上传原始数据。
2. 提供 HTML/Markdown 报告导出、告警 hook 和团队可分享的脱敏证据包。
3. 发布 `qwake-model-fingerprint` Skill：它只编排 CLI、提示授权与解释结果，不复制检测算法。

**验收标准**：Skill、官网和 CLI 使用同一份命令与术语；用户无需把 key 或原始数据交给外部服务。

## 8. 官网与博客信息架构（阶段 A 后实施）

当前问题：`/blog/` 没有 Astro 路由；首页导航的 Blog 链接仍直接指向旧的跨平台教程。因此访问 `/blog/` 会 404，且多篇文章出现后没有统一发现入口。

目标结构：

```text
/blog/                                      English blog index
/zh-CN/blog/                                Chinese blog index
/blog/use-qwake-on-macos-windows-linux/     Wake scheduling guide
/blog/model-behavioral-fingerprinting/      Research note
/blog/test-model-relay-with-qwake/          Relay audit tutorial
```

首页导航改为指向语言对应的 `/blog/`。博客索引页按“额度窗口唤醒”和“模型行为指纹”分组，展示标题、摘要、发布日期、语言对照链接。教程内容应引用已实现的正式 CLI；在阶段 A 完成前，页面仅将当前功能标为实验性，并避免展示尚未稳定的命令名。

## 9. 开源与商业化边界

建议保持 CLI 核心、协议、fixture、Skill 和基础本地报告开源。这样做有三点价值：外部可复现、结论更可信、社区可以贡献 endpoint 适配和语言规范化。

不建议一开始开放“公共参考指纹库”的直接上传：它会遇到模型版本、来源可信度、许可证、供应商争议和数据投毒问题。更好的顺序是先发布可复现 protocol 与匿名 fixture；在校准机制成熟后，再考虑经过审核、带来源证明的可选 reference catalog。

未来收费应围绕团队与持续运营，而非锁住单机检测：计划审计、历史漂移、团队基准管理、可审计报告、webhook、私有部署和企业支持。基础检测保持可本地执行，是该产品最重要的信任资产。

## 10. 未决问题

- 是否将默认语言从 `en` 改为根据系统 locale 选择，还是始终明确要求 `--languages`？
- 是否允许将 raw response 保存为默认值；这有利于复查但提高本地敏感信息风险。
- 首个校准集应只使用公开可访问模型，还是允许维护者保存经授权的商业 endpoint 统计数据？
- Skill 的首个目标平台是 Codex、Claude Code，还是采用两者都能读取的通用 Markdown 工作流？
