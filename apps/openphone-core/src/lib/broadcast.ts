import type { WebSocket } from "ws";
import type { WSEvent } from "../../../../contracts/events/index.js";

const clients = new Set<WebSocket>();

export function addClient(socket: WebSocket): void {
  clients.add(socket);
}

export function removeClient(socket: WebSocket): void {
  clients.delete(socket);
}

export function broadcast<T>(event: WSEvent<T>): void {
  const data = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(data);
    }
  }
}

export function send<T>(socket: WebSocket, event: WSEvent<T>): void {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(event));
  }
}
