import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it } from "node:test";
import { discoverAgents } from "../agents.ts";

function createTempDir(prefix = "pi-agent-frontmatter-"): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function removeTempDir(dir: string): void {
	try {
		fs.rmSync(dir, { recursive: true, force: true });
	} catch {}
}

describe("agent frontmatter parsing", () => {
	it("treats false-like skill and extension fields as explicit disable", () => {
		const tempDir = createTempDir("pi-agent-frontmatter-");
		const agentsDir = path.join(tempDir, ".pi", "agents");
		fs.mkdirSync(agentsDir, { recursive: true });
		fs.writeFileSync(
			path.join(agentsDir, "worker.md"),
			`---
name: worker
description: Test worker
tools: false
defaultReads: false
skill: false
extensions: false
---

You are a test worker.
`,
			"utf-8",
		);

		try {
			const result = discoverAgents(tempDir, "project");
			const agent = result.agents.find((candidate) => candidate.name === "worker");
			assert.ok(agent, "should discover the project agent");
			assert.equal(agent.tools, undefined);
			assert.equal(agent.mcpDirectTools, undefined);
			assert.equal(agent.defaultReads, undefined);
			assert.equal(agent.skills, false);
			assert.equal(agent.extensions, false);
		} finally {
			removeTempDir(tempDir);
		}
	});

	it("treats empty skill and extension fields as explicit disable", () => {
		const tempDir = createTempDir("pi-agent-frontmatter-");
		const agentsDir = path.join(tempDir, ".pi", "agents");
		fs.mkdirSync(agentsDir, { recursive: true });
		fs.writeFileSync(
			path.join(agentsDir, "reviewer.md"),
			`---
name: reviewer
description: Test reviewer
tools:
defaultReads:
skill:
extensions:
---

You are a test reviewer.
`,
			"utf-8",
		);

		try {
			const result = discoverAgents(tempDir, "project");
			const agent = result.agents.find((candidate) => candidate.name === "reviewer");
			assert.ok(agent, "should discover the project agent");
			assert.equal(agent.tools, undefined);
			assert.equal(agent.mcpDirectTools, undefined);
			assert.equal(agent.defaultReads, undefined);
			assert.equal(agent.skills, false);
			assert.equal(agent.extensions, false);
		} finally {
			removeTempDir(tempDir);
		}
	});
});
