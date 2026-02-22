import QtQuick
import QtQuick.Layouts
import "../components"
import ".."

Item {
    id: root

    // ── Mock data (replace with model from backend later) ──
    ListModel {
        id: mockEntries

        ListElement {
            subject: "Re: Q4 planning deck — feedback"
            timestamp: "2026-02-21T10:15:00Z"
            kind: "ingest"
        }
        ListElement {
            subject: "Calendar synced — 3 events updated"
            timestamp: "2026-02-21T09:45:00Z"
            kind: "sync"
        }
        ListElement {
            subject: "Newsletter from TechCrunch archived"
            timestamp: "2026-02-21T09:30:00Z"
            kind: "auto_archive"
        }
        ListElement {
            subject: "Declined: optional team social"
            timestamp: "2026-02-21T08:00:00Z"
            kind: "auto_decline"
        }
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
            model: mockEntries
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
                visible: mockEntries.count === 0
            }
        }
    }
}
