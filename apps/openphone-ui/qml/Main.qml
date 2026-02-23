import QtQuick
import QtQuick.Layouts
import "components"
import "views"

Window {
    id: root
    width: 480
    height: 960
    visible: true
    visibility: Window.FullScreen
    title: "OpenPhone"
    color: Theme.background

    // ── Bind window dimensions to Theme for responsive scaling ──
    onWidthChanged: Theme.windowWidth = width
    onHeightChanged: Theme.windowHeight = height
    // ── WebSocket client ──
    WebSocketClient {
        id: wsClient
        activeSessionKey: root.activeSessionKey
        onCardRemoved: function(cardId) {
            if (activeChatContext && activeChatContext.cardId === cardId) {
                if (wsClient.cardsModel.count > 0) {
                    currentCardIndex = Math.min(currentCardIndex, wsClient.cardsModel.count - 1)
                    if (currentCardIndex < 0) currentCardIndex = 0
                    var c = wsClient.cardsModel.get(currentCardIndex)
                    goToCardChat(wsClient.cardToRole ? wsClient.cardToRole(c) : c)
                } else {
                    goToRootChat()
                }
            }
        }
        onCardCycleRequested: function() {
            if (wsClient.cardsModel.count > 0) {
                currentCardIndex = (currentCardIndex + 1) % wsClient.cardsModel.count
                var c = wsClient.cardsModel.get(currentCardIndex)
                goToCardChat(wsClient.cardToRole ? wsClient.cardToRole(c) : c)
            }
        }
    }

    // ── API client for REST (cards, session history) ──
    ApiClient {
        id: apiClient
        onCardFetched: function(card) {
            _pendingLedgerCardId = ""
            _pendingLedgerCard = card
            for (var i = 0; i < wsClient.cardsModel.count; i++) {
                if (wsClient.cardsModel.get(i).id === card.id) {
                    root.currentCardIndex = i
                    break
                }
            }
            root.goToCardChat(card)
        }
        onSessionHistoryFetched: function(sessionKey, messages) {
            if (sessionKey === "ui:chat:general") {
                wsClient.populateChat(messages)
            } else {
                var cardId = sessionKey.replace(/^ui:chat:/, "")
                if (cardId) wsClient.populateChatForCard(cardId, messages)
            }
            if (_pendingLedgerCard) {
                viewIndex = 0
                _pendingLedgerCard = null
            }
        }
    }

    Component.onCompleted: {
        Theme.windowWidth = width
        Theme.windowHeight = height
        apiClient.fetchSessionHistory("ui:chat:general")
        if (wsClient.cardsModel.count > 0) {
            currentCardIndex = 0
            var c = wsClient.cardsModel.get(0)
            goToCardChat(wsClient.cardToRole ? wsClient.cardToRole(c) : c)
        }
    }

    Connections {
        target: wsClient.cardsModel
        function onCountChanged() {
            if (wsClient.cardsModel.count > 0 && !activeChatContext) {
                currentCardIndex = 0
                var c = wsClient.cardsModel.get(0)
                goToCardChat(wsClient.cardToRole ? wsClient.cardToRole(c) : c)
            }
        }
    }

    property var _pendingLedgerCardId: ""
    property var _pendingLedgerCard: null

    // ── Chat context: null = root (main chat), else { cardId, card } = card chat ──
    property var activeChatContext: null

    // ── Which card is shown (0-based); cycles when user skips ──
    property int currentCardIndex: 0

    // ── Session key for current chat (used by WebSocketClient to filter deltas) ──
    property string activeSessionKey: activeChatContext ? ("ui:chat:" + (activeChatContext.cardId || activeChatContext.card?.id || "")) : "ui:chat:general"

    // ── View state: 0=Focus, 1=Ledger, 2=Calendar ──
    property int viewIndex: 0

    onViewIndexChanged: {
        if (viewIndex !== 0) {
            activeChatContext = null
        }
    }

    function goToRootChat() {
        activeChatContext = null
        apiClient.fetchSessionHistory("ui:chat:general")
    }

    function goToCardChat(card) {
        if (!card || !card.id) return
        activeChatContext = { cardId: card.id, card: wsClient.cardToRole ? wsClient.cardToRole(card) : card }
        apiClient.fetchSessionHistory("ui:chat:" + card.id)
    }

    function cycleView() {
        viewIndex = (viewIndex + 1) % 3
    }

    // ── Effective card: current index when cards exist, else null ──
    function getEffectiveCard() {
        if (!wsClient.cardsModel || wsClient.cardsModel.count === 0) return null
        if (currentCardIndex < 0 || currentCardIndex >= wsClient.cardsModel.count) return wsClient.cardsModel.get(0)
        return wsClient.cardsModel.get(currentCardIndex)
    }

    function cycleToNextCard() {
        if (!wsClient.cardsModel || wsClient.cardsModel.count === 0) return
        currentCardIndex = (currentCardIndex + 1) % wsClient.cardsModel.count
        var c = wsClient.cardsModel.get(currentCardIndex)
        goToCardChat(wsClient.cardToRole ? wsClient.cardToRole(c) : c)
    }

    function getEffectiveCardId() {
        var card = getEffectiveCard()
        return card ? card.id : ""
    }

    function onLedgerEntryClicked(cardId) {
        if (!cardId) return
        _pendingLedgerCardId = cardId
        _pendingLedgerCard = null
        apiClient.fetchCard(cardId)
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        // ── Top bar ──
        ContextBand {
            Layout.fillWidth: true
            currentView: root.viewIndex
            onViewToggled: root.cycleView()
        }

        // ── View area ──
        StackLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            currentIndex: root.viewIndex

            FocusView {
                showCardActions: true
                chatModel: wsClient.chatModel
                thinking: wsClient.thinking
                cardsModel: wsClient.cardsModel
                wsClient: wsClient
                currentCardIndex: root.currentCardIndex
                onActionTriggered: function(cardId, action) {
                    wsClient.sendCardAction(cardId, action)
                }
                onSkipRequested: root.cycleToNextCard()
            }

            LedgerView {
                ledgerModel: wsClient.ledgerModel
                onLedgerEntryClicked: root.onLedgerEntryClicked(cardId)
            }

            CalendarView {
                calendarModel: wsClient.calendarModel
            }
        }

        // ── Bottom input ──
        InputBar {
            Layout.fillWidth: true
            onSubmitted: function(message) {
                var cardId = root.viewIndex === 0 ? root.getEffectiveCardId() : ""
                wsClient.sendChatMessage(message, cardId)
            }
        }
    }
}
