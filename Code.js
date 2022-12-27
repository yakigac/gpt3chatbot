/* 
  Slackから、GASを経由してGPT3のレスポンスを返すプログラム。

  参考にした記事：
  - https://qiita.com/paranishian/items/9cb754683584c6c05164
  - https://qiita.com/noritsune/items/c4d58bc933198cfa101e#4-gas%E3%81%A8slack%E3%82%A2%E3%83%97%E3%83%AA%E3%82%92%E9%80%A3%E6%90%BA%E3%81%99%E3%82%8B
*/


function doPost(e) {
  // Slackからのイベントを取得する
  var event = JSON.parse(e.postData.contents);

  // Slackからのイベントの種類を判定する
  if (event.type == "url_verification") {
    // URLの検証イベントの場合は、challengeパラメータを返す
    return ContentService.createTextOutput(event.challenge).setMimeType(ContentService.MimeType.PLAIN_TEXT);
  } else if (event.type == "event_callback") {
    // イベントコールバックイベントの場合は、イベントを処理する
    return handleEvent(event);
  }
}

function isDuplicateSlackEvent(slackEvent){
  const channel = slackEvent.channel;
  const ts = slackEvent.ts;
  const cache = CacheService.getScriptCache();

  const cacheKey = channel + ':' + ts;
  const cached = cache.get(cacheKey); //同じcacheKeyでストアされているデータをゲットする（無ければNULLになる）
  if(cached != null){
    return true
  }
  else{
    cache.put(cacheKey, true, 60); // trueをcachKeyでキャッシュする（単位sec）
  }
  return false
}

function handleEvent(event) {
  // Slackから送信されたイベントを取得する
  var slackEvent = event.event;

  if(isDuplicateSlackEvent(slackEvent)){
    console.log('重複クエリのため、何もせず終了します。');
    return;
  }

  // Slackでのイベントの種類を判定する
  if (slackEvent.type == "app_mention") {

    // メンションイベントの場合は、メンションされたテキストを取得する
    var text = slackEvent.text;

    // メンションされたテキストから、コマンドを取得する
    var array = text.split(" ");
    if(array.length > 1){
        var command = array[1];
    }

    // コマンドを判定する
    if (command == "/usage") {
      const usage = checkUsageThisMonth();
      sendMessage("$"+usage.current_usage_usd, slackEvent.channel);
    }
    else if (command == "/gpt3" && array.length > 2) {
      // gpt3コマンドの場合は、GPT3のレスポンスを返す
      message = array[2];
      // promtを作成
      const prompt = makePrompt(message);
      sendMessage(getGpt3Message(prompt), slackEvent.channel);
    }
    else{
      sendMessage("知らないコマンドです。。", slackEvent.channel);
    }
    
  }
}

function sendMessage(message, channel) {
  // Slack APIのトークンを取得する
  var token = PropertiesService.getScriptProperties().getProperty("SLACK_TOKEN");

  // Slack APIを使用して、メッセージを送信する
  var options = {
    "method": "post",
    "headers": {
      "Authorization": "Bearer " + token
    },
    "payload": {
      "channel": channel,
      "text": message
    }
  };
  UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", options);
}

/**
 * GPT-3に対して、指定したメッセージを送信し、レスポンスを取得する
 * @param {string} message - 送信するメッセージ
 * @return {string} GPT-3からのレスポンス
 */
function getGpt3Message(prompt) {
  // GPT-3のエンドポイントURL
  var uri = 'https://api.openai.com/v1/completions';
  // OpenAIのAPIキー
  var token = PropertiesService.getScriptProperties().getProperty("OPENAI_SECRET_KEY");

  // HTTPリクエストで使用するヘッダー
  var headers = {
    'Authorization': 'Bearer '+ token, // APIキーを指定する
    'Content-type': 'application/json' // データ形式を指定する
  };

  // リクエストのボディを作成
  const requestBody = {
    // モデルを指定
    model: 'text-davinci-003',
    // クエリとなる文字列を指定
    prompt: prompt, // プロンプトを指定する
    // 生成される文章の最大トークン数を指定。単語数というような意味
    // 1000辺り$0.02なので少なくしておく
    max_tokens: 300,
      // 0.5と指定すると生成される文章は入力となる文章に似たものが多くなる傾向があります。
      // 逆に、temperatureフィールドに1.0と指定すると、生成される文章は、より多様なものになる傾向があります。
    temperature: 0.5,
  };
  // HTTPリクエストで使用するオプション
  var options = {
    'muteHttpExceptions' : true, // HTTPエラーを無視する
    'headers': headers, // ヘッダーを指定する
    'Content-type': 'application/json', // データ形式を指定する
    'method': 'POST', // HTTPメソッドを指定する
    'payload': JSON.stringify(requestBody),// リクエストボディを指定する
  };
  try {
      // GPT-3にリクエストを送信する
      const response = UrlFetchApp.fetch(uri, options);
      // レスポンスを取得する
      var json=JSON.parse(response.getContentText());
      // GPT-3からのレスポンスを返す
      console.log("gpt3 responce");
      console.log(json["choices"][0]["text"]);
      return json["choices"][0]["text"];
  } catch(e) {
    console.log('error');
  }
}

function checkUsageThisMonth() {
  // 現在の日時を取得
  var now = new Date();

  // 今月の1日を取得
  var startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // 今月の1日をYYYY-MM-DDで取得。
  var startDate = Utilities.formatDate(startOfMonth, "Asia/Tokyo", "yyyy-MM-dd");

  // 現在の日時をYYYY-MM-DDで取得。
  var endDate = Utilities.formatDate(now, "Asia/Tokyo", "yyyy-MM-dd");

  // GPT-3 の API キー
  var apiKey = PropertiesService.getScriptProperties().getProperty("OPENAI_SECRET_KEY");

  // GPT-3 API のエンドポイント
  var endpoint = "https://api.openai.com/v1/usage?start_date=" + startDate + "&end_date=" + endDate;

  // HTTP リクエストを作成
  var options = {
    "method": "GET",
    "headers": {
      "Authorization": "Bearer " + apiKey
    }
  };

  // GPT-3 API にリクエストを送信
  var response = UrlFetchApp.fetch(endpoint, options);

  // レスポンスを取得
  var json = response.getContentText();

  const usage = JSON.parse(json);

  // 使用量を表示
  Logger.log(usage);
  return usage
}

function makePrompt(message){
  var prompt = `以下はAIアシスタントとの対話です。アシスタントは創造的で、賢いです。AIの回答は140文字以内になります。\n`
  + `Human:` + message
  + `AI:`;
  return prompt
}
