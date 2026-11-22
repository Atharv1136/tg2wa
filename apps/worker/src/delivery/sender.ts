export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  retryable?: boolean;
}

export interface Destination {
  phoneE164: string;
  apiKey: string;
  provider?: "callmebot" | "textmebot" | "ntfy" | string;
}

export interface Sender {
  send(dest: Destination, text: string): Promise<SendResult>;
}
