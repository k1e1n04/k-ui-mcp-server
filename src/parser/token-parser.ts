import fs from "node:fs";
import path from "node:path";
import type { DesignToken, TokenCategory } from "../types.js";

/** CSSファイルとトークンカテゴリの対応 */
const TOKEN_FILES: Record<string, TokenCategory> = {
  "colors.css": "colors",
  "spacing.css": "spacing",
  "typography.css": "typography",
  "shadows.css": "shadows",
  "animations.css": "animations",
};

/**
 * デザイントークンをCSSファイルから解析する
 */
export function parseDesignTokens(kuiPath: string): DesignToken[] {
  const tokensDir = path.join(kuiPath, "src", "tokens");
  const tokens: DesignToken[] = [];

  for (const [file, category] of Object.entries(TOKEN_FILES)) {
    const filePath = path.join(tokensDir, file);
    if (!fs.existsSync(filePath)) continue;

    const cssContent = fs.readFileSync(filePath, "utf-8");

    if (category === "animations") {
      tokens.push(...parseAnimations(cssContent));
    } else {
      tokens.push(...parseCSSVariables(cssContent, category));
    }
  }

  // spacing.cssにはradiusも含まれるので分類を補正
  for (const token of tokens) {
    if (token.name.includes("-radius-")) {
      token.category = "radius";
    }
  }

  return tokens;
}

/**
 * CSS変数を解析する（:rootブロックとダークモードブロック）
 */
function parseCSSVariables(
  cssContent: string,
  category: TokenCategory
): DesignToken[] {
  const tokens = new Map<string, DesignToken>();

  // :rootの変数を取得
  const rootPattern = /:root\s*\{([^}]+)\}/g;
  let rootMatch;
  let isFirst = true;

  while ((rootMatch = rootPattern.exec(cssContent)) !== null) {
    const block = rootMatch[1];
    const isDark = !isFirst; // 2番目の:rootブロックはダークモード

    const varPattern = /(--[\w-]+)\s*:\s*([^;]+);/g;
    let varMatch;

    while ((varMatch = varPattern.exec(block)) !== null) {
      const name = varMatch[1].trim();
      const value = varMatch[2].trim();

      if (isDark) {
        const existing = tokens.get(name);
        if (existing) {
          existing.darkValue = value;
        }
      } else {
        tokens.set(name, { name, value, category });
      }
    }

    isFirst = false;
  }

  // @media (prefers-color-scheme: dark) 内の変数も処理
  const darkMediaPattern =
    /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([^}]+)\}/;
  const darkMatch = cssContent.match(darkMediaPattern);
  if (darkMatch) {
    const block = darkMatch[1];
    const varPattern = /(--[\w-]+)\s*:\s*([^;]+);/g;
    let varMatch;

    while ((varMatch = varPattern.exec(block)) !== null) {
      const name = varMatch[1].trim();
      const value = varMatch[2].trim();
      const existing = tokens.get(name);
      if (existing) {
        existing.darkValue = value;
      } else {
        tokens.set(name, { name, value: "", category, darkValue: value });
      }
    }
  }

  return Array.from(tokens.values());
}

/**
 * @keyframesアニメーションを解析する
 */
function parseAnimations(cssContent: string): DesignToken[] {
  const tokens: DesignToken[] = [];
  const pattern = /@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\n\}/g;
  let match;

  while ((match = pattern.exec(cssContent)) !== null) {
    const name = match[1];
    const body = match[2].trim();
    tokens.push({
      name,
      value: body,
      category: "animations",
    });
  }

  return tokens;
}
