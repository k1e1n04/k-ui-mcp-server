/** コンポーネントのカテゴリ */
export type ComponentCategory = "atoms" | "molecules" | "templates";

/** コンポーネントのPropsフィールド */
export interface PropField {
  /** フィールド名 */
  name: string;
  /** 型名 */
  type: string;
  /** 必須かどうか */
  required: boolean;
  /** デフォルト値 */
  defaultValue?: string;
  /** JSDocの説明 */
  description?: string;
}

/** コンポーネント情報 */
export interface ComponentInfo {
  /** コンポーネント名 */
  name: string;
  /** カテゴリ */
  category: ComponentCategory;
  /** JSDocから抽出した説明 */
  description: string;
  /** ファイルパス（k-uiルートからの相対パス） */
  filePath: string;
  /** Props定義 */
  props: PropField[];
  /** エクスポートされる型名 */
  exportedTypes: string[];
  /** コンポーネントのソースコード */
  sourceCode: string;
}

/** Storyの使用例 */
export interface StoryExample {
  /** Story名 */
  name: string;
  /** argsの内容 */
  args: Record<string, string>;
}

/** Storybook情報 */
export interface StoryInfo {
  /** Storybookのタイトル */
  title: string;
  /** 使用例一覧 */
  examples: StoryExample[];
  /** ソースコード */
  sourceCode: string;
}

/** デザイントークン */
export interface DesignToken {
  /** CSS変数名 */
  name: string;
  /** 値 */
  value: string;
  /** カテゴリ */
  category: TokenCategory;
  /** ダークモード時の値 */
  darkValue?: string;
}

/** トークンカテゴリ */
export type TokenCategory =
  | "colors"
  | "spacing"
  | "typography"
  | "shadows"
  | "animations"
  | "radius";

/** コード検証結果 */
export interface ValidationResult {
  /** 検証OK/NG */
  valid: boolean;
  /** エラー一覧 */
  errors: ValidationError[];
  /** 警告一覧 */
  warnings: ValidationWarning[];
}

/** 検証エラー */
export interface ValidationError {
  /** エラーメッセージ */
  message: string;
  /** 修正提案 */
  suggestion?: string;
}

/** 検証警告 */
export interface ValidationWarning {
  /** 警告メッセージ */
  message: string;
  /** 修正提案 */
  suggestion?: string;
}
