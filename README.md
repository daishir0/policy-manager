# policy-manager

## Overview
Policy Manager is a document management system for organizational policies, guidelines, and handbooks. It provides AI-powered features including Q&A with document references, contradiction checking between documents, and draft generation assistance.

Key features:
- Document management with versioning and lifecycle (draft → published → retired)
- Category and organization hierarchy for document classification
- AI-powered Q&A using RAG (Retrieval-Augmented Generation)
- Contradiction detection between new and existing documents
- AI-assisted document draft generation
- Access analytics and improvement proposals
- Role-based access control (Admin, Document Admin, Employee)

## Installation

### Prerequisites
- Node.js 18+
- PostgreSQL 15+ with pgvector extension
- Anthropic API key (for AI features)

### Local Installation

1. Clone the repository:
```bash
git clone https://github.com/daishir0/policy-manager.git
cd policy-manager
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.sample .env
# Edit .env with your configuration
```

4. Set up the database:
```bash
# Create PostgreSQL database with pgvector extension
psql -c "CREATE DATABASE policy_manager;"
psql -d policy_manager -c "CREATE EXTENSION vector;"

# Run migrations
npx prisma migrate deploy

# Seed initial data (optional)
npx prisma db seed
```

5. Build and start:
```bash
npm run build
npm start
```

### Vercel Deployment

1. Fork this repository to your GitHub account

2. Connect to Vercel:
   - Go to [Vercel](https://vercel.com)
   - Import your forked repository
   - Configure environment variables in Vercel dashboard

3. Set up database:
   - Use Vercel Postgres or external PostgreSQL with pgvector support
   - Add DATABASE_URL to environment variables

4. Deploy:
   - Vercel will automatically build and deploy

## Usage

1. Access the application at your configured URL
2. Log in with admin credentials (default: admin@example.com / password123)
3. Navigate using the sidebar:
   - **Documents**: Create, edit, and manage policy documents
   - **Search**: Find documents by keyword
   - **Q&A**: Ask questions about policies (AI-powered)
   - **Draft**: Generate document drafts using AI
   - **Analytics**: View access statistics
   - **Proposals**: Review AI-generated improvement suggestions

## Notes
- AI features require a valid Anthropic API key
- For production, change the default admin password immediately
- E2E tests must be run against a deployed instance (not localhost)
- pgvector extension is required for vector similarity search

## License
This project is licensed under the MIT License - see the LICENSE file for details.

---

# policy-manager

## 概要
Policy Managerは、組織の方針書・ガイドライン・ハンドブック等を管理するための文書管理システムです。AIを活用したQ&A機能、文書間の矛盾チェック、文案生成支援などの機能を提供します。

主な機能:
- バージョン管理付き文書管理（下書き → 公開 → 廃止のライフサイクル）
- カテゴリと組織階層による文書分類
- RAG（検索拡張生成）を使用したAI Q&A
- 新規文書と既存文書間の矛盾検出
- AIによる文書案生成支援
- アクセス分析と改善提案
- ロールベースのアクセス制御（管理者・文書管理者・従業員）

## インストール方法

### 前提条件
- Node.js 18以上
- PostgreSQL 15以上（pgvector拡張機能付き）
- Anthropic APIキー（AI機能用）

### ローカルインストール

1. リポジトリをクローン:
```bash
git clone https://github.com/daishir0/policy-manager.git
cd policy-manager
```

2. 依存関係をインストール:
```bash
npm install
```

3. 環境変数を設定:
```bash
cp .env.sample .env
# .envを編集して設定を入力
```

4. データベースをセットアップ:
```bash
# pgvector拡張機能付きのPostgreSQLデータベースを作成
psql -c "CREATE DATABASE policy_manager;"
psql -d policy_manager -c "CREATE EXTENSION vector;"

# マイグレーションを実行
npx prisma migrate deploy

# 初期データを投入（オプション）
npx prisma db seed
```

5. ビルドして起動:
```bash
npm run build
npm start
```

### Vercelへのデプロイ

1. このリポジトリをGitHubアカウントにフォーク

2. Vercelに接続:
   - [Vercel](https://vercel.com)にアクセス
   - フォークしたリポジトリをインポート
   - Vercelダッシュボードで環境変数を設定

3. データベースをセットアップ:
   - Vercel Postgresまたはpgvector対応の外部PostgreSQLを使用
   - DATABASE_URLを環境変数に追加

4. デプロイ:
   - Vercelが自動的にビルドしてデプロイ

## 使い方

1. 設定したURLでアプリケーションにアクセス
2. 管理者認証情報でログイン（デフォルト: admin@example.com / password123）
3. サイドバーを使用してナビゲート:
   - **文書一覧**: ポリシー文書の作成・編集・管理
   - **検索**: キーワードで文書を検索
   - **Q&A対話**: ポリシーについて質問（AI機能）
   - **文案生成**: AIを使用して文書案を生成
   - **アクセス統計**: アクセス統計を表示
   - **改善提案**: AIが生成した改善提案を確認

## 注意点
- AI機能には有効なAnthropic APIキーが必要です
- 本番環境では、デフォルトの管理者パスワードを直ちに変更してください
- E2Eテストはデプロイされたインスタンスに対して実行する必要があります（localhostではない）
- ベクトル類似検索にはpgvector拡張機能が必要です

## ライセンス
このプロジェクトはMITライセンスの下でライセンスされています。詳細はLICENSEファイルを参照してください。
