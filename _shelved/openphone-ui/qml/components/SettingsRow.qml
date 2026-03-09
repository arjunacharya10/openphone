import QtQuick
import QtQuick.Layouts
import ".."

Item {
    id: root

    property string label: ""
    property string iconType: ""   // "gear", "envelope", "lock"
    property bool showChevron: true

    signal clicked()

    implicitHeight: Math.max(iconBox.height, rowContent.implicitHeight)

    RowLayout {
        id: rowContent
        anchors.fill: parent
        anchors.leftMargin: Theme.spacingMD
        anchors.rightMargin: Theme.spacingMD
        spacing: Theme.spacingMD

        // ── Icon ──
        Item {
            id: iconBox
            width: Math.round(20 * Theme.scale)
            height: width
            Layout.alignment: Qt.AlignVCenter

            Canvas {
                anchors.fill: parent
                property string icon: root.iconType
                onIconChanged: requestPaint()
                Component.onCompleted: requestPaint()

                onPaint: {
                    var ctx = getContext("2d")
                    ctx.reset()
                    ctx.strokeStyle = Theme.foreground.toString()
                    ctx.lineWidth = 1.5
                    ctx.lineCap = "round"
                    ctx.lineJoin = "round"
                    var s = width

                    if (icon === "gear") {
                        var cx = s / 2, cy = s / 2
                        var r1 = s * 0.4, r2 = s * 0.22
                        for (var i = 0; i < 8; i++) {
                            var a = (i / 8) * 2 * Math.PI - Math.PI / 2
                            ctx.beginPath()
                            ctx.moveTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a))
                            ctx.lineTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a))
                            ctx.stroke()
                        }
                        ctx.beginPath()
                        ctx.arc(cx, cy, r2 * 0.5, 0, 2 * Math.PI)
                        ctx.stroke()
                    } else if (icon === "envelope") {
                        ctx.strokeRect(1, 1, s - 2, (s - 2) * 0.7)
                        ctx.beginPath()
                        ctx.moveTo(1, 1)
                        ctx.lineTo(s / 2, s * 0.5)
                        ctx.lineTo(s - 1, 1)
                        ctx.stroke()
                    } else if (icon === "lock") {
                        var bodyHeight = (s - 4) * 0.5
                        var bodyTop = s - bodyHeight - 2
                        ctx.beginPath()
                        ctx.strokeRect(2, bodyTop, s - 4, bodyHeight)
                        var cx = s / 2
                        var radius = (s - 8) * 0.25
                        ctx.beginPath()
                        ctx.arc(cx, bodyTop, radius, Math.PI, 0, false)
                        ctx.stroke()
                    }
                }
            }
        }

        // ── Label ──
        Text {
            Layout.fillWidth: true
            text: root.label
            font.pixelSize: Theme.fontSizeMD
            color: Theme.foreground
            verticalAlignment: Text.AlignVCenter
            elide: Text.ElideRight
        }

        // ── Chevron ──
        Text {
            visible: root.showChevron
            text: "\u203A"
            font.pixelSize: Theme.fontSizeLG
            font.weight: Font.Light
            color: Theme.subtleText
            Layout.alignment: Qt.AlignVCenter
        }
    }

    MouseArea {
        anchors.fill: parent
        onClicked: root.clicked()
        cursorShape: Qt.PointingHandCursor
    }
}
