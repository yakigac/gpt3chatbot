export function postSlackMessage(message:string, channel:string, event_ts:string) {
    // Slack APIのトークンを取得する
    const token = PropertiesService.getScriptProperties().getProperty("SLACK_TOKEN");
  
    // Slack APIを使用して、メッセージを送信する
    const options:GoogleAppsScript.URL_Fetch.URLFetchRequestOptions  = {
      "method": "post",
      "headers": {
        "Authorization": "Bearer " + token
      },
      "payload": {
        "channel": channel,
        "text": message,
        "thread_ts": event_ts
      }
    };
    UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", options);
  }