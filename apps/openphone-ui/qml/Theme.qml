pragma Singleton
import QtQuick

QtObject {
    id: theme

    // ── Reference device (design target 480×960) ──
    readonly property real refWidth: 480
    readonly property real refHeight: 960
    readonly property real refDpi: 96

    property real windowWidth: 480
    property real windowHeight: 960
    property real screenPixelDensity: 3.78  // px/mm, set from Main (Screen.pixelDensity); fallback ~96 DPI

    // ── Layout scale: min 1.0 so UI never shrinks below design ──
    readonly property real scale: Math.max(1.0, Math.min(windowWidth / refWidth, windowHeight / refHeight))

    // ── Font scale: DPI-aware, min 1.0 so text stays readable on all screens ──
    readonly property real scaleFont: {
        var dpi = screenPixelDensity > 0 ? screenPixelDensity * 25.4 : refDpi
        var rw = (windowWidth * refDpi) / (dpi * refWidth)
        var rh = (windowHeight * refDpi) / (dpi * refHeight)
        return Math.max(1.0, Math.min(rw, rh))
    }

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

    // ── Font sizes (DPI-aware, scaleFont ensures readability) ──
    readonly property int fontSizeXS: Math.round(9  * scaleFont)
    readonly property int fontSizeSM: Math.round(11 * scaleFont)
    readonly property int fontSizeMD: Math.round(13 * scaleFont)
    readonly property int fontSizeLG: Math.round(14 * scaleFont)
    readonly property int fontSizeXL: Math.round(22 * scaleFont)

    // ── Spacing (scaled) ──
    readonly property int spacingXS: Math.round(4  * scale)
    readonly property int spacingSM: Math.round(8  * scale)
    readonly property int spacingMD: Math.round(16 * scale)
    readonly property int spacingLG: Math.round(20 * scale)
    readonly property int spacingXL: Math.round(24 * scale)

    // ── Border radii ──
    readonly property int radiusSM: Math.round(2 * scale)
    readonly property int radiusMD: Math.round(3 * scale)
    readonly property int radiusLG: Math.round(6 * scale)

    // ── Glassmorphism accents ──
    readonly property color glassBackground: Qt.rgba(0.08, 0.08, 0.09, 0.85)
    readonly property color glassBorder: Qt.rgba(border.r, border.g, border.b, 0.6)
    readonly property real glassShadowOpacity: 0.35
}
