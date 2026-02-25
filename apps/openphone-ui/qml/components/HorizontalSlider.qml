import QtQuick
import QtQuick.Layouts
import ".."

Item {
    id: root

    property real value: 0.5   // 0..1
    signal valueModified(real value)
    property string iconType: "brightness"   // "brightness", "volume"

    // ── iOS-style sizing knobs ──
    property int trackHeight: Math.round(24 * Theme.scale)     // <- slider thickness
    property int sliderHeight: Math.round(52 * Theme.scale)    // overall row height
    property bool showThumb: false
    property int thumbSize: Math.round(22 * Theme.scale)

    // ── Colors tuned to your Theme ──
    // soft “glass” track instead of hard border
    readonly property color trackColor: Qt.rgba(1, 1, 1, 0.10)
    readonly property color fillColor: Theme.foreground
    readonly property color thumbColor: Theme.foreground
    readonly property color thumbRing: Qt.rgba(0, 0, 0, 0.22)

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
        if (iconType === "brightness") return "qrc:/qml/assets/icons/brightness-white.png"
        if (iconType === "volume")
            return (root.value > 0 ? "qrc:/qml/assets/icons/volume-on-white.png"
                                   : "qrc:/qml/assets/icons/volume-off-white.png")
        return "qrc:/qml/assets/icons/brightness-white.png"
    }

    implicitHeight: root.sliderHeight

    RowLayout {
        anchors.fill: parent
        spacing: Theme.spacingMD

        Item {
            Layout.preferredWidth: Math.round(28 * Theme.scale)
            Layout.preferredHeight: Layout.preferredWidth
            Layout.alignment: Qt.AlignVCenter

            Image {
                anchors.fill: parent
                source: root._iconSource
                fillMode: Image.PreserveAspectFit
                smooth: true
            }
        }

        Rectangle {
            id: track
            Layout.fillWidth: true
            Layout.preferredHeight: root.trackHeight      // <- THICKNESS HERE
            Layout.alignment: Qt.AlignVCenter
            radius: height / 2
            color: root.trackColor

            // filled portion
            Rectangle {
                id: fill
                anchors.left: parent.left
                anchors.top: parent.top
                anchors.bottom: parent.bottom
                width: parent.width * root.sliderValue
                radius: parent.radius
                color: root.fillColor
            }

            // optional iOS-like thumb
            Rectangle {
                id: thumb
                visible: root.showThumb
                width: root.thumbSize
                height: root.thumbSize
                radius: width / 2
                color: root.thumbColor

                anchors.verticalCenter: parent.verticalCenter
                x: Math.max(0, Math.min(parent.width - width,
                                        (parent.width * root.sliderValue) - width / 2))

                // subtle ring/shadow like iOS
                border.width: 1
                border.color: root.thumbRing
            }

            MouseArea {
                anchors.fill: parent

                function setValueFromX(x) {
                    var w = parent.width
                    root.sliderValue = Math.max(0, Math.min(1, x / w))
                }

                onPressed: setValueFromX(mouse.x)
                onPositionChanged: if (pressed) setValueFromX(mouse.x)
            }
        }
    }
}