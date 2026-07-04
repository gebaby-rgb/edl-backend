import { Module } from '@nestjs/common';
import { LoggerModule } from './logger/logger.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { CasesModule } from './cases/cases.module';
import { FilesModule } from './files/files.module';
import { ChatModule } from './chat/chat.module';
import { QuotationsModule } from './quotations/quotations.module';
import { ProductionModule } from './production/production.module';
import { DeliveryModule } from './delivery/delivery.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';
import { HealthController } from './common/controllers/health.controller';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    LoggerModule,   // Global — available in every module without re-importing
    AuthModule,
    PrismaModule,
    UsersModule,
    CasesModule,
    FilesModule,
    ChatModule,
    QuotationsModule,
    ProductionModule,
    DeliveryModule,
    NotificationsModule,
    ReportsModule,
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 5,
    }]),
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
