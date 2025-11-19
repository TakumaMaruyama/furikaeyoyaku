import { getUncachableResendClient } from "./resend-client";

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

export async function sendConfirmationEmail(
  toEmail: string,
  childName: string,
  courseLabel: string,
  date: string,
  startTime: string,
  classBand: string,
  declineToken: string
) {
  const { client, fromEmail } = await getUncachableResendClient();
  
  const declineUrl = `${BASE_URL}/api/wait-decline?token=${declineToken}`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>振替予約確定のお知らせ</title>
  <style>
    body {
      font-family: "Noto Sans JP", sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #0066cc;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .header h1 {
      color: #0066cc;
      font-size: 24px;
      margin: 0;
    }
    .content {
      margin-bottom: 24px;
    }
    .info-box {
      background-color: #f0f7ff;
      border-left: 4px solid #0066cc;
      padding: 16px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .info-box p {
      margin: 8px 0;
      font-size: 16px;
    }
    .info-box strong {
      color: #0066cc;
    }
    .button {
      display: inline-block;
      background-color: #dc2626;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      text-align: center;
      margin: 20px 0;
    }
    .footer {
      margin-top: 32px;
      padding-top: 20px;
      border-top: 1px solid #e5e5e5;
      font-size: 14px;
      color: #666;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ 振替予約が確定しました</h1>
    </div>
    
    <div class="content">
      <p>保護者様</p>
      <p>いつもご利用ありがとうございます。</p>
      <p><strong>${childName}</strong> さんの振替予約が確定いたしました。</p>
      
      <div class="info-box">
        <p><strong>コース：</strong>${courseLabel}</p>
        <p><strong>クラス帯：</strong>${classBand}</p>
        <p><strong>日時：</strong>${date} ${startTime}</p>
      </div>
      
      <p>もし都合が悪くなった場合は、以下のボタンから辞退することができます。</p>
      <p>辞退された場合、次の順番待ちの方に自動的にご案内いたします。</p>
      
      <div style="text-align: center;">
        <a href="${declineUrl}" class="button">辞退する</a>
      </div>
    </div>
    
    <div class="footer">
      <p>このメールは自動送信されています。</p>
      <p>水泳教室 振替予約システム</p>
    </div>
  </div>
</body>
</html>
  `;

  await client.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: `[振替確定] ${date} ${startTime} - ${classBand}`,
    html: htmlContent,
  });
}

export async function sendExpiredEmail(
  toEmail: string,
  childName: string,
  courseLabel: string,
  date: string,
  startTime: string,
  classBand: string
) {
  const { client, fromEmail } = await getUncachableResendClient();

  const htmlContent = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>振替予約のご案内</title>
  <style>
    body {
      font-family: "Noto Sans JP", sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #ea580c;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .header h1 {
      color: #ea580c;
      font-size: 24px;
      margin: 0;
    }
    .content {
      margin-bottom: 24px;
    }
    .info-box {
      background-color: #fff7ed;
      border-left: 4px solid #ea580c;
      padding: 16px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .info-box p {
      margin: 8px 0;
      font-size: 16px;
    }
    .footer {
      margin-top: 32px;
      padding-top: 20px;
      border-top: 1px solid #e5e5e5;
      font-size: 14px;
      color: #666;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>振替予約のご案内</h1>
    </div>
    
    <div class="content">
      <p>保護者様</p>
      <p>いつもご利用ありがとうございます。</p>
      <p><strong>${childName}</strong> さんの順番待ちについてお知らせいたします。</p>
      
      <div class="info-box">
        <p><strong>コース：</strong>${courseLabel}</p>
        <p><strong>クラス帯：</strong>${classBand}</p>
        <p><strong>日時：</strong>${date} ${startTime}</p>
      </div>
      
      <p>誠に申し訳ございませんが、レッスン開始時刻が近づいたため、今回はご案内ができませんでした。</p>
      <p>また別の機会にお申し込みください。</p>
    </div>
    
    <div class="footer">
      <p>このメールは自動送信されています。</p>
      <p>水泳教室 振替予約システム</p>
    </div>
  </div>
</body>
</html>
  `;

  await client.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: `[振替] 今回はご案内できませんでした - ${date} ${startTime} ${classBand}`,
    html: htmlContent,
  });
}

export async function sendAbsenceLoggedEmail(
  toEmail: string,
  childName: string,
  courseLabel: string,
  classBand: string,
  lessonDate: string,
  startTime: string,
  resumeToken: string
) {
  const { client, fromEmail } = await getUncachableResendClient();
  const resumeUrl = `${BASE_URL}/?token=${resumeToken}`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>欠席登録のご案内</title>
  <style>
    body {
      font-family: "Noto Sans JP", sans-serif;
      background-color: #f5f5f5;
      margin: 0;
      padding: 20px;
      color: #333;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      padding: 32px;
    }
    .header {
      border-bottom: 2px solid #0ea5e9;
      margin-bottom: 20px;
      text-align: center;
    }
    .header h1 {
      color: #0ea5e9;
      margin: 0;
      font-size: 22px;
    }
    .info-box {
      background-color: #ecfeff;
      border-left: 4px solid #0ea5e9;
      padding: 16px;
      border-radius: 4px;
      margin: 20px 0;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      border-radius: 999px;
      background: #0ea5e9;
      color: #fff !important;
      text-decoration: none;
      font-weight: 600;
      margin-top: 12px;
    }
    .footer {
      font-size: 13px;
      color: #666;
      text-align: center;
      margin-top: 24px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>欠席のご連絡を受け付けました</h1>
    </div>
    <p>保護者様</p>
    <p>
      いつもお子さまのレッスンにご参加いただきありがとうございます。<br/>
      <strong>${childName}</strong> さんの欠席登録を受け付けました。以下のリンクから振替の手続きを進められます。
    </p>
    <div class="info-box">
      <p><strong>欠席クラス：</strong>${courseLabel} / ${classBand}</p>
      <p><strong>欠席日：</strong>${lessonDate} ${startTime}</p>
    </div>
    <p style="text-align:center;">
      <a class="button" href="${resumeUrl}">振替手続きを開く</a>
    </p>
    <p>リンクは他の端末からでも開けます。振替期限内（欠席日の前後1か月）にお手続きをお願いいたします。</p>
    <div class="footer">
      <p>このメールは自動送信されています。</p>
      <p>水泳教室 振替予約システム</p>
    </div>
  </div>
</body>
</html>
  `;

  await client.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: `[欠席登録完了] ${lessonDate} ${courseLabel}`,
    html: htmlContent,
  });
}
