/* 
  Slackから、GASを経由してGPT3のレスポンスを返すプログラム。

  参考にした記事：
  - https://qiita.com/paranishian/items/9cb754683584c6c05164
  - https://qiita.com/noritsune/items/c4d58bc933198cfa101e
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

function isDuplicateSlackEvent(slackEvent) {
  const channel = slackEvent.channel;
  const ts = slackEvent.ts;
  const cache = CacheService.getScriptCache();

  const cacheKey = channel + ':' + ts;
  const cached = cache.get(cacheKey); //同じcacheKeyでストアされているデータをゲットする（無ければNULLになる）
  if (cached != null) {
    return true
  }
  else {
    cache.put(cacheKey, true, 60); // trueをcacheKeyでキャッシュする（単位sec）
  }
  return false
}

function handleEvent(event) {
  // Slackから送信されたイベントを取得する
  var slackEvent = event.event;

  if (isDuplicateSlackEvent(slackEvent)) {
    console.log('重複クエリのため、何もせず終了します。');
    return;
  }

  // Slackでのイベントの種類を判定する
  if (slackEvent.type == "app_mention") {

    // メンションイベントの場合は、メンションされたテキストを取得する
    const text = slackEvent.text;

    // メンションされたテキストから、コマンドを取得する
    const array = text.split(" ");
    const command = (array.length > 1 ? array[1] : null)

    // コマンドを判定する
    if (command == "/usage") {
      const usage = checkUsageThisMonth();
      sendMessage("今月の使用量は$" + usage.current_usage_usd + "です。", slackEvent.channel);
    }
    else if (command == "/clear") {
      const cacheKey = slackEvent.channel;
      const cache = CacheService.getScriptCache();
      cache.remove(cacheKey); //同じcacheKeyでストアされているデータをゲットする（無ければNULLになる）
      sendMessage("記憶喪失しました。。", slackEvent.channel);
    }
    else if (command == "/store") {
      const channel = slackEvent.channel;
      const messages = getAndPushMessages(channel, null);
      const prompt = makeConversationPrompt(messages, "");
      postMessageSnippet(prompt, channel);
    }
    else if (array.length > 1) {
      const message = array.slice(1).join(" "); // 特殊命令でない場合は文字列すべてをGPT3に投げる

      // promtを作成（同じチャンネルでの会話は10分以内なら覚えている）
      const cacheKey = slackEvent.channel;
      const messages = getAndPushMessages(cacheKey, "Human:" + message);

      const prompt = makeConversationPrompt(messages);
      const ai_message = getGpt3Message(prompt);

      handleAIMessage(ai_message, slackEvent);

      getAndPushMessages(cacheKey, "AI:" + JSON.stringify(ai_message));
    }
    else {
      sendMessage("すみません、よくわからないです。。", slackEvent.channel);
    }

  }
}

function handleAIMessage(ai_message_json, slackEvent) {
  var command = "";
  var text = "";
  var code = "";
  console.log(ai_message_json);
  try {
		ai_message = JSON.parse(ai_message_json);
    command = ai_message.command;
    text = ai_message.text;
    code = ai_message.code;
    filename = ai_message.filename;
	} catch (error) {
    console.warn(error);
		return false;
	}

  console.log(command);
  // コマンドを判定する
  if (command == "/usage") {
    const usage = checkUsageThisMonth();
    sendMessage("今月の使用量は$" + usage.current_usage_usd + "です。", slackEvent.channel);
  }
  else if (command == "/code"){
    sendMessage(text, slackEvent.channel);
    postMessageSnippet(code, slackEvent.channel, filename);
  }
  else if (command == "/talk"){
    sendMessage(text, slackEvent.channel);
  }
  else {
    sendMessage("すみません、よくわからないです。。", slackEvent.channel);
  }
  return true;
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
    'Authorization': 'Bearer ' + token, // APIキーを指定する
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
    max_tokens: 500,
    // 0.5と指定すると生成される文章は入力となる文章に似たものが多くなる傾向があります。
    // 逆に、temperatureフィールドに1.0と指定すると、生成される文章は、より多様なものになる傾向があります。
    temperature: 0.5,
    stop: ["\nAI:", "\nHuman:"]
  };
  // HTTPリクエストで使用するオプション
  var options = {
    'muteHttpExceptions': true, // HTTPエラーを無視する
    'headers': headers, // ヘッダーを指定する
    'method': 'POST', // HTTPメソッドを指定する
    'payload': JSON.stringify(requestBody),// リクエストボディを指定する
  };
  try {
    // GPT-3にリクエストを送信する
    const response = UrlFetchApp.fetch(uri, options);
    // レスポンスを取得する
    var json = JSON.parse(response.getContentText());
    // GPT-3からのレスポンスを返す
    const response_text = json["choices"][0]["text"];
    return response_text;
  } catch (e) {
    console.error(e);
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
  console.log(usage);
  return usage
}

function makeConversationPrompt(messages, aiPrefix = "AI:") {
  var prompt = `以下はAIアシスタントとの対話です。アシスタントは簡潔に受け答えします。AIは以下ルールを守ります。（数字が大きいほど重要）
  1. プログラムを記載する際はslackのコードブロックで囲む。
  2. 回答は原則140文字以内に収める。もし140文字以内で回答しきれない場合は改行後に「続けてもよろしいでしょうか？」というメッセージで問いかけを行い、Humanの返答を待つ。
  3. Humanが明示的に許可している場合、2の140文字ではなく、500文字以内で回答する。
  4. AIの回答はその後別のプログラムで処理されるため、command, text, text_length,code,filenameという項目を持ったjson形式で返される。（JSONの規約に沿ってエスケープシーケンスを使用する）
  5. commandには、プログラムコードを含む場合/code、OpenAIのAPI使用量について聞かれている場合/usage、その他の場合/talkを設定する\n
--例--
Human:こんにちは
AI:
{"command":"/talk","text":"こんにちは！","text_length":6,"filename":"","code":""}
Human:pythonでハローワールド書きたい
AI:
{"command":"/code","text":"Pythonで"Hello, World!"を表示するには、次のようにプログラムを書くことができます。","text_length":51,"filename":"helloworld.py","code":"print(\"Hello, World!\")\\n"}
Human:全部小文字にして
AI:
{"command":"/code","text":"すべて小文字にしました。","text_length":51,"filename":"helloworld_uppercase.py","code":"print(\"hello, world!\")\\n"}
Human:今月のAPI使用量を教えて
AI:
{"command":"/usage","text":"今月のAPI使用量を調査しました。","text_length":17,"filename":"","code":""}

--ここから実際の会話履歴--\n`
    + messages.join('\n')
    + `\n`
    + aiPrefix;

  return prompt
}

function getAndPushMessages(cacheKey, newMessage) {
  const cache = CacheService.getScriptCache();
  const prevMessagesString = cache.get(cacheKey); //同じcacheKeyでストアされているデータをゲットする（無ければNULLになる）
  // キャッシュには文字列で入っているため、パースして、配列として取得する。
  var messages = JSON.parse(prevMessagesString);
  if (messages == null) {
    messages = [];
  }
  if (newMessage != null) {
    messages.push(newMessage)
  }

  // 配列を文字列化して、保存する。
  const messagesString = JSON.stringify(messages);
  cache.put(cacheKey, messagesString, 600);

  return messages
}

function postMessageSnippet(message, channel, filename="sample.txt") {
  // Slack APIトークンをスクリプトプロパティから取得する
  const token = PropertiesService.getScriptProperties().getProperty("SLACK_TOKEN");
  // Slack APIのfiles.uploadエンドポイント
  const SLACK_API_ENDPOINT = "https://slack.com/api/files.upload";

  // Slack APIのfiles.uploadエンドポイントを使用して、投稿するテキストファイルのコンテンツを設定する
  var payload = {
    "token": token, // Slack APIトークン
    "channels": channel, // 投稿先のチャンネルID
    "content": message, // メッセージの中身
    "filename": filename, // テキスト形式のファイルを指定
    "title": "Messages" // Slack上でのファイルのタイトル
  };

  // Slack APIへのリクエストで使用するオプションを設定する
  var options = {
    "method": "post", // HTTPのPOSTメソッドを使用する
    "headers": {
      "Authorization": "Bearer " + token // Slack APIトークンを使用する
    },
    "contentType": 'application/x-www-form-urlencoded', // コンテンツタイプを指定する
    "payload": payload // リクエストペイロードを設定する
  };

  try {
    // Postリクエストを送信する
    UrlFetchApp.fetch(SLACK_API_ENDPOINT, options);
  } catch (e) {
    console.error(e); // エラーが発生した場合は、コンソールにエラーを出力する
  }
}