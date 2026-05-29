import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  // =========================================
  // SEND OTP
  // =========================================

  async sendOtp(email: string, code: string) {
    await this.transporter.sendMail({
      to: email,
      subject: 'Your Glucofy OTP Code',
      html: `
<div style="
  margin: 0;
  padding: 0;
  background-color: #F8FBF7;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
">
  <div style="
    max-width: 550px;
    margin: auto;
    padding: 24px 12px;
  ">
    <div style="
      background: #ffffff;
      border-radius: 32px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(139, 195, 74, 0.06);
      border: 1px solid #EEF5EC;
    ">
      
      <div style="
        padding: 32px 24px 16px 24px;
        text-align: center;
      ">
        <img
          src="https://i.imgur.com/sBwRpBd.png"
          width="70"
          alt="Glucofy Logo"
          style="
            display: block;
            margin: 0 auto 12px auto;
          "
        />
        <h1 style="
          color: #1E293B;
          margin: 0;
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.5px;
        ">
          Glucofy
        </h1>
        <p style="
          margin: 4px 0 0 0;
          color: #10B981;
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
        ">
          Smart Sugar Health Assistant
        </p>
      </div>

      <div style="padding: 0 24px 32px 24px;">
        
        <div style="height: 1px; background: #F1F5F9; margin-bottom: 24px;"></div>

        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="
            margin: 0 0 8px 0;
            font-size: 20px;
            font-weight: 700;
            color: #0F172A;
          ">
            Verification Required
          </h2>
          <p style="
            color: #64748B;
            font-size: 14px;
            line-height: 1.5;
            margin: 0;
          ">
            Use this secure verification code to continue your login process safely.
          </p>
        </div>

        <div style="
          background: #F8FAFC;
          border: 2px dashed #E2E8F0;
          border-radius: 24px;
          padding: 24px 16px;
          text-align: center;
        ">
          <p style="
            margin: 0 0 16px 0;
            color: #64748B;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          ">
            Your Secure OTP Code
          </p>
          
          <div style="
            background: #ffffff;
            border-radius: 16px;
            padding: 14px 20px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 10px 25px rgba(245, 158, 11, 0.06);
            border: 1px solid #FEF3C7;
          ">
            <span id="otpCode" style="
              font-size: 38px;
              font-weight: 800;
              color: #F59E0B;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              letter-spacing: 4px;
              margin-right: 12px;
            ">${code}</span>

            <button 
              onclick="navigator.clipboard.writeText('${code}'); this.style.backgroundColor='#10B981'; this.innerText='✓';"
              style="
                background-color: #F59E0B;
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 8px;
                font-size: 12px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.2s ease;
                outline: none;
              "
              title="Copy Code"
            >
              Copy
            </button>
          </div>

          <p style="
            margin: 12px 0 0 0;
            color: #94A3B8;
            font-size: 12px;
          ">
            Tap 'Copy' or hold the code to replicate
          </p>
        </div>

        <div style="
          margin-top: 20px;
          background: #F4FBF2;
          border-radius: 20px;
          padding: 16px;
          border: 1px solid #E7F6E4;
        ">
          <table width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td align="center" width="50%" style="border-right: 1px solid #E2E8F0;">
                <div style="
                  font-size: 24px;
                  font-weight: 800;
                  color: #10B981;
                  line-height: 1.2;
                ">
                  5m
                </div>
                <div style="
                  color: #64748B;
                  font-size: 12px;
                  font-weight: 500;
                  margin-top: 2px;
                ">
                  Expiration
                </div>
              </td>
              <td align="center" width="50%">
                <div style="
                  font-size: 24px;
                  font-weight: 800;
                  color: #F59E0B;
                  line-height: 1.2;
                ">
                  100%
                </div>
                <div style="
                  color: #64748B;
                  font-size: 12px;
                  font-weight: 500;
                  margin-top: 2px;
                ">
                  Secure Connection
                </div>
              </td>
            </tr>
          </table>
        </div>

        <div style="
          margin-top: 20px;
          background: #FFFBEB;
          padding: 14px 16px;
          border-radius: 16px;
          border: 1px solid #FEF3C7;
        ">
          <p style="
            margin: 0;
            color: #B45309;
            line-height: 1.4;
            font-size: 12px;
            text-align: center;
            font-weight: 500;
          ">
            ⚠️ Never share this OTP code with anyone. Glucofy will never ask for your verification code.
          </p>
        </div>

      </div>

      <div style="
        background: #F8FAFC;
        padding: 20px;
        text-align: center;
        border-top: 1px solid #F1F5F9;
      ">
        <p style="
          margin: 0;
          color: #94A3B8;
          font-size: 12px;
          font-weight: 500;
        ">
          © 2026 Glucofy • Healthy Life Starts Today
        </p>
      </div>

    </div>
  </div>
</div>
`,
    });
  }
}