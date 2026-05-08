export type AgentName = 'claude' | 'opencode' | 'relay';

export const AGENT_DIRECTORY_MAP: Record<AgentName, string> = {
  claude: './claude/skills',
  opencode: './opencode/skills',
  relay: './.relay/skills',
};

export const SUPPORTED_AGENTS: AgentName[] = ['claude', 'opencode', 'relay'];

export function getAgentTargetDir(agent: AgentName): string {
  return AGENT_DIRECTORY_MAP[agent];
}