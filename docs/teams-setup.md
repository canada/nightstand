# Teamsの予定表を接続する

Teamsで使うMicrosoft 365アカウントの**個人の既定カレンダー**をMicrosoft Graphから読み取る。チーム／チャネル専用カレンダー、共有カレンダーやチャットは対象外。既存の時計、天気の通常表示と詳細画面、タイマーは維持する。

## 最初のアプリ登録

このPRの初期状態は未設定であり、実際のMicrosoft認証は開始しない。登録には利用する組織のMicrosoft Entraへのアクセスが必要。組織がアプリ登録やユーザー同意を制限している場合は管理者に依頼する。

1. [Microsoft Entra管理センター](https://entra.microsoft.com/)の「アプリの登録」から、Nightstand用のアプリを新規登録する。
2. 個人利用する組織の「この組織ディレクトリのみ」を選択する。
3. 認証のプラットフォームに **シングルページアプリケーション（SPA）** を追加する。
4. リダイレクトURIに `https://canada.github.io/nightstand/teams-auth-return.html` を登録する。末尾を含め完全一致させる。
5. Microsoft Graphの**委任されたアクセス許可**として `Calendars.ReadBasic` を追加する。予定の本文、出席者、添付、メール、チャット、書き込み権限は要求しない。既定で付く不要な `User.Read` は削除できる。
6. 概要に表示される「アプリケーション（クライアント）ID」と「ディレクトリ（テナント）ID」を `teams-config.js` に設定する。どちらも公開識別子であり、**クライアントシークレットは作らない**。
7. 組織で必要な同意を済ませ、登録したアカウントで実際の接続を検証する。

ローカルでMicrosoft認証を検証する場合は、別途 `http://localhost:8766/teams-auth-return.html` をSPAリダイレクトURIに登録する。本番のURIをローカル用に変更しない。認証の戻りページはフレームワークやルーターを読み込まず、公式redirect bridgeだけを起動する。GitHub Pagesはビルド不要。

## 使い方

`?next=1` を付けた改良版で、予定欄の「Teamsに接続」を押し、Microsoftの画面で接続するアカウントを選ぶ。上のカレンダーの月を切り替えると予定もその月へ切り替わる。今月はこれからの予定を簡潔に表示し、「一覧」で過去の予定を含む月全体を確認できる。時刻は端末のタイムゾーンに合わせる。

接続はそのタブだけ。再読み込みや画面からの離脱後は再接続する。「このタブの接続を解除」はNightstand内の接続だけを消し、Teams本体など他のMicrosoftサービスからはログアウトしない。Safariなどではポップアップの許可が必要になる場合がある。

## データと認証の扱い

- Microsoft公式MSAL Browserを同じサイトから配信し、Authorization Code Flow + PKCEを使う。接続はユーザーのクリックから始める。別タブ・別端末での自動接続は行わない。
- `Calendars.ReadBasic` の委任権限で `/me/calendarView` だけを読む。Microsoft APIの戻り時刻はUTCを要求する。
- 取得する項目は予定ID、件名、開始／終了、終日・中止・公開区分に限定する。非公開・社外秘の予定は件名を隠す。件名はHTMLとして扱わず、テキストとして表示する。
- **予定とアクセストークン・更新トークンはメモリだけ**に保持する。予定をlocalStorage・sessionStorage・GitHub・サーバー・実行ログへ書き込まない。MSALが認証の一時的な状態を現在のタブのsessionStorageに保持する場合があり、これはトークンの永続保存とは別。
- 予定取得はブラウザからMicrosoftへ直接行う。自前のサーバー、共有キャッシュやチャットの連携アカウントを経由しない。
- APIのページ送り先もGraphの同じリソースに限定し、別ホストや別APIへ認証ヘッダーを送らない。HTTPリダイレクトを拒否する。
- 接続解除・ページ離脱では予定を即座に消し、進行中の取得を中断する。遅れて届いた応答や古い月の結果は表示しない。
- 同じURLを別のパソコンで開いても予定は取得しない。そのパソコンでも本人がMicrosoftへ接続することはできる。このPRは特定端末以外からのMicrosoftログインを禁止する端末制限ではない。
- クリック乗っ取りや認証応答の不整合を避けるため、埋め込みフレーム内の接続は許可しない。ページ全体にCSPを設定し、外部スクリプトや不要な接続先を制限する。

## 検証

`npm test`（依存パッケージのインストール不要）でGraphの接続先、ページ送り、UTC時刻、非公開予定、権限エラーを検証する。ブラウザではSDK・Graphを模したデータで、未接続時の取得禁止、別タブ、再読み込み、解除後の遅い応答、XSS用の件名、月の切り替え、既存機能を確認する。

実アカウントでの接続確認は、アプリ登録と `teams-config.js` の設定後に別途行う。モックだけでMicrosoft側の同意・組織の制限・実データ取得の成功を保証しない。

## 参照

- [MSAL Browserの初期化](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/initialization)
- [MSALのキャッシュとmemoryStorage](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/caching)
- [認証応答のredirect bridge](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/redirect-bridge)
- [calendarViewと最小権限](https://learn.microsoft.com/en-us/graph/api/calendar-list-calendarview?view=graph-rest-1.0)
