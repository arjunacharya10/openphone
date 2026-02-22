import QtQuick
import ".."

Rectangle {
    id: root

    property string kind: ""

    readonly property var kindLabels: ({
        "sync": "Synced",
        "ingest": "Ingested",
        "auto_archive": "Archived",
        "auto_decline": "Declined",
        "user_action": "User",
        "reminder": "Reminded"
    })

    color: Theme.kindBadgeBg
    radius: Theme.radiusMD
    implicitWidth: badgeText.implicitWidth + Theme.spacingSM * 2
    implicitHeight: badgeText.implicitHeight + 2

    Text {
        id: badgeText
        anchors.centerIn: parent
        text: (root.kindLabels[root.kind] || root.kind).toUpperCase()
        font.pixelSize: Theme.fontSizeXS - 1
        font.letterSpacing: 0.8
        font.capitalization: Font.AllUppercase
        color: Theme.kindBadgeText
    }
}
