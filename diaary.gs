const IMAGE_GENERATION_URL = 'https://api.openai.com/v1/images/generations';
const FOLDER_ID = PropertiesService.getScriptProperties().getProperty('FOLDER_ID');
const imageFolder = DriveApp.getFolderById(FOLDER_ID);

//リンクしているスプレッドシート
const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('log');

//LINEのMessagingAPI
var CHANNEL_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty('CHANNEL_ACCESS_TOKEN'); 
// botがLINEメッセージに反応する条件（ウェイクワード）を正規表現で指定
const botRegExp = new RegExp(/^日記を作成/)

//OpenAI APIの設定
const OPENAI_APIKEY = PropertiesService.getScriptProperties().getProperty('OPENAI_APIKEY');
const OPENAI_MODEL = "gpt-3.5-turbo";
const OPENAI_SYSTEM_PROMPT = "your prompt";
// 文章生成時のOpenAIの役割
const botRoleContent = `
対話の内容を日記形式の文章にして、読みやすく段落分けし、100字程度で出力してください。
`

var replyToken, event

const start_comment = '日記の作成を開始します。\nこれからする4つの質問にできるだけ具体的に答えてください'
const question = ['今日はどんなことがありましたか？一番印象に残ったことを教えてください！','なぜ印象的だったのか、理由を教えてもらえますか？','その出来事に対してどのように感じましたか？達成感や後悔はありますか？\n振り返ってみて感じたことを教えてください！','最後に、明日の目標を教えてください。どんなことを達成したいですか？'];



//テキストをJSONテキスト配列に変換
function test_message(tex) {

  //送られたメッセージをそのままオウム返し
  var reply_messages = [{'type':'text', 'text': tex}]
 
  return reply_messages;
}

//スプレッドシートの特定の列初期化
function clear_column(column_num){
  const lastRaw = logSheet.getLastRow();
  if(lastRaw != 0){
    logSheet.getRange(1,column_num,lastRaw).clear();
  }
}

//スプレッドシート完全初期化
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
  console.log(typeof(result));
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


//スプレッドシートから、日記文章生成
function textGenerate(){
  //データ取得
  let memContent = [];
  var mem_dataA;
  var mem_dataB;
  //最大行数の取得
  const numRow = logSheet.getLastRow();
  //A列の値取得
  mem_dataA = logSheet.getRange(1,1,numRow).getValues();
  //B列の値取得
  mem_dataB = logSheet.getRange(1,2,numRow).getValues();

  //AIの役割や会話履歴といった情報を、OpenAIに渡すための形式にする。
  memContent.push({"role": "system", "content": botRoleContent });
  //質問（A列）の後に返答（B列）が来るように、配列の末尾に要素を追加する。
  for(i=0;i<numRow;i++)
  {
    memContent.push({"role": "assistant", "content": JSON.stringify(mem_dataA[i]) }); //JSON.stringifyは、オブジェクトを文字配列に変換する
    memContent.push({"role": "user", "content": JSON.stringify(mem_dataB[i]) });
  }  
  
  // ChatGPT APIへのリクエストオプションを生成
  let textDiary = callOpenAIAPI(memContent)
  console.log(textDiary);

  return textDiary;
}


//LINEのチャット情報がポストで送られてくるので、ポストデータ取得
function doPost(e) {
//初期処理
  // LINEBotから送られてきたデータを、プログラムで利用しやすいようにJSON形式に変換する
  event = JSON.parse(e.postData.contents).events[0];

  //返信するためのトークン取得
  replyToken= event.replyToken;

  //入力されたメッセージを取得
  let lastMessage = event.message.text;

  // line-bot-sdk-gas のライブラリを利用しています ( https://github.com/kobanyan/line-bot-sdk-gas )
  const linebotClient = new LineBotSDK.Client({ channelAccessToken: CHANNEL_ACCESS_TOKEN });

  // メッセージ以外(スタンプや画像など)が送られてきた場合は終了
  if (lastMessage === undefined) {
    // メッセージ以外(スタンプや画像など)が送られてきた場合
    lastMessage = 'テキスト以外のメッセージは対応していません';
    
    // メッセージを返信
    messages = test_message(lastMessage);
    linebotClient.replyMessage(replyToken, messages);

    return ContentService.createTextOutput(JSON.stringify({'content': 'post ok'})).setMimeType(ContentService.MimeType.JSON);
  }else{
    ;
  }
//初期処理終了
//QA処理開始
  //最大行数の取得
  const lastRow = logSheet.getLastRow();

  //各場面に分けて、質問を送信し、返答を保存
  if(lastMessage.match(botRegExp)){
  //シートの初期化
    all_clear();
  
  //Q1をJNOS型でシートに保存
    sendMessage = question[0];
    log_to_sheet("A",sendMessage);

    //Q1をメッセージ送信

    messages = test_message(sendMessage); 
    linebotClient.replyMessage(replyToken, messages);

    return ContentService.createTextOutput(JSON.stringify({'content': 'post ok'})).setMimeType(ContentService.MimeType.JSON);

  }else if(lastRow === 4){ //質問終了時
  //AnswerをJNOS型でシートに保存
    log_to_sheet("B",lastMessage);

    //日記生成開始
    tDiary = textGenerate();
    /*
    ann='日記を作成しました。しばらくお待ちください。';
    const annou=test_message(ann);
    linebotClient.replyMessage(replyToken,annou);
    */
    console.log(tDiary);
    log_to_sheet("C",tDiary);
    log_to_sheet("D",'step1');
    imageUrl=ilustlation(tDiary);

    const varDiary = test_message(imageUrl);
    log_to_sheet("E",'step2');

    // メッセージを返信
    linebotClient.replyMessage(replyToken, varDiary);
    log_to_sheet("F",'step3')

    return ContentService.createTextOutput(JSON.stringify({'content': 'post ok'})).setMimeType(ContentService.MimeType.JSON);

  }else if(lastRow < 4){  //最大行数が偶数のとき（質問に対する返答が保存されているとき）
    //メッセージ（Answer）をシートに保存
    log_to_sheet("B",lastMessage);

    //次の質問をシートに保存
    log_to_sheet("A",question[lastRow]);

    //次の質問を送信
    sendMessage = question[lastRow];

    // メッセージを返信
    messages = test_message(sendMessage);
    linebotClient.replyMessage(replyToken, messages);

    return ContentService.createTextOutput(JSON.stringify({'content': 'post ok'})).setMimeType(ContentService.MimeType.JSON);

  }else{
    console.log('QA error');
  }

//QA処理完了
}

function ill_test(){
  tet='きれいな花';
  console.log(typeof(tet));
  ilustlation(tet);
}

// メイン処理
function ilustlation(textDiary) {
  const translatedText = translateJaToEn(textDiary);
  console.log(translatedText);
  const url = generateImage(translatedText);
  const driveUrl = downloadImageFromOpenAiServer(url);
  console.log(typeof(driveUrl));
  return url;
}

// 画像生成
function generateImage(text) {
  const options = {
    "method" : "get",
    'contentType': 'application/json',
    "headers": { "Authorization":"Bearer " + OPENAI_APIKEY },
    "payload": JSON.stringify({
      prompt: text,
      n: 1,                   //デフォルトと同じであれば省略可
      size: "256x256",      //デフォルトと同じであれば省略可
      response_format: "url"  //デフォルトと同じであれば省略可
    })
  }
  const response = UrlFetchApp.fetch(IMAGE_GENERATION_URL, options);
  const imageUrl = JSON.parse(response.getContentText()).data[0].url;
  console.log(imageUrl);
  return imageUrl;
}

// Open AIサーバーから画像ダウンロードしてGoogle Driveに保存
function downloadImageFromOpenAiServer(imageUrl) {
  const response = UrlFetchApp.fetch(imageUrl);
  const blob = response.getBlob();  
  let newFile = imageFolder.createFile(blob);
  newFile.setName(Date.now());
  return newFile.getDownloadUrl();
}


// 日本語から英語に変換
function translateJaToEn(text) {
  return LanguageApp.translate(text, 'ja', 'en');
}

function getTodayDate() {
  //Dateオブジェクトからインスタンスを生成
  const today = new Date();
  //メソッドを使って、本日の日付を取得
  const year = today.getFullYear(); //年
  const month = today.getMonth()+1; //月
  const date = today.getDate(); //日
  const day = today.getDay(); //曜日
  const dayArray = ["日","月","火","水","木","金","土"]; //曜日の配列
  txtDate=String(year) + "年" + String(month) + "月" + String(date) + "日" + String(dayArray[day]) + "曜日の日記"
  Logger.log(year + "年" + month + "月" + date + "日" + dayArray[day]);
  return textDate;
}
function genDocument(txtdiary) {
  toDay=getTodayDate();
  var doc = DocumentApp.create("DIARY"+toDay);
  var body = doc.getBody();
  var paragraphs = body.getParagraphs();
  var p1 = paragraphs[0]
  // 本文作成
  body.appendParagraph("----------------------------------------------------------------------------------------------------");
  p1.appendText(toDay+"曜日の日記");
  p1.appendText(txtdiary);
}

function check_doc(){
  text='aiueo';
  genDocument(text);
}