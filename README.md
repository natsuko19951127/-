# TEAM FLOW

PCとスマートフォンの両方で使える、社内業務ダッシュボードです。

## 使い方マニュアル

スタッフの日報入力、店長の確認、保存・送信の注意点は [使い方マニュアル](./使い方マニュアル.md) を参照してください。

## Claude Codeで開く

1. ZIPを展開します。
2. Claude Codeで展開したフォルダを開きます。
3. ターミナルで `npm run dev` を実行します。
4. ブラウザで `http://localhost:4173` を開きます。

## コマンド

```bash
npm run dev    # ローカルプレビュー
npm run check  # JavaScriptの構文確認
```

## 構成

```text
dist/
├── index.html
├── styles.css
└── app.js
CLAUDE.md
README.md
package.json
```

データはブラウザのローカルストレージに保存されます。バックエンドやデータベースは使用していません。
