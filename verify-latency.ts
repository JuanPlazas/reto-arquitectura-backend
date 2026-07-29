import { ActionType, PrismaClient, Signal } from '@prisma/client';
import axios from 'axios';

export type SignalWithOptionalId = Omit<Signal, 'id' | 'metadata'>;

async function checkLatency() {
  const prisma = new PrismaClient();
  const vehicleId = 1;
  const sendAt = new Date();
  const timeoutMs = 5000;

  console.log(`[${sendAt.toISOString()}] Sending PANIC signal...`);

  try {
    const signal: SignalWithOptionalId = {
      vehicleId,
      latitude: 0,
      longitude: 0,
      speed: 100,
      direction: 1,
      receivedAt: sendAt,
      type: 'PANIC',
    };

    // 1. Send Signal
    await axios.post('http://localhost:3000/signals', signal);
    console.log('Signal sent. Waiting for action...');

    // 2. Poll for ActionLog
    while (Date.now() - sendAt.getTime() < timeoutMs) {
      const log = await prisma.actionLog.findFirst({
        where: {
          vehicleId,
          ruleId: null,
          reason: signal.type,
          action: ActionType.NOTIFY_AUTHORITIES,
          executedAt: { gte: sendAt },
        },
      });

      if (log) {
        const latency = log.executedAt.getTime() - sendAt.getTime();
        console.log(
          `Action detected! [id: ${log.id}, vehicle: ${log.vehicleId}, reason: ${log.reason}]`,
        );
        console.log(`Latency: ${latency}ms`);

        if (latency < 2000) {
          console.log('SUCCESS: Latency is under 2 seconds.');
          process.exit(0);
        } else {
          console.error('FAILURE: Latency exceeded 2 seconds.');
          process.exit(1);
        }
      }

      await new Promise((r) => setTimeout(r, 100));
    }

    console.error('TIMEOUT: Action not detected within 2 seconds.');

    // Check if Signal was persisted at least
    const signalPersisted = await prisma.signal.findFirst({
      where: { ...signal },
    });

    if (signalPersisted) {
      console.log('DEBUG: Signal WAS persisted in DB');
      console.log(
        'Possible causes: Rule not triggered, RabbitMQ Action Queue issue, or Actions Service down.',
      );
    } else {
      console.log('DEBUG: Signal was NOT persisted in DB.');
      console.log(
        'Possible causes: Ingestion failed, RabbitMQ Signal Queue issue, or Worker hung/crashed before persistence.',
      );
    }

    process.exit(1);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkLatency();
