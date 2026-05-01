//! Erkennung installierter Bildbetrachter (Pfade), sortiert nach Popularität.
//! Kuratierte Kandidatenliste pro Betriebssystem — es werden nur existierende Pfade zurückgegeben.

use serde::Serialize;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize)]
pub struct DetectedPhotoViewerApp {
    pub display_name: String,
    pub path: String,
    /// Niedriger = höhere Priorität (beliebter / typischer Standard).
    pub rank: u32,
}

fn push_if_exists(out: &mut Vec<DetectedPhotoViewerApp>, rank: u32, display_name: &str, path: PathBuf) {
    if path.is_file() || path.is_dir() {
        out.push(DetectedPhotoViewerApp {
            display_name: display_name.to_string(),
            path: path.to_string_lossy().to_string(),
            rank,
        });
    }
}

#[cfg(target_os = "macos")]
fn scan_macos() -> Vec<DetectedPhotoViewerApp> {
    let mut out = Vec::new();
    let mut r: u32 = 0;
    // Reihenfolge = typische Popularität / sinnvoller Default (ca. 90 Einträge).
    const NAMES_PATHS: &[(&str, &str)] = &[
        ("Apple Preview", "/System/Applications/Preview.app"),
        ("Apple Fotos", "/System/Applications/Photos.app"),
        ("Seashore", "/Applications/Seashore.app"),
        ("XnView MP", "/Applications/XnViewMP.app"),
        ("XnView Classic", "/Applications/XnView.app"),
        ("GIMP", "/Applications/GIMP.app"),
        ("Affinity Photo 2", "/Applications/Affinity Photo 2.app"),
        ("Affinity Photo", "/Applications/Affinity Photo.app"),
        ("Pixelmator Pro", "/Applications/Pixelmator Pro.app"),
        ("Pixelmator Classic", "/Applications/Pixelmator.app"),
        ("Acorn", "/Applications/Acorn.app"),
        ("Photoscape X", "/Applications/Photoscape X.app"),
        ("Imagine", "/Applications/Imagine.app"),
        ("ApolloOne", "/Applications/ApolloOne.app"),
        ("Lyn", "/Applications/Lyn.app"),
        ("Phiewer", "/Applications/Phiewer.app"),
        ("qView", "/Applications/qView.app"),
        ("Photo Mechanic", "/Applications/Photo Mechanic.app"),
        ("Capture One", "/Applications/Capture One.app"),
        ("darktable", "/Applications/darktable.app"),
        ("RawTherapee", "/Applications/RawTherapee.app"),
        ("Lightroom", "/Applications/Adobe Lightroom.app"),
        ("Adobe Bridge", "/Applications/Adobe Bridge 2024/Adobe Bridge 2024.app"),
        ("Adobe Illustrator", "/Applications/Adobe Illustrator 2024/Adobe Illustrator.app"),
        ("Inkscape", "/Applications/Inkscape.app"),
        ("Krita", "/Applications/krita.app"),
        ("Skim", "/Applications/Skim.app"),
        ("PDF Expert", "/Applications/PDF Expert.app"),
        ("Foxit PDF Reader", "/Applications/Foxit PDF Reader.app"),
        ("Google Chrome", "/Applications/Google Chrome.app"),
        ("Mozilla Firefox", "/Applications/Firefox.app"),
        ("Microsoft Edge", "/Applications/Microsoft Edge.app"),
        ("Brave Browser", "/Applications/Brave Browser.app"),
        ("Opera", "/Applications/Opera.app"),
        ("Vivaldi", "/Applications/Vivaldi.app"),
        ("Tor Browser", "/Applications/Tor Browser.app"),
        ("Safari", "/Applications/Safari.app"),
        ("Skitch", "/Applications/Skitch.app"),
        ("Snagit", "/Applications/Snagit.app"),
        ("Snagit (alt)", "/Applications/Snagit 2024.app"),
        ("Typora", "/Applications/Typora.app"),
        ("Marked 2", "/Applications/Marked 2.app"),
        ("BBEdit", "/Applications/BBEdit.app"),
        ("VS Code", "/Applications/Visual Studio Code.app"),
        ("Code", "/Applications/Code.app"),
        ("Cursor", "/Applications/Cursor.app"),
        ("Sublime Text", "/Applications/Sublime Text.app"),
        ("TextMate", "/Applications/TextMate.app"),
        ("MacVim", "/Applications/MacVim.app"),
        ("Aquamacs", "/Applications/Aquamacs.app"),
        ("Emacs", "/Applications/Emacs.app"),
        ("iPhoto (alt)", "/Applications/iPhoto.app"),
        ("Aperture (alt)", "/Applications/Aperture.app"),
        ("GraphicConverter", "/Applications/GraphicConverter.app"),
        ("GraphicConverter 12", "/Applications/GraphicConverter 12.app"),
        ("Luminar Neo", "/Applications/Luminar Neo.app"),
        ("Luminar AI", "/Applications/Luminar AI.app"),
        ("ON1 Photo RAW", "/Applications/ON1 Photo RAW 2024.app"),
        ("DxO PhotoLab", "/Applications/DxO PhotoLab 7.app"),
        ("DxO PureRAW", "/Applications/DxO PureRAW.app"),
        ("SILKYPIX", "/Applications/RAW FILE CONVERTER EX 3.0.app"),
        ("PhotoScape", "/Applications/PhotoScapeX.app"),
        ("Polarr", "/Applications/Polarr Photo Editor.app"),
        ("JPEGmini", "/Applications/JPEGmini.app"),
        ("ImageOptim", "/Applications/ImageOptim.app"),
        ("Optimage", "/Applications/Optimage.app"),
        ("PhotoBulk", "/Applications/PhotoBulk.app"),
        ("Retrobatch", "/Applications/Retrobatch.app"),
        ("BatchPhoto", "/Applications/BatchPhoto.app"),
        ("PhotoBulk Watermark", "/Applications/PhotoBulk Watermark.app"),
        ("Hazel", "/Applications/Hazel.app"),
        ("Permute", "/Applications/Permute.app"),
        ("HandBrake", "/Applications/HandBrake.app"),
        ("VLC", "/Applications/VLC.app"),
        ("IINA", "/Applications/IINA.app"),
        ("mpv", "/Applications/mpv.app"),
        ("Adobe Photoshop 2025", "/Applications/Adobe Photoshop 2025/Adobe Photoshop 2025.app"),
        ("Adobe Photoshop 2024", "/Applications/Adobe Photoshop 2024/Adobe Photoshop 2024.app"),
        ("Adobe Photoshop 2023", "/Applications/Adobe Photoshop 2023/Adobe Photoshop 2023.app"),
        ("Adobe Photoshop 2022", "/Applications/Adobe Photoshop 2022/Adobe Photoshop 2022.app"),
        ("Adobe Photoshop CC", "/Applications/Adobe Photoshop CC/Adobe Photoshop CC.app"),
        ("Adobe Photoshop Elements", "/Applications/Adobe Photoshop Elements 2024/Adobe Photoshop Elements 2024 Editor.app"),
        ("Adobe Lightroom Classic", "/Applications/Adobe Lightroom Classic/Adobe Lightroom Classic.app"),
        ("CorelDRAW", "/Applications/CorelDRAW.app"),
        ("Paint.NET (Wine/Wineskin)", "/Applications/Paint.NET.app"),
        ("ImageJ", "/Applications/ImageJ.app"),
        ("ImageJ (Fiji)", "/Applications/Fiji.app"),
        ("Horos", "/Applications/Horos.app"),
        ("OsiriX", "/Applications/OsiriX.app"),
        ("OsiriX MD", "/Applications/OsiriX MD.app"),
        ("Miele-LXIV", "/Applications/Miele-LXIV.app"),
        ("DCM", "/Applications/DCM.app"),
        ("RadiAnt (Wine)", "/Applications/RadiAntViewer.app"),
        ("Manga/Comic: edge", "/Applications/YACReader.app"),
        ("YACReader", "/Applications/YACReader.app"),
        ("Simple Comic", "/Applications/Simple Comic.app"),
        ("Luminance HDR", "/Applications/Luminance HDR.app"),
        ("HDRtist", "/Applications/HDRtist.app"),
        ("Photomatix Pro", "/Applications/Photomatix Pro.app"),
        ("Hugin", "/Applications/Hugin.app"),
        ("PTGui", "/Applications/PTGui Pro.app"),
        ("Capture One Express", "/Applications/Capture One Express.app"),
        ("AfterShot Pro", "/Applications/AfterShot Pro.app"),
    ];

    for (name, p) in NAMES_PATHS {
        push_if_exists(&mut out, r, name, PathBuf::from(p));
        r += 1;
    }

    out.sort_by_key(|e| e.rank);
    out
}

#[cfg(target_os = "windows")]
fn scan_windows() -> Vec<DetectedPhotoViewerApp> {
    let mut out = Vec::new();
    let mut r: u32 = 0;
    let pf = std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".to_string());
    let pf86 = std::env::var("ProgramFiles(x86)").unwrap_or_else(|_| "C:\\Program Files (x86)".to_string());
    let local = std::env::var("LOCALAPPDATA").unwrap_or_default();

    let mut add = |name: &str, pb: PathBuf| {
        push_if_exists(&mut out, r, name, pb);
        r += 1;
    };

    add("Paint", PathBuf::from(r"C:\Windows\System32\mspaint.exe"));
    add("IrfanView 64", {
        let mut p = PathBuf::from(&pf);
        p.push("IrfanView");
        p.push("i_view64.exe");
        p
    });
    add("IrfanView 32", {
        let mut p = PathBuf::from(&pf86);
        p.push("IrfanView");
        p.push("i_view32.exe");
        p
    });
    add("XnView MP", {
        let mut p = PathBuf::from(&pf);
        p.push("XnViewMP");
        p.push("xnviewmp.exe");
        p
    });
    add("GIMP", {
        let mut p = PathBuf::from(&pf);
        p.push("GIMP 2");
        p.push("bin");
        p.push("gimp-2.10.exe");
        p
    });
    add("GIMP 3", {
        let mut p = PathBuf::from(&pf);
        p.push("GIMP 3");
        p.push("bin");
        p.push("gimp-3.exe");
        p
    });
    add("Google Chrome", {
        let mut p = PathBuf::from(r"C:\Program Files\Google\Chrome\Application\chrome.exe");
        p
    });
    add("Mozilla Firefox", {
        let mut p = PathBuf::from(&pf);
        p.push("Mozilla Firefox");
        p.push("firefox.exe");
        p
    });
    add("Microsoft Edge", {
        let mut p = PathBuf::from(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe");
        p
    });
    add("Adobe Photoshop 2025", {
        let mut p = PathBuf::from(&pf);
        p.push("Adobe");
        p.push("Adobe Photoshop 2025");
        p.push("Photoshop.exe");
        p
    });
    add("Adobe Photoshop 2024", {
        let mut p = PathBuf::from(&pf);
        p.push("Adobe");
        p.push("Adobe Photoshop 2024");
        p.push("Photoshop.exe");
        p
    });
    add("Adobe Photoshop 2023", {
        let mut p = PathBuf::from(&pf);
        p.push("Adobe");
        p.push("Adobe Photoshop 2023");
        p.push("Photoshop.exe");
        p
    });
    add("FastStone Image Viewer", {
        let mut p = PathBuf::from(&pf);
        p.push("FastStone Image Viewer");
        p.push("FSViewer.exe");
        p
    });
    add("FastStone MaxView", {
        let mut p = PathBuf::from(&pf);
        p.push("FastStone MaxView");
        p.push("FSMaxView.exe");
        p
    });
    add("Honeyview", {
        let mut p = PathBuf::from(&pf);
        p.push("Honeyview");
        p.push("Honeyview.exe");
        p
    });
    add("Nomacs", {
        let mut p = PathBuf::from(&pf);
        p.push("nomacs");
        p.push("bin");
        p.push("nomacs.exe");
        p
    });
    add("ImageGlass", {
        let mut p = PathBuf::from(&local);
        p.push("Programs");
        p.push("ImageGlass");
        p.push("ImageGlass.exe");
        p
    });
    add("PhotoQt", {
        let mut p = PathBuf::from(&pf);
        p.push("PhotoQt");
        p.push("photoqt.exe");
        p
    });
    add("Quick Picture Viewer", {
        let mut p = PathBuf::from(&pf);
        p.push("QuickPictureViewer");
        p.push("QuickPictureViewer.exe");
        p
    });
    add("JPEGView", {
        let mut p = PathBuf::from(&pf);
        p.push("JPEGView");
        p.push("JPEGView.exe");
        p
    });
    add("Apowersoft HEIC Viewer", {
        let mut p = PathBuf::from(&pf);
        p.push("Apowersoft");
        p.push("HEIC Viewer");
        p.push("HEICViewer.exe");
        p
    });
    add("CopyTrans HEIC", {
        let mut p = PathBuf::from(&pf);
        p.push("CopyTrans");
        p.push("HEIC for Windows");
        p.push("Viewer.exe");
        p
    });
    add("Adobe Bridge 2024", {
        let mut p = PathBuf::from(&pf);
        p.push("Adobe");
        p.push("Adobe Bridge 2024");
        p.push("Bridge.exe");
        p
    });
    add("Paint.NET", {
        let mut p = PathBuf::from(&pf);
        p.push("paint.net");
        p.push("PaintDotNet.exe");
        p
    });
    add("Krita", {
        let mut p = PathBuf::from(&pf);
        p.push("Krita (x64)");
        p.push("bin");
        p.push("krita.exe");
        p
    });
    add("Inkscape", {
        let mut p = PathBuf::from(&pf);
        p.push("Inkscape");
        p.push("bin");
        p.push("inkscape.exe");
        p
    });
    add("darktable", {
        let mut p = PathBuf::from(&pf);
        p.push("darktable");
        p.push("bin");
        p.push("darktable.exe");
        p
    });
    add("RawTherapee", {
        let mut p = PathBuf::from(&pf);
        p.push("RawTherapee");
        p.push("rawtherapee.exe");
        p
    });
    add("Capture One", {
        let mut p = PathBuf::from(&pf);
        p.push("Capture One");
        p.push("Capture One.exe");
        p
    });
    add("Lightroom", {
        let mut p = PathBuf::from(&pf);
        p.push("Adobe");
        p.push("Adobe Lightroom CC");
        p.push("Lightroom.exe");
        p
    });
    add("Alien Skin Exposure", {
        let mut p = PathBuf::from(&pf);
        p.push("Exposure Software");
        p.push("Exposure X7");
        p.push("Exposure X7.exe");
        p
    });
    add("ACDSee", {
        let mut p = PathBuf::from(&pf);
        p.push("ACD Systems");
        p.push("ACDSee Home");
        p.push("ACDSeeHome64.exe");
        p
    });
    add("Skylum Luminar Neo", {
        let mut p = PathBuf::from(&pf);
        p.push("Skylum");
        p.push("Luminar Neo");
        p.push("Luminar Neo.exe");
        p
    });
    add("DxO PhotoLab", {
        let mut p = PathBuf::from(&pf);
        p.push("DxO");
        p.push("DxO PhotoLab 7");
        p.push("DxO.PhotoLab.exe");
        p
    });
    add("ON1 Photo RAW", {
        let mut p = PathBuf::from(&pf);
        p.push("ON1");
        p.push("ON1 Photo RAW 2024");
        p.push("ONPhotoRAW.exe");
        p
    });
    add("SumatraPDF (Bilder eingeschränkt)", {
        let mut p = PathBuf::from(&pf);
        p.push("SumatraPDF");
        p.push("SumatraPDF.exe");
        p
    });
    add("BandiView", {
        let mut p = PathBuf::from(&pf);
        p.push("Bandisoft");
        p.push("BandiView");
        p.push("BandiView.exe");
        p
    });
    add("JPEGmini Pro", {
        let mut p = PathBuf::from(&pf);
        p.push("JPEGmini");
        p.push("JPEGmini Pro.exe");
        p
    });
    add("XnConvert", {
        let mut p = PathBuf::from(&pf);
        p.push("XnConvert");
        p.push("xnconvert.exe");
        p
    });

    out.sort_by_key(|e| e.rank);
    out
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn scan_unix() -> Vec<DetectedPhotoViewerApp> {
    let mut out = Vec::new();
    let mut r: u32 = 0;
    const CANDIDATES: &[(&str, &str)] = &[
        ("GNOME Bildbetrachter (eog)", "/usr/bin/eog"),
        ("GNOME Bildbetrachter", "/usr/bin/gnome-image-viewer"),
        ("Eye of MATE", "/usr/bin/eom"),
        ("gThumb", "/usr/bin/gthumb"),
        ("gwenview", "/usr/bin/gwenview"),
        ("kolourpaint", "/usr/bin/kolourpaint"),
        ("okular", "/usr/bin/okular"),
        ("xdg-open (System)", "/usr/bin/xdg-open"),
        ("feh", "/usr/bin/feh"),
        ("sxiv", "/usr/bin/sxiv"),
        ("nsxiv", "/usr/bin/nsxiv"),
        ("mirage", "/usr/bin/mirage"),
        ("ristretto", "/usr/bin/ristretto"),
        ("gpicview", "/usr/bin/gpicview"),
        ("qimgv", "/usr/bin/qimgv"),
        ("phototonic", "/usr/bin/phototonic"),
        ("Pinta", "/usr/bin/pinta"),
        ("geeqie", "/usr/bin/geeqie"),
        ("viewnior", "/usr/bin/viewnior"),
        ("drawing", "/usr/bin/drawing"),
        ("krita", "/usr/bin/krita"),
        ("gimp", "/usr/bin/gimp"),
        ("inkscape", "/usr/bin/inkscape"),
        ("darktable", "/usr/bin/darktable"),
        ("darktable (lokal)", "/usr/local/bin/darktable"),
        ("rawtherapee", "/usr/bin/rawtherapee"),
        ("digikam", "/usr/bin/digikam"),
        ("showfoto", "/usr/bin/showfoto"),
        ("Firefox", "/usr/bin/firefox"),
        ("Chrome / Chromium", "/usr/bin/chromium"),
        ("Chromium Browser", "/usr/bin/chromium-browser"),
        ("Google Chrome", "/usr/bin/google-chrome"),
        ("Google Chrome (stabile)", "/usr/bin/google-chrome-stable"),
        ("Brave", "/usr/bin/brave-browser"),
        ("Microsoft Edge", "/usr/bin/microsoft-edge"),
        ("Vivaldi", "/usr/bin/vivaldi-stable"),
        ("Opera", "/usr/bin/opera"),
        ("mpv", "/usr/bin/mpv"),
        ("vlc", "/usr/bin/vlc"),
        ("swayimg", "/usr/bin/swayimg"),
        ("imv", "/usr/bin/imv"),
        ("imv-wayland", "/usr/bin/imv-wayland"),
        ("pqiv", "/usr/bin/pqiv"),
        ("nomacs", "/usr/bin/nomacs"),
        ("lximage-qt", "/usr/bin/lximage-qt"),
        ("deepin-image-viewer", "/usr/bin/deepin-image-viewer"),
        ("mirage (python-alt)", "/usr/local/bin/mirage"),
        ("fotoxx", "/usr/bin/fotoxx"),
        ("Geeqie (lokal)", "/usr/local/bin/geeqie"),
        ("XnView MP", "/opt/XnView/xnview.sh"),
        ("Java imageJ", "/usr/bin/imagej"),
        ("fiji", "/usr/bin/fiji"),
        ("ristretto (lokal)", "/usr/local/bin/ristretto"),
        ("eog (lokal)", "/usr/local/bin/eog"),
        ("feh (lokal)", "/usr/local/bin/feh"),
        ("sxiv (lokal)", "/usr/local/bin/sxiv"),
        ("gimp (flatpak run)", "/var/lib/flatpak/exports/bin/org.gimp.GIMP"),
        ("krita (flatpak)", "/var/lib/flatpak/exports/bin/org.kde.krita"),
        ("Inkscape (flatpak)", "/var/lib/flatpak/exports/bin/org.inkscape.Inkscape"),
        ("GThumb flatpak", "/var/lib/flatpak/exports/bin/org.gnome.gThumb"),
        ("Loupe (GNOME)", "/usr/bin/loupe"),
        ("decoder (Cosmic)", "/usr/bin/com.system76.CosmicViewer"),
        ("qview", "/usr/bin/qview"),
        ("lumina-photo", "/usr/bin/lumina-photo"),
        ("mirage (pip)", "/home/.local/bin/mirage"),
    ];

    for (name, p) in CANDIDATES {
        push_if_exists(&mut out, r, name, PathBuf::from(p));
        r += 1;
    }

    out.sort_by_key(|e| e.rank);
    out
}

/// Nur installierte Apps, sortiert nach `rank` (beliebteste zuerst).
pub fn detect_photo_viewer_apps() -> Vec<DetectedPhotoViewerApp> {
    #[cfg(target_os = "macos")]
    {
        scan_macos()
    }
    #[cfg(target_os = "windows")]
    {
        scan_windows()
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        scan_unix()
    }
}
