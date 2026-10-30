import {Body, Controller, HttpCode, Post} from '@nestjs/common';
import {ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse} from '@nestjs/swagger';
import {AuthService} from './auth.service.js';
import {LoginDto, LoginResponseDto} from './dto/login.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({summary: 'Inicia sesión y devuelve un token de acceso (JWT)'})
  @ApiOkResponse({type: LoginResponseDto})
  @ApiUnauthorizedResponse({description: 'INVALID_CREDENTIALS'})
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.auth.login(dto.email, dto.password);
  }
}
