export type ClientInfo = {
  id: string;
  userAgent: string;
  connectedAt: number;
  lastPingMs: number | null;
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  actions?: { action: string; title: string }[];
};

export interface ServerToClientEvents {
  'clients:update': (clients: ClientInfo[]) => void;
  'pong:reply': (sentAt: number) => void;
}

export interface ClientToServerEvents {
  'status:join': () => void;
  'status:leave': () => void;
  'ping:probe': (sentAt: number) => void;
}

export type AnySocketEvent =
  | keyof ServerToClientEvents
  | keyof ClientToServerEvents;
