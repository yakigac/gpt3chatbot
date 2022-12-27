# gpt3chatbot

Slackから、GASを経由してGPT3のレスポンスを返すプログラム。


## 必要手順

### Google Apps Scriptでの初期設定

1. GASプロジェクトを作成する。
1. GASプロジェクトに、Slack APIを使用するためのスクリプトを追加する。
1. 公開設定でデプロイし、GASプロジェクトの公開URLをメモしておく。

### Slackでの初期設定

1. Slack APIサイトにアクセスし、「Create an App」ボタンをクリックする。
1. アプリ名を入力し、アプリを作成するワークスペースを選択する。
1. アプリを作成すると、Slack APIのトークンが表示されるので、これをメモしておく。
1. Slackの「Event Subscriptions」を有効にし、GASプロジェクトの公開URLを設定する

### OPENAIでの初期設定

TODO

### 繋ぎこみ

TODO
