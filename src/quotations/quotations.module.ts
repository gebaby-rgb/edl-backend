import { Module } from '@nestjs/common';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from './quotations.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [QuotationsController],
  providers: [QuotationsService],
  exports: [QuotationsService], // Exported for other modules to perform validation checks
})
export class QuotationsModule {}
