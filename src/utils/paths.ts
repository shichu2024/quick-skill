import * as path from 'path';
import * as url from 'url';
import type { AgentName } from '../constants/agents.js';
import { getAgentTargetDir } from '../constants/agents.js';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getSkillSourcePath(): string {
  const cliRoot = path.resolve(__dirname, '..', '..');
  return path.join(cliRoot, 'skills');
}

export function resolveAgentSkillDir(agent: AgentName): string {
  const relativePath = getAgentTargetDir(agent);
  return path.resolve(process.cwd(), relativePath);
}