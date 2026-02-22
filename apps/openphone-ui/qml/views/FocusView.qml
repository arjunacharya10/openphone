import QtQuick
import QtQuick.Layouts
import "../components"
import ".."

Item {
    id: root

    // ── Live card from WebSocketClient (null = no active card) ──
    property var card: null
    // ── Chat messages from WebSocketClient ──
    property var chatModel: null
    // ── True when waiting for first LLM token ──
    property bool thinking: false

    signal actionTriggered(string cardId, string action)

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        // ── Chat area (fills space) ──
        ChatArea {
            Layout.fillWidth: true
            Layout.fillHeight: true
            chatModel: root.chatModel
            thinking: root.thinking
        }

        // ── Empty state when no card ──
        Text {
            Layout.leftMargin: Theme.spacingLG
            Layout.rightMargin: Theme.spacingLG
            Layout.bottomMargin: Theme.spacingSM
            text: "All handled."
            font.pixelSize: Theme.fontSizeSM
            font.italic: true
            font.weight: Font.Light
            color: Theme.dimText
            visible: root.card === null
        }

        // ── Card content when card present ──
        Item {
            Layout.fillWidth: true
            Layout.leftMargin: Theme.spacingLG
            Layout.rightMargin: Theme.spacingLG
            Layout.bottomMargin: Theme.spacingMD
            visible: root.card !== null
            implicitHeight: cardColumn.implicitHeight

            ColumnLayout {
                id: cardColumn
                anchors.left: parent.left
                anchors.right: parent.right
                spacing: Theme.spacingMD

                Text {
                    Layout.fillWidth: true
                    text: root.card ? root.card.title : ""
                    font.pixelSize: Theme.fontSizeXL
                    font.weight: Font.Light
                    lineHeight: 1.2
                    lineHeightMode: Text.ProportionalHeight
                    color: Theme.foreground
                    wrapMode: Text.WordWrap
                }

                Text {
                    Layout.fillWidth: true
                    Layout.maximumWidth: parent.width * 0.95
                    text: root.card ? root.card.context : ""
                    font.pixelSize: Theme.fontSizeLG
                    font.weight: Font.Light
                    lineHeight: 1.6
                    lineHeightMode: Text.ProportionalHeight
                    color: Theme.muted
                    wrapMode: Text.WordWrap
                    visible: text.length > 0
                }

                Row {
                    spacing: Theme.spacingMD
                    Layout.topMargin: Theme.spacingXS

                    Repeater {
                        model: root.card ? JSON.parse(root.card.actionsJson) : []

                        ActionButton {
                            label: modelData.label
                            variant: modelData.action === "dismiss"
                                     ? "dismiss"
                                     : (index === 0 ? "primary" : "secondary")
                            onClicked: root.actionTriggered(root.card.id, modelData.action)
                        }
                    }
                }
            }
        }
    }
}
