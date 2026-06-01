import { Body, Controller, Post, Get } from '@nestjs/common';

import { OtpService } from './otp.service';
import { MailService } from 'src/mail/mail.service';
import * as dns from 'dns';
import * as net from 'net';

@Controller('otp')
export class OtpController {
  constructor(
    private otpService: OtpService,
    private mailService: MailService,
  ) {}

  // @Get('dns-test')
  // async dnsTest() {
  //   return new Promise((resolve, reject) => {
  //     dns.resolve4('smtp-relay.brevo.com', (err, addresses) => {
  //       if (err) reject(err);
  //       else resolve(addresses);
  //     });
  //   });
  // }

  @Get('smtp-test')
  smtpTest() {
    return new Promise((resolve) => {
      const socket = net.createConnection(587, 'smtp-relay.brevo.com', () => {
        resolve('CONNECTED');
        socket.destroy();
      });

      socket.on('error', (e) => {
        resolve(e.message);
      });

      socket.setTimeout(10000);

      socket.on('timeout', () => {
        resolve('TIMEOUT');
      });
    });
  }

  @Get('dns-google')
  async dnsGoogle() {
    return new Promise((resolve, reject) => {
      dns.lookup('google.com', { all: true }, (err, addresses) => {
        if (err) reject(err);
        else resolve(addresses);
      });
    });
  }

  @Get('dns-brevo')
  async dnsBrevo() {
    return new Promise((resolve, reject) => {
      dns.lookup('smtp-relay.brevo.com', { all: true }, (err, addresses) => {
        if (err) reject(err);
        else resolve(addresses);
      });
    });
  }

  @Get('dns-test')
  async dnsTest() {
    return new Promise((resolve, reject) => {
      dns.lookup('smtp-relay.brevo.com', { all: true }, (err, addresses) => {
        if (err) reject(err);
        else resolve(addresses);
      });
    });
  }

  // @Get('mail-test')
  // async mailTest() {
  //   await this.mailService.sendOtp('fatchurrosi17@gmail.com', '123456');

  //   return 'ok';
  // }

  @Get('mail-test')
  async mailTest() {
    return await fetch('https://api.brevo.com/v3/account', {
      headers: {
        'api-key': process.env.BREVO_API_KEY!,
      },
    }).then((r) => r.text());
  }

  @Post('send')
  async sendOtp(@Body('email') email: string) {
    return this.otpService.sendOtp(email);
  }

  @Post('verify')
  async verifyOtp(@Body('email') email: string, @Body('code') code: string) {
    return this.otpService.verifyOtp(email, code);
  }
}
