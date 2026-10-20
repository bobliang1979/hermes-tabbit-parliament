#!/usr/bin/env bash
#
# Pattern A — 议会全流程 / Full Parliament
# ------------------------------------------------------------------
# Runs one complex task through all five models, handing each model the
# previous model's answer. This is a *playbook*: Hermes is still free to
# stop early, reorder, or skip steps when driving the CLI by hand.
#
# Usage:
#   ./examples/parliament.sh "设计一个支持 10 万并发的实时推送系统"
#
# Every stage writes its answer to out/parliament-<timestamp>/NN-model.md
# so you can read the whole debate afterwards.
#
# Requirements: bash, node >= 22, Tabbit running with --remote-debugging-port
# ------------------------------------------------------------------

set -uo pipefail

TASK="${*:-}"
if [ -z "$TASK" ]; then
  echo "用法: $0 \"<你的复杂任务>\"" >&2
  exit 2
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOLS="$HERE/../tools/hermes-tools.js"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="out/parliament-$STAMP"
mkdir -p "$OUT"
CTX=6000 # how much of the previous answer to forward

ask() { # ask <model> <outfile> <prompt>
  local model="$1" outfile="$2" prompt="$3"
  echo "──────── ▶ $model"
  if printf '%s' "$prompt" | node "$TOOLS" ask "$model" --no-save --timeout 300 --stable 3 - >"$outfile"; then
    echo "          ✓ $(wc -c <"$outfile") bytes → $outfile"
  else
    local code=$?
    echo "          ✗ $model 失败 (exit $code) —— 继续下一轮，稍后人工补上" >&2
    return $code
  fi
}

echo "🏛️  议会全流程 / Full Parliament"
echo "   任务: $TASK"
echo "   记录: $OUT"
echo

# Step 1 — 🔍 研究员: 事实与假设
ask grok "$OUT/01-grok.md" \
"你是议会的研究员。任务：$TASK

请给出：
1. 需要核实的关键技术事实（版本、API、已知坑）
2. 我（或他人）对这个任务常见的错误假设，并纠正它们
3. 相关的库 / 论文 / 文档
只输出要点，不要写代码。"

# Step 2 — 💬 工程师: 方案设计（带上 Grok 的发现）
ask qwen "$OUT/02-qwen.md" \
"你是议会的工程师。任务：$TASK

研究员已核实的事实与纠正：
$(head -c $CTX "$OUT/01-grok.md" 2>/dev/null || echo "(无)")

请给出：
1. 架构方案（分层 + 模块职责）
2. 关键技术选型与理由
3. 主要风险点
不要写完整实现，给设计与关键骨架代码即可。"

# Step 3 — 🤝 评审官: 找漏洞
ask arena "$OUT/03-arena.md" \
"你是议会的评审官，任务是挑刺。任务：$TASK

工程师方案：
$(head -c $CTX "$OUT/02-qwen.md" 2>/dev/null || echo "(无)")

请给出：
1. P0/P1 级问题（安全、并发、内存、可用性），按严重度排序
2. 每个问题的具体修复建议
3. 方案缺失的边界情况
直接、具体、不要客套。"

# Step 4 — 🧠 议长: 综合决策
ask gemini "$OUT/04-gemini.md" \
"你是议会的议长，需要做最终架构决策。任务：$TASK

研究员的事实：
$(head -c $((CTX/2)) "$OUT/01-grok.md" 2>/dev/null || echo "(无)")

工程师的方案：
$(head -c $((CTX/2)) "$OUT/02-qwen.md" 2>/dev/null || echo "(无)")

评审官的质疑：
$(head -c $((CTX/2)) "$OUT/03-arena.md" 2>/dev/null || echo "(无)")

请给出：
1. 采纳 / 否决哪些意见，以及理由
2. 最终架构决策（明确、可执行）
3. 分阶段实施路线图
输出决策，不要输出完整代码。"

# Step 5 — ✍️ 书记员: 执笔实现
ask chatglm "$OUT/05-chatglm.md" \
"你是议会的书记员，负责写出最终实现。任务：$TASK

议长的最终决策：
$(head -c $CTX "$OUT/04-gemini.md" 2>/dev/null || echo "(无)")

评审官要求修复的问题：
$(head -c $((CTX/2)) "$OUT/03-arena.md" 2>/dev/null || echo "(无)")

请输出完整、可运行的实现（含必要注释与错误处理），不要省略代码。"

echo
echo "🏁 议会结束 —— 记录目录: $OUT"
echo "   Hermes 的最后一步: 阅读 05-chatglm.md 并亲自验证/修正。"
