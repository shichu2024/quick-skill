export interface SkillSnapshot {
  content: string;    // SKILL.md 完整文本
  hash: string;       // SHA-256 全文哈希（十六进制）
  timestamp: string;  // ISO 8601 时间戳
}
