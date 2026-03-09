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

    /** Current session key for chat: "ui:chat:general" or "ui:chat:cardId" — used for thinking indicator routing */
    property string activeSessionKey: "ui:chat:general"

    /** Per-card chat models: cardId -> ListModel. General chat stays in chatModel. */
    property var _chatModelsByCard: ({})

    signal cardRemoved(string cardId)
    signal cardCycleRequested()

    function getChatModelForCard(cardId) {
        if (!cardId || cardId === "") return chatModel
        if (!_chatModelsByCard[cardId]) {
            var m = Qt.createQmlObject("import QtQuick; ListModel {}", root, "chatModel_" + cardId)
            _chatModelsByCard[cardId] = m
        }
        return _chatModelsByCard[cardId]
    }

    function populateChatForCard(cardId, messages) {
        var m = getChatModelForCard(cardId)
        m.clear()
        if (!messages || !Array.isArray(messages)) return
        for (var i = 0; i < messages.length; i++) {
            var msg = messages[i]
            if (!msg || msg.role === "toolResult") continue
            if (msg.role === "user" || msg.role === "assistant") {
                var text = root.extractTextFromMessage(msg)
                m.append({ role: msg.role, text: text, streaming: false })
            }
        }
    }

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
        var targetModel = root.getChatModelForCard(cardId || "")
        targetModel.append({ role: "user", text: message })
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

            case "card:removed": {
                var removeId = event.payload.id
                for (var j = 0; j < root.cardsModel.count; j++) {
                    if (root.cardsModel.get(j).id === removeId) {
                        root.cardsModel.remove(j)
                        break
                    }
                }
                root.cardRemoved(removeId)
                break
            }

            case "card:cycle": {
                root.cardCycleRequested()
                break
            }

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
                var sk = event.payload.sessionKey || "ui:chat:general"
                if (sk === root.activeSessionKey) root.thinking = false
                var target = sk === "ui:chat:general" ? root.chatModel : root.getChatModelForCard(sk.replace("ui:chat:", ""))
                var delta = event.payload.delta || ""
                if (target.count > 0) {
                    var last = target.get(target.count - 1)
                    if (last.role === "assistant") {
                        var accumulated = root.sanitizeChatText(last.text + delta)
                        target.setProperty(target.count - 1, "text", accumulated)
                        break
                    }
                }
                target.append({ role: "assistant", text: root.sanitizeChatText(delta), streaming: true })
                break
            }

            case "chat:response": {
                var sk2 = event.payload.sessionKey || "ui:chat:general"
                if (sk2 === root.activeSessionKey) root.thinking = false
                var target2 = sk2 === "ui:chat:general" ? root.chatModel : root.getChatModelForCard(sk2.replace("ui:chat:", ""))
                var fullText = root.sanitizeChatText(event.payload.text || "")
                if (target2.count > 0) {
                    var lastIdx2 = target2.count - 1
                    var lastMsg2 = target2.get(lastIdx2)
                    if (lastMsg2.role === "assistant") {
                        if (fullText.length > 0) {
                            target2.setProperty(lastIdx2, "text", fullText)
                            target2.setProperty(lastIdx2, "streaming", false)
                        } else {
                            target2.remove(lastIdx2)
                        }
                    } else {
                        if (fullText.length > 0) {
                            target2.append({ role: "assistant", text: fullText, streaming: false })
                        }
                    }
                } else {
                    if (fullText.length > 0) {
                        target2.append({ role: "assistant", text: fullText, streaming: false })
                    }
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
        var refType = entry.refType || ""
        var refId = entry.refId || ""
        var action = details.action || ""
        var subject
        if (refType === "card" && (details.cardTitle || action)) {
            subject = (details.cardTitle || "Card") + " — " + (action || details.subject || entry.kind)
        } else {
            subject = details.subject || action || entry.kind
        }
        return {
            id: entry.id || "",
            kind: entry.kind || "",
            refType: refType,
            refId: refId,
            subject: subject,
            action: action,
            timestamp: entry.timestamp || new Date().toISOString()
        }
    }

    function extractTextFromMessage(m) {
        if (!m) return ""
        var c = m.content
        if (typeof c === "string") return root.sanitizeChatText(c)
        if (!c) return ""
        if (Array.isArray(c)) {
            var out = ""
            for (var j = 0; j < c.length; j++) {
                var block = c[j]
                if (block && block.type === "text" && block.text)
                    out += block.text
            }
            return root.sanitizeChatText(out)
        }
        if (typeof c === "object" && c.text) return root.sanitizeChatText(c.text)
        return ""
    }

    function sanitizeChatText(text) {
        if (!text || typeof text !== "string") return ""
        return text.split("\n").filter(function(line) {
            var t = line.trim()
            if (!t) return true
            if (/\{\s*"role"\s*:/.test(t) && /\}\s*$/.test(t)) return false
            if (t === "ignore the message") return false
            if (/^<[^>]+>$/.test(t)) return false
            return true
        }).join("\n").trim()
    }

    function populateChat(messages) {
        root.chatModel.clear()
        if (!messages || !Array.isArray(messages)) return
        for (var i = 0; i < messages.length; i++) {
            var m = messages[i]
            if (!m || m.role === "toolResult") continue
            if (m.role === "user" || m.role === "assistant") {
                var text = root.extractTextFromMessage(m)
                root.chatModel.append({ role: m.role, text: text, streaming: false })
            }
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
