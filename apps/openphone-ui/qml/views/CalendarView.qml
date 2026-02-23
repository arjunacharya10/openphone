import QtQuick
import QtQuick.Layouts
import "../components"
import ".."

Item {
    id: root

    readonly property int hoursStart: 8
    readonly property int hoursEnd: 22
    readonly property int totalHours: hoursEnd - hoursStart

    // ── Live calendar model from WebSocketClient ──
    property var calendarModel: null

    ColumnLayout {
        anchors.fill: parent
        anchors.leftMargin: Theme.spacingLG
        anchors.rightMargin: Theme.spacingLG
        anchors.topMargin: Theme.spacingXS
        spacing: Theme.spacingSM

        // ── "TODAY" label ──
        Text {
            text: "TODAY"
            font.pixelSize: Theme.fontSizeXS
            font.letterSpacing: 2.0
            font.capitalization: Font.AllUppercase
            color: Theme.dimText
            opacity: 0.6
        }

        // ── Timeline ──
        Item {
            Layout.fillWidth: true
            Layout.fillHeight: true

            // ── Left border line ──
            Rectangle {
                id: borderLine
                x: Theme.spacingLG + Theme.spacingSM
                y: 0
                width: 1
                height: parent.height
                color: "#222222"
            }

            // ── Hour markers ──
            Repeater {
                model: [8, 10, 12, 14, 16, 18, 20]

                Text {
                    x: 0
                    y: ((modelData - root.hoursStart) / root.totalHours) * parent.height
                    text: modelData + ":00"
                    font.pixelSize: Theme.fontSizeXS
                    font.family: "monospace"
                    color: Theme.border
                }
            }

            // ── Current time indicator ──
            TimelineLine {
                id: timeLine
                anchors.left: borderLine.left
                anchors.right: parent.right
                y: visible ? ((timeLine.currentHour - root.hoursStart) / root.totalHours) * parent.height : 0
            }

            // ── Event blocks ──
            Repeater {
                model: root.calendarModel

                Rectangle {
                    x: borderLine.x + Theme.spacingSM + Theme.spacingXS
                    y: ((model.startHour - root.hoursStart) / root.totalHours) * parent.height
                    width: parent.width - x
                    height: Math.max(
                        ((model.endHour - model.startHour) / root.totalHours) * parent.height,
                        parent.height * 0.03
                    )

                    color: Theme.cardBg
                    border.color: Theme.cardBorder
                    border.width: 1
                    radius: Theme.radiusSM

                    ColumnLayout {
                        anchors.fill: parent
                        anchors.leftMargin: Theme.spacingSM
                        anchors.rightMargin: Theme.spacingSM
                        anchors.topMargin: Theme.spacingXS
                        anchors.bottomMargin: Theme.spacingXS
                        spacing: 2

                        Text {
                            Layout.fillWidth: true
                            text: model.summary
                            font.pixelSize: Theme.fontSizeSM
                            font.weight: Font.Medium
                            color: Theme.foreground
                            elide: Text.ElideRight
                        }

                        Text {
                            Layout.fillWidth: true
                            text: {
                                var h = Math.floor(model.startHour)
                                var m = Math.round((model.startHour - h) * 60)
                                var suffix = h >= 12 ? "PM" : "AM"
                                var hour12 = h > 12 ? h - 12 : (h === 0 ? 12 : h)
                                var timeStr = hour12 + ":" + (m < 10 ? "0" + m : m) + " " + suffix
                                return model.location ? timeStr + " \u00B7 " + model.location : timeStr
                            }
                            font.pixelSize: Theme.fontSizeXS
                            font.family: "monospace"
                            color: "#666666"
                            elide: Text.ElideRight
                        }
                    }
                }
            }

            // ── Empty state ──
            Text {
                anchors.centerIn: parent
                text: "Clear day."
                font.pixelSize: Math.round(12 * Theme.scaleFont)
                font.family: "monospace"
                color: Theme.dimText
                visible: !root.calendarModel || root.calendarModel.count === 0
            }
        }
    }
}
