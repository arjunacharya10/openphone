import QtQuick
import QtQuick.Layouts
import "../components"
import ".."

Item {
    id: root

    property bool showCardActions: true
    property var chatModel: null
    property bool thinking: false
    property var cardsModel: null
    property var wsClient: null
    property int currentCardIndex: 0

    signal actionTriggered(string cardId, string action)
    signal skipRequested()

    readonly property bool hasCards: cardsModel && cardsModel.count > 0
    property int _safeIndex: cardsModel && cardsModel.count > 0 ? Math.max(0, Math.min(currentCardIndex, cardsModel.count - 1)) : 0
    property var topCard: cardsModel && cardsModel.count > 0 ? cardsModel.get(_safeIndex) : null
    property var topCardActions: topCard ? (function() { try { return JSON.parse(topCard.actionsJson || "[]") } catch (e) { return [] } })() : []

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        // ── Main chat view: no cards ──
        Item {
            Layout.fillWidth: true
            Layout.fillHeight: true
            visible: !root.hasCards

            ColumnLayout {
                anchors.fill: parent
                spacing: 0

                ChatArea {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    chatModel: root.chatModel
                    thinking: root.thinking
                    showEmptyPlaceholder: true
                }

                Text {
                    Layout.leftMargin: Theme.spacingLG
                    Layout.rightMargin: Theme.spacingLG
                    Layout.bottomMargin: Theme.spacingSM
                    text: "All handled."
                    font.pixelSize: Theme.fontSizeSM
                    font.italic: true
                    font.weight: Font.Light
                    color: Theme.dimText
                }
            }
        }

        // ── Card chat view: active cards only ──
        Item {
            Layout.fillWidth: true
            Layout.fillHeight: true
            visible: root.hasCards

            ColumnLayout {
                anchors.fill: parent
                spacing: 0

                // Index indicator: "2/5" "5 cards awaiting" + Skip
                RowLayout {
                    Layout.fillWidth: true
                    Layout.topMargin: Theme.spacingSM
                    Layout.bottomMargin: Theme.spacingXS
                    Layout.leftMargin: Theme.spacingLG
                    Layout.rightMargin: Theme.spacingLG

                    Text {
                        text: (root.currentCardIndex + 1) + "/" + (root.cardsModel ? root.cardsModel.count : 0)
                        font.pixelSize: Theme.fontSizeSM
                        font.weight: Font.Light
                        color: Theme.dimText
                    }

                    Text {
                        text: (root.cardsModel ? root.cardsModel.count : 0) + " cards awaiting"
                        font.pixelSize: Theme.fontSizeSM
                        font.weight: Font.Light
                        color: Theme.dimText
                        Layout.leftMargin: Theme.spacingMD
                    }

                    Item { Layout.fillWidth: true }

                    ActionButton {
                        label: "Skip"
                        variant: "dismiss"
                        onClicked: root.skipRequested()
                    }
                }

                // Single card: header + chat (always top of stack)
                Item {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    visible: root.topCard

                    ColumnLayout {
                        anchors.fill: parent
                        spacing: 0

                        // Card header
                        Item {
                            Layout.fillWidth: true
                            Layout.preferredHeight: cardHeaderContent.implicitHeight + Theme.spacingLG * 2

                            ColumnLayout {
                                id: cardHeaderContent
                                anchors.fill: parent
                                anchors.margins: Theme.spacingLG
                                spacing: Theme.spacingMD

                                Text {
                                    Layout.fillWidth: true
                                    Layout.maximumHeight: 48
                                    text: root.topCard ? (root.topCard.title || "Card") : ""
                                    font.pixelSize: Theme.fontSizeXL
                                    font.weight: Font.Light
                                    lineHeight: 1.2
                                    lineHeightMode: Text.ProportionalHeight
                                    color: Theme.foreground
                                    wrapMode: Text.WordWrap
                                    elide: Text.ElideRight
                                    maximumLineCount: 2
                                }

                                Text {
                                    Layout.fillWidth: true
                                    Layout.maximumHeight: 72
                                    Layout.maximumWidth: parent.width * 0.95
                                    text: root.topCard ? (root.topCard.context || "") : ""
                                    font.pixelSize: Theme.fontSizeLG
                                    font.weight: Font.Light
                                    lineHeight: 1.6
                                    lineHeightMode: Text.ProportionalHeight
                                    color: Theme.muted
                                    wrapMode: Text.WordWrap
                                    elide: Text.ElideRight
                                    maximumLineCount: 3
                                    visible: root.topCard && (root.topCard.context || "").length > 0
                                }

                                Row {
                                    spacing: Theme.spacingMD
                                    Layout.topMargin: Theme.spacingSM
                                    visible: root.showCardActions && root.topCard && root.topCardActions.length > 0

                                    Repeater {
                                        model: root.topCardActions

                                        ActionButton {
                                            label: modelData.label || ""
                                            variant: modelData.action === "dismiss"
                                                     ? "dismiss"
                                                     : (index === 0 ? "primary" : "secondary")
                                            onClicked: root.actionTriggered(root.topCard.id, modelData.action)
                                        }
                                    }
                                }
                            }
                        }

                        // This card's chat
                        ChatArea {
                            Layout.fillWidth: true
                            Layout.fillHeight: true
                            chatModel: root.topCard && root.wsClient ? root.wsClient.getChatModelForCard(root.topCard.id) : null
                            thinking: root.thinking
                            showEmptyPlaceholder: false
                        }
                    }
                }
            }
        }
    }
}
