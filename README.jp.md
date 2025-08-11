# ESLyric-LyricGeminiStrip

ESLyric向けの拡張歌詞取得プラグイン集です。Gemini AIを使用した歌詞タイトル正規化機能付きで、より正確な歌詞取得を実現します。

## 概要

このプロジェクトには、以下の音楽サービス向けの歌詞取得プラグインが含まれています：

- **kugou.js** - 酷狗音楽（KuGou）
- **musixmatch.js** - Musixmatch
- **netease.js** - 网易云音乐（NetEase Cloud Music）
- **qqmusic.js** - QQ音乐（QQ Music）

## 特徴

- 🎵 複数の音楽サービスから歌詞を取得
- 🧠 Gemini AIによる楽曲タイトル正規化
- 🔍 カバー楽曲、リミックス、注釈の自動除去
- 📝 同期歌詞（LRC、QRC）対応
- ⚙️ 設定可能なAPIキーとオプション

## セットアップ

### 1. ESLyricでの設定

これらのプラグインをESLyricで使用するには：

1. ESLyricのプラグインディレクトリに`.js`ファイルをコピー
2. ESLyricでプラグインを有効化

### 2. Gemini AI設定（オプション）

より高精度な歌詞検索のためにGemini AIを設定できます：

1. [Google AI Studio](https://aistudio.google.com/app/apikey)でAPIキーを取得
2. ESLyricで以下の設定を行う：
   - `gemini_enabled` = "1"
   - `gemini_api_key` = "YOUR_API_KEY_HERE"

### 3. 手動設定（開発者向け）

各ファイルの設定値を直接編集することも可能です：

```javascript
const DEFAULT_GEMINI_ENABLED = true; // true/false
const DEFAULT_GEMINI_API_KEY = "YOUR_API_KEY_HERE";
```

## 使用方法

1. ESLyricで楽曲を再生
2. 歌詞取得を実行
3. プラグインが自動的に：
   - 楽曲タイトルを正規化
   - 複数のサービスから歌詞を検索
   - 最適な歌詞を返却

## Gemini AI正規化機能

### 処理例

- `少女レイ / みきとP cover 9Lana` → `少女レイ`
- `のだ covered by Mirea Sheltzs ・陽月るるふ・よしか⁂【歌ってみた】` → `のだ`
- `KING feat. Kanaria (Official MV)` → `KING`

### 除去される要素

- アーティスト名・作者・作曲・編曲・プロデューサー情報
- feat./ft./featuring
- ver./version/MV/PV/live/remix/short/full
- カバー・covered by・歌ってみた・翻唱
- ハッシュタグ・絵文字・注釈【】()[]
- 区切り文字以降の情報（/, ／, |, ｜, -, ・, ·, ~, 〜）

## 技術仕様

### 対応フォーマット

- **LRC** - 標準歌詞フォーマット
- **QRC** - QQ音楽の拡張フォーマット
- **KRC** - 酷狗音楽の独自フォーマット

### APIエンドポイント

- Gemini AI: `generativelanguage.googleapis.com`
- 酷狗音楽: `lyrics.kugou.com`
- Musixmatch: `apic-desktop.musixmatch.com`
- 网易云音乐: `music.163.com`
- QQ音楽: `c.y.qq.com`, `u.y.qq.com`

## トラブルシューティング

### よくある問題

1. **歌詞が見つからない**

   - 楽曲タイトルに余計な情報が含まれている可能性があります
   - Gemini AI機能を有効にしてみてください

2. **Gemini AIが動作しない**

   - APIキーが正しく設定されているか確認
   - APIクォータが残っているか確認

3. **エラーメッセージ**
   - ESLyricのログを確認してください
   - ネットワーク接続を確認してください

## ライセンス

このプロジェクトはオープンソースです。各音楽サービスの利用規約に従ってご使用ください。

## クレジット

- 网易云音乐API: [NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi)
- QQ音楽API: [QQMusicApi](https://github.com/jsososo/QQMusicApi), [QRCD](https://github.com/xmcp/QRCD)
- 暗号化: [crypto-es](https://github.com/entronad/crypto-es)

## 貢献

プルリクエストやイシューの報告を歓迎します。
