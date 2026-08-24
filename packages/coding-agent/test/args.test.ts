/**
 * 文件职责：验证命令行参数解析器对所有公开标志、简写、值、消息、文件参数和未知选项的处理。
 * 技术维度：使用 Vitest 表驱动式断言，直接调用纯函数 parseArgs 检查结构化解析结果。
 * 产品维度：保证用户通过 CLI 启动、续接、选模型、加载扩展和控制工具时获得一致且可预期的行为。
 * 逻辑维度：按参数类别分组测试布尔标志、带值选项、资源开关、工具选项以及复杂组合。
 * 关键边界：本文件只验证语法解析，不校验路径存在性、凭据有效性或 main 中的业务组合限制。
 * 新手阅读建议：先看简单布尔标志，再比较带值和重复标志，最后阅读未知选项与复杂组合用例。
 */
import { describe, expect, test } from "vitest";
import { parseArgs } from "../src/cli/args.ts";

describe("parseArgs", () => {
	describe("--version flag", () => {
		// 测试场景：验证“parses --version flag”对应的命令行解析行为。
		test("parses --version flag", () => {
			/** 当前用例的参数解析结果，用于核对“parses --version flag”场景中的字段和值。 */
			const result = parseArgs(["--version"]);
			expect(result.version).toBe(true);
		});

		// 测试场景：验证“parses -v shorthand”对应的命令行解析行为。
		test("parses -v shorthand", () => {
			/** 当前用例的参数解析结果，用于核对“parses -v shorthand”场景中的字段和值。 */
			const result = parseArgs(["-v"]);
			expect(result.version).toBe(true);
		});

		// 测试场景：验证“--version takes precedence over other args”对应的命令行解析行为。
		test("--version takes precedence over other args", () => {
			/** 当前用例的参数解析结果，用于核对“--version takes precedence over other args”场景中的字段和值。 */
			const result = parseArgs(["--version", "--help", "some message"]);
			expect(result.version).toBe(true);
			expect(result.help).toBe(true);
			expect(result.messages).toContain("some message");
		});
	});

	describe("--help flag", () => {
		// 测试场景：验证“parses --help flag”对应的命令行解析行为。
		test("parses --help flag", () => {
			/** 当前用例的参数解析结果，用于核对“parses --help flag”场景中的字段和值。 */
			const result = parseArgs(["--help"]);
			expect(result.help).toBe(true);
		});

		// 测试场景：验证“parses -h shorthand”对应的命令行解析行为。
		test("parses -h shorthand", () => {
			/** 当前用例的参数解析结果，用于核对“parses -h shorthand”场景中的字段和值。 */
			const result = parseArgs(["-h"]);
			expect(result.help).toBe(true);
		});
	});

	describe("--print flag", () => {
		// 测试场景：验证“parses --print flag”对应的命令行解析行为。
		test("parses --print flag", () => {
			/** 当前用例的参数解析结果，用于核对“parses --print flag”场景中的字段和值。 */
			const result = parseArgs(["--print"]);
			expect(result.print).toBe(true);
		});

		// 测试场景：验证“parses -p shorthand”对应的命令行解析行为。
		test("parses -p shorthand", () => {
			/** 当前用例的参数解析结果，用于核对“parses -p shorthand”场景中的字段和值。 */
			const result = parseArgs(["-p"]);
			expect(result.print).toBe(true);
		});

		// 测试场景：验证“parses prompt after -p even when it starts with YAML frontmatter”对应的命令行解析行为。
		test("parses prompt after -p even when it starts with YAML frontmatter", () => {
			/** 以 YAML frontmatter 开头的多行提示词，验证其不会被误判为选项。 */
			const prompt = "---\ntitle: hello\n---\nSay hi.";
			/** 当前用例的参数解析结果，用于核对“parses prompt after -p even when it starts with YAML frontmatter”场景中的字段和值。 */
			const result = parseArgs(["-p", prompt]);
			expect(result.print).toBe(true);
			expect(result.messages).toEqual([prompt]);
			expect(result.unknownFlags.size).toBe(0);
		});

		// 测试场景：验证“does not consume options after -p as prompts”对应的命令行解析行为。
		test("does not consume options after -p as prompts", () => {
			/** 当前用例的参数解析结果，用于核对“does not consume options after -p as prompts”场景中的字段和值。 */
			const result = parseArgs(["-p", "--provider", "openai", "Say hi."]);
			expect(result.print).toBe(true);
			expect(result.provider).toBe("openai");
			expect(result.messages).toEqual(["Say hi."]);
		});
	});

	describe("--continue flag", () => {
		// 测试场景：验证“parses --continue flag”对应的命令行解析行为。
		test("parses --continue flag", () => {
			/** 当前用例的参数解析结果，用于核对“parses --continue flag”场景中的字段和值。 */
			const result = parseArgs(["--continue"]);
			expect(result.continue).toBe(true);
		});

		// 测试场景：验证“parses -c shorthand”对应的命令行解析行为。
		test("parses -c shorthand", () => {
			/** 当前用例的参数解析结果，用于核对“parses -c shorthand”场景中的字段和值。 */
			const result = parseArgs(["-c"]);
			expect(result.continue).toBe(true);
		});
	});

	describe("--resume flag", () => {
		// 测试场景：验证“parses --resume flag”对应的命令行解析行为。
		test("parses --resume flag", () => {
			/** 当前用例的参数解析结果，用于核对“parses --resume flag”场景中的字段和值。 */
			const result = parseArgs(["--resume"]);
			expect(result.resume).toBe(true);
		});

		// 测试场景：验证“parses -r shorthand”对应的命令行解析行为。
		test("parses -r shorthand", () => {
			/** 当前用例的参数解析结果，用于核对“parses -r shorthand”场景中的字段和值。 */
			const result = parseArgs(["-r"]);
			expect(result.resume).toBe(true);
		});
	});

	describe("flags with values", () => {
		// 测试场景：验证“parses --provider”对应的命令行解析行为。
		test("parses --provider", () => {
			/** 当前用例的参数解析结果，用于核对“parses --provider”场景中的字段和值。 */
			const result = parseArgs(["--provider", "openai"]);
			expect(result.provider).toBe("openai");
		});

		// 测试场景：验证“parses --model”对应的命令行解析行为。
		test("parses --model", () => {
			/** 当前用例的参数解析结果，用于核对“parses --model”场景中的字段和值。 */
			const result = parseArgs(["--model", "gpt-4o"]);
			expect(result.model).toBe("gpt-4o");
		});

		// 测试场景：验证“parses --api-key”对应的命令行解析行为。
		test("parses --api-key", () => {
			/** 当前用例的参数解析结果，用于核对“parses --api-key”场景中的字段和值。 */
			const result = parseArgs(["--api-key", "sk-test-key"]);
			expect(result.apiKey).toBe("sk-test-key");
		});

		// 测试场景：验证“parses --system-prompt”对应的命令行解析行为。
		test("parses --system-prompt", () => {
			/** 当前用例的参数解析结果，用于核对“parses --system-prompt”场景中的字段和值。 */
			const result = parseArgs(["--system-prompt", "You are a helpful assistant"]);
			expect(result.systemPrompt).toBe("You are a helpful assistant");
		});

		// 测试场景：验证“parses --append-system-prompt”对应的命令行解析行为。
		test("parses --append-system-prompt", () => {
			/** 当前用例的参数解析结果，用于核对“parses --append-system-prompt”场景中的字段和值。 */
			const result = parseArgs(["--append-system-prompt", "Additional context"]);
			expect(result.appendSystemPrompt).toEqual(["Additional context"]);
		});

		// 测试场景：验证“parses multiple --append-system-prompt flags”对应的命令行解析行为。
		test("parses multiple --append-system-prompt flags", () => {
			/** 当前用例的参数解析结果，用于核对“parses multiple --append-system-prompt flags”场景中的字段和值。 */
			const result = parseArgs(["--append-system-prompt", "Context A", "--append-system-prompt", "Context B"]);
			expect(result.appendSystemPrompt).toEqual(["Context A", "Context B"]);
		});

		// 测试场景：验证“parses --mode”对应的命令行解析行为。
		test("parses --mode", () => {
			/** 当前用例的参数解析结果，用于核对“parses --mode”场景中的字段和值。 */
			const result = parseArgs(["--mode", "json"]);
			expect(result.mode).toBe("json");
		});

		// 测试场景：验证“parses --mode rpc”对应的命令行解析行为。
		test("parses --mode rpc", () => {
			/** 当前用例的参数解析结果，用于核对“parses --mode rpc”场景中的字段和值。 */
			const result = parseArgs(["--mode", "rpc"]);
			expect(result.mode).toBe("rpc");
		});

		// 测试场景：验证“parses --session”对应的命令行解析行为。
		test("parses --session", () => {
			/** 当前用例的参数解析结果，用于核对“parses --session”场景中的字段和值。 */
			const result = parseArgs(["--session", "/path/to/session.jsonl"]);
			expect(result.session).toBe("/path/to/session.jsonl");
		});

		// 测试场景：验证“parses --session-id”对应的命令行解析行为。
		test("parses --session-id", () => {
			/** 当前用例的参数解析结果，用于核对“parses --session-id”场景中的字段和值。 */
			const result = parseArgs(["--session-id", "orchestrated-session"]);
			expect(result.sessionId).toBe("orchestrated-session");
		});

		// 测试场景：验证“parses --fork”对应的命令行解析行为。
		test("parses --fork", () => {
			/** 当前用例的参数解析结果，用于核对“parses --fork”场景中的字段和值。 */
			const result = parseArgs(["--fork", "1234abcd"]);
			expect(result.fork).toBe("1234abcd");
			expect(result.messages).toEqual([]);
		});

		// 测试场景：验证“parses --export”对应的命令行解析行为。
		test("parses --export", () => {
			/** 当前用例的参数解析结果，用于核对“parses --export”场景中的字段和值。 */
			const result = parseArgs(["--export", "session.jsonl"]);
			expect(result.export).toBe("session.jsonl");
		});

		// 测试场景：验证“parses --thinking”对应的命令行解析行为。
		test("parses --thinking", () => {
			/** 当前用例的参数解析结果，用于核对“parses --thinking”场景中的字段和值。 */
			const result = parseArgs(["--thinking", "high"]);
			expect(result.thinking).toBe("high");
		});

		// 测试场景：验证“parses --models as comma-separated list”对应的命令行解析行为。
		test("parses --models as comma-separated list", () => {
			/** 当前用例的参数解析结果，用于核对“parses --models as comma-separated list”场景中的字段和值。 */
			const result = parseArgs(["--models", "gpt-4o,claude-sonnet,gemini-pro"]);
			expect(result.models).toEqual(["gpt-4o", "claude-sonnet", "gemini-pro"]);
		});
	});

	describe("--name flag", () => {
		// 测试场景：验证“parses --name flag with value”对应的命令行解析行为。
		test("parses --name flag with value", () => {
			/** 当前用例的参数解析结果，用于核对“parses --name flag with value”场景中的字段和值。 */
			const result = parseArgs(["--name", "my-session"]);
			expect(result.name).toBe("my-session");
		});

		// 测试场景：验证“parses -n shorthand”对应的命令行解析行为。
		test("parses -n shorthand", () => {
			/** 当前用例的参数解析结果，用于核对“parses -n shorthand”场景中的字段和值。 */
			const result = parseArgs(["-n", "quick-session"]);
			expect(result.name).toBe("quick-session");
		});

		// 测试场景：验证“preserves empty values for main validation”对应的命令行解析行为。
		test("preserves empty values for main validation", () => {
			/** 当前用例的参数解析结果，用于核对“preserves empty values for main validation”场景中的字段和值。 */
			const result = parseArgs(["--name", ""]);
			expect(result.name).toBe("");
		});

		// 测试场景：验证“reports missing value”对应的命令行解析行为。
		test("reports missing value", () => {
			/** 当前用例的参数解析结果，用于核对“reports missing value”场景中的字段和值。 */
			const result = parseArgs(["--name"]);
			expect(result.diagnostics).toEqual([{ type: "error", message: "--name requires a value" }]);
		});

		// 测试场景：验证“works alongside other flags”对应的命令行解析行为。
		test("works alongside other flags", () => {
			/** 当前用例的参数解析结果，用于核对“works alongside other flags”场景中的字段和值。 */
			const result = parseArgs(["--name", "named-run", "--print", "--model", "gpt-4o", "hello"]);
			expect(result.name).toBe("named-run");
			expect(result.print).toBe(true);
			expect(result.model).toBe("gpt-4o");
			expect(result.messages).toEqual(["hello"]);
		});
	});

	describe("--no-session flag", () => {
		// 测试场景：验证“parses --no-session flag”对应的命令行解析行为。
		test("parses --no-session flag", () => {
			/** 当前用例的参数解析结果，用于核对“parses --no-session flag”场景中的字段和值。 */
			const result = parseArgs(["--no-session"]);
			expect(result.noSession).toBe(true);
		});
	});

	describe("--extension flag", () => {
		// 测试场景：验证“parses single --extension”对应的命令行解析行为。
		test("parses single --extension", () => {
			/** 当前用例的参数解析结果，用于核对“parses single --extension”场景中的字段和值。 */
			const result = parseArgs(["--extension", "./my-extension.ts"]);
			expect(result.extensions).toEqual(["./my-extension.ts"]);
		});

		// 测试场景：验证“parses -e shorthand”对应的命令行解析行为。
		test("parses -e shorthand", () => {
			/** 当前用例的参数解析结果，用于核对“parses -e shorthand”场景中的字段和值。 */
			const result = parseArgs(["-e", "./my-extension.ts"]);
			expect(result.extensions).toEqual(["./my-extension.ts"]);
		});

		// 测试场景：验证“parses multiple --extension flags”对应的命令行解析行为。
		test("parses multiple --extension flags", () => {
			/** 当前用例的参数解析结果，用于核对“parses multiple --extension flags”场景中的字段和值。 */
			const result = parseArgs(["--extension", "./ext1.ts", "-e", "./ext2.ts"]);
			expect(result.extensions).toEqual(["./ext1.ts", "./ext2.ts"]);
		});
	});

	describe("--no-extensions flag", () => {
		// 测试场景：验证“parses --no-extensions flag”对应的命令行解析行为。
		test("parses --no-extensions flag", () => {
			/** 当前用例的参数解析结果，用于核对“parses --no-extensions flag”场景中的字段和值。 */
			const result = parseArgs(["--no-extensions"]);
			expect(result.noExtensions).toBe(true);
		});

		// 测试场景：验证“parses --no-extensions with explicit -e flags”对应的命令行解析行为。
		test("parses --no-extensions with explicit -e flags", () => {
			/** 当前用例的参数解析结果，用于核对“parses --no-extensions with explicit -e flags”场景中的字段和值。 */
			const result = parseArgs(["--no-extensions", "-e", "foo.ts", "-e", "bar.ts"]);
			expect(result.noExtensions).toBe(true);
			expect(result.extensions).toEqual(["foo.ts", "bar.ts"]);
		});
	});

	describe("--skill flag", () => {
		// 测试场景：验证“parses single --skill”对应的命令行解析行为。
		test("parses single --skill", () => {
			/** 当前用例的参数解析结果，用于核对“parses single --skill”场景中的字段和值。 */
			const result = parseArgs(["--skill", "./skill-dir"]);
			expect(result.skills).toEqual(["./skill-dir"]);
		});

		// 测试场景：验证“parses multiple --skill flags”对应的命令行解析行为。
		test("parses multiple --skill flags", () => {
			/** 当前用例的参数解析结果，用于核对“parses multiple --skill flags”场景中的字段和值。 */
			const result = parseArgs(["--skill", "./skill-a", "--skill", "./skill-b"]);
			expect(result.skills).toEqual(["./skill-a", "./skill-b"]);
		});
	});

	describe("--prompt-template flag", () => {
		// 测试场景：验证“parses single --prompt-template”对应的命令行解析行为。
		test("parses single --prompt-template", () => {
			/** 当前用例的参数解析结果，用于核对“parses single --prompt-template”场景中的字段和值。 */
			const result = parseArgs(["--prompt-template", "./prompts"]);
			expect(result.promptTemplates).toEqual(["./prompts"]);
		});

		// 测试场景：验证“parses multiple --prompt-template flags”对应的命令行解析行为。
		test("parses multiple --prompt-template flags", () => {
			/** 当前用例的参数解析结果，用于核对“parses multiple --prompt-template flags”场景中的字段和值。 */
			const result = parseArgs(["--prompt-template", "./one", "--prompt-template", "./two"]);
			expect(result.promptTemplates).toEqual(["./one", "./two"]);
		});
	});

	describe("--theme flag", () => {
		// 测试场景：验证“parses single --theme”对应的命令行解析行为。
		test("parses single --theme", () => {
			/** 当前用例的参数解析结果，用于核对“parses single --theme”场景中的字段和值。 */
			const result = parseArgs(["--theme", "./theme.json"]);
			expect(result.themes).toEqual(["./theme.json"]);
		});

		// 测试场景：验证“parses multiple --theme flags”对应的命令行解析行为。
		test("parses multiple --theme flags", () => {
			/** 当前用例的参数解析结果，用于核对“parses multiple --theme flags”场景中的字段和值。 */
			const result = parseArgs(["--theme", "./dark.json", "--theme", "./light.json"]);
			expect(result.themes).toEqual(["./dark.json", "./light.json"]);
		});
	});

	describe("--no-skills flag", () => {
		// 测试场景：验证“parses --no-skills flag”对应的命令行解析行为。
		test("parses --no-skills flag", () => {
			/** 当前用例的参数解析结果，用于核对“parses --no-skills flag”场景中的字段和值。 */
			const result = parseArgs(["--no-skills"]);
			expect(result.noSkills).toBe(true);
		});
	});

	describe("--no-prompt-templates flag", () => {
		// 测试场景：验证“parses --no-prompt-templates flag”对应的命令行解析行为。
		test("parses --no-prompt-templates flag", () => {
			/** 当前用例的参数解析结果，用于核对“parses --no-prompt-templates flag”场景中的字段和值。 */
			const result = parseArgs(["--no-prompt-templates"]);
			expect(result.noPromptTemplates).toBe(true);
		});
	});

	describe("--no-themes flag", () => {
		// 测试场景：验证“parses --no-themes flag”对应的命令行解析行为。
		test("parses --no-themes flag", () => {
			/** 当前用例的参数解析结果，用于核对“parses --no-themes flag”场景中的字段和值。 */
			const result = parseArgs(["--no-themes"]);
			expect(result.noThemes).toBe(true);
		});
	});

	describe("--no-context-files flag", () => {
		// 测试场景：验证“parses --no-context-files flag”对应的命令行解析行为。
		test("parses --no-context-files flag", () => {
			/** 当前用例的参数解析结果，用于核对“parses --no-context-files flag”场景中的字段和值。 */
			const result = parseArgs(["--no-context-files"]);
			expect(result.noContextFiles).toBe(true);
		});

		// 测试场景：验证“parses -nc shorthand”对应的命令行解析行为。
		test("parses -nc shorthand", () => {
			/** 当前用例的参数解析结果，用于核对“parses -nc shorthand”场景中的字段和值。 */
			const result = parseArgs(["-nc"]);
			expect(result.noContextFiles).toBe(true);
		});
	});

	describe("project approval flags", () => {
		// 测试场景：验证“parses --approve”对应的命令行解析行为。
		test("parses --approve", () => {
			/** 当前用例的参数解析结果，用于核对“parses --approve”场景中的字段和值。 */
			const result = parseArgs(["--approve"]);
			expect(result.projectTrustOverride).toBe(true);
		});

		// 测试场景：验证“parses -a shorthand”对应的命令行解析行为。
		test("parses -a shorthand", () => {
			/** 当前用例的参数解析结果，用于核对“parses -a shorthand”场景中的字段和值。 */
			const result = parseArgs(["-a"]);
			expect(result.projectTrustOverride).toBe(true);
		});

		// 测试场景：验证“parses --no-approve”对应的命令行解析行为。
		test("parses --no-approve", () => {
			/** 当前用例的参数解析结果，用于核对“parses --no-approve”场景中的字段和值。 */
			const result = parseArgs(["--no-approve"]);
			expect(result.projectTrustOverride).toBe(false);
		});

		// 测试场景：验证“parses -na shorthand”对应的命令行解析行为。
		test("parses -na shorthand", () => {
			/** 当前用例的参数解析结果，用于核对“parses -na shorthand”场景中的字段和值。 */
			const result = parseArgs(["-na"]);
			expect(result.projectTrustOverride).toBe(false);
		});
	});

	describe("--verbose flag", () => {
		// 测试场景：验证“parses --verbose flag”对应的命令行解析行为。
		test("parses --verbose flag", () => {
			/** 当前用例的参数解析结果，用于核对“parses --verbose flag”场景中的字段和值。 */
			const result = parseArgs(["--verbose"]);
			expect(result.verbose).toBe(true);
		});
	});

	describe("--offline flag", () => {
		// 测试场景：验证“parses --offline flag”对应的命令行解析行为。
		test("parses --offline flag", () => {
			/** 当前用例的参数解析结果，用于核对“parses --offline flag”场景中的字段和值。 */
			const result = parseArgs(["--offline"]);
			expect(result.offline).toBe(true);
		});
	});

	describe("tool flags", () => {
		// 测试场景：验证“parses --no-tools flag”对应的命令行解析行为。
		test("parses --no-tools flag", () => {
			/** 当前用例的参数解析结果，用于核对“parses --no-tools flag”场景中的字段和值。 */
			const result = parseArgs(["--no-tools"]);
			expect(result.noTools).toBe(true);
		});

		// 测试场景：验证“parses -nt shorthand”对应的命令行解析行为。
		test("parses -nt shorthand", () => {
			/** 当前用例的参数解析结果，用于核对“parses -nt shorthand”场景中的字段和值。 */
			const result = parseArgs(["-nt"]);
			expect(result.noTools).toBe(true);
		});

		// 测试场景：验证“parses --no-builtin-tools flag”对应的命令行解析行为。
		test("parses --no-builtin-tools flag", () => {
			/** 当前用例的参数解析结果，用于核对“parses --no-builtin-tools flag”场景中的字段和值。 */
			const result = parseArgs(["--no-builtin-tools"]);
			expect(result.noBuiltinTools).toBe(true);
		});

		// 测试场景：验证“parses -nbt shorthand”对应的命令行解析行为。
		test("parses -nbt shorthand", () => {
			/** 当前用例的参数解析结果，用于核对“parses -nbt shorthand”场景中的字段和值。 */
			const result = parseArgs(["-nbt"]);
			expect(result.noBuiltinTools).toBe(true);
		});

		// 测试场景：验证“parses --tools flag”对应的命令行解析行为。
		test("parses --tools flag", () => {
			/** 当前用例的参数解析结果，用于核对“parses --tools flag”场景中的字段和值。 */
			const result = parseArgs(["--tools", "read,bash"]);
			expect(result.tools).toEqual(["read", "bash"]);
		});

		// 测试场景：验证“parses -t shorthand”对应的命令行解析行为。
		test("parses -t shorthand", () => {
			/** 当前用例的参数解析结果，用于核对“parses -t shorthand”场景中的字段和值。 */
			const result = parseArgs(["-t", "read,bash"]);
			expect(result.tools).toEqual(["read", "bash"]);
		});

		// 测试场景：验证“parses --exclude-tools flag”对应的命令行解析行为。
		test("parses --exclude-tools flag", () => {
			/** 当前用例的参数解析结果，用于核对“parses --exclude-tools flag”场景中的字段和值。 */
			const result = parseArgs(["--exclude-tools", "read,bash"]);
			expect(result.excludeTools).toEqual(["read", "bash"]);
		});

		// 测试场景：验证“parses -xt shorthand”对应的命令行解析行为。
		test("parses -xt shorthand", () => {
			/** 当前用例的参数解析结果，用于核对“parses -xt shorthand”场景中的字段和值。 */
			const result = parseArgs(["-xt", "read,bash"]);
			expect(result.excludeTools).toEqual(["read", "bash"]);
		});

		// 测试场景：验证“parses --no-tools with explicit --tools flags”对应的命令行解析行为。
		test("parses --no-tools with explicit --tools flags", () => {
			/** 当前用例的参数解析结果，用于核对“parses --no-tools with explicit --tools flags”场景中的字段和值。 */
			const result = parseArgs(["--no-tools", "--tools", "read,bash"]);
			expect(result.noTools).toBe(true);
			expect(result.tools).toEqual(["read", "bash"]);
		});

		// 测试场景：验证“parses --no-builtin-tools with explicit --tools flags”对应的命令行解析行为。
		test("parses --no-builtin-tools with explicit --tools flags", () => {
			/** 当前用例的参数解析结果，用于核对“parses --no-builtin-tools with explicit --tools flags”场景中的字段和值。 */
			const result = parseArgs(["--no-builtin-tools", "--tools", "read,bash"]);
			expect(result.noBuiltinTools).toBe(true);
			expect(result.tools).toEqual(["read", "bash"]);
		});
	});

	describe("messages and file args", () => {
		// 测试场景：验证“parses plain text messages”对应的命令行解析行为。
		test("parses plain text messages", () => {
			/** 当前用例的参数解析结果，用于核对“parses plain text messages”场景中的字段和值。 */
			const result = parseArgs(["hello", "world"]);
			expect(result.messages).toEqual(["hello", "world"]);
		});

		// 测试场景：验证“parses @file arguments”对应的命令行解析行为。
		test("parses @file arguments", () => {
			/** 当前用例的参数解析结果，用于核对“parses @file arguments”场景中的字段和值。 */
			const result = parseArgs(["@README.md", "@src/main.ts"]);
			expect(result.fileArgs).toEqual(["README.md", "src/main.ts"]);
		});

		// 测试场景：验证“parses mixed messages and file args”对应的命令行解析行为。
		test("parses mixed messages and file args", () => {
			/** 当前用例的参数解析结果，用于核对“parses mixed messages and file args”场景中的字段和值。 */
			const result = parseArgs(["@file.txt", "explain this", "@image.png"]);
			expect(result.fileArgs).toEqual(["file.txt", "image.png"]);
			expect(result.messages).toEqual(["explain this"]);
		});

		// 测试场景：验证“captures unknown long flags with string values”对应的命令行解析行为。
		test("captures unknown long flags with string values", () => {
			/** 当前用例的参数解析结果，用于核对“captures unknown long flags with string values”场景中的字段和值。 */
			const result = parseArgs(["--unknown-flag", "message"]);
			expect(result.messages).toEqual([]);
			expect(result.unknownFlags.get("unknown-flag")).toBe("message");
		});

		// 测试场景：验证“captures unknown boolean long flags”对应的命令行解析行为。
		test("captures unknown boolean long flags", () => {
			/** 当前用例的参数解析结果，用于核对“captures unknown boolean long flags”场景中的字段和值。 */
			const result = parseArgs(["--unknown-flag"]);
			expect(result.unknownFlags.get("unknown-flag")).toBe(true);
		});

		// 测试场景：验证“captures unknown long flags with equals syntax”对应的命令行解析行为。
		test("captures unknown long flags with equals syntax", () => {
			/** 当前用例的参数解析结果，用于核对“captures unknown long flags with equals syntax”场景中的字段和值。 */
			const result = parseArgs(["--unknown-flag=value"]);
			expect(result.unknownFlags.get("unknown-flag")).toBe("value");
		});
	});

	describe("complex combinations", () => {
		// 测试场景：验证“parses multiple flags together”对应的命令行解析行为。
		test("parses multiple flags together", () => {
			/** 当前用例的参数解析结果，用于核对“parses multiple flags together”场景中的字段和值。 */
			const result = parseArgs([
				"--provider",
				"anthropic",
				"--model",
				"claude-sonnet",
				"--print",
				"--thinking",
				"high",
				"@prompt.md",
				"Do the task",
			]);
			expect(result.provider).toBe("anthropic");
			expect(result.model).toBe("claude-sonnet");
			expect(result.print).toBe(true);
			expect(result.thinking).toBe("high");
			expect(result.fileArgs).toEqual(["prompt.md"]);
			expect(result.messages).toEqual(["Do the task"]);
		});
	});
});
