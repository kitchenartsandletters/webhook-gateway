export class WebhookProcessingError extends Error {
  constructor(message: string, public context?: Record<string, any>) {
    super(message);
    this.name = 'WebhookProcessingError';
  }
}