# 水泳教室 振替予約システム

## プロジェクト概要

水泳教室の振替希望受付と待ちリスト管理を自動化するフルスタックWebアプリケーション。保護者が振替枠を検索・予約でき、満員の場合は順番待ちに登録できます。空きが出た際は待ち順に自動的に振替予約が確定され、確定通知メールが送信されます。

## 技術スタック

- **フロントエンド**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **バックエンド**: Node.js + Express + TypeScript
- **データベース**: Prisma + SQLite（開発用）
- **メール送信**: Resend API（Replit統合）
- **スケジューラ**: node-cron
- **フォント**: Noto Sans JP

## 主要機能

### 保護者向け画面（/）

1. **検索フォーム**
   - 子どもの名前、クラス帯（初級/中級/上級）、欠席日を入力
   - 欠席日の前後30日の範囲で振替可能枠を検索

2. **候補一覧表示**
   - ○（残り2枠以上）：即時予約可能
   - △（残り1枠）：即時予約可能
   - ×（残り0枠）：順番待ち登録

3. **即時予約**（○/△の枠）
   - クリック1つで振替予約が確定

4. **順番待ち登録**（×の枠）
   - メールアドレスを入力して順番待ちに登録
   - 空きが出次第、自動的に予約が確定され、通知メールが送信される

### 管理画面（/admin）

1. **確定一覧タブ**
   - 確定済みの振替リクエストを一覧表示
   - 事務局が既存管理システムへ手入力するためのデータ

2. **待ち一覧タブ**
   - 待ちリストの状況を枠ごとに表示
   - 枠容量（振替受入枠数、使用済み枠数）の編集機能
   - 「1時間前クローズ」ボタンで待ちリストを手動クローズ

3. **枠管理タブ**
   - ClassSlot（レッスン枠）の作成・編集・削除機能
   - 日時、コース名、クラス帯、定員、振替受入枠数の設定
   - 休館日の登録・削除機能（日付と休館日名の設定）

### 自動処理

1. **空き枠発生時の自動確定**
   - 管理画面で枠容量を編集し、空きが増えた場合
   - 辞退により空きが出た場合
   - 待ち順（登録順）に自動的に予約を確定し、通知メールを送信

2. **レッスン開始1時間前の自動クローズ**
   - node-cronスケジューラが10分ごとにチェック
   - 開始1時間前を過ぎた枠の待ちリストを自動クローズ
   - 未案内の待ち者に「今回はご案内できませんでした」メールを送信

## APIエンドポイント

### 保護者向け
- `POST /api/search-slots` - 振替候補検索
- `POST /api/book` - 即時予約
- `POST /api/waitlist` - 順番待ち登録
- `GET /api/wait-decline?token=...` - 辞退処理

### 管理画面向け
- `GET /api/admin/confirmed` - 確定リクエスト一覧取得
- `GET /api/admin/waiting` - 待ちリスト一覧取得
- `POST /admin/update-slot-capacity` - 枠容量更新
- `POST /admin/close-waitlist` - 待ちリスト手動クローズ
- `GET /api/admin/slots` - 全ClassSlot取得
- `POST /api/admin/create-slot` - ClassSlot作成
- `PUT /api/admin/update-slot` - ClassSlot更新
- `DELETE /api/admin/delete-slot` - ClassSlot削除
- `GET /api/admin/holidays` - 休館日一覧取得
- `POST /api/admin/create-holiday` - 休館日登録
- `DELETE /api/admin/delete-holiday` - 休館日削除

## データモデル

### GlobalSettings
- グローバル設定（振替可能日数、締切時刻など）

### ClassSlot
- レッスン枠（日時、コース名、クラス帯、容量情報など）

### Holiday
- 休館日（日付、休館日名）

### Request
- 振替リクエスト（子ども名、欠席日、振替先、ステータスなど）

## 最近の変更

**2025-10-28 (2)**: ClassSlot管理と休館日管理機能を追加
- 管理画面に「枠管理」タブを追加
- ClassSlot（レッスン枠）のCRUD機能を実装：
  - 作成・編集・削除のダイアログUI
  - 日時、コース名、クラス帯、定員、振替受入枠数の設定
  - バックエンドAPIの実装（create/update/delete）
- 休館日管理機能を実装：
  - 休館日の登録・削除UI
  - Holidayモデルの追加（Prismaスキーマ）
  - バックエンドAPIの実装（create/delete）
- データバリデーション強化：
  - createHolidayRequestSchemaに日付形式の正規表現バリデーション追加
  - shared/schema.tsにHolidayResponse型を追加し型の重複を解消
- E2Eテスト成功：全機能が正常に動作
- Architectレビュー合格：コード品質、セキュリティ、保守性の確認完了

**2025-10-28 (1)**: 重要なバグ修正とMVP完成
- **重大なバグ修正**: apiRequest関数がJSONを返すように修正（検索結果が表示されない問題を解決）
- FormFieldコンポーネントを使用してフォームをreact-hook-formと完全統合
- 保護者向け画面と管理画面間のナビゲーションリンクを追加
- すべてのコア機能のE2Eテスト成功を確認：
  - 検索機能
  - 即時予約機能
  - 順番待ち登録機能
  - 管理画面での容量編集と自動確定
- Architectレビュー完了：主要機能に致命的不備なし

**2025-01-28**: 初回実装完了
- Prismaスキーマ定義とマイグレーション
- 保護者向け画面（検索フォーム、候補一覧、予約・順番待ち）
- 管理画面（確定一覧、待ち一覧、容量編集）
- Resend統合によるメール送信機能
- node-cronスケジューラによる自動クローズ処理
- 空き枠発生時の自動確定ロジック

## プロジェクト構成

```
.
├── prisma/
│   ├── schema.prisma         # Prismaスキーマ定義
│   ├── seed.ts              # シードデータ
│   └── migrations/          # マイグレーションファイル
├── server/
│   ├── index.ts            # Expressサーバーエントリポイント
│   ├── routes.ts           # APIルート定義
│   ├── db.ts               # Prisma Client
│   ├── resend-client.ts    # Resend統合クライアント
│   ├── email-service.ts    # メール送信サービス
│   └── scheduler.ts        # node-cronスケジューラ
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── parent.tsx    # 保護者向け画面
│   │   │   └── admin.tsx     # 管理画面
│   │   ├── components/
│   │   │   └── waitlist-dialog.tsx  # 順番待ち登録ダイアログ
│   │   └── App.tsx          # ルーティング設定
│   └── index.html
├── shared/
│   └── schema.ts           # 共有型定義・バリデーションスキーマ
└── design_guidelines.md    # デザインガイドライン
```

## 開発メモ

- Noto Sans JPフォントを使用した日本語対応
- Material Design 3インスパイアのデザインシステム
- ○/△/×のステータス表示でわかりやすいUI
- レスポンシブデザイン対応
- メールテンプレートはHTMLで美しくデザイン
