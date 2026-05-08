import { describe, it, expect } from 'vitest';
import type { AgentName } from '../../src/constants/agents.js';
import { AGENT_DIRECTORY_MAP, SUPPORTED_AGENTS, getAgentTargetDir } from '../../src/constants/agents.js';

describe('agent directory mapping', () => {
  it('should define correct AgentName type', () => {
    const claude: AgentName = 'claude';
    const opencode: AgentName = 'opencode';
    const relay: AgentName = 'relay';
    
    expect(['claude', 'opencode', 'relay']).toContain(claude);
    expect(['claude', 'opencode', 'relay']).toContain(opencode);
    expect(['claude', 'opencode', 'relay']).toContain(relay);
  });

  it('should have correct AGENT_DIRECTORY_MAP entries', () => {
    expect(AGENT_DIRECTORY_MAP.claude).toBe('./claude/skills');
    expect(AGENT_DIRECTORY_MAP.opencode).toBe('./opencode/skills');
    expect(AGENT_DIRECTORY_MAP.relay).toBe('./.relay/skills');
  });

  it('should have all supported agents in SUPPORTED_AGENTS', () => {
    expect(SUPPORTED_AGENTS).toHaveLength(3);
    expect(SUPPORTED_AGENTS).toContain('claude');
    expect(SUPPORTED_AGENTS).toContain('opencode');
    expect(SUPPORTED_AGENTS).toContain('relay');
  });

  it('should return correct directory for each agent via getAgentTargetDir', () => {
    expect(getAgentTargetDir('claude')).toBe('./claude/skills');
    expect(getAgentTargetDir('opencode')).toBe('./opencode/skills');
    expect(getAgentTargetDir('relay')).toBe('./.relay/skills');
  });

  });