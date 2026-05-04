import type { FlowId } from "./artifacts";

export interface RouteDecision {
  flowId: FlowId;
  reason: string;
}

export interface RouterContext {
  hasDiff: boolean;
}

function containsAny(source: string, patterns: string[]): boolean {
  return patterns.some((pattern) => source.includes(pattern));
}

export function routeTask(task: string, context: RouterContext): RouteDecision {
  const normalizedTask = task.toLowerCase();

  if (containsAny(normalizedTask, ["review", "audit", "security", "güvenlik", "risk", "kontrol"])) {
    return {
      flowId: "dual-review",
      reason: "Task review or audit isteği gibi görünüyor."
    };
  }

  if (containsAny(normalizedTask, ["plan", "mimari", "architecture", "tasarım", "roadmap", "nasıl olmalı"])) {
    return {
      flowId: "dual-plan",
      reason: "Task planning or architecture isteği gibi görünüyor."
    };
  }

  if (context.hasDiff && normalizedTask.trim().length < 80) {
    return {
      flowId: "dual-review",
      reason: "Mevcut diff varken kısa veya belirsiz task review için daha güvenli."
    };
  }

  if (containsAny(normalizedTask, ["fix", "düzelt", "implement", "ekle", "bug", "refactor", "build", "yap"])) {
    return {
      flowId: "claude-impl",
      reason: "Task implementation veya fix isteği gibi görünüyor."
    };
  }

  return {
    flowId: "claude-impl",
    reason: "Default implementer flow seçildi."
  };
}
