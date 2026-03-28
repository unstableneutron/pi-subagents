import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, it } from "node:test";

async function tryImport<T>(specifier: string): Promise<T | null> {
	try {
		const url = pathToFileURL(path.resolve(specifier)).href;
		return await import(url) as T;
	} catch (error: any) {
		const code = error?.code;
		if (code === "MODULE_NOT_FOUND" || code === "ERR_MODULE_NOT_FOUND") {
			return null;
		}
		throw error;
	}
}

const skillsMod = await tryImport<any>("./skills.ts");
const available = !!skillsMod;
const clearSkillCache = skillsMod?.clearSkillCache;
const resolveSkills = skillsMod?.resolveSkills;
const resolveSkillsWithFallback = skillsMod?.resolveSkillsWithFallback;

const tempDirs: string[] = [];

function createTempDir(prefix = "pi-skills-resolution-"): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
	tempDirs.push(dir);
	return dir;
}

function writeSkillPackage(packageRoot: string, skillName: string): void {
	const skillDir = path.join(packageRoot, "skills", skillName);
	fs.mkdirSync(skillDir, { recursive: true });
	fs.writeFileSync(
		path.join(packageRoot, "package.json"),
		JSON.stringify({
			name: `pkg-${skillName}`,
			version: "1.0.0",
			pi: { skills: [`./skills/${skillName}`] },
		}, null, 2),
		"utf-8",
	);
	fs.writeFileSync(
		path.join(skillDir, "SKILL.md"),
		`---\nname: ${skillName}\ndescription: Test skill ${skillName}\n---\nContent\n`,
		"utf-8",
	);
}

afterEach(() => {
	clearSkillCache();
	while (tempDirs.length > 0) {
		const dir = tempDirs.pop();
		if (!dir) continue;
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

describe("skill resolution from package-based sources", { skip: !available ? "skills.ts not importable" : undefined }, () => {
	it("discovers skills from project settings.packages string entries", () => {
		const cwd = createTempDir();
		const packageRoot = path.join(cwd, ".pi", "local-package");
		writeSkillPackage(packageRoot, "settings-package-skill");
		fs.mkdirSync(path.join(cwd, ".pi"), { recursive: true });
		fs.writeFileSync(
			path.join(cwd, ".pi", "settings.json"),
			JSON.stringify({ packages: ["./local-package"] }, null, 2),
			"utf-8",
		);

		const result = resolveSkills(["settings-package-skill"], cwd);
		assert.equal(result.missing.length, 0);
		assert.equal(result.resolved.length, 1);
		assert.equal(result.resolved[0]?.name, "settings-package-skill");
	});

	it("discovers skills from project settings.packages file URIs", () => {
		const cwd = createTempDir();
		const packageRoot = path.join(cwd, ".pi", "file-package");
		writeSkillPackage(packageRoot, "settings-file-skill");
		fs.mkdirSync(path.join(cwd, ".pi"), { recursive: true });
		fs.writeFileSync(
			path.join(cwd, ".pi", "settings.json"),
			JSON.stringify({ packages: ["file:./file-package"] }, null, 2),
			"utf-8",
		);

		const result = resolveSkills(["settings-file-skill"], cwd);
		assert.equal(result.missing.length, 0);
		assert.equal(result.resolved.length, 1);
		assert.equal(result.resolved[0]?.name, "settings-file-skill");
	});

	it("discovers skills from cwd package.json pi.skills", () => {
		const cwd = createTempDir();
		writeSkillPackage(cwd, "cwd-package-skill");

		const result = resolveSkills(["cwd-package-skill"], cwd);
		assert.equal(result.missing.length, 0);
		assert.equal(result.resolved.length, 1);
		assert.equal(result.resolved[0]?.name, "cwd-package-skill");
		assert.equal(result.resolved[0]?.source, "project-package");
	});

	it("falls back to runtime cwd when effective cwd does not define the requested skill", () => {
		const runtimeCwd = createTempDir();
		const taskCwd = path.join(runtimeCwd, "nested");
		fs.mkdirSync(taskCwd, { recursive: true });
		writeSkillPackage(runtimeCwd, "runtime-fallback-skill");

		const result = resolveSkillsWithFallback(["runtime-fallback-skill"], taskCwd, runtimeCwd);
		assert.equal(result.missing.length, 0);
		assert.equal(result.resolved.length, 1);
		assert.equal(result.resolved[0]?.name, "runtime-fallback-skill");
	});
});
