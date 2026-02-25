import QtQuick
import QtQuick.Layouts
import ".."

Item {
    id: root

    property real value: 0.5   // 0..1, 0 = bottom
    signal valueModified(real value)

    property string iconType: "brightness"   // "brightness", "volume"

    onValueChanged: {
        if (Math.abs(sliderValue - value) > 0.001)
            sliderValue = value
    }

    property real sliderValue: value
    onSliderValueChanged: {
        var v = Math.max(0, Math.min(1, sliderValue))
        if (Math.abs(v - value) > 0.001)
            root.valueModified(v)
    }

    readonly property string _iconSource: {
        if (iconType === "brightness") return "qrc:/qml/assets/icons/brightness.png"
        if (iconType === "volume") return (root.value > 0 ? "qrc:/qml/assets/icons/volume-on.png" : "qrc:/qml/assets/icons/volume-off.png")
        return "qrc:/qml/assets/icons/brightness.png"
    }

    readonly property int trackWidth: Math.round(56 * Theme.scale)

    Item {
        anchors.fill: parent

        // Track (thick capsule, full width so icon fits inside) with icon at bottom
        Rectangle {
            id: track
            anchors.fill: parent
            width: parent.width
            height: parent.height
            radius: width / 2
            color: Theme.border

            Rectangle {
                id: fill
                anchors.bottom: parent.bottom
                anchors.horizontalCenter: parent.horizontalCenter
                width: parent.width
                height: parent.height * root.sliderValue
                radius: parent.radius
                color: Theme.foreground
            }

            // Icon inside track at bottom
            Item {
                anchors.bottom: parent.bottom
                anchors.horizontalCenter: parent.horizontalCenter
                width: Math.round(28 * Theme.scale)
                height: width

                Image {
                    anchors.fill: parent
                    source: root._iconSource
                    fillMode: Image.PreserveAspectFit
                    smooth: true
                }
            }

            MouseArea {
                anchors.fill: parent
                function setValueFromY(y) {
                    var h = track.height
                    var v = 1 - (y / h)
                    root.sliderValue = Math.max(0, Math.min(1, v))
                }
                onPressed: setValueFromY(mouse.y)
                onPositionChanged: if (pressed) setValueFromY(mouse.y)
            }
        }
    }
}
