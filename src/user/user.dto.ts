import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApiKeyDto {
    @ApiProperty({
        description: 'Human-readable name for this API key',
        example: 'Production Server',
    })
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    name: string;
}

export class UpdateProfileDto {
    @ApiPropertyOptional({
        description: 'Full name of the user',
        example: 'Moses Rodrigues',
    })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    full_name?: string;
}
