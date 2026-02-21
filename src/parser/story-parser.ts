import fs from "node:fs";
import path from "node:path";
import type { StoryExample, StoryInfo } from "../types.js";

/**
 * コンポーネントに対応するStorybookファイルを解析する
 */
export function parseStory(
  kuiPath: string,
  componentFilePath: string
): StoryInfo | null {
  // コンポーネントファイルから.stories.tsxのパスを生成
  const dir = path.dirname(path.join(kuiPath, componentFilePath));
  const baseName = path.basename(componentFilePath, ".tsx");
  const storyFile = path.join(dir, `${baseName}.stories.tsx`);

  if (!fs.existsSync(storyFile)) return null;

  const sourceCode = fs.readFileSync(storyFile, "utf-8");
  return parseStorySource(sourceCode);
}

/**
 * Storybookソースコードを解析する
 */
function parseStorySource(sourceCode: string): StoryInfo {
  const title = extractTitle(sourceCode);
  const examples = extractExamples(sourceCode);

  return { title, examples, sourceCode };
}

/**
 * Storybookのtitleを抽出する
 */
function extractTitle(sourceCode: string): string {
  const match = sourceCode.match(/title:\s*"([^"]+)"/);
  return match?.[1] ?? "";
}

/**
 * Storyの使用例を抽出する
 */
function extractExamples(sourceCode: string): StoryExample[] {
  const examples: StoryExample[] = [];

  // export const StoryName: Story = { args: { ... } } パターン
  const storyPattern =
    /export const (\w+):\s*Story\s*=\s*\{[\s\S]*?args:\s*\{([\s\S]*?)\}\s*[,}]/g;
  let match;

  while ((match = storyPattern.exec(sourceCode)) !== null) {
    const name = match[1];
    const argsBlock = match[2];
    const args = parseArgs(argsBlock);
    examples.push({ name, args });
  }

  return examples;
}

/**
 * argsブロックをキーバリューペアに変換する
 */
function parseArgs(argsBlock: string): Record<string, string> {
  const args: Record<string, string> = {};

  // 単純なkey: value パターン（JSXやオブジェクトを含む複雑な値は文字列化）
  const argPattern = /(\w+):\s*(?:"([^"]+)"|(\w+)|(\([\s\S]*?\))|(true|false))/g;
  let match;

  while ((match = argPattern.exec(argsBlock)) !== null) {
    const key = match[1];
    const value = match[2] ?? match[3] ?? match[4] ?? match[5];
    if (key && value) {
      args[key] = value;
    }
  }

  return args;
}
