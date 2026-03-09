import QtQuick
import QtQuick.Layouts
import QtQuick.Window
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

    // ── Lock state: true = show lock screen overlay ──
    property bool isLocked: true

    // ── Quick settings panel (pull-down from top, only when not locked) ──
    property bool quickSettingsOpen: false
    property real quickSettingsDragOffset: 0
    readonly property real quickSettingsPanelHeight: Math.round(320 * Theme.scale)
    property real quickSettingsPanelY: -320

    // ── Bind window dimensions and screen density to Theme for responsive scaling ──
    onWidthChanged: {
        Theme.windowWidth = width
        Theme.screenPixelDensity = Screen.pixelDensity
    }
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
            root.ledgerSelectedCard = wsClient.cardToRole ? wsClient.cardToRole(card) : card
            viewIndex = 1
            apiClient.fetchSessionHistory("ui:chat:" + card.id)
        }
        onSessionHistoryFetched: function(sessionKey, messages) {
            if (sessionKey === "ui:chat:general") {
                wsClient.populateChat(messages)
            } else {
                var cardId = sessionKey.replace(/^ui:chat:/, "")
                if (cardId) wsClient.populateChatForCard(cardId, messages)
            }
        }
    }

    Component.onCompleted: {
        Theme.windowWidth = width
        Theme.windowHeight = height
        quickSettingsPanelY = -quickSettingsPanelHeight
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

    // ── Chat context: null = root (main chat), else { cardId, card } = card chat ──
    property var activeChatContext: null

    // ── Which card is shown (0-based); cycles when user skips ──
    property int currentCardIndex: 0

    // ── Session key for current chat (used by WebSocketClient to filter deltas) ──
    property string activeSessionKey: {
        if (ledgerSelectedCard && ledgerSelectedCard.id) return "ui:chat:" + ledgerSelectedCard.id
        if (activeChatContext && activeChatContext.cardId) return "ui:chat:" + activeChatContext.cardId
        return "ui:chat:general"
    }

    // ── Card opened from Ledger (separate view, back returns to ledger list) ──
    property var ledgerSelectedCard: null

    // ── View state: 0=Focus, 1=Ledger, 2=Calendar, 3=Settings ──
    property int viewIndex: 0

    onViewIndexChanged: {
        if (viewIndex !== 0) activeChatContext = null
        if (viewIndex !== 1) ledgerSelectedCard = null
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
        viewIndex = (viewIndex + 1) % 4
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
        if (viewIndex === 1 && ledgerSelectedCard && ledgerSelectedCard.id) return ledgerSelectedCard.id
        if (activeChatContext && activeChatContext.cardId) return activeChatContext.cardId
        var card = getEffectiveCard()
        return card ? card.id : ""
    }

    function onLedgerEntryClicked(cardId) {
        if (!cardId) return
        apiClient.fetchCard(cardId)
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0
        visible: !root.isLocked
        enabled: !root.isLocked

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
                wsClient: wsClient
                thinking: wsClient.thinking
                selectedCard: root.ledgerSelectedCard
                onLedgerEntryClicked: root.onLedgerEntryClicked(cardId)
                onBackRequested: {
                    root.ledgerSelectedCard = null
                }
            }

            CalendarView {
                calendarModel: wsClient.calendarModel
            }

            SettingsView {
                onLockRequested: root.isLocked = true
            }
        }

        // ── Bottom input ──
        InputBar {
            visible: !root.isLocked && (root.viewIndex === 0 || root.viewIndex === 2)
            Layout.fillWidth: true
            onSubmitted: function(message) {
                var cardId = (root.viewIndex === 0 || root.viewIndex === 1) ? root.getEffectiveCardId() : ""
                wsClient.sendChatMessage(message, cardId)
            }
        }
    }

    // ── Lock screen overlay ──
    LockScreen {
        anchors.fill: parent
        visible: root.isLocked
        onUnlocked: root.isLocked = false
    }

    // ── Quick settings overlay: pull down from top to open; panel is off-screen until dragged. Tap outside to close. ──
    Item {
        id: quickSettingsOverlay
        anchors.fill: parent
        z: 100
        clip: false

        // Dimmed backdrop below panel: only when panel is open; tap to close
        Rectangle {
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.top: parent.top
            anchors.topMargin: root.quickSettingsPanelHeight
            anchors.bottom: parent.bottom
            color: Qt.rgba(0, 0, 0, 0.35)
            visible: root.quickSettingsOpen
            opacity: root.quickSettingsOpen ? 1 : 0
            Behavior on opacity { NumberAnimation { duration: 180 } }

            MouseArea {
                anchors.fill: parent
                onClicked: {
                    root.quickSettingsOpen = false
                    quickSettingsPanelAnim.from = root.quickSettingsPanelY
                    quickSettingsPanelAnim.to = -root.quickSettingsPanelHeight
                    quickSettingsPanelAnim.start()
                }
            }
        }

        // Drag strip at top: invisible, only for pull-down gesture (panel stays off-screen until dragged)
        Item {
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.top: parent.top
            height: Math.round(36 * Theme.scale)

            property real pressY: 0

            MouseArea {
                anchors.fill: parent
                onPressed: parent.pressY = mouse.y
                onPositionChanged: {
                    var dy = mouse.y - parent.pressY
                    if (dy > 0) {
                        root.quickSettingsDragOffset = Math.min(dy, root.quickSettingsPanelHeight)
                        root.quickSettingsPanelY = -root.quickSettingsPanelHeight + root.quickSettingsDragOffset
                    }
                }
                onReleased: {
                    var threshold = root.quickSettingsPanelHeight * 0.4
                    root.quickSettingsOpen = root.quickSettingsDragOffset > threshold
                    root.quickSettingsDragOffset = 0
                    quickSettingsPanelAnim.from = root.quickSettingsPanelY
                    quickSettingsPanelAnim.to = root.quickSettingsOpen ? 0 : -root.quickSettingsPanelHeight
                    quickSettingsPanelAnim.start()
                }
            }
        }

        // Panel: positioned off-screen (y negative) when closed; slides down when opened
        QuickSettingsPanel {
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.top: parent.top
            y: root.quickSettingsPanelY
            height: root.quickSettingsPanelHeight
            visible: root.quickSettingsPanelY > -root.quickSettingsPanelHeight

            onCloseRequested: {
                root.quickSettingsOpen = false
                quickSettingsPanelAnim.from = root.quickSettingsPanelY
                quickSettingsPanelAnim.to = -root.quickSettingsPanelHeight
                quickSettingsPanelAnim.start()
            }
        }
    }

    NumberAnimation {
        id: quickSettingsPanelAnim
        target: root
        property: "quickSettingsPanelY"
        duration: 220
        easing.type: Easing.InOutQuad
    }
}
