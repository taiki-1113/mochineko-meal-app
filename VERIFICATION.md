# 実装確認（2026-10-27）

環境：Windows / Chrome 156（Playwright Chromium制御）。独立した一時ブラウザープロファイルで実行し、既存ユーザーのブラウザーデータは変更していない。

## PASS

- 未登録から設定へ誘導、漢字名の拒否、ひらがな登録後の食事開始。
- 開始と同時の時刻保存、開始8秒、通常動作への遷移。
- 通常4回目の名前差し込み、直前の文との重複なし。
- 吹き出し8秒と消失後3秒のタップ制限、表示中の割り込み禁止。
- 10分設定の体型01〜09すべての境界。目標到達で自動終了せず180秒後に睡眠。
- 睡眠中のタップで起床・吹き出しなし。終了確認の継続でセッション維持。
- 終了確定から約8秒間表示し、ホームへ戻ってセッションを削除。
- 実際のWeb Audio再生で、開始→終了の割り込み時に同時音源が最大1つ。音を有効にした終了待ちも確認。
- 名前編集後もID維持、3人上限、削除後の再追加、音OFFの保存・再読み込み。
- 再読み込みで睡眠を復元。非同期の画像情報ロード後にホームが重複しない。
- 320×568、375×667、844×390、1280×900で横はみ出しなし。12文字の名前でも吹き出しとキャラクターが重ならない。
- サービスワーカーの実キャッシュ後に通信OFFで再読み込み・画像表示・登録・食事開始。
- キャッシュ内の体型PNG10枚・WAV13ファイル・画像メタデータの取得成功。
- WAV13ファイルはPCM16bit mono、22,050Hz。波形の最大値はクリッピング未満。
- app.js / audio.js / messages.js / sw.js のJavaScript構文確認。

## スクリーンショット

- `output/verification/home.png`
- `output/verification/meal.png`
- `output/verification/sleep.png`
- `output/verification/small-screen.png`

## 未確認・品質上の制約

- iPhone Safari・ホーム画面PWAの実機、通知・電話後の音の再開、iOS消音スイッチ、画面消灯とWake Lock。
- 鳴き声はオリジナル合成音で、利用者による聞き心地の採否は未確定。
- 画像の縁、視点差、前足を寄せる簡易アニメーションの最終デザイン確認。
- GitHub Pagesへの今回の更新の公開。作業フォルダーにGit管理情報はない。

検証スクリプト：`tools/verify-app.cjs`。Playwrightを利用可能なNODE_PATHとChrome実行ファイル（環境変数MOCHI_CHROMEで変更可）が必要。テスト用HTTPサーバーを内部で起動する。

## ホーム微調整の確認（2026-10-27）

`tools/verify-home-design.cjs` で確認。390×844でホーム下部の操作エリアは461px→345px（74.84%）、ヒーロー領域は362.91px→481.08px。開始ボタンの文字はボタン中心とのずれ1px未満。朝昼夜ボタンと開始の操作領域44px以上を維持。

320×568、375×667、390×844、844×390、1280×900で横はみ出しなし。親向けの漢字表記と子ども用のひらがな吹き出し、開始遷移を確認。v7キャッシュで青空背景 home-sky.png のオフライン取得成功。

修正後の実画面：`output/verification/home-refined.png`、`home-refined-small.png`、`settings-refined.png`。

## プレイ画面微調整の確認（2026-10-27）

`tools/verify-play-design.cjs` で確認。390×844（丸い姿・最大体型）、320×568（細身・12文字の名前）、844×390（横向き）で、吹き出しが顔側を指すこと、本文が吹き出し内に収まること、終了ボタンの文字とイラスト・矢印が重ならないこと、横はみ出しがないことを確認。Zen Maru Gothicの実フォント読込を確認し、v8キャッシュでのオフライン取得成功。

実画面：`output/verification/play-refined.png`、`play-refined-small.png`、`play-refined-large-cat.png`、`play-refined-longname.png`、`play-refined-landscape.png`。
