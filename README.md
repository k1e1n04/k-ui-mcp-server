# k-ui MCP Server

[k-ui](https://github.com/k1e1n04/k-ui) コンポーネントライブラリの情報を LLM に提供する MCP サーバー。

## セットアップ

### Claude Code

`.claude/settings.json` に追加:

```json
{
  "mcpServers": {
    "k-ui": {
      "command": "npx",
      "args": ["-y", "github:k1e1n04/k-ui-mcp-server"]
    }
  }
}
```

ローカルの k-ui ソースを参照する場合は `K_UI_PATH` を指定:

```json
{
  "mcpServers": {
    "k-ui": {
      "command": "npx",
      "args": ["-y", "github:k1e1n04/k-ui-mcp-server"],
      "env": {
        "K_UI_PATH": "/path/to/k-ui"
      }
    }
  }
}
```

`K_UI_PATH` 未指定の場合、GitHub から自動的に clone して `~/.cache/k-ui-mcp-server/` にキャッシュします。

### バージョン指定

`K_UI_VERSION` でブランチやタグを指定できます（デフォルト: `main`）:

```json
{
  "mcpServers": {
    "k-ui": {
      "command": "npx",
      "args": ["-y", "github:k1e1n04/k-ui-mcp-server"],
      "env": {
        "K_UI_VERSION": "v1.2.0"
      }
    }
  }
}
```

バージョンごとにキャッシュが分かれるため、複数バージョンの切り替えも可能です。

## ツール

| ツール | 説明 |
|---|---|
| `list_components` | コンポーネント一覧を返す。`category` で atoms/molecules/templates をフィルタ可能 |
| `get_component_schema` | 指定コンポーネントの Props 定義・デフォルト値・Storybook 使用例・ソースコードを返す |
| `get_design_tokens` | デザイントークン（CSS 変数）を返す。`category` で colors/spacing/typography/shadows/animations/radius をフィルタ可能 |
| `validate_code` | k-ui を使った TSX コードスニペットを検証する（import チェック・props 値の検証・tokens.css の有無） |

## 開発

```bash
npm install
npm run build
```
