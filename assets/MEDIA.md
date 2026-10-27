# 素材の出自（2026-10-27）

- `character/stage-01.png`〜`stage-04.png`、`stage-06.png`〜`stage-10.png`：ユーザー提供の「デザイン/体型XX.png」をコピー。元画像を変更していない。
- `character/stage-05.png`：ユーザー提供「デザイン/体型05.png」から市松模様を除去した派生画像。組み込み画像生成ツールを使用。APIキー・CLIは使用していない。
- `background/room.png`：ユーザー提供の食事画面イメージから、UIとキャラクターを除去した派生背景。同じ組み込み画像生成ツールを使用。
- `background/home-sky.png`：ユーザー提供のホーム画面から、猫・文字・UIを除去したホーム専用背景。窓から見える青空と白い雲を保つよう組み込み画像生成ツールで編集。元の参考画像は変更していない。
- `character/manifest.json`：アルファの範囲を読み取った表示用メタデータ。ピクセルは編集しない。生成スクリプトは `tools/character-manifest.py`。
- `audio/*.wav`：`tools/generate-meows.py` によるオリジナルの波形合成。外部録音、声優の音声、TTS、API、既存キャラクターの声を使用していない。猫風の合成音であり、実際の猫の録音ではない。

## 背景の最終プロンプト（組み込みツール）

Use case: precise-object-edit. Edit the reference into a clean BACKGROUND ONLY asset for the same Mochineko mobile meal app. Remove the entire cat, speech bubble, all text, lunch pill, all icons, the pink button and all UI. Reconstruct the cozy sunny living room with window on left, pale curtains, warm cream walls, softly blurred wooden shelves/plants right, cream textured rug filling bottom half. Preserve exact warm cream honey palette and softly blurred 3D photographed depth of field of the reference. Floor visible naturally, no tables, no plates, no food, no creatures, no text, no borders. Entire portrait canvas filled edge to edge with the living room background. Foreground floor center empty to composite existing cat on top. This is production background asset, not a UI mockup. 1024x1536 portrait.

## 体型05の最終プロンプト（組み込みツール）

Use case: background-extraction. Edit this exact existing cat asset: remove ONLY the gray/white checkerboard backdrop and replace it with actual transparent alpha. Preserve the exact same cat, same round body size, face, half-lidded eyes, tan markings, pink ears and nose, whiskers, tail and paws, pose, head tilt, soft 3D fur, lighting. Clean anti-aliased edge without white fringe or checkerboard fragments. Keep entire cat within square canvas, slight even safety margin all sides, no cropping. No text or shadow rectangle. Do not redesign the character. Transparent PNG production asset.

## 青空のホーム背景の最終プロンプト（組み込みツール）

Use case: precise-object-edit. Create a production BACKGROUND ONLY edit of this exact reference home screen. Remove the entire cat, all UI cards/buttons, all text/title/logo/paw icons, phone status bar/icons. Preserve the reference's cozy sunlit cream dining room, wooden shelf and green plants on left, white sheer curtains, warm honey-colored wood and pale yellow gingham table around the middle. MOST IMPORTANT: preserve and clearly show the large window in the UPPER RIGHT with fresh pale BLUE SKY and soft WHITE CLOUDS visible through it, matching this reference. Blue sky should occupy rightmost 40 percent of the upper half; do not fill it with a brown wall or curtain. Reconstruct the room and the empty table where cat and UI were removed, naturally extending the warmly lit dining room into the lower portion. Background softly out of focus like original, but sky clearly identifiable as blue and clouds white. Keep the upper right sky bright and calm so brown app title can be drawn over it later. No letters, no UI, no characters, no animals, no symbols, no frames. Portrait 1024x1536, edge-to-edge. This image will be used under real HTML controls and the existing cat, so do not add any new design elements.

## フォント

`fonts/ZenMaruGothic-Bold.ttf` はGoogle Fonts公式配布のZen Maru Gothic Boldを変更せず同梱。SIL Open Font License 1.1全文を `fonts/OFL-ZenMaruGothic.txt` に保存。

- プロジェクト：https://github.com/googlefonts/zen-marugothic
- 取得元：https://raw.githubusercontent.com/google/fonts/main/ofl/zenmarugothic/ZenMaruGothic-Bold.ttf
- 吹き出し・終了ボタンの猫マークと飾り線は、このアプリ用にSVGで作成。
