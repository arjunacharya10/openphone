import QtQuick
import QtWebSockets
import ".."

Item {
    id: root

    // ── Public API ──
    property bool connected: false

    property ListModel cardsModel: ListModel {}
    property ListModel ledgerModel: ListModel {}
    property ListModel calendarModel: ListModel {}
    property ListModel chatModel: ListModel {}
    property bool thinking: false

    function sendCardAction(cardId, action) {
        if (!root.connected) return
        socket.sendTextMessage(JSON.stringify({
            type: "card:action",
            payload: { cardId: cardId, action: action },
            timestamp: Date.now()
        }))
    }

    function sendChatMessage(message, cardId) {
        if (!root.connected) return
        root.thinking = true
        root.chatModel.append({ role: "user", text: message })
        socket.sendTextMessage(JSON.stringify({
            type: "chat:message",
            payload: { message: message, cardId: cardId || undefined },
            timestamp: Date.now()
        }))
    }

    // ── WebSocket connection ──
    WebSocket {
        id: socket
        url: "ws://localhost:3000/ws"
        active: true

        onStatusChanged: {
            switch (socket.status) {
            case WebSocket.Open:
                root.connected = true
                reconnectTimer.stop()
                console.log("[ws] connected")
                break
            case WebSocket.Closed:
                root.connected = false
                reconnectTimer.start()
                console.log("[ws] closed — retrying in 3s")
                break
            case WebSocket.Error:
                root.connected = false
                reconnectTimer.start()
                console.log("[ws] error:", socket.errorString)
                break
            }
        }

        onTextMessageReceived: function(message) {
            var event
            try {
                event = JSON.parse(message)
            } catch (e) {
                console.warn("[ws] failed to parse message:", message)
                return
            }

            switch (event.type) {

            case "connected":
                // handshake confirmation — no-op, status already set
                break

            case "cards:sync":
                root.cardsModel.clear()
                for (var i = 0; i < event.payload.length; i++) {
                    root.cardsModel.append(cardToRole(event.payload[i]))
                }
                break

            case "card:created":
                // Insert sorted by priority — prepend high priority, append others
                var newCard = cardToRole(event.payload)
                if (event.payload.priority === "high") {
                    root.cardsModel.insert(0, newCard)
                } else {
                    root.cardsModel.append(newCard)
                }
                break

            case "card:removed":
                var removeId = event.payload.id
                for (var j = 0; j < root.cardsModel.count; j++) {
                    if (root.cardsModel.get(j).id === removeId) {
                        root.cardsModel.remove(j)
                        break
                    }
                }
                break

            case "ledger:sync":
                root.ledgerModel.clear()
                for (var k = 0; k < event.payload.length; k++) {
                    root.ledgerModel.append(ledgerToRole(event.payload[k]))
                }
                break

            case "action:recorded":
                root.ledgerModel.insert(0, ledgerToRole(event.payload))
                break

            case "calendar:sync":
                root.calendarModel.clear()
                for (var m = 0; m < event.payload.length; m++) {
                    root.calendarModel.append(calendarToRole(event.payload[m]))
                }
                break

            case "chat:delta": {
                root.thinking = false
                var delta = event.payload.delta || ""
                if (root.chatModel.count > 0) {
                    var last = root.chatModel.get(root.chatModel.count - 1)
                    if (last.role === "assistant") {
                        root.chatModel.setProperty(root.chatModel.count - 1, "text", last.text + delta)
                        break
                    }
                }
                root.chatModel.append({ role: "assistant", text: delta, streaming: true })
                break
            }

            case "chat:response": {
                root.thinking = false
                var fullText = event.payload.text || ""
                if (root.chatModel.count > 0) {
                    var lastIdx = root.chatModel.count - 1
                    var lastMsg = root.chatModel.get(lastIdx)
                    if (lastMsg.role === "assistant") {
                        root.chatModel.setProperty(lastIdx, "text", fullText)
                        root.chatModel.setProperty(lastIdx, "streaming", false)
                    } else {
                        root.chatModel.append({ role: "assistant", text: fullText, streaming: false })
                    }
                } else {
                    root.chatModel.append({ role: "assistant", text: fullText, streaming: false })
                }
                break
            }

            default:
                console.log("[ws] unhandled event type:", event.type)
            }
        }
    }

    // ── Reconnect timer ──
    Timer {
        id: reconnectTimer
        interval: 3000
        repeat: false
        onTriggered: {
            console.log("[ws] reconnecting...")
            socket.active = false
            socket.active = true
        }
    }

    // ── Data mapping helpers ──

    function cardToRole(card) {
        return {
            id: card.id || "",
            type: card.type || "system",
            title: card.title || "",
            context: card.context || "",
            priority: card.priority || "medium",
            actionsJson: JSON.stringify(card.actions || []),
            sourceType: card.sourceType || "",
            sourceId: card.sourceId || "",
            createdAt: card.createdAt || ""
        }
    }

    function ledgerToRole(entry) {
        var details = entry.details || {}
        var subject = details.subject || details.action || entry.kind
        return {
            id: entry.id || "",
            kind: entry.kind || "",
            subject: subject,
            timestamp: entry.timestamp || new Date().toISOString()
        }
    }

    function calendarToRole(ev) {
        return {
            id: ev.id || "",
            summary: ev.summary || "",
            startHour: isoToDecimalHour(ev.startTime),
            endHour: isoToDecimalHour(ev.endTime),
            location: ev.location || "",
            allDay: ev.allDay || false
        }
    }

    function isoToDecimalHour(isoString) {
        var d = new Date(isoString)
        return d.getHours() + d.getMinutes() / 60
    }
}
