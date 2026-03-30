import fs from "fs";
import path from "path";
import { getOpenclawPackageCandidates, OPENCLAW_HOME, OPENCLAW_SKILLS_DIR, OPENCLAW_CONFIG_PATH } from "./openclaw-paths.js";

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  emoji: string;
  source: string;
  location: string;
  usedBy: string[];
  files?: SkillFile[];
}

export interface SkillFile {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: number;
}

export interface SkillAgentInfo {
  name: string;
  emoji: string;
}

function findOpenClawPkg(): string {
  const candidates = getOpenclawPackageCandidates();
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "package.json"))) return candidate;
  }
  return candidates[0] || "";
}

const OPENCLAW_PKG = findOpenClawPkg();
const SKILL_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const FILE_NAME_RE = /^[a-zA-Z0-9._-]{1,128}$/;

function toRealPathOrResolved(targetPath: string): string {
  try {
    return fs.realpathSync(targetPath);
  } catch {
    return path.resolve(targetPath);
  }
}

function pathWithinRoot(targetPath: string, rootPath: string): boolean {
  const target = toRealPathOrResolved(targetPath);
  const root = toRealPathOrResolved(rootPath);
  return target === root || target.startsWith(root + path.sep);
}

function getAllowedSkillRoots(): string[] {
  const roots = [OPENCLAW_SKILLS_DIR];
  if (OPENCLAW_PKG) {
    roots.push(path.join(OPENCLAW_PKG, "skills"));
    roots.push(path.join(OPENCLAW_PKG, "extensions"));
  }
  return Array.from(new Set(roots.map((item) => path.resolve(item))));
}

function assertSkillPathAllowed(targetPath: string): string {
  const normalized = path.resolve(targetPath);
  const allowedRoots = getAllowedSkillRoots();
  const isAllowed = allowedRoots.some((root) => pathWithinRoot(normalized, root));
  if (!isAllowed) {
    throw new Error("Path is outside allowed skill directories");
  }
  return normalized;
}

function parseFrontmatter(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!content.startsWith("---")) return result;
  const parts = content.split("---", 3);
  if (parts.length < 3) return result;
  const fm = parts[1];

  const nameMatch = fm.match(/^name:\s*(.+)/m);
  if (nameMatch) result.name = nameMatch[1].trim().replace(/^["']|["']$/g, "");

  const descMatch = fm.match(/^description:\s*["']?(.+?)["']?\s*$/m);
  if (descMatch) result.description = descMatch[1].trim().replace(/^["']|["']$/g, "");

  const emojiMatch = fm.match(/"emoji":\s*"([^"]+)"/);
  if (emojiMatch) result.emoji = emojiMatch[1];

  return result;
}

function parseSkillMd(skillMd: string, source: string, id = path.basename(path.dirname(skillMd))): SkillInfo | null {
  if (!fs.existsSync(skillMd)) return null;
  const content = fs.readFileSync(skillMd, "utf-8");
  const fm = parseFrontmatter(content);
  return {
    id,
    name: fm.name || id,
    description: fm.description || "",
    emoji: fm.emoji || "🔧",
    source,
    location: skillMd,
    usedBy: [],
  };
}

function getSkillFiles(skillDir: string): SkillFile[] {
  const files: SkillFile[] = [];
  if (!fs.existsSync(skillDir)) return files;

  const items = fs.readdirSync(skillDir, { withFileTypes: true });
  for (const item of items) {
    const itemPath = path.join(skillDir, item.name);
    if (item.isDirectory()) {
      files.push({
        name: item.name,
        path: itemPath,
        type: 'directory'
      });
    } else if (item.isFile()) {
      const stat = fs.statSync(itemPath);
      files.push({
        name: item.name,
        path: itemPath,
        type: 'file',
        size: stat.size,
        modified: stat.mtimeMs
      });
    }
  }

  return files.sort((a, b) => {
    // Directories first, then files, alphabetically
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function scanSkillsDir(dir: string, source: string): SkillInfo[] {
  const skills: SkillInfo[] = [];
  if (!fs.existsSync(dir)) return skills;
  for (const name of fs.readdirSync(dir).sort()) {
    const skillDir = path.join(dir, name);
    const skillMd = path.join(skillDir, "SKILL.md");
    if (fs.existsSync(skillMd)) {
      const skill = parseSkillMd(skillMd, source, name);
      if (skill) {
        skill.files = getSkillFiles(skillDir);
        skills.push(skill);
      }
    }
  }
  return skills;
}

function getAgentSkillsFromSessions(): Record<string, Set<string>> {
  const agentsDir = OPENCLAW_HOME;
  const result: Record<string, Set<string>> = {};
  if (!fs.existsSync(agentsDir)) return result;

  for (const agentId of fs.readdirSync(agentsDir)) {
    const sessionsDir = path.join(agentsDir, agentId, "sessions");
    if (!fs.existsSync(sessionsDir)) continue;

    const jsonlFiles = fs.readdirSync(sessionsDir)
      .filter((file) => file.endsWith(".jsonl"))
      .sort();
    const skillNames = new Set<string>();

    for (const file of jsonlFiles.slice(-3)) {
      const content = fs.readFileSync(path.join(sessionsDir, file), "utf-8");
      const idx = content.indexOf("skillsSnapshot");
      if (idx < 0) continue;
      const chunk = content.slice(idx, idx + 5000);
      const matches = chunk.matchAll(/\\?"name\\?":\s*\\?"([^"\\]+)\\?"/g);
      for (const match of matches) {
        const name = match[1];
        if (!["exec", "read", "edit", "write", "process", "message", "web_search", "web_fetch",
              "browser", "tts", "gateway", "memory_search", "memory_get", "cron", "nodes",
              "canvas", "session_status", "sessions_list", "sessions_history", "sessions_send",
              "sessions_spawn", "agents_list"].includes(name) && name.length > 1) {
          skillNames.add(name);
        }
      }
    }

    if (skillNames.size > 0) result[agentId] = skillNames;
  }

  return result;
}

export function listOpenclawSkills(): { skills: SkillInfo[]; agents: Record<string, SkillAgentInfo>; total: number } {
  const builtinSkills = scanSkillsDir(path.join(OPENCLAW_PKG, "skills"), "builtin");

  const extDir = path.join(OPENCLAW_PKG, "extensions");
  const extSkills: SkillInfo[] = [];
  if (fs.existsSync(extDir)) {
    for (const ext of fs.readdirSync(extDir)) {
      const extSkill = parseSkillMd(path.join(extDir, ext, "SKILL.md"), `extension:${ext}`, ext);
      if (extSkill) {
        extSkill.files = getSkillFiles(path.join(extDir, ext));
        extSkills.push(extSkill);
      }

      const skillsDir = path.join(extDir, ext, "skills");
      if (fs.existsSync(skillsDir)) {
        extSkills.push(...scanSkillsDir(skillsDir, `extension:${ext}`));
      }
    }
  }

  const customSkills = scanSkillsDir(OPENCLAW_SKILLS_DIR, "custom");
  const allSkills = [...builtinSkills, ...extSkills, ...customSkills];

  const agentSkills = getAgentSkillsFromSessions();
  for (const skill of allSkills) {
    for (const [agentId, skills] of Object.entries(agentSkills)) {
      if (skills.has(skill.id) || skills.has(skill.name)) {
        skill.usedBy.push(agentId);
      }
    }
  }

  let agentList: any[] = [];
  try {
    const config = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG_PATH, "utf-8"));
    agentList = config.agents?.list || [];
  } catch {}

  const agents: Record<string, SkillAgentInfo> = {};
  for (const agent of agentList) {
    agents[agent.id] = {
      name: agent.identity?.name || agent.name || agent.id,
      emoji: agent.identity?.emoji || "🤖",
    };
  }

  return { skills: allSkills, agents, total: allSkills.length };
}

export function getOpenclawSkillContent(source: string, id: string): { skill: SkillInfo; content: string } | null {
  const { skills } = listOpenclawSkills();
  const skill = skills.find((entry) => entry.source === source && entry.id === id);
  if (!skill) return null;
  return {
    skill,
    content: fs.readFileSync(skill.location, "utf-8"),
  };
}

export function getOpenclawSkillByLocation(location: string): SkillInfo | null {
  const { skills } = listOpenclawSkills();
  return skills.find((s) => s.location === location) || null;
}

export function readSkillFile(filePath: string): { content: string; exists: boolean } {
  const safePath = assertSkillPathAllowed(filePath);
  if (!fs.existsSync(safePath)) {
    return { content: "", exists: false };
  }
  return {
    content: fs.readFileSync(safePath, "utf-8"),
    exists: true
  };
}

export function writeSkillFile(filePath: string, content: string): { success: boolean; error?: string } {
  try {
    const safePath = assertSkillPathAllowed(filePath);
    // Ensure directory exists
    const dir = path.dirname(safePath);
    assertSkillPathAllowed(dir);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write to temp file first, then rename for atomic operation
    const tmpPath = `${safePath}.tmp`;
    fs.writeFileSync(tmpPath, content, "utf-8");
    fs.renameSync(tmpPath, safePath);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function createSkill(skillId: string, name: string, description: string, emoji: string): { success: boolean; skill?: SkillInfo; error?: string } {
  try {
    if (!SKILL_ID_RE.test(skillId)) {
      return { success: false, error: "Invalid skillId (letters/numbers/_/- only)" };
    }

    const skillDir = path.join(OPENCLAW_SKILLS_DIR, skillId);
    assertSkillPathAllowed(skillDir);
    if (fs.existsSync(skillDir)) {
      return { success: false, error: `Skill "${skillId}" already exists` };
    }

    fs.mkdirSync(skillDir, { recursive: true });

    const skillMdPath = path.join(skillDir, "SKILL.md");
    const content = `---
name: "${name}"
description: "${description}"
"emoji": "${emoji}"
---

# ${name}

${description}
`;

    fs.writeFileSync(skillMdPath, content, "utf-8");

    const skill: SkillInfo = {
      id: skillId,
      name,
      description,
      emoji,
      source: "custom",
      location: skillMdPath,
      usedBy: [],
      files: getSkillFiles(skillDir)
    };

    return { success: true, skill };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function deleteSkill(source: string, skillId: string): { success: boolean; error?: string } {
  // Only allow deleting custom skills
  if (source !== "custom") {
    return { success: false, error: "Only custom skills can be deleted" };
  }

  try {
    if (!SKILL_ID_RE.test(skillId)) {
      return { success: false, error: "Invalid skillId" };
    }

    const skillDir = path.join(OPENCLAW_SKILLS_DIR, skillId);
    assertSkillPathAllowed(skillDir);
    if (!fs.existsSync(skillDir)) {
      return { success: false, error: `Skill "${skillId}" not found` };
    }

    // Recursively delete directory
    fs.rmSync(skillDir, { recursive: true, force: true });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function listSkillFiles(skillDir: string): SkillFile[] {
  const safeDir = assertSkillPathAllowed(skillDir);
  return getSkillFiles(safeDir);
}

export function createSkillFile(skillDir: string, fileName: string, content: string = ""): { success: boolean; path?: string; error?: string } {
  try {
    if (!FILE_NAME_RE.test(fileName) || fileName.includes("..") || fileName.includes(path.sep)) {
      return { success: false, error: "Invalid fileName" };
    }

    const safeSkillDir = assertSkillPathAllowed(skillDir);
    const filePath = path.join(safeSkillDir, fileName);
    assertSkillPathAllowed(filePath);

    if (fs.existsSync(filePath)) {
      return { success: false, error: `File "${fileName}" already exists` };
    }

    // Ensure directory exists
    if (!fs.existsSync(safeSkillDir)) {
      fs.mkdirSync(safeSkillDir, { recursive: true });
    }

    fs.writeFileSync(filePath, content, "utf-8");

    return { success: true, path: filePath };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function deleteSkillFile(filePath: string): { success: boolean; error?: string } {
  try {
    const safePath = assertSkillPathAllowed(filePath);
    if (!fs.existsSync(safePath)) {
      return { success: false, error: "File not found" };
    }

    fs.unlinkSync(safePath);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
