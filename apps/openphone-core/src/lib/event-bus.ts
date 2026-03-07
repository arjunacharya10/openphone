import type { Card, LedgerEntry } from "../../../../contracts/events/index.js";

export type StateEvent =
  | { type: "card:created"; payload: Card }
  | { type: "card:removed"; payload: { id: string } }
  | { type: "ledger:entry"; payload: LedgerEntry }
  | { type: "ingest:received"; payload: { channel: string; summary: string } };

type Subscriber = (event: StateEvent) => void;

const subscribers = new Set<Subscriber>();

export function publish(event: StateEvent): void {
  for (const sub of subscribers) {
    try {
      sub(event);
    } catch {
      // subscriber errors must not crash the bus
    }
  }
}

export function subscribe(fn: Subscriber): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}
