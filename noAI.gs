
var CHANNEL_ACCESS_TOKEN = 'KQCjwzmEUTVZM7h634BXGWEY1AKf0+gq7duFhLlr8MsxpYDnGR6LZ8kV451X8tYG8Ljm8H9WC6yVExhPor4ElyP9TVJwnQfreqMlBGjhdR48FDxjgsEGmLz7SYdslVBjyZXh9JcjTxmyfwYJF3QZ2wdB04t89/1O/w1cDnyilFU='; 
const OPENAI_APIKEY = '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';
const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('log');

const OPENAI_MODEL = "gpt-3.5-turbo";

const OPENAI_SYSTEM_PROMPT = "your prompt";

// botがLINEメッセージに反応する条件（ウェイクワード等）を正規表現で指定
const botRegExp = new RegExp(/^日記を作成/)

// botにロールプレイをさせる際の制約条件(適宜書き換えてください)
const botRoleContent = `
対話の内容をもとに、400字程度の日記を作成して、出力してください
`
var replyToken, event

const start_comment = '日記の作成を開始します。\nこれからする4つの質問にできるだけ具体的に答えてください'
const question = ['今日の出来事を教えてください','それはどこで、誰としましたか？','その出来事に対してどう感じましたか？','最後に、明日の目標を教えてください'];

//質問ごとにシートに出力する関数のデバッグ
function test_sheet_src(lastMessage){
  const lastRow = logSheet.getLastRow();
  console.log(lastRow);
  let text_export=[];
  let q_export=[];
  if(lastMessage.match(botRegExp)){
  //シートの初期化
    all_clear();
    console.log('check');
  
  //Q1をJNOS型でシートに保存
    sendMessage = question[0];
    console.log(sendMessage);
    text_export.push({"role": "assistant", "content": sendMessage});
    console.log(text_export);
    log_to_sheet("A",text_export);
  
  }else if(lastRow === 4){ //質問終了時
  //AnswerをJNOS型でシートに保存
    text_export.push({"role": "user", "content": lastMessage});
    log_to_sheet("B",text_export);

  }else if(lastRow < 4){  //最大行数が偶数のとき（質問に対する返答が保存されているとき）
  //メッセージ（Answer）をシートに保存
    text_export.push({"role": "user", "content": lastMessage});
    log_to_sheet("B",text_export);

  //次の質問をシートに保存
    q_export.push({"role": "assistant", "content": question[lastRow]});
    log_to_sheet("A",q_export);

  }else{
    console.log('QA error');
  }
}

function test_sheet(){
  mes='はい';
  test_sheet_src(mes);
}

function testGenerate(){
  //スプレッドシートから会話記録の読み込み
  //データ取得
  let memContent = [];
  var mem_dataA;
  var mem_dataB;
  //最大行数の取得
  const numRow = logSheet.getLastRow();
  mem_dataA = logSheet.getRange(1,1,numRow).getValues();
  mem_dataB = logSheet.getRange(1,2,numRow).getValues();

  memContent.push({"role": "system", "content": botRoleContent });

  for(i=0;i<numRow;i++)
  {
    memContent.push({"role": "assistant", "content": mem_dataA[i] });
    memContent.push({"role": "user", "content": mem_dataB[i] });
  }
  
  console.log(memContent);
  
  
  // レスポンスメッセージを作成（テスト用）
  //let textDiary='rp'

  // ChatGPT APIへのリクエストオプションを生成
  let textDiary = callOpenAIAPI(memContent)
  console.log(textDiary);

  const varDiary = test_message(textDiary);

}


//ポストで送られてくるので、ポストデータ取得
function doPost(e) {
//初期処理
  // LINEBotから送られてきたデータを、プログラムで利用しやすいようにJSON形式に変換する
  event = JSON.parse(e.postData.contents).events[0];

  //返信するためのトークン取得
  replyToken= event.replyToken;

  //入力されたメッセージを取得
  let lastMessage = event.message.text;

  // メッセージ以外(スタンプや画像など)が送られてきた場合は終了
  if (lastMessage === undefined) {
    // メッセージ以外(スタンプや画像など)が送られてきた場合
    lastMessage = 'テキスト以外のメッセージは対応していません';
    
    // line-bot-sdk-gas のライブラリを利用しています ( https://github.com/kobanyan/line-bot-sdk-gas )
    const linebotClient = new LineBotSDK.Client({ channelAccessToken: CHANNEL_ACCESS_TOKEN });

    // メッセージを返信
    messages = test_message(lastMessage);
    linebotClient.replyMessage(replyToken, messages);

    return ContentService.createTextOutput(JSON.stringify({'content': 'post ok'})).setMimeType(ContentService.MimeType.JSON);
  }else{
    ;
  }

  const sys_cmd=[{"role": "system", "content": botRoleContent}]


  //スプレッドシートから会話記録の読み込み（B列で確認）
  //最大行数の取得
  const lastRow = logSheet.getLastRow();

  if(lastMessage.match(botRegExp)){
  //シートの初期化
    all_clear();
  
  //Q1をJNOS型でシートに保存
    sendMessage = question[0];
    log_to_sheet("A",sendMessage);

    //Q1をメッセージ送信
    // line-bot-sdk-gas のライブラリを利用しています ( https://github.com/kobanyan/line-bot-sdk-gas )
    const linebotClient = new LineBotSDK.Client({ channelAccessToken: CHANNEL_ACCESS_TOKEN });

    messages = test_message(sendMessage); 
    linebotClient.replyMessage(replyToken, messages);

    return ContentService.createTextOutput(JSON.stringify({'content': 'post ok'})).setMimeType(ContentService.MimeType.JSON);

  }else if(lastRow === 4){ //質問終了時
  //AnswerをJNOS型でシートに保存
    log_to_sheet("B",lastMessage);

  // メッセージを送信
    sendMessage = '絵日記を作成します';
    // line-bot-sdk-gas のライブラリを利用しています ( https://github.com/kobanyan/line-bot-sdk-gas )
    const linebotClient = new LineBotSDK.Client({ channelAccessToken: CHANNEL_ACCESS_TOKEN });

    messages = test_message(sendMessage);
    linebotClient.replyMessage(replyToken, messages);

    return ContentService.createTextOutput(JSON.stringify({'content': 'post ok'})).setMimeType(ContentService.MimeType.JSON);

  }else if(lastRow < 4){  //最大行数が偶数のとき（質問に対する返答が保存されているとき）
  //メッセージ（Answer）をシートに保存
    log_to_sheet("B",lastMessage);

  //次の質問をシートに保存
    log_to_sheet("A",question[lastRow]);

  //次の質問を送信
    sendMessage = question[lastRow];

    // line-bot-sdk-gas のライブラリを利用しています ( https://github.com/kobanyan/line-bot-sdk-gas )
    const linebotClient = new LineBotSDK.Client({ channelAccessToken: CHANNEL_ACCESS_TOKEN });

    // メッセージを返信
    messages = test_message(sendMessage);
    linebotClient.replyMessage(replyToken, messages);

    return ContentService.createTextOutput(JSON.stringify({'content': 'post ok'})).setMimeType(ContentService.MimeType.JSON);

  }else{
    console.log('QA error');
  }



//QA処理完了
//日記生成開始

  //スプレッドシートから会話記録の読み込み
  //データ取得
  var currentMemoryContent = [];
  var mem_dataA;
  var mem_dataB;
  //最大行数の取得
  mem_dataA = logSheet.getRange(1,1,4).getValues();
  mem_dataB = logSheet.getRange(1,2,4).getValues();

  currentMemoryContent.push(sys_cmd);
  for(i=0;i<numRow;i++)
  {
    currentMemoryContent.push(mem_dataA[i]);
    currentMemoryContent.push(mem_dataB[i]);
  }
  
  
  // レスポンスメッセージを作成（テスト用）
  //let textDiary='rp'

  // ChatGPT APIへのリクエストオプションを生成
  let textDiary = callOpenAIAPI(currentMemoryContent)
  log_to_sheet("C",textDiary);

  const varDiary = test_message(textDiary);

//ここまでGPTで文章生成
}

// 動作確認用のオウム返しのメッセージを作成する関数
function parrot_message(user_message) {

  //送られたメッセージをそのままオウム返し
  var reply_messages = [user_message];
 
  // メッセージを返信
  var messages = reply_messages.map(function (v) {
    return {'type': 'text', 'text': v};    
  });

  return messages
}

function test_message(tex) {

  //送られたメッセージをそのままオウム返し
  var reply_messages = [{'type':'text', 'text': tex}]
 
  return reply_messages;
}

//スプレッドシートの初期化
function clear_column(column_num){
  const lastRaw = logSheet.getLastRow();
  if(lastRaw != 0){
    logSheet.getRange(1,column_num,lastRaw).clear();
  }
}

function all_clear()
{
  logSheet.clear();
}

// Google Apps Script で OpenAI API を利用するための関数
function callOpenAIAPI(prompt) {
  const apiUrl = "https://api.openai.com/v1/chat/completions";
  const headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + OPENAI_APIKEY
  };
  
  const payload = {
    "model": OPENAI_MODEL,
    "messages": prompt,
  };
  
  const options = {
    "method": "post",
    "headers": headers,
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };
  
  const response = UrlFetchApp.fetch(apiUrl, options);
  const responseJson = JSON.parse(response.getContentText());
  
  if (response.getResponseCode() == 200) {
    return responseJson.choices[0].message.content;
  } else {
    throw new Error("Error calling OpenAI API: " + response.getContentText());
  }
}

// openai api動作確認用
function testOpenAIAPI() {
  let prompt = [];
  prompt.push({"role": "system", "content": botRoleContent },{"role": "assistant", "content": '今日は何をしましたか' },{"role": "assistant", "content": 'システム開発' });
  const result = callOpenAIAPI(prompt);
  log_to_sheet("C",result);
  Logger.log(result);
}


// 処理の確認用にログを出力する関数
function log_to_sheet(column, text) {
  if(logSheet.getRange(column + "1").getValue() == ""){
    lastRow = 0
  } else if(logSheet.getRange(column + "2").getValue() == ""){
    lastRow = 1
  } else {
    var lastRow = logSheet.getRange(column + "1").getNextDataCell(SpreadsheetApp.Direction.DOWN).getRow();
    // 無限に増えるので1000以上書き込んだらリセット
    console.log("lastRow", lastRow)
    if(lastRow >= 1000){
      logSheet.getRange(column + "1:" + column + "10").clearContent()
      lastRow = 0
    }
  }
  var putRange = column + String(lastRow + 1)
  logSheet.getRange(putRange).setValue(text);
}
