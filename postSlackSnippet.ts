export function postSlackSnippet(content:string, channel:string, event_ts:string, filename = "sample.txt", initial_comment?:string|null) {
    // Slack APIトークンをスクリプトプロパティから取得する
    const token = PropertiesService.getScriptProperties().getProperty("SLACK_TOKEN");
    // Slack APIのfiles.uploadエンドポイント
    const SLACK_API_ENDPOINT = "https://slack.com/api/files.upload";
  
    // Slack APIのfiles.uploadエンドポイントを使用して、投稿するテキストファイルのコンテンツを設定する
    var payload = {
      "token": token, // Slack APIトークン
      "channels": channel, // 投稿先のチャンネルID
      'content': content, // メッセージの中身
      'initial_comment': initial_comment,
      'filename': filename, // テキスト形式のファイルを指定
      'title': filename, // Slack上でのファイルのタイトル
      "thread_ts": event_ts
    };
  
    // Slack APIへのリクエストで使用するオプションを設定する
    var options:GoogleAppsScript.URL_Fetch.URLFetchRequestOptions  = {
      "method": "post", // HTTPのPOSTメソッドを使用する
      "headers": {
        "Authorization": "Bearer " + token // Slack APIトークンを使用する
      },
      'contentType': 'application/x-www-form-urlencoded', // コンテンツタイプを指定する
      "payload": payload // リクエストペイロードを設定する
    };
  
    try {
      // Postリクエストを送信する
      UrlFetchApp.fetch(SLACK_API_ENDPOINT, options);
    } catch (e) {
      console.error(e); // エラーが発生した場合は、コンソールにエラーを出力する
    }
  }