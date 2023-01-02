/* 
  Slackから、GASを経由してGPT3のレスポンスを返すプログラム。

  参考にした記事：
  - https://qiita.com/paranishian/items/9cb754683584c6c05164
  - https://qiita.com/noritsune/items/c4d58bc933198cfa101e
*/


function doPost(e) {
  // Slackからのイベントを取得する
  const event = JSON.parse(e.postData.contents);

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
  const ts = slackEvent.ts; //メッセージのtsを使う（event_tsはスレッドの親メッセージのts）
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
  const slackEvent = event.event;
  const ts = slackEvent.thread_ts || slackEvent.ts;

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

    console.log("slackEvent", slackEvent);

    // コマンドを判定する
    if (command == "/usage") {
      const usage = fetchUsageFromDec();
      postMessage("これまでの使用量は$" + usage.current_usage_usd + "です。", slackEvent.channel, ts);
    }
    else if (command == "/clear") {
      const cacheKey = slackEvent.channel;
      const cache = CacheService.getScriptCache();
      cache.remove(cacheKey); //同じcacheKeyでストアされているデータをゲットする（無ければNULLになる）
      postMessage("記憶喪失しました。。", slackEvent.channel, ts);
    }
    else if (command == "/store") {
      const messages = getAndPushMessages(slackEvent.channel, null);
      const prompt = makePrompt(messages, "");
      postMessageSnippet(prompt, slackEvent.channel, ts);
    }
    else if (array.length > 1) {
      const message = array.slice(1).join(" "); // 特殊命令でない場合は文字列すべてをGPT3に投げる

      // promptを作成（同じチャンネルでの会話は10分以内なら覚えている）
      const cacheKey = slackEvent.channel;
      const messages = getAndPushMessages(cacheKey, "Human:" + message);

      const prompt = makePrompt(messages);
      const ai_message = fetchGpt3Message(prompt);

      getAndPushMessages(cacheKey, "AI:" + ai_message);
      handleAiResponse(ai_message, slackEvent);
      //sendMessage(ai_message, slackEvent.channel, ts);
    }
    else {
      postMessage("すみません、よくわからないです。。", slackEvent.channel);
    }

  }
}

function handleAiResponse(message, slackEvent) {
  // AIの返信の種類と含まれる命令を判定する
  // AIのメッセージの一行目には/agent XX YYのようなエージェントへの命令か、/humanという人間への返信かを区別する情報を含む。
  // これを処理して適切なアウトプットにつなげる。

  const ts = slackEvent.thread_ts || slackEvent.ts;

  // AIのメッセージの一行目から、人間への返信orAgentへのメッセージ、Agentへのメッセージであればどういった命令かを抽出。
  const message_array = message.split("\n");
  const command_and_arguments = (message_array.length > 0 ? message_array[0] : null);
  const command_array = command_and_arguments.trim().split(" ");
  const to_whom = (command_array.length > 0 ? command_array[0] : null);
  const tool = (command_array.length > 1 ? command_array[1] : null);
  const arguments = (command_array.length > 2 ? command_array.slice(2) : []);

  console.log("message_array:", message_array);
  // コマンドを判定する
  if (to_whom == "/agent") {
    if (tool == "code_reply" && message_array.length > 1) {
      const filename = arguments.length > 0 ? arguments[0] : null;
      const code = message_array.slice(1).join("\n");

      // codeだったらスニペットで返す
      postMessageSnippet(code, slackEvent.channel, ts, filename);
    }
    else {
      // 未定義処理（現状はメッセージ全体を返す）
      console.warn("未定義の命令が設定されました。command_array:", command_array);
      postMessage(message, slackEvent.channel, ts);
    }
  }
  else if (to_whom == "/human" && message_array.length > 1) {
    // 通常の返信では二行目以降のメッセージ全体を返す。
    const message_to_human = message_array.slice(1).join("\n");
    postMessage(message_to_human, slackEvent.channel, ts);
  }
  else {
    // 未定義処理（現状はメッセージ全体を返す）
    console.warn("未定義の送信先が設定されました。message_array:", message_array);
    postMessage(message, slackEvent.channel, ts);
  }
}

function postMessage(message, channel, event_ts) {
  // Slack APIのトークンを取得する
  const token = PropertiesService.getScriptProperties().getProperty("SLACK_TOKEN");

  // Slack APIを使用して、メッセージを送信する
  const options = {
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

/**
 * GPT-3に対して、指定したメッセージを送信し、レスポンスを取得する
 * @param {string} message - 送信するメッセージ
 * @return {string} GPT-3からのレスポンス
 */
function fetchGpt3Message(prompt) {
  // GPT-3のエンドポイントURL
  const uri = 'https://api.openai.com/v1/completions';
  // OpenAIのAPIキー
  const token = PropertiesService.getScriptProperties().getProperty("OPENAI_SECRET_KEY");

  // HTTPリクエストで使用するヘッダー
  const headers = {
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
    temperature: 0.1,
    stop: ["\nAI:", "\nHuman:"] // AIが一人で会話を続けないようにします。
  };
  // HTTPリクエストで使用するオプション
  const options = {
    'muteHttpExceptions': true, // HTTPエラーを無視する
    'headers': headers, // ヘッダーを指定する
    'method': 'POST', // HTTPメソッドを指定する
    'payload': JSON.stringify(requestBody),// リクエストボディを指定する
  };
  try {
    // GPT-3にリクエストを送信する
    const response = UrlFetchApp.fetch(uri, options);
    // レスポンスを取得する
    const json = JSON.parse(response.getContentText());
    // GPT-3からのレスポンスを返す
    const response_text = json["choices"][0]["text"];
    return response_text;
  } catch (e) {
    console.error(e);
  }
}

function fetchUsageFromDec() {
  // GPT-3 の API キー
  const apiKey = PropertiesService.getScriptProperties().getProperty("OPENAI_SECRET_KEY");

  // 現在の日時を取得
  const now = new Date();

  // 今月の1日を取得
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // 今月の1日をYYYY-MM-DDで取得。
  // const startDate = Utilities.formatDate(startOfMonth, "Asia/Tokyo", "yyyy-MM-dd");
  const startDate = "2022-12-01"

  // 現在の日時をYYYY-MM-DDで取得。
  const endDate = Utilities.formatDate(now, "Asia/Tokyo", "yyyy-MM-dd");


  // GPT-3 API のエンドポイント
  const endpoint = "https://api.openai.com/v1/usage?start_date=" + startDate + "&end_date=" + endDate;

  // HTTP リクエストを作成
  const options = {
    "method": "GET",
    "headers": {
      "Authorization": "Bearer " + apiKey
    }
  };

  // GPT-3 API にリクエストを送信
  const response = UrlFetchApp.fetch(endpoint, options);

  // レスポンスを取得
  const json = response.getContentText();

  const usage = JSON.parse(json);

  // 使用量を表示
  console.log(usage);
  return usage
}

function makePrompt(messages, aiPrefix = "AI:") {
  const prompt = `以下はHumanと、AIと、Agentの対話です。AIはHumanに従順で、簡潔に受け答えし、必要に応じてAgentを利用します。AIは以下ルールを守ります。\n`
    + `- 返答の1行目は必ず/humanまたは/agentという形で、メッセージの種別とその引数（nullable）を記載する。\n`
    + `- Humanに話しかける場合は、/humanという種別にしたうえで、二行目以降にメッセージを記載する。\n`
    + `- Agentに話しかける場合は、/agentという種別にする。\n`
    + `- Agentが実施できることであれば、積極的にAgentを活用する。\n`
    + `- プログラムコードを記載する場合、その説明はプログラム内のコメントとして記載する（2行目以降をそのまま実行できるようにする）。\n`
    + `- 回答はプログラムコード部分を除いて、原則140文字以内に収める。この制限を超える場合はHumanに許可を求める。\n`
    + `---\n`
    + `Agentは以下ができます。\n`
    + `- "/agent multiply X Y"のようなインプットがあった場合、XとYの積を計算して返す。\n`
    + `- "/agent code_reply FILENAME"のようなインプットがあった場合、二行目以降に書かれたコードをシンタックスハイライトしてHumanに渡す。FILENAMEは適切なファイル名を渡す必要がある。\n`
    + `---\n`
    + messages.join('\n')
    + `\n`
    + aiPrefix;

  return prompt
}

function getAndPushMessages(cacheKey, newMessage) {
  const cache = CacheService.getScriptCache();
  const prevMessagesString = cache.get(cacheKey); //同じcacheKeyでストアされているデータをゲットする（無ければNULLになる）
  // キャッシュには文字列で入っているため、パースして、配列として取得する。
  let messages = JSON.parse(prevMessagesString);
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

function postMessageSnippet(message, channel, event_ts, filename = "sample.txt", initial_comment) {
  // Slack APIトークンをスクリプトプロパティから取得する
  const token = PropertiesService.getScriptProperties().getProperty("SLACK_TOKEN");
  // Slack APIのfiles.uploadエンドポイント
  const SLACK_API_ENDPOINT = "https://slack.com/api/files.upload";

  // Slack APIのfiles.uploadエンドポイントを使用して、投稿するテキストファイルのコンテンツを設定する
  var payload = {
    "token": token, // Slack APIトークン
    "channels": channel, // 投稿先のチャンネルID
    'content': message, // メッセージの中身
    'initial_comment': initial_comment,
    'filename': filename, // テキスト形式のファイルを指定
    'title': filename, // Slack上でのファイルのタイトル
    "thread_ts": event_ts
  };

  // Slack APIへのリクエストで使用するオプションを設定する
  var options = {
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