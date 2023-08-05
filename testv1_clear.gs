var CHANNEL_ACCESS_TOKEN = 'KQCjwzmEUTVZM7h634BXGWEY1AKf0+gq7duFhLlr8MsxpYDnGR6LZ8kV451X8tYG8Ljm8H9WC6yVExhPor4ElyP9TVJwnQfreqMlBGjhdR48FDxjgsEGmLz7SYdslVBjyZXh9JcjTxmyfwYJF3QZ2wdB04t89/1O/w1cDnyilFU='; 
const OPENAI_APIKEY = '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';
const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('log');
const checkSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('check');

const OPENAI_MODEL = "gpt-3.5-turbo";

const OPENAI_SYSTEM_PROMPT = "your prompt";

// botがLINEメッセージに反応する条件（ウェイクワード等）を正規表現で指定
const botRegExp = new RegExp(/^日記を作成/)

// botにロールプレイをさせる際の制約条件(適宜書き換えてください)
const botRoleContent = `
これから以下の設定に従って対話を繰り返します。

以下の4つのことについて質問をしてください。
・今日朝起きてから何をしたか。
・今日の出来事でよかったことと、それに対してどう感じたか
・今日失敗したことと、それに対してどう感じたか
・明日の目標
振り返りが終わったら、それまでの会話をもとに日記を作成して、出力してください。

それでは始めます。まずは今日の出来事について質問をしてください。
`
var replyToken, event

//ポストで送られてくるので、ポストデータ取得
function doPost(e) {
/*初期処理*/
  // LINEBotから送られてきたデータを、プログラムで利用しやすいようにJSON形式に変換する
  event = JSON.parse(e.postData.contents).events[0];

  //返信するためのトークン取得
  replyToken= event.replyToken;

  //入力されたメッセージを取得
  let lastMessage = event.message.text;
  let verify = lastMessage;
  //新規作成時はシートを初期化
  if(verify.match(botRegExp)){
    all_clear();
    lastMessage.replace(botRegExp, "");
  }else{
    ;
  }

  // メッセージ以外(スタンプや画像など)が送られてきた場合は終了
  if (verify === undefined) {
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
/*初期処理完了*/
/*ここからAIに投げる質問生成*/
  // ChatGPTに渡す会話情報
  let conversations = [];

  //スプレッドシートから会話記録の読み込み（B列で確認）
  //データ取得
  var currentMemoryContent;
  //最大行数の取得
  const lastRow = logSheet.getLastRow();
  //データがすでに存在する場合、currentMemoryContentに格納
  if(lastRow != 0)
  {
    currentMemoryContent = logSheet.getRange(1,1,lastRow).getValues();
    /*
    for(i = 0; i < currentMemoryContent.length; i++ ){
      check_to_sheet("A", currentMemoryContent[i]);
    }
    */
  }else{
    //スプレッドシートにデータがなければconversationsに初期データを追加
    conversations.push({"role": "system", "content": botRoleContent });
    currentMemoryContent=[];
  }

  //仮
  for(i=0;i<currentMemoryContent.length;i++){
    conversations.push(currentMemoryContent[i]);
  }
  
  //新規に作成する場合以外は、ユーザから送信された最新の会話文を追加（botRegExpは会話文に含めない）
  conversations.push({"role": "user", "content": lastMessage});//array.push(a,b,c,...)でarrayの末尾にa,b,c,..を追加
  Logger.log(conversations)
  
/*ここまでAIに投げる質問生成*/
//ここまでデバック済み
/*ここからGPTで文章生成*/

  // レスポンスメッセージを作成（テスト用）
  let botReply='rp'
/*
  // ChatGPT APIへのリクエストオプションを生成
  let botReply = callOpenAIAPI(conversations)
*/
  const sendmessage = test_message(botReply);

//ここまでGPTで文章生成
//ここからGPTの返答を含めた履歴を保存
  // botの会話履歴をアップデートしてシートへ保存
  newMemoryContent = conversations;
  newMemoryContent.push({"role": "assistant", "content": botReply});
  clear_column(1);
  for(let i = 0; i < newMemoryContent.length; i++ ){
    log_to_sheet("A", newMemoryContent[i]);
  }
//ここまでGPTの返答を含めた履歴を保存
//ここからLINEに送信する文章生成

  // line-bot-sdk-gas のライブラリを利用しています ( https://github.com/kobanyan/line-bot-sdk-gas )
  const linebotClient = new LineBotSDK.Client({ channelAccessToken: CHANNEL_ACCESS_TOKEN });

  // メッセージを返信
  linebotClient.replyMessage(replyToken, sendmessage);

  
  return ContentService.createTextOutput(JSON.stringify({'content': 'post ok'})).setMimeType(ContentService.MimeType.JSON);
//ここまでLINEに送信する文章生成

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
  prompt.push({"role": "system", "content": botRoleContent });
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

// 処理の確認用にログを出力する関数
function check_to_sheet(column, text) {
  if(checkSheet.getRange(column + "1").getValue() == ""){
    lastRow = 0
  } else if(checkSheet.getRange(column + "2").getValue() == ""){
    lastRow = 1
  } else {
    var lastRow = checkSheet.getRange(column + "1").getNextDataCell(SpreadsheetApp.Direction.DOWN).getRow();
    // 無限に増えるので1000以上書き込んだらリセット
    console.log("lastRow", lastRow)
    if(lastRow >= 1000){
      checkSheet.getRange(column + "1:" + column + "10").clearContent()
      lastRow = 0
    }
  }
  var putRange = column + String(lastRow + 1)
  checkSheet.getRange(putRange).setValue(text);
}
