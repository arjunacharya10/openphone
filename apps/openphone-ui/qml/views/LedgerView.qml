import QtQuick
import QtQuick.Layouts
import "../components"
import ".."

Item {
    id: root

    // ── Live ledger model from WebSocketClient ──
    property var ledgerModel: null

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

    ColumnLayout {
        anchors.fill: parent
        anchors.leftMargin: Theme.spacingLG
        anchors.rightMargin: Theme.spacingLG
        anchors.topMargin: Theme.spacingXS
        spacing: 0

        // ── Header ──
        Text {
            Layout.topMargin: Theme.spacingXS
            Layout.bottomMargin: Theme.spacingLG
            text: "Actions taken on your behalf."
            font.pixelSize: Math.round(12 * Theme.scale)
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
                            font.pixelSize: Math.round(10 * Theme.scale)
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
                font.pixelSize: Math.round(12 * Theme.scale)
                font.family: "monospace"
                color: Theme.dimText
                visible: !root.ledgerModel || root.ledgerModel.count === 0
            }
        }
    }
}
