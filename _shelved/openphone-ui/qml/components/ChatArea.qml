import QtQuick
import QtQuick.Layouts
import "../components"
import ".."

Item {
    id: root

    property var chatModel: null
    property bool thinking: false
    /** When false (card active), hide "Instruct or query" placeholder */
    property bool showEmptyPlaceholder: true

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        ListView {
            id: listView
            Layout.fillWidth: true
            Layout.fillHeight: true
            Layout.leftMargin: Theme.spacingLG
            Layout.rightMargin: Theme.spacingLG
            Layout.topMargin: Theme.spacingSM
            model: root.chatModel
            clip: true
            spacing: Theme.spacingSM

            onCountChanged: {
                if (count > 0) {
                    positionViewAtEnd()
                }
            }

            delegate: Row {
                width: listView.width
                spacing: 2

                Text {
                    width: showCursor ? parent.width - cursorLabel.implicitWidth - parent.spacing : parent.width
                    property bool showCursor: model.role === "assistant" && model.streaming
                    text: model.text || ""
                    font.pixelSize: Theme.fontSizeMD
                    font.italic: model.role === "user"
                    font.weight: Font.Light
                    color: model.role === "user" ? Theme.muted : Theme.foreground
                    wrapMode: Text.WordWrap
                    visible: text.length > 0 || showCursor
                    textFormat: model.role === "assistant" && !model.streaming
                        ? Text.MarkdownText
                        : Text.PlainText
                }

                Text {
                    id: cursorLabel
                    text: "\u258C"
                    font.pixelSize: Theme.fontSizeMD
                    font.weight: Font.Light
                    color: Theme.muted
                    visible: model.role === "assistant" && model.streaming
                    opacity: blinkOn ? 1 : 0.25
                    property bool blinkOn: true

                    Timer {
                        running: cursorLabel.visible
                        repeat: true
                        interval: 530
                        onTriggered: cursorLabel.blinkOn = !cursorLabel.blinkOn
                    }
                }
            }

            footer: ThinkingIndicator {
                width: listView.width
                visible: root.thinking
            }

            Text {
                anchors.centerIn: parent
                text: "Instruct or query..."
                font.pixelSize: Theme.fontSizeMD
                font.italic: true
                color: Theme.dimText
                visible: root.showEmptyPlaceholder && (!root.chatModel || root.chatModel.count === 0)
            }
        }
    }
}
