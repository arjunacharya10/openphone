import QtQuick
import ".."

Item {
    id: root
    implicitHeight: cursor.implicitHeight

    Text {
        id: cursor
        anchors.left: parent.left
        anchors.verticalCenter: parent.verticalCenter
        text: "\u258C"
        font.pixelSize: Theme.fontSizeMD
        font.weight: Font.Light
        color: Theme.muted
        opacity: blinkOn ? 1 : 0.25
        property bool blinkOn: true

        Timer {
            running: root.visible
            repeat: true
            interval: 530
            onTriggered: cursor.blinkOn = !cursor.blinkOn
        }
    }
}
