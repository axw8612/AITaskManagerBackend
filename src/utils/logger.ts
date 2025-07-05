import winston from 'winston';
import fetch from 'node-fetch';
import { config } from '../config/config';

class SeqTransport extends winston.transports.Console {
  private serverUrl: string;
  private apiKey: string;

  constructor(opts: { serverUrl: string; apiKey: string }) {
    super();
    this.serverUrl = opts.serverUrl;
    this.apiKey = opts.apiKey;
  }

  override log(info: any, callback: () => void) {
    // Send to SEQ asynchronously
    this.sendToSeq(info);
    // Call the parent method if it exists
    if (super.log) {
      super.log(info, callback);
    } else {
      callback();
    }
  }

  private async sendToSeq(logEntry: any) {
    try {
      const seqEvent = {
        '@t': new Date().toISOString(),
        '@l': logEntry.level.toUpperCase(),
        '@m': logEntry.message,
        ...logEntry.meta,
      };

      await fetch(`${this.serverUrl}/api/events/raw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Seq-ApiKey': this.apiKey,
        },
        body: JSON.stringify(seqEvent),
      });
    } catch (error) {
      // Silently fail to avoid logging loops
    }
  }
}

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }),
];

if (config.nodeEnv === 'production') {
  transports.push(
    new winston.transports.File({
      filename: config.logging.file,
      format: logFormat,
    })
  );
}

// Add SEQ transport if configured
if (config.logging.seq) {
  const seqTransport = new SeqTransport({
    serverUrl: config.logging.seq.serverUrl,
    apiKey: config.logging.seq.apiKey,
  });
  transports.push(seqTransport);
  console.log('SEQ logging configured for:', config.logging.seq.serverUrl);
}

export const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports,
  exitOnError: false,
});

// Stream for Morgan HTTP logging
export const logStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};
