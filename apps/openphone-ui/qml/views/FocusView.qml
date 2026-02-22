import QtQuick
import QtQuick.Layouts
import "../components"
import ".."

Item {
    id: root

    // ── Live card from WebSocketClient (null = no active card) ──
    property var card: null

    signal actionTriggered(string cardId, string action)

    // ── Empty state ──
    Text {
        anchors.centerIn: parent
        text: "All handled."
        font.pixelSize: Theme.fontSizeXL - 2
        font.italic: true
        font.weight: Font.Light
        color: Theme.dimText
        visible: root.card === null
    }

    // ── Card content ──
    Item {
        anchors.fill: parent
        anchors.leftMargin: Theme.spacingLG
        anchors.rightMargin: Theme.spacingLG
        visible: root.card !== null

        ColumnLayout {
            anchors.verticalCenter: parent.verticalCenter
            anchors.left: parent.left
            anchors.right: parent.right
            spacing: Theme.spacingMD

            // ── Title ──
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

            // ── Context ──
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

            // ── Action buttons ──
            Row {
                spacing: Theme.spacingMD
                Layout.topMargin: Theme.spacingXS
                visible: root.card !== null

                Repeater {
                    model: root.card ? JSON.parse(root.card.actionsJson) : []

                    ActionButton {
                        label: modelData.label
                        // Derive variant from action name and position
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
