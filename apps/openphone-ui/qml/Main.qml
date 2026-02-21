import QtQuick
import QtQuick.Window

Window {
    id: root
    width: 480
    height: 960
    visible: true
    visibility: Window.FullScreen
    title: "OpenPhone"
    color: "#1a1a2e"

    Text {
        anchors.centerIn: parent
        text: "OpenPhone"
        font.pixelSize: 36
        font.weight: Font.Light
        color: "#e0e0e0"
    }
}
