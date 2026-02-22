import type { CardType, CardPriority, CardAction } from "../events/index.js";

export interface CreateCardRequest {
  type: CardType;
  title: string;
  context?: string;
  priority?: CardPriority;
  actions?: CardAction[];
  sourceType?: string;
  sourceId?: string;
}

export interface CardActionRequest {
  action: string;
}
