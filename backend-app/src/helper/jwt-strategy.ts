import { Injectable } from '@nestjs/common';

import { PassportStrategy } from '@nestjs/passport';

import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    console.log(process.env.JWT_SECRET);

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      ignoreExpiration: false,

      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  // async validate(payload: any) {
  //   return {
  //     id: payload.id,
  //     email: payload.email,
  //     role: payload.role,
  //   };
  // }

async validate(payload: any) {

  return {
    id: payload.id,
    email: payload.email,
    role: payload.role,
  };
}

  // return {
  //   id: payload.sub,
  //   email: payload.email,
  //   role: payload.role,
  // };
}
