# gpt3chatbot

Slackから、GASを経由してGPT3のレスポンスを返すプログラム。

## 概要

![image](https://user-images.githubusercontent.com/10434946/211309598-246e8766-cac1-476b-a28e-13b3610bf630.png)

### このプログラムでできること

・Slackを使った会話形式でのGPT3とのやり取り
・プログラムをSlackのスニペットで返してもらう

### このプログラムで（現状）できないこと

・GPT3のツール利用をGPT3に直接渡す処理（現状は人間→GPT3→ツール→人間のみ）

## 利用手順

### Google Apps Scriptでの初期設定

1. [Google Apps Script](https://script.google.com/home)のページからプロジェクトを作成する。
1. GASプロジェクトに、スクリプトを追加する。
1. 「種類の選択：ウェブアプリ」「アクセスできるユーザー：全員」の設定でデプロイし、GASプロジェクトの公開URLをメモする。

### Slackでの初期設定

1. [Slackのアプリ管理画面](https://api.slack.com/apps)にアクセスし、「Create New App」からSlackアプリを作成する。
1. 「Event Subscriptions」画面の「Enable Events」をオンにし、「Request URL」にGASプロジェクトの公開URLをペーストする。
1. 「Subscribe to bot events」の「Add Bot User Event」から「app_mention」を追加し、「Save changes」をクリックして保存する。
1. 「Install App」からワークスペースにアプリをインストールする。
1. 「Bot User OAuth Token」をGASプロジェクトの「プロジェクトの設定」から「スクリプトプロパティ」に「SLACK_TOKEN」として登録する。

### OPENAIでの初期設定

1. [Open AIのAPI key管理画面](https://beta.openai.com/account/api-keys)にアクセスし、「Create a new secret key」をクリックする。
1. 「Secret key」をGASプロジェクトの「プロジェクトの設定」から「スクリプトプロパティ」に「OPENAI_SECRET_KEY」として登録する。

### typescriptのビルド設定

TODO
