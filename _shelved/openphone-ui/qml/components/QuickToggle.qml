import QtQuick
import ".."

Item {
    id: root

    property bool checked: false
    property string iconType: "wifi"   // "wifi", "bluetooth", "orientationLock"

    signal clicked()

    readonly property string _iconSource: {
        if (iconType === "wifi") return "qrc:/qml/assets/icons/wifi.png"
        if (iconType === "bluetooth") return "qrc:/qml/assets/icons/bluetooth.png"
        if (iconType === "orientationLock") return "qrc:/qml/assets/icons/orientation.png"
        return "qrc:/qml/assets/icons/wifi.png"
    }

    Rectangle {
        id: circle
        anchors.centerIn: parent
        width: Math.min(parent.width, parent.height)
        height: width
        radius: width / 2
        color: root.checked ? Theme.accent : "white"

        Behavior on color { ColorAnimation { duration: 150 } }

        Image {
            anchors.centerIn: parent
            width: Math.round(circle.width * 0.5)
            height: width
            source: root._iconSource
            fillMode: Image.PreserveAspectFit
            smooth: true
        }
    }

    MouseArea {
        anchors.fill: parent
        onClicked: root.clicked()
        cursorShape: Qt.PointingHandCursor
    }
}
