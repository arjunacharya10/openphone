import QtQuick
import QtQuick.Layouts
import "../components"
import ".."

Item {
    id: root

    signal actionTriggered(int cardId, string action)

    // ── Mock card data (replace with model from backend later) ──
    property var mockCard: ({
        id: 1,
        title: "Standup with eng in 15 min — prep notes?",
        context: "Daily sync at 10:30 AM\nAgenda: sprint progress, blockers, weekend deploy plan",
        actions: [
            { label: "Prep notes", action: "prep_notes", variant: "primary" },
            { label: "Skip", action: "skip", variant: "secondary" },
            { label: "Okay", action: "dismiss", variant: "dismiss" }
        ]
    })

    property bool hasCard: true  // Toggle to test empty state

    // ── Empty state ──
    Text {
        anchors.centerIn: parent
        text: "All handled."
        font.pixelSize: Theme.fontSizeXL - 2
        font.italic: true
        font.weight: Font.Light
        color: Theme.dimText
        visible: !root.hasCard
    }

    // ── Card content ──
    Item {
        anchors.fill: parent
        anchors.leftMargin: Theme.spacingLG
        anchors.rightMargin: Theme.spacingLG
        visible: root.hasCard

        ColumnLayout {
            anchors.verticalCenter: parent.verticalCenter
            anchors.left: parent.left
            anchors.right: parent.right
            spacing: Theme.spacingMD

            // ── Title ──
            Text {
                Layout.fillWidth: true
                text: root.mockCard.title
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
                text: root.mockCard.context
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

                Repeater {
                    model: root.mockCard.actions

                    ActionButton {
                        label: modelData.label
                        variant: modelData.variant
                        onClicked: root.actionTriggered(root.mockCard.id, modelData.action)
                    }
                }
            }
        }
    }
}
