import QtQuick
import ".."

Item {
    id: root

    // Position is controlled by parent based on currentHour
    property real currentHour: 0
    visible: currentHour >= 8 && currentHour <= 22

    // Updates every minute
    Timer {
        interval: 60000
        running: true
        repeat: true
        triggeredOnStart: true
        onTriggered: {
            var now = new Date()
            root.currentHour = now.getHours() + now.getMinutes() / 60
        }
    }

    height: Math.round(8 * Theme.scale)

    Row {
        anchors.verticalCenter: parent.verticalCenter
        anchors.left: parent.left
        anchors.leftMargin: -Math.round(4 * Theme.scale)
        anchors.right: parent.right
        spacing: 0

        // ── Dot ──
        Rectangle {
            width: Math.round(8 * Theme.scale)
            height: width
            radius: width / 2
            color: Theme.accent
            anchors.verticalCenter: parent.verticalCenter
        }

        // ── Line ──
        Rectangle {
            height: 1
            width: parent.width - Math.round(8 * Theme.scale)
            color: Theme.accent
            opacity: 0.4
            anchors.verticalCenter: parent.verticalCenter
        }
    }
}
