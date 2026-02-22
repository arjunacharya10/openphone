pragma Singleton
import QtQuick

QtObject {
    id: theme

    // ── Scale factor (bind to root window dimensions) ──
    property real windowWidth: 480
    property real windowHeight: 960
    readonly property real scale: Math.min(windowWidth / 480, windowHeight / 960)

    // ── Colors ──
    readonly property color background:    "#121110"
    readonly property color foreground:    "#EBE9E4"
    readonly property color muted:         "#888888"
    readonly property color accent:        "#D4C5B0"
    readonly property color border:        "#333333"
    readonly property color cardBg:        "#1A1918"
    readonly property color cardBorder:    "#2A2928"
    readonly property color dimText:       "#444444"
    readonly property color subtleText:    "#555555"
    readonly property color kindBadgeBg:   "#1F1E1D"
    readonly property color kindBadgeText: "#777777"

    // ── Font sizes (scaled) ──
    readonly property int fontSizeXS: Math.round(9  * scale)
    readonly property int fontSizeSM: Math.round(11 * scale)
    readonly property int fontSizeMD: Math.round(13 * scale)
    readonly property int fontSizeLG: Math.round(14 * scale)
    readonly property int fontSizeXL: Math.round(22 * scale)

    // ── Spacing (scaled) ──
    readonly property int spacingXS: Math.round(4  * scale)
    readonly property int spacingSM: Math.round(8  * scale)
    readonly property int spacingMD: Math.round(16 * scale)
    readonly property int spacingLG: Math.round(20 * scale)
    readonly property int spacingXL: Math.round(24 * scale)

    // ── Border radii ──
    readonly property int radiusSM: Math.round(2 * scale)
    readonly property int radiusMD: Math.round(3 * scale)
}
