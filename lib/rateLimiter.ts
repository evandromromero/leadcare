// Rate Limiter para proteção contra ban do WhatsApp
// Limita quantidade de mensagens por instância e adiciona delay entre envios

interface RateLimitEntry {
  timestamps: number[];
  lastSent: number;
}

const rateLimitStore: Map<string, RateLimitEntry> = new Map();

// Configurações de proteção
const CONFIG = {
  MAX_MESSAGES_PER_MINUTE: 15,  // Máximo de mensagens por minuto por instância
  MIN_DELAY_MS: 3000,           // Delay mínimo entre mensagens (3 segundos)
  WINDOW_MS: 60000,             // Janela de tempo para contagem (1 minuto)
};

export function canSendMessage(instanceName: string): { allowed: boolean; waitMs: number; reason?: string } {
  const now = Date.now();
  let entry = rateLimitStore.get(instanceName);

  if (!entry) {
    entry = { timestamps: [], lastSent: 0 };
    rateLimitStore.set(instanceName, entry);
  }

  // Limpar timestamps antigos (fora da janela de 1 minuto)
  entry.timestamps = entry.timestamps.filter(t => now - t < CONFIG.WINDOW_MS);

  // Verificar rate limit (mensagens por minuto)
  if (entry.timestamps.length >= CONFIG.MAX_MESSAGES_PER_MINUTE) {
    const oldestTimestamp = entry.timestamps[0];
    const waitMs = CONFIG.WINDOW_MS - (now - oldestTimestamp);
    return {
      allowed: false,
      waitMs,
      reason: `Limite de ${CONFIG.MAX_MESSAGES_PER_MINUTE} mensagens por minuto atingido. Aguarde ${Math.ceil(waitMs / 1000)} segundos.`
    };
  }

  // Verificar delay mínimo entre mensagens
  const timeSinceLastSent = now - entry.lastSent;
  if (timeSinceLastSent < CONFIG.MIN_DELAY_MS) {
    const waitMs = CONFIG.MIN_DELAY_MS - timeSinceLastSent;
    return {
      allowed: false,
      waitMs,
      reason: `Aguarde ${Math.ceil(waitMs / 1000)} segundos antes de enviar outra mensagem.`
    };
  }

  return { allowed: true, waitMs: 0 };
}

export function recordMessageSent(instanceName: string): void {
  const now = Date.now();
  let entry = rateLimitStore.get(instanceName);

  if (!entry) {
    entry = { timestamps: [], lastSent: 0 };
    rateLimitStore.set(instanceName, entry);
  }

  entry.timestamps.push(now);
  entry.lastSent = now;
}

export function getRateLimitStatus(instanceName: string): { 
  messagesInLastMinute: number; 
  maxPerMinute: number;
  canSendIn: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(instanceName);

  if (!entry) {
    return { 
      messagesInLastMinute: 0, 
      maxPerMinute: CONFIG.MAX_MESSAGES_PER_MINUTE,
      canSendIn: 0
    };
  }

  const recentTimestamps = entry.timestamps.filter(t => now - t < CONFIG.WINDOW_MS);
  const timeSinceLastSent = now - entry.lastSent;
  const canSendIn = timeSinceLastSent < CONFIG.MIN_DELAY_MS 
    ? CONFIG.MIN_DELAY_MS - timeSinceLastSent 
    : 0;

  return {
    messagesInLastMinute: recentTimestamps.length,
    maxPerMinute: CONFIG.MAX_MESSAGES_PER_MINUTE,
    canSendIn
  };
}

// Função para aguardar o delay necessário
export function waitForRateLimit(instanceName: string): Promise<void> {
  const { allowed, waitMs } = canSendMessage(instanceName);
  
  if (allowed) {
    return Promise.resolve();
  }

  return new Promise(resolve => setTimeout(resolve, waitMs));
}
