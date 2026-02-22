import QtQuick
import QtQuick.Layouts
import ".."

Item {
    id: root

    signal viewToggled()

    property int currentView: 0

    implicitHeight: Theme.spacingXL + Theme.spacingMD

    // ── Live clock ──
    property string timeString: ""
    property string dateString: ""

    Timer {
        interval: 1000
        running: true
        repeat: true
        triggeredOnStart: true
        onTriggered: {
            var now = new Date()
            root.timeString = Qt.formatTime(now, "h:mm")
            root.dateString = Qt.formatDate(now, "ddd, MMM d")
        }
    }

    RowLayout {
        anchors.fill: parent
        anchors.leftMargin: Theme.spacingLG
        anchors.rightMargin: Theme.spacingLG
        anchors.topMargin: Theme.spacingMD

        // ── Time + Date ──
        Row {
            spacing: Theme.spacingSM
            opacity: 0.3

            Text {
                text: root.timeString
                font.pixelSize: Theme.fontSizeSM
                font.weight: Font.Medium
                font.letterSpacing: 2
                color: Theme.foreground
                textFormat: Text.PlainText
            }

            Text {
                text: root.dateString.toUpperCase()
                font.pixelSize: Theme.fontSizeSM
                font.weight: Font.Light
                font.letterSpacing: 2
                color: Theme.foreground
                textFormat: Text.PlainText
            }
        }

        Item { Layout.fillWidth: true }

        // ── View toggle button ──
        Rectangle {
            width: Theme.spacingLG + Theme.spacingSM
            height: width
            color: "transparent"
            opacity: toggleMouse.containsMouse ? 1.0 : 0.3

            Behavior on opacity { NumberAnimation { duration: 200 } }

            // View-specific icons drawn with Canvas
            Canvas {
                anchors.centerIn: parent
                width: Math.round(14 * Theme.scale)
                height: width

                property int viewMode: root.currentView
                onViewModeChanged: requestPaint()
                onWidthChanged: requestPaint()

                onPaint: {
                    var ctx = getContext("2d")
                    ctx.reset()
                    ctx.strokeStyle = Theme.foreground.toString()
                    ctx.lineWidth = 1.5
                    ctx.lineCap = "round"
                    ctx.lineJoin = "round"
                    var s = width

                    if (viewMode === 0) {
                        // Focus: concentric circles
                        ctx.beginPath()
                        ctx.arc(s/2, s/2, s/2 - 1, 0, 2 * Math.PI)
                        ctx.stroke()
                        ctx.beginPath()
                        ctx.arc(s/2, s/2, s/6, 0, 2 * Math.PI)
                        ctx.stroke()
                    } else if (viewMode === 1) {
                        // Ledger: book icon
                        ctx.beginPath()
                        ctx.moveTo(2, s - 2)
                        ctx.lineTo(s - 2, s - 2)
                        ctx.stroke()
                        ctx.beginPath()
                        ctx.rect(2, 1, s - 4, s - 4)
                        ctx.stroke()
                    } else {
                        // Calendar: grid icon
                        ctx.beginPath()
                        ctx.rect(2, 3, s - 4, s - 4)
                        ctx.stroke()
                        ctx.beginPath()
                        ctx.moveTo(s * 0.35, 1)
                        ctx.lineTo(s * 0.35, 5)
                        ctx.stroke()
                        ctx.beginPath()
                        ctx.moveTo(s * 0.65, 1)
                        ctx.lineTo(s * 0.65, 5)
                        ctx.stroke()
                        ctx.beginPath()
                        ctx.moveTo(2, s * 0.45)
                        ctx.lineTo(s - 2, s * 0.45)
                        ctx.stroke()
                    }
                }
            }

            MouseArea {
                id: toggleMouse
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: root.viewToggled()
            }
        }
    }
}
