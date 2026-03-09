import QtQuick
import ".."

Item {
    id: root

    property string label: ""
    property string variant: "primary"  // "primary", "dismiss", "secondary"

    signal clicked()

    implicitWidth: labelText.implicitWidth
    implicitHeight: labelText.implicitHeight + borderLine.height + Theme.spacingXS

    property color textColor: {
        if (variant === "dismiss") return Theme.dimText
        if (variant === "secondary") return mouseArea.containsMouse ? "#999999" : "#666666"
        return Theme.foreground  // primary
    }

    property color borderColor: {
        if (variant === "dismiss") return Theme.border
        if (variant === "secondary") return mouseArea.containsMouse ? "#666666" : "transparent"
        return mouseArea.containsMouse ? Theme.foreground : Qt.rgba(Theme.foreground.r, Theme.foreground.g, Theme.foreground.b, 0.4)
    }

    Column {
        anchors.fill: parent
        spacing: Theme.spacingXS

        Text {
            id: labelText
            text: root.label
            font.pixelSize: Theme.fontSizeMD
            color: root.textColor

            Behavior on color { ColorAnimation { duration: 200 } }
        }

        Rectangle {
            id: borderLine
            width: labelText.implicitWidth
            height: 1
            color: root.borderColor

            Behavior on color { ColorAnimation { duration: 200 } }
        }
    }

    MouseArea {
        id: mouseArea
        anchors.fill: parent
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onClicked: root.clicked()
    }
}
