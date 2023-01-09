/* 
  Slackから、GASを経由してGPT3のレスポンスを返すプログラム。

  参考にした記事：
  - https://qiita.com/paranishian/items/9cb754683584c6c05164
  - https://qiita.com/noritsune/items/c4d58bc933198cfa101e
  - https://github.com/hwchase17/langchain/blob/master/LICENSE
*/

// type, interface

interface ToolInterface {
  name: string;
  description: string;
  checkInput(message: string): boolean;
  use(message: string, slackEvent: any): string;
}

type SlackEvent = {
  type: string;
  text: string;
  channel: string;
  ts: string;
  thread_ts?: string;
}

type PostDataContents = {
  event: SlackEvent
}

type PostEvent = {
  queryString: string;
  parameter: { [index: string]: string; };
  parameters: { [index: string]: [string]; };
  contentLenth: number;
  postData: {
    length: number;
    type: string;
    contents: string;
    name: string;
  };
}

// tools
class BaseTool {
  name: string;
  description: string;

  constructor(name: string, description: string) {
    this.name = name;
    this.description = description;
  }
  extractMessage(message: string) {
    const lines = message.trim().split("\n");
    const tool_and_arguments = (lines.length > 0 ? lines[0].trim().split(" ") : null);
    const tool = (tool_and_arguments && tool_and_arguments.length > 0 ? tool_and_arguments[0] : null);
    const args = (tool_and_arguments && tool_and_arguments.length > 1 ? tool_and_arguments.slice(1) : []);
    return { lines: lines, tool: tool, args: args }
  }
}

class replyTool extends BaseTool implements ToolInterface {
  constructor() {
    super("/reply", '"/reply"のようなインプットがあった場合、二行目以降のメッセージを人間に送る。');
  }
  checkInput(message: string) {
    return true;
  }
  use(message: string, slackEvent: SlackEvent) {
    const ts = slackEvent.thread_ts || slackEvent.ts;
    const inputs = this.extractMessage(message);
    const message_to_human = inputs.args.join(" ") + "\n" + inputs.lines.slice(1).join("\n");
    postSlackMessage(message_to_human, slackEvent.channel, ts);
    return message_to_human;
  }
}

class calcTool extends BaseTool implements ToolInterface {
  // X*Y等の四則演算を計算して、メッセージで返すツール。
  constructor() {
    super("/calc", `"/calc X * Y"のようなインプットがあった場合、XとYを四則演算して返す。二行目以降には何も書いてはいけない。`)
  }
  checkInput(message: string) {
    const inputs = this.extractMessage(message);
    if (inputs.args.length > 2) {
      return true;
    }
    else {
      return false;
    }
  }
  use(message: string, slackEvent: SlackEvent) {
    const ts = slackEvent.thread_ts || slackEvent.ts;
    const inputs = this.extractMessage(message);
    const x = parseFloat(inputs.args[0]);
    const operator = inputs.args[1];
    const y = parseFloat(inputs.args[2]);
    const answer = this.calcSimple(x, operator, y);
    postSlackMessage(x + operator + y + "=" + answer, slackEvent.channel, ts);
    return x + operator + y + "=" + answer;
  }
  private calcSimple(x: number, operator: string, y: number) {
    let answer = null;
    if (operator == "+") {
      answer = x + y;
    }
    else if (operator == "-") {
      answer = x - y;
    }
    else if (operator == "*") {
      answer = x * y;
    }
    else if (operator == "/" && y != 0) {
      answer = x / y;
    }
    return answer;
  }
}

class codeReplyTool extends BaseTool implements ToolInterface {
  constructor() {
    super("/code_reply", `"/code_reply FILENAME"のようなインプットがあった場合、二行目以降に書かれたコードをシンタックスハイライトしてHumanに渡す。FILENAMEには言語に応じた適切な拡張子をつけて渡す必要がある。`)
  }
  checkInput(message: string) {
    const inputs = this.extractMessage(message);
    if (inputs.args.length > 0 && inputs.lines.length > 1) {
      return true;
    }
    else {
      return false;
    }
  }
  use(message: string, slackEvent: SlackEvent) {
    const ts = slackEvent.thread_ts || slackEvent.ts;
    const inputs = this.extractMessage(message);
    const filename = inputs.args[0];
    const code = inputs.lines.slice(1).join("\n");

    // スニペットで返す
    postSlackSnippet(code, slackEvent.channel, ts, filename);
    return code;
  }
}

// functions

function postSlackMessage(message: string, channel: string, event_ts: string) {
  // Slack APIのトークンを取得する
  const token = PropertiesService.getScriptProperties().getProperty("SLACK_TOKEN");

  // Slack APIを使用して、メッセージを送信する
  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    "method": "post",
    "headers": {
      "Authorization": "Bearer " + token
    },
    "payload": {
      "channel": channel,
      "text": message,
      "thread_ts": event_ts,
      "username": "bot"
    }
  };
  UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", options);
}

function postSlackSnippet(content: string, channel: string, event_ts: string, filename = "sample.txt", initial_comment?: string | null) {
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
  var options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
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

// main.ts

function doPost(e: PostEvent) {
  // Slackからのイベントを取得する
  const postDataContents = JSON.parse(e.postData.contents);

  // Slackからのイベントの種類を判定する
  if (postDataContents.type == "url_verification") {
    // URLの検証イベントの場合は、challengeパラメータを返す
    return ContentService.createTextOutput(postDataContents.challenge).setMimeType(ContentService.MimeType.TEXT);
  } else if (postDataContents.type == "event_callback") {
    // イベントコールバックイベントの場合は、イベントを処理する
    return handleEvent(postDataContents);
  }
}

function isDuplicateSlackEvent(slackEvent: SlackEvent) {
  const channel = slackEvent.channel;
  const ts = slackEvent.ts; //メッセージのtsを使う（event_tsはスレッドの親メッセージのts）
  const cache = CacheService.getScriptCache();

  const cacheKey = channel + ':' + ts;
  const cached = cache.get(cacheKey); //同じcacheKeyでストアされているデータをゲットする（無ければNULLになる）
  if (cached != null) {
    return true
  }
  else {
    cache.put(cacheKey, "true", 60); // trueをcacheKeyでキャッシュする（単位sec）
  }
  return false
}

function handleEvent(postDataContents: PostDataContents) {
  // Slackから送信されたイベントを取得する
  const slackEvent = postDataContents.event;
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
      postSlackMessage("これまでの使用量は$" + usage.current_usage_usd + "です。", slackEvent.channel, ts);
    }
    else if (command == "/clear") {
      const cacheKey = slackEvent.channel;
      const cache = CacheService.getScriptCache();
      cache.remove(cacheKey); //同じcacheKeyでストアされているデータをゲットする（無ければNULLになる）
      postSlackMessage("記憶喪失しました。。", slackEvent.channel, ts);
    }
    else if (command == "/store") {
      const messages = getAndAddMessages(slackEvent.channel);
      const prompt = makePrompt(messages, "");
      postSlackSnippet(prompt, slackEvent.channel, ts);
    }
    else if (array.length > 1) {
      const message = array.slice(1).join(" "); // 特殊命令でない場合は文字列すべてをGPT3に投げる

      // promptを作成（同じチャンネルでの会話は10分以内なら覚えている）
      const cacheKey = slackEvent.channel;
      const messages = getAndAddMessages(cacheKey, "Human:" + message);

      const prompt = makePrompt(messages);
      const ai_message = fetchGpt3Message(prompt);

      getAndAddMessages(cacheKey, "AI:" + ai_message);
      handleAiResponse(ai_message, slackEvent);
      //sendMessage(ai_message, slackEvent.channel, ts);
    }
    else {
      postSlackMessage("すみません、よくわからないです。。", slackEvent.channel, ts);
    }

  }
}

function handleAiResponse(message: string, slackEvent: SlackEvent) {
  // AIの返信の種類と含まれる命令を判定する
  // AIのメッセージの一行目には/agent XX YYのようなエージェントへの命令か、/humanという人間への返信かを区別する情報を含む。
  // これを処理して適切なアウトプットにつなげる。

  const ts = slackEvent.thread_ts || slackEvent.ts;

  // AIのメッセージの一行目から、人間への返信orAgentへのメッセージ、Agentへのメッセージであればどういった命令かを抽出。
  const lines = message.trim().split("\n");
  const tool_and_arguments = (lines.length > 0 ? lines[0].trim().split(" ") : null);
  const desired_tool_name = (tool_and_arguments && tool_and_arguments.length > 0 ? tool_and_arguments[0] : null);

  const reply_tool = new replyTool();
  const code_reply_tool = new codeReplyTool();
  const calc_tool = new calcTool();

  // コマンドを判定する
  if (desired_tool_name == reply_tool.name && reply_tool.checkInput(message)) {
    // 通常の返信ではコマンド行以外すべてのメッセージを返す。
    reply_tool.use(message, slackEvent);
  }
  else if (desired_tool_name == code_reply_tool.name && code_reply_tool.checkInput(message)) {
    code_reply_tool.use(message, slackEvent);
  }
  else if (desired_tool_name == calc_tool.name && calc_tool.checkInput(message)) {
    calc_tool.use(message, slackEvent);
  }
  else {
    // 未定義処理（現状は警告を出してメッセージ全体を返す）
    console.warn("未定義の命令が設定されました。");
    console.warn("tool_and_arguments:", tool_and_arguments);
    console.warn("message:", lines);
    postSlackMessage(message + "\n(AIからの未定義命令検知)", slackEvent.channel, ts);
  }
}

/**
 * GPT-3に対して、指定したメッセージを送信し、レスポンスを取得する
 * @param {string} message - 送信するメッセージ
 * @return {string} GPT-3からのレスポンス
 */
function fetchGpt3Message(prompt: string) {
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
    stop: ["\nAI:", "\nHuman:", "\nTool:"] // AIが一人で会話を続けないようにします。
  };
  // HTTPリクエストで使用するオプション
  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    muteHttpExceptions: true, // HTTPエラーを無視する
    headers: headers, // ヘッダーを指定する
    method: "post", // HTTPメソッドを指定する
    payload: JSON.stringify(requestBody),// リクエストボディを指定する
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
  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "get",
    headers: {
      Authorization: "Bearer " + apiKey
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

function makePrompt(messages: string[], aiPrefix = "AI:") {
  const prompt = `以下はHumanと、AIの対話です。AIは賢くHumanに従順で、簡潔に受け答えし、必要なtoolを利用して返答します。AIは以下ルールを守ります。\n`
    + `- 返答の1行目は必ず/xxx args1 args2 ...等という形で、メッセージの種別と必要な引数を記載する。(xxxにはツール名、argsには必要な引数が入る)\n`
    + `- toolが使える場合は、できる限り積極的にtoolを活用する。\n`
    + `- プログラムコードを記載する場合、その説明はプログラム内のコメントとして記載する(2行目以降をそのまま実行できるようにする)。\n`
    + `- 回答はプログラムコード部分を除いて、原則140文字以内に収める。この制限を超える場合はHumanに許可を求める。\n`
    + `---\n`
    + `toolには、以下の種類が存在します。\n`
    + `- "/reply"のようなインプットがあった場合、二行目以降のメッセージを人間に送る。\n`
    + `- "/code_reply FILENAME"のようなインプットがあった場合、二行目以降に書かれたコードをシンタックスハイライトしてHumanに渡す。FILENAMEには言語に応じた適切な拡張子をつけて渡す必要がある。\n`
    + `- "/calc X * Y"のようなインプットがあった場合、XとYを四則演算して返す。二行目以降には何も書いてはいけない。\n`
    + `---\n`
    + messages.join('\n')
    + `\n`
    + aiPrefix;

  return prompt
}

function getAndAddMessages(cacheKey: string, newMessage?: string) {
  const cache = CacheService.getScriptCache();
  const prevMessagesString = cache.get(cacheKey); //同じcacheKeyでストアされているデータをゲットする（無ければNULLになる）
  // キャッシュには文字列で入っているため、パースして、配列として取得する。
  const messages = prevMessagesString ? JSON.parse(prevMessagesString) : [];
  if (newMessage != null) {
    messages.push(newMessage)
  }

  // 配列を文字列化して、保存する。
  const messagesString = JSON.stringify(messages);
  cache.put(cacheKey, messagesString, 600);

  return messages
}
