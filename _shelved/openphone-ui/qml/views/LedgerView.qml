import QtQuick
import QtQuick.Layouts
import "../components"
import ".."

Item {
    id: root

    property var ledgerModel: null
    property var wsClient: null
    property bool thinking: false
    /** When set, show this card's chat (from ledger); back returns to list */
    property var selectedCard: null

    signal ledgerEntryClicked(string cardId)
    signal backRequested()

    /** Find ledger entry for a card; return its action string */
    function getActionForCard(cardId) {
        if (!root.ledgerModel || !cardId) return ""
        for (var i = 0; i < root.ledgerModel.count; i++) {
            var e = root.ledgerModel.get(i)
            if ((e.refId || "") === cardId) return e.action || ""
        }
        return ""
    }

    readonly property var actionLabels: ({
        "archive": "Archived",
        "mark_read": "Marked read",
        "reply": "Replied",
        "ignore": "Ignored",
        "dismiss": "Dismissed",
        "prep_notes": "Prep notes",
        "skip": "Skipped"
    })

    function formatActionLabel(actionStr) {
        if (!actionStr) return ""
        return root.actionLabels[actionStr] || (actionStr.charAt(0).toUpperCase() + actionStr.slice(1).replace(/_/g, " "))
    }

    // ── Relative timestamp formatter ──
    function formatRelativeTime(ts) {
        var date = new Date(ts)
        var now = new Date()
        var diffMs = now.getTime() - date.getTime()
        var diffMins = Math.round(diffMs / 60000)

        if (diffMins < 1) return "Just now"
        if (diffMins < 60) return diffMins + "m ago"
        if (diffMins < 1440) return Math.round(diffMins / 60) + "h ago"
        return Qt.formatDate(date, "MMM d")
    }

    StackLayout {
        anchors.fill: parent
        currentIndex: root.selectedCard ? 1 : 0

        // ── List mode ──
        Item {
            Layout.fillWidth: true
            Layout.fillHeight: true

        ColumnLayout {
            anchors.fill: parent
            anchors.leftMargin: Theme.spacingLG
            anchors.rightMargin: Theme.spacingLG
            anchors.topMargin: Theme.spacingXS
            spacing: 0

            Text {
                Layout.topMargin: Theme.spacingXS
                Layout.bottomMargin: Theme.spacingLG
                text: "Actions taken on your behalf."
                font.pixelSize: Math.round(12 * Theme.scaleFont)
                font.italic: true
                font.weight: Font.Light
                color: Theme.dimText
            }

        // ── Entry list ──
        ListView {
            Layout.fillWidth: true
            Layout.fillHeight: true
            model: root.ledgerModel
            clip: true
            spacing: Theme.spacingLG

            delegate: Item {
                width: ListView.view.width
                height: entryColumn.implicitHeight

                property bool isCardLinked: model.refType === "card" && (model.refId || "").length > 0

                MouseArea {
                    anchors.fill: parent
                    enabled: parent.isCardLinked
                    cursorShape: parent.isCardLinked ? Qt.PointingHandCursor : Qt.ArrowCursor
                    onClicked: {
                        if (parent.isCardLinked && model.refId) {
                            root.ledgerEntryClicked(model.refId)
                        }
                    }
                }

                ColumnLayout {
                    id: entryColumn
                    anchors.left: parent.left
                    anchors.right: parent.right
                    spacing: Theme.spacingXS

                    // ── Subject line ──
                    Text {
                        Layout.fillWidth: true
                        text: model.subject
                        font.pixelSize: Theme.fontSizeMD
                        color: "#D4D4D4"
                        elide: Text.ElideRight
                        maximumLineCount: 2
                        wrapMode: Text.WordWrap
                    }

                    // ── Timestamp + badge ──
                    Row {
                        spacing: Theme.spacingSM

                        Text {
                            text: root.formatRelativeTime(model.timestamp)
                            font.pixelSize: Math.round(10 * Theme.scaleFont)
                            font.family: "monospace"
                            color: Theme.subtleText
                            anchors.verticalCenter: parent.verticalCenter
                        }

                        KindBadge {
                            kind: model.kind
                            anchors.verticalCenter: parent.verticalCenter
                        }
                    }
                }
            }

            // ── Empty state ──
            Text {
                anchors.centerIn: parent
                text: "No records yet."
                font.pixelSize: Math.round(12 * Theme.scaleFont)
                font.family: "monospace"
                color: Theme.dimText
                visible: !root.ledgerModel || root.ledgerModel.count === 0
            }
        }
        }
        }

        // ── Card detail mode: past action + chat ──
        ColumnLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            visible: root.selectedCard

            RowLayout {
                Layout.fillWidth: true
                Layout.leftMargin: Theme.spacingLG
                Layout.rightMargin: Theme.spacingLG
                Layout.topMargin: Theme.spacingSM
                Layout.bottomMargin: Theme.spacingXS

                ActionButton {
                    label: "← Back"
                    variant: "dismiss"
                    onClicked: root.backRequested()
                }
                Item { Layout.fillWidth: true }
            }

            Item {
                Layout.fillWidth: true
                Layout.fillHeight: true

                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: Theme.spacingLG
                    spacing: Theme.spacingMD

                    Text {
                        Layout.fillWidth: true
                        text: root.selectedCard ? (root.selectedCard.title || "Card") : ""
                        font.pixelSize: Theme.fontSizeXL
                        font.weight: Font.Light
                        color: Theme.foreground
                        wrapMode: Text.WordWrap
                        maximumLineCount: 2
                    }
                    Text {
                        Layout.fillWidth: true
                        Layout.maximumHeight: 60
                        text: root.selectedCard ? (root.selectedCard.context || "") : ""
                        font.pixelSize: Theme.fontSizeLG
                        font.weight: Font.Light
                        color: Theme.muted
                        wrapMode: Text.WordWrap
                        elide: Text.ElideRight
                        maximumLineCount: 3
                        visible: root.selectedCard && (root.selectedCard.context || "").length > 0
                    }
                    Row {
                        Layout.fillWidth: true
                        spacing: Theme.spacingSM
                        visible: root.selectedCard && root.formatActionLabel(root.getActionForCard(root.selectedCard.id)).length > 0
                        Text {
                            text: "Action taken:"
                            font.pixelSize: Theme.fontSizeSM
                            color: Theme.dimText
                            anchors.verticalCenter: parent.verticalCenter
                        }
                        Text {
                            text: root.selectedCard ? root.formatActionLabel(root.getActionForCard(root.selectedCard.id)) : ""
                            font.pixelSize: Theme.fontSizeSM
                            font.weight: Font.Medium
                            color: Theme.foreground
                            anchors.verticalCenter: parent.verticalCenter
                        }
                    }
                    ChatArea {
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        chatModel: root.selectedCard && root.wsClient ? root.wsClient.getChatModelForCard(root.selectedCard.id) : null
                        thinking: root.thinking
                        showEmptyPlaceholder: false
                    }
                }
            }
        }
    }
}
