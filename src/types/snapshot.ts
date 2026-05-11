export interface SkillSnapshot {
  content: string;    // SKILL.md 完整文本
  hash: string;       // SHA-256 全文哈希（十六进制）
  timestamp: string;  // ISO 8601 时间戳
  /** 系统生成用例的内容哈希映射（T-004 冲突检测用），key 为用例 id */
  caseHashes?: Record<string, string>;
}
