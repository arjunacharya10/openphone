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
    signal carouselIndexChanged(int index)

    readonly property bool hasCards: cardsModel && cardsModel.count > 0

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

        // ── Card chat view: full-page carousel (card + chat per page), swipe = next card+chat ──
        Item {
            Layout.fillWidth: true
            Layout.fillHeight: true
            visible: root.hasCards

            ColumnLayout {
                anchors.fill: parent
                spacing: 0

                // Index indicator: "1/4" "2 cards pending"
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
                }

                // Full-page carousel: each page = card header + that card's chat
                ListView {
                    id: cardCarousel
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    clip: true
                    orientation: ListView.Vertical
                    snapMode: ListView.SnapOneItem
                    highlightRangeMode: ListView.StrictlyEnforceRange
                    preferredHighlightBegin: 0
                    preferredHighlightEnd: height
                    model: root.cardsModel

                    Component.onCompleted: {
                        currentIndex = root.currentCardIndex
                    }

                    onCurrentIndexChanged: {
                        if (currentIndex >= 0 && root.cardsModel && currentIndex < root.cardsModel.count) {
                            root.carouselIndexChanged(currentIndex)
                        }
                    }

                    delegate: Item {
                        id: cardDelegateItem
                        width: cardCarousel.width
                        height: cardCarousel.height

                        property string cardId: model.id || ""
                        property var cardActions: (function() {
                            try { return JSON.parse(model.actionsJson || "[]") } catch (e) { return [] }
                        })()
                        property bool isActiveCard: cardCarousel.currentIndex === index

                        ColumnLayout {
                            anchors.fill: parent
                            spacing: 0

                            // Card header (compact)
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
                                        text: model.title || "Card"
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
                                        text: model.context || ""
                                        font.pixelSize: Theme.fontSizeLG
                                        font.weight: Font.Light
                                        lineHeight: 1.6
                                        lineHeightMode: Text.ProportionalHeight
                                        color: Theme.muted
                                        wrapMode: Text.WordWrap
                                        elide: Text.ElideRight
                                        maximumLineCount: 3
                                        visible: (model.context || "").length > 0
                                    }

                                    Row {
                                        spacing: Theme.spacingMD
                                        Layout.topMargin: Theme.spacingSM
                                        visible: root.showCardActions && cardDelegateItem.cardActions.length > 0

                                        Repeater {
                                            model: cardDelegateItem.cardActions

                                            ActionButton {
                                                label: modelData.label || ""
                                                variant: modelData.action === "dismiss"
                                                         ? "dismiss"
                                                         : (index === 0 ? "primary" : "secondary")
                                                onClicked: root.actionTriggered(cardDelegateItem.cardId, modelData.action)
                                            }
                                        }
                                    }
                                }
                            }

                            // This card's chat
                            ChatArea {
                                Layout.fillWidth: true
                                Layout.fillHeight: true
                                chatModel: root.wsClient ? root.wsClient.getChatModelForCard(cardDelegateItem.cardId) : null
                                thinking: root.thinking && cardDelegateItem.isActiveCard
                                showEmptyPlaceholder: false
                            }
                        }
                    }
                }

                Connections {
                    target: root
                    function onCurrentCardIndexChanged() {
                        if (cardCarousel.currentIndex !== root.currentCardIndex) {
                            cardCarousel.currentIndex = root.currentCardIndex
                        }
                    }
                }
            }
        }
    }
}
