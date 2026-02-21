#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";

import { parseComponents } from "./parser/component-parser.js";
import { parseDesignTokens } from "./parser/token-parser.js";
import { parseStory } from "./parser/story-parser.js";
import type {
  ComponentInfo,
  DesignToken,
  ValidationError,
  ValidationWarning,
} from "./types.js";

const K_UI_REPO = "https://github.com/k1e1n04/k-ui.git";

/**
 * k-uiのソースパスを解決する
 * 優先順位: K_UI_PATH環境変数 > GitHubからclone
 * K_UI_VERSION環境変数でブランチ・タグを指定可能（デフォルト: main）
 */
function resolveKuiPath(): string {
  if (process.env.K_UI_PATH) {
    return process.env.K_UI_PATH;
  }

  const version = process.env.K_UI_VERSION ?? "main";
  const cacheDir = path.join(os.homedir(), ".cache", "k-ui-mcp-server");
  // バージョンごとにディレクトリを分ける
  const repoDir = path.join(cacheDir, `k-ui-${version}`);

  if (fs.existsSync(path.join(repoDir, "src"))) {
    // 既にclone済み → fetchして指定バージョンに更新
    try {
      execSync(`git fetch --depth 1 --quiet origin ${version}`, {
        cwd: repoDir,
        stdio: "ignore",
      });
      execSync("git checkout --quiet FETCH_HEAD", {
        cwd: repoDir,
        stdio: "ignore",
      });
    } catch {
      // オフラインでも既存キャッシュで動作可能
    }
  } else {
    // 初回clone
    fs.mkdirSync(cacheDir, { recursive: true });
    execSync(
      `git clone --depth 1 --branch ${version} --quiet ${K_UI_REPO} "${repoDir}"`,
      { stdio: "ignore" }
    );
  }

  return repoDir;
}

const K_UI_PATH = resolveKuiPath();

// 起動時にソースを解析してキャッシュ
const components = parseComponents(K_UI_PATH);
const tokens = parseDesignTokens(K_UI_PATH);

const server = new McpServer({
  name: "k-ui-mcp-server",
  version: "1.0.0",
});

// ── list_components ──
server.tool(
  "list_components",
  "k-uiのコンポーネント一覧を返す",
  {
    category: z
      .enum(["atoms", "molecules", "templates"])
      .optional()
      .describe("カテゴリでフィルタ"),
  },
  async ({ category }) => {
    let filtered = components;
    if (category) {
      filtered = components.filter((c) => c.category === category);
    }

    const list = filtered.map((c) => ({
      name: c.name,
      category: c.category,
      description: c.description,
      filePath: c.filePath,
      propsCount: c.props.length,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(list, null, 2) }],
    };
  }
);

// ── get_component_schema ──
server.tool(
  "get_component_schema",
  "指定コンポーネントのProps定義・バリアント・使用例を返す",
  {
    component_name: z
      .string()
      .describe("コンポーネント名（例: Button, Dialog）"),
  },
  async ({ component_name }) => {
    const component = components.find(
      (c) => c.name.toLowerCase() === component_name.toLowerCase()
    );

    if (!component) {
      const available = components.map((c) => c.name).join(", ");
      return {
        content: [
          {
            type: "text",
            text: `コンポーネント "${component_name}" は見つかりませんでした。\n利用可能: ${available}`,
          },
        ],
      };
    }

    // Storybook情報を取得
    const story = parseStory(K_UI_PATH, component.filePath);

    const result = {
      name: component.name,
      category: component.category,
      description: component.description,
      filePath: component.filePath,
      importPath: `import { ${component.name} } from "k-ui";`,
      props: component.props,
      exportedTypes: component.exportedTypes,
      stories: story
        ? {
            title: story.title,
            examples: story.examples,
          }
        : null,
      sourceCode: component.sourceCode,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ── get_design_tokens ──
server.tool(
  "get_design_tokens",
  "デザイントークン（CSS変数）を返す",
  {
    category: z
      .enum(["colors", "spacing", "typography", "shadows", "animations", "radius"])
      .optional()
      .describe("カテゴリでフィルタ"),
  },
  async ({ category }) => {
    let filtered = tokens;
    if (category) {
      filtered = tokens.filter((t) => t.category === category);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }],
    };
  }
);

// ── validate_code ──
server.tool(
  "validate_code",
  "k-uiを使ったコードスニペットを検証する",
  {
    code: z.string().describe("検証するTSX/TSコードスニペット"),
  },
  async ({ code }) => {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // k-uiからインポートされているコンポーネントを特定
    const importPattern = /import\s*\{([^}]+)\}\s*from\s*["']k-ui["']/g;
    const importedNames: string[] = [];
    let importMatch;

    while ((importMatch = importPattern.exec(code)) !== null) {
      const names = importMatch[1].split(",").map((n) => n.trim());
      importedNames.push(
        ...names.filter((n) => !n.startsWith("type ") && n.length > 0)
      );
    }

    if (importedNames.length === 0) {
      // k-uiのコンポーネントがJSX内で使われているかチェック
      const componentNames = components.map((c) => c.name);
      const usedComponents = componentNames.filter((name) =>
        new RegExp(`<${name}[\\s/>]`).test(code)
      );

      if (usedComponents.length > 0) {
        errors.push({
          message: `k-uiのimportがありません。使用されているコンポーネント: ${usedComponents.join(", ")}`,
          suggestion: `import { ${usedComponents.join(", ")} } from "k-ui";`,
        });
      }
    }

    // インポートされたコンポーネントの存在チェック
    for (const name of importedNames) {
      const component = components.find((c) => c.name === name);
      if (!component) {
        // 型名かもしれない
        const isType = components.some((c) =>
          c.exportedTypes.includes(name)
        );
        if (!isType) {
          const similar = components
            .map((c) => c.name)
            .find(
              (n) => n.toLowerCase() === name.toLowerCase()
            );
          errors.push({
            message: `"${name}" はk-uiにエクスポートされていません`,
            suggestion: similar
              ? `"${similar}" ではありませんか？`
              : undefined,
          });
        }
      }
    }

    // 各コンポーネントのprops検証
    for (const name of importedNames) {
      const component = components.find((c) => c.name === name);
      if (!component) continue;

      // JSXでの使用箇所を探す
      const jsxPattern = new RegExp(`<${name}\\s+([^>]*)`, "g");
      let jsxMatch;

      while ((jsxMatch = jsxPattern.exec(code)) !== null) {
        const propsStr = jsxMatch[1];
        // 使用されているprops名を抽出
        const usedProps = [
          ...propsStr.matchAll(/(\w+)\s*[=]/g),
        ].map((m) => m[1]);

        const validPropNames = component.props.map((p) => p.name);
        // HTML属性は除外（className, onClick, id等）
        const htmlAttrs = [
          "className",
          "id",
          "style",
          "onClick",
          "onChange",
          "onSubmit",
          "onBlur",
          "onFocus",
          "ref",
          "key",
          "aria-label",
          "aria-labelledby",
          "aria-describedby",
          "data-testid",
          "role",
          "tabIndex",
          "type",
          "name",
          "value",
          "placeholder",
          "disabled",
          "autoFocus",
          "children",
        ];

        for (const usedProp of usedProps) {
          if (
            !validPropNames.includes(usedProp) &&
            !htmlAttrs.includes(usedProp) &&
            !usedProp.startsWith("data-") &&
            !usedProp.startsWith("aria-")
          ) {
            warnings.push({
              message: `${name}に "${usedProp}" プロパティは定義されていません（HTML属性の可能性あり）`,
              suggestion: `利用可能なprops: ${validPropNames.join(", ")}`,
            });
          }
        }

        // リテラル型の値を検証（variant, size等）
        for (const prop of component.props) {
          const literalValues = extractLiteralValues(prop.type);
          if (literalValues.length === 0) continue;

          const valuePattern = new RegExp(
            `${prop.name}\\s*=\\s*"([^"]+)"`,
            "g"
          );
          let valueMatch;
          while (
            (valueMatch = valuePattern.exec(propsStr)) !== null
          ) {
            const usedValue = valueMatch[1];
            if (!literalValues.includes(usedValue)) {
              errors.push({
                message: `${name}の${prop.name}に無効な値 "${usedValue}" が指定されています`,
                suggestion: `有効な値: ${literalValues.join(", ")}`,
              });
            }
          }
        }
      }
    }

    // tokens.cssのimportチェック
    const usesTokens = /var\(--kui-/.test(code);
    const hasTokenImport = /import\s+["']k-ui\/tokens\.css["']/.test(code);
    if (usesTokens && !hasTokenImport) {
      warnings.push({
        message: "k-uiのCSS変数を使用していますが、tokens.cssのimportがありません",
        suggestion: `import "k-ui/tokens.css";`,
      });
    }

    const result = {
      valid: errors.length === 0,
      errors,
      warnings,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

/**
 * リテラル型の文字列ユニオンから選択肢を抽出する
 * 例: '"primary" | "secondary"' → ["primary", "secondary"]
 * 例: 'ButtonVariant' → ソースから解決
 */
function extractLiteralValues(typeStr: string): string[] {
  const values: string[] = [];
  const literalPattern = /"([^"]+)"/g;
  let match;

  while ((match = literalPattern.exec(typeStr)) !== null) {
    values.push(match[1]);
  }

  // 型名参照の場合、コンポーネントの型定義から解決
  if (values.length === 0 && !typeStr.includes("{")) {
    const typeName = typeStr.trim();
    for (const component of components) {
      const typePattern = new RegExp(
        `export type ${typeName}\\s*=\\s*([^;]+)`,
        "m"
      );
      const typeMatch = component.sourceCode.match(typePattern);
      if (typeMatch) {
        const resolved = typeMatch[1];
        let literalMatch;
        while (
          (literalMatch = literalPattern.exec(resolved)) !== null
        ) {
          values.push(literalMatch[1]);
        }
        break;
      }
    }
  }

  return values;
}

// サーバー起動
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("MCPサーバーの起動に失敗しました:", error);
  process.exit(1);
});
