import fs from "node:fs";
import path from "node:path";
import type {
  ComponentCategory,
  ComponentInfo,
  PropField,
} from "../types.js";

/** カテゴリディレクトリとカテゴリの対応 */
const CATEGORY_DIRS: Record<string, ComponentCategory> = {
  atoms: "atoms",
  molecules: "molecules",
  templates: "templates",
};

/**
 * k-uiのコンポーネントソースを解析して情報を抽出する
 */
export function parseComponents(kuiPath: string): ComponentInfo[] {
  const componentsDir = path.join(kuiPath, "src", "components");
  const components: ComponentInfo[] = [];

  for (const [dir, category] of Object.entries(CATEGORY_DIRS)) {
    const categoryDir = path.join(componentsDir, dir);
    if (!fs.existsSync(categoryDir)) continue;

    const entries = fs.readdirSync(categoryDir, { withFileTypes: true });
    for (const entry of entries) {
      // ディレクトリのみ（index.tsを除外）
      if (!entry.isDirectory()) continue;

      const componentFile = path.join(
        categoryDir,
        entry.name,
        `${entry.name}.tsx`
      );
      if (!fs.existsSync(componentFile)) continue;

      const sourceCode = fs.readFileSync(componentFile, "utf-8");
      const relativePath = path.relative(kuiPath, componentFile);

      const info = parseComponentSource(
        entry.name,
        category,
        relativePath,
        sourceCode
      );
      components.push(info);
    }
  }

  return components;
}

/**
 * コンポーネントのソースコードからProps等を抽出する
 */
function parseComponentSource(
  name: string,
  category: ComponentCategory,
  filePath: string,
  sourceCode: string
): ComponentInfo {
  return {
    name,
    category,
    description: extractComponentDescription(sourceCode, name),
    filePath,
    props: extractProps(sourceCode, name),
    exportedTypes: extractExportedTypes(sourceCode),
    sourceCode,
  };
}

/**
 * コンポーネントのJSDoc説明を抽出する
 */
function extractComponentDescription(
  sourceCode: string,
  componentName: string
): string {
  // コンポーネント宣言直前のJSDocを探す
  const pattern = new RegExp(
    `/\\*\\*\\s*\\n\\s*\\*\\s*(.+?)\\s*\\n\\s*\\*/\\s*\\nexport const ${componentName}`,
    "m"
  );
  const match = sourceCode.match(pattern);
  return match?.[1] ?? "";
}

/**
 * Props interfaceからフィールドを抽出する
 */
function extractProps(sourceCode: string, componentName: string): PropField[] {
  // Props interfaceのブロックを取得
  const propsInterfaceName = `${componentName}Props`;
  const interfacePattern = new RegExp(
    `export interface ${propsInterfaceName}[^{]*\\{([\\s\\S]*?)^\\}`,
    "m"
  );
  const interfaceMatch = sourceCode.match(interfacePattern);
  if (!interfaceMatch) return [];

  const interfaceBody = interfaceMatch[1];
  const props: PropField[] = [];

  // 各propsフィールドを抽出（JSDoc付き）
  const fieldPattern =
    /(?:\/\*\*\s*(.+?)\s*\*\/\s*\n\s*)?(\w+)(\??):\s*([^;]+);/g;
  let fieldMatch;

  while ((fieldMatch = fieldPattern.exec(interfaceBody)) !== null) {
    const [, description, fieldName, optional, type] = fieldMatch;
    // extendsしたHTML属性のフィールドは除外
    if (fieldName === "extends") continue;

    const defaultValue = extractDefaultValue(sourceCode, fieldName);

    props.push({
      name: fieldName,
      type: type.trim(),
      required: optional !== "?",
      defaultValue,
      description: description?.trim(),
    });
  }

  return props;
}

/**
 * デフォルト値を抽出する（destructuring assignmentから）
 */
function extractDefaultValue(
  sourceCode: string,
  propName: string
): string | undefined {
  const pattern = new RegExp(`${propName}\\s*=\\s*([^,}]+)`);
  const match = sourceCode.match(pattern);
  if (!match) return undefined;
  const value = match[1].trim();
  // 型アノテーションやスプレッド演算子でなければ返す
  if (value.startsWith("...") || value.includes(":")) return undefined;
  return value;
}

/**
 * exportされた型名を抽出する
 */
function extractExportedTypes(sourceCode: string): string[] {
  const types: string[] = [];
  const pattern = /export (?:type|interface) (\w+)/g;
  let match;
  while ((match = pattern.exec(sourceCode)) !== null) {
    types.push(match[1]);
  }
  return types;
}
