# Googleカレンダーを接続する

Nightstandで週の行を押し、「Googleカレンダー」を開きます。Googleで共有・追加済みのカレンダーを複数選び、読み取り専用で表示します。予定の作成・変更はGoogleカレンダーで行ってください。

## 最初のアプリ登録

1. [Google Cloud](https://console.cloud.google.com/)でNightstand用のプロジェクトを作成・選択します。
2. [Google Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com)を有効にします。
3. Google Auth Platformの「ブランディング」でアプリ名（例：Nightstand）と自分の連絡先を設定します。個人のGoogleアカウントでは対象を「外部」にし、「対象」のテストユーザーに自分のGoogleアカウントを追加します。
4. 「データアクセス」で次の読み取り専用スコープを追加します。

   ```text
   https://www.googleapis.com/auth/calendar.events.readonly
   https://www.googleapis.com/auth/calendar.calendarlist.readonly
   ```

5. 「クライアント」で「ウェブアプリケーション」のOAuthクライアントIDを作成します。「承認済みのJavaScript生成元」に、使うNightstandの生成元を登録します。パスやクエリは含めません。

   ```text
   https://canada.github.io
   https://nightstand-preview.canadie.chatgpt.site
   ```

   接続設定画面に表示される生成元を優先してください。プレビューが別の生成元のフレームで開かれる場合は、その表示と実際の通常ブラウザーの生成元を確認します。ローカルで検証するときだけ `http://localhost:8866` または `http://127.0.0.1:8866` も登録します。

6. 発行された `…apps.googleusercontent.com` のクライアントIDをNightstandの「GoogleのアプリID」に貼り付け、「Googleに接続」を押します。Googleの画面で使うアカウントを選び、予定とカレンダー一覧の読み取りを許可します。すでに以前の版で接続した場合も、データアクセスに一覧の読み取りスコープを追加し、Nightstandへ再接続してください。

クライアントIDはアプリを識別する公開情報です。この実装でクライアントシークレット・APIキー・サービスアカウントの鍵は使いません。公開リポジトリにも追加しないでください。

公式手順：[同意画面とテストユーザー](https://developers.google.com/workspace/guides/configure-oauth-consent)、[OAuthクライアントの作成](https://developers.google.com/workspace/guides/create-credentials#oauth-client-id)。個人での検証はテストユーザーの範囲で行い、一般公開する場合はGoogleの公開・審査要件を別途確認します。

## 表示するカレンダーと祝日

接続後にもう一度「Googleカレンダー」を開くと、Googleに追加済みのカレンダーをチェックで選べます。初回はメインカレンダーとGoogle側で表示中のカレンダーを選びます。選択はこのタブ内だけに保持します。

- 共有・追加カレンダーやGoogleの祝日カレンダーを表示できます。色はGoogle側の設定を使い、予定を押すと元のカレンダー名も確認できます。
- 一覧にないカレンダーは、先にGoogleカレンダーで追加・共有済みか確認します。空き時間のみの共有は一覧に理由を表示して選択不可とします。予定の詳細を表示するには共有元の閲覧許可が必要です。
- 日本の祝日はGoogle接続と独立して月間・週間に表示します。週間の日付も祝日の色になります。Googleの祝日カレンダーの同名・同日の祝日は終日欄で重複表示しません。
- 選択解除したカレンダーの予定はすぐ消します。共有解除や閲覧権限の変更を取得したときも、古い予定を消します。ほかのカレンダーの取得は続けます。
- Googleへの書き込みやカレンダーの追加・共有設定の変更はしません。

公式仕様：[カレンダー一覧取得](https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/list)、[閲覧権限と表示状態](https://developers.google.com/workspace/calendar/api/v3/reference/calendarList)。

## 同期と表示

- 選択中の週の予定だけを取得します。繰り返し予定は個別の回として取得し、終日・複数日の予定にも対応します。重なる時間指定の予定は横に並びます。短い予定や細い列は省略表示し、押すと内容を開けます。
- 週間表示を開いている間、前面のタブで5分ごとに更新します。「更新」でも再取得できます。閉じている間は定期取得しません。前面への復帰時と週の移動時にも取得します。
- 通信に失敗した場合、同じ週で取得済みの予定は「前回取得した予定」と明示して残します。別の週の予定を流用したり、失敗を「予定なし」と表示したりしません。
- 選択したカレンダーを個別に取得します。一部が取得できなくても、成功したカレンダーは表示します。通信失敗のカレンダーに前回の予定を残す場合は、そのことを明示します。予定の編集、Googleへの書き戻し、閉じたページのバックグラウンド同期はありません。
- クラシックではGoogle連携機能を読み込みません。

## 接続情報と予定の扱い

- 認証トークン・予定・カレンダー一覧・選択状態は現在のタブのメモリだけに保持します。LocalStorage・SessionStorage・Cookie・URL・公開ファイル・サーバーには保存しません。API通信はGoogleへ直接行い、認証トークンはAuthorizationヘッダーで送信します。レスポンスはブラウザーのHTTPキャッシュを使用しません。
- 保存するのは入力したアプリIDだけです。それだけでは予定にアクセスできず、別端末・別タブではGoogleへの接続操作が必要です。
- 切断・認証期限切れ・認証のアクセス拒否で表示とメモリ上の予定・カレンダー一覧を消去します。個別のカレンダーのアクセス拒否はそのカレンダーの予定を消去します。取得中の通信は中止し、遅い応答や古いログイン結果が予定を復活させないようにします。詳細画面も閉じて消去します。
- ページを離れたり再読み込みすると接続を解除します。短時間で失効するアクセストークンの期限が切れた場合も、ボタンからの再接続が必要です。認証画面を勝手に開いたり、再接続を自動で繰り返したりしません。
- 「切断」はこのタブからの接続解除です。Google側のアプリ許可を全体として取り消す場合は、[Googleアカウントの接続管理](https://myaccount.google.com/connections)で行ってください。

公式仕様：[Google Identity Servicesのトークン方式](https://developers.google.com/identity/oauth2/web/guides/use-token-model)、[予定取得API](https://developers.google.com/workspace/calendar/api/v3/reference/events/list)。

## 接続できないとき

- Googleログインが組み込みブラウザーで拒否される場合は、同じURLを通常のChrome・Edge・Safariなどで開いてください。Googleは認証に使うブラウザーを制限しています。
- ログイン画面が開かない場合は、Nightstandのポップアップを許可して接続し直します。
- 生成元の不一致は、Google側のJavaScript生成元が接続設定画面の表示と一致するか確認します。
- アクセス拒否は、Calendar APIの有効化・テストユーザー・読み取り権限を確認します。

[GoogleのOAuthポリシー](https://developers.google.com/identity/protocols/oauth2/policies)
