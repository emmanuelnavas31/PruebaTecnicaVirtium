import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  /** @example ana@orbita.test */
  @IsEmail({}, { message: 'email no es válido' })
  @MaxLength(254)
  email: string;

  /** @example Orbita123! */
  @IsString()
  @MinLength(1, { message: 'password es obligatorio' })
  @MaxLength(200)
  password: string;
}

export class LoginResponseDto {
  accessToken: string;
  tokenType: 'Bearer';
  /** Segundos de vida del token. */
  expiresIn: number;
  /** Fecha ISO en que expira el token. */
  expiresAt: string;
  user: { id: string; email: string };
}
