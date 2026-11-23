//! UI language for MeDoc Recovery (`de`|`en`|`fr`|`ar`).
//! Same principle as the USB activation app and practice documents.

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Locale {
    De,
    En,
    Fr,
    Ar,
}

impl Locale {
    pub const ALL: [Locale; 4] = [Locale::En, Locale::De, Locale::Fr, Locale::Ar];

    pub fn code(self) -> &'static str {
        match self {
            Locale::De => "de",
            Locale::En => "en",
            Locale::Fr => "fr",
            Locale::Ar => "ar",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Locale::De => "DE",
            Locale::En => "EN",
            Locale::Fr => "FR",
            Locale::Ar => "AR",
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub enum Msg {
    Title,
    Subtitle,
    Build,
    LocalStore,
    Rescan,
    OpenStore,
    Bridge,
    BridgeA,
    BridgeB,
    BridgeC,
    Passphrase,
    WrapPassphrase,
    Manifest,
    AppDir,
    PracticeShare,
    VendorShare,
    VendorSk,
    WriteWrap,
    WriteWrapDir,
    VerifyDb,
    DoVerify,
    ExportPath,
    ExportFormat,
    DoExport,
    IncludeKey,
    Recover,
    Status,
    ResetTitle,
    ResetHint,
    PracticeDir,
    LoadAccounts,
    Account,
    NewLoginPassword,
    RepeatLoginPassword,
    PasswordPolicy,
    ResetButton,
}

pub fn t(locale: Locale, msg: Msg) -> &'static str {
    match (locale, msg) {
        (Locale::De, Msg::Title) => "MeDoc Wiederherstellung",
        (Locale::Fr, Msg::Title) => "Récupération MeDoc",
        (Locale::Ar, Msg::Title) => "استعادة MeDoc",
        (_, Msg::Title) => "MeDoc Recovery",

        (Locale::De, Msg::Subtitle) => {
            "Offline Safe Bridge. Pfade werden aus dem lokalen Store gefüllt; Vendor-Schlüssel unter store/vendor/."
        }
        (Locale::Fr, Msg::Subtitle) => {
            "Safe Bridge hors ligne. Chemins remplis depuis le dépôt local ; clés vendor sous store/vendor/."
        }
        (Locale::Ar, Msg::Subtitle) => {
            "Safe Bridge دون اتصال. تُملأ المسارات من المخزن المحلي؛ مفاتيح المورّد تحت store/vendor/."
        }
        (_, Msg::Subtitle) => {
            "Offline Safe Bridge. Paths auto-fill from the local store; vendor keys live under store/vendor/."
        }

        (Locale::De, Msg::Build) => "Build",
        (Locale::Fr, Msg::Build) => "Build",
        (Locale::Ar, Msg::Build) => "الإصدار",
        (_, Msg::Build) => "Build",

        (Locale::De, Msg::LocalStore) => "Lokaler Store",
        (Locale::Fr, Msg::LocalStore) => "Dépôt local",
        (Locale::Ar, Msg::LocalStore) => "المخزن المحلي",
        (_, Msg::LocalStore) => "Local store",

        (Locale::De, Msg::Rescan) => "Erneut scannen",
        (Locale::Fr, Msg::Rescan) => "Rescanner",
        (Locale::Ar, Msg::Rescan) => "إعادة المسح",
        (_, Msg::Rescan) => "Rescan / reload",

        (Locale::De, Msg::OpenStore) => "Store-Ordner öffnen",
        (Locale::Fr, Msg::OpenStore) => "Ouvrir le dossier",
        (Locale::Ar, Msg::OpenStore) => "فتح مجلد المخزن",
        (_, Msg::OpenStore) => "Open store folder",

        (Locale::De, Msg::Bridge) => "Bridge",
        (Locale::Fr, Msg::Bridge) => "Pont",
        (Locale::Ar, Msg::Bridge) => "الجسر",
        (_, Msg::Bridge) => "Bridge",

        (Locale::De, Msg::BridgeA) => "A — Aktivierung + Passphrase",
        (Locale::Fr, Msg::BridgeA) => "A — activation + phrase",
        (Locale::Ar, Msg::BridgeA) => "أ — تفعيل + عبارة المرور",
        (_, Msg::BridgeA) => "A — activation + passphrase",

        (Locale::De, Msg::BridgeB) => "B — App-Daten + Wrap-Passphrase",
        (Locale::Fr, Msg::BridgeB) => "B — données app + phrase wrap",
        (Locale::Ar, Msg::BridgeB) => "ب — بيانات التطبيق + عبارة الالتفاف",
        (_, Msg::BridgeB) => "B — app-data + wrap passphrase",

        (Locale::De, Msg::BridgeC) => "C — Practice- + Vendor-Share",
        (Locale::Fr, Msg::BridgeC) => "C — parts practice + vendor",
        (Locale::Ar, Msg::BridgeC) => "ج — مشاركة العيادة + المورّد",
        (_, Msg::BridgeC) => "C — practice + vendor share",

        (Locale::De, Msg::Passphrase) => "Passphrase",
        (Locale::Fr, Msg::Passphrase) => "Phrase secrète",
        (Locale::Ar, Msg::Passphrase) => "عبارة المرور",
        (_, Msg::Passphrase) => "Passphrase",

        (Locale::De, Msg::WrapPassphrase) => "Neue Wrap-Passphrase",
        (Locale::Fr, Msg::WrapPassphrase) => "Nouvelle phrase wrap",
        (Locale::Ar, Msg::WrapPassphrase) => "عبارة التفاف جديدة",
        (_, Msg::WrapPassphrase) => "New wrap passphrase",

        (Locale::De, Msg::Manifest) => "activation.json",
        (Locale::Fr, Msg::Manifest) => "activation.json",
        (Locale::Ar, Msg::Manifest) => "activation.json",
        (_, Msg::Manifest) => "activation.json",

        (Locale::De, Msg::AppDir) => "App-Datenverzeichnis",
        (Locale::Fr, Msg::AppDir) => "Répertoire app-data",
        (Locale::Ar, Msg::AppDir) => "مجلد بيانات التطبيق",
        (_, Msg::AppDir) => "App-data directory",

        (Locale::De, Msg::PracticeShare) => "Practice-Share",
        (Locale::Fr, Msg::PracticeShare) => "Part practice",
        (Locale::Ar, Msg::PracticeShare) => "مشاركة العيادة",
        (_, Msg::PracticeShare) => "Practice share",

        (Locale::De, Msg::VendorShare) => "Vendor-Share",
        (Locale::Fr, Msg::VendorShare) => "Part vendor",
        (Locale::Ar, Msg::VendorShare) => "مشاركة المورّد",
        (_, Msg::VendorShare) => "Vendor share",

        (Locale::De, Msg::VendorSk) => "vendor-recovery.sk",
        (Locale::Fr, Msg::VendorSk) => "vendor-recovery.sk",
        (Locale::Ar, Msg::VendorSk) => "vendor-recovery.sk",
        (_, Msg::VendorSk) => "vendor-recovery.sk",

        (Locale::De, Msg::WriteWrap) => "Wrap schreiben",
        (Locale::Fr, Msg::WriteWrap) => "Écrire le wrap",
        (Locale::Ar, Msg::WriteWrap) => "كتابة الالتفاف",
        (_, Msg::WriteWrap) => "Write wrap",

        (Locale::De, Msg::WriteWrapDir) => "Ziel-App-Daten (Wrap)",
        (Locale::Fr, Msg::WriteWrapDir) => "App-data cible (wrap)",
        (Locale::Ar, Msg::WriteWrapDir) => "بيانات التطبيق الهدف (التفاف)",
        (_, Msg::WriteWrapDir) => "Target app-data (wrap)",

        (Locale::De, Msg::VerifyDb) => "medoc.db prüfen",
        (Locale::Fr, Msg::VerifyDb) => "Vérifier medoc.db",
        (Locale::Ar, Msg::VerifyDb) => "التحقق من medoc.db",
        (_, Msg::VerifyDb) => "Verify medoc.db",

        (Locale::De, Msg::DoVerify) => "DB nach Wiederherstellung prüfen",
        (Locale::Fr, Msg::DoVerify) => "Vérifier la DB après récupération",
        (Locale::Ar, Msg::DoVerify) => "تحقق من قاعدة البيانات بعد الاستعادة",
        (_, Msg::DoVerify) => "Verify DB after recover",

        (Locale::De, Msg::ExportPath) => "Export-Datei",
        (Locale::Fr, Msg::ExportPath) => "Fichier d'export",
        (Locale::Ar, Msg::ExportPath) => "ملف التصدير",
        (_, Msg::ExportPath) => "Export file",

        (Locale::De, Msg::ExportFormat) => "Exportformat",
        (Locale::Fr, Msg::ExportFormat) => "Format d'export",
        (Locale::Ar, Msg::ExportFormat) => "صيغة التصدير",
        (_, Msg::ExportFormat) => "Export format",

        (Locale::De, Msg::DoExport) => "Ergebnis exportieren",
        (Locale::Fr, Msg::DoExport) => "Exporter le résultat",
        (Locale::Ar, Msg::DoExport) => "تصدير النتيجة",
        (_, Msg::DoExport) => "Export result",

        (Locale::De, Msg::IncludeKey) => "Klartext-Schlüssel in Export (gefährlich)",
        (Locale::Fr, Msg::IncludeKey) => "Inclure la clé en clair (dangereux)",
        (Locale::Ar, Msg::IncludeKey) => "تضمين المفتاح النصي (خطير)",
        (_, Msg::IncludeKey) => "Include plaintext key (dangerous)",

        (Locale::De, Msg::Recover) => "Wiederherstellen",
        (Locale::Fr, Msg::Recover) => "Récupérer",
        (Locale::Ar, Msg::Recover) => "استعادة",
        (_, Msg::Recover) => "Recover",

        (Locale::De, Msg::Status) => "Status",
        (Locale::Fr, Msg::Status) => "État",
        (Locale::Ar, Msg::Status) => "الحالة",
        (_, Msg::Status) => "Status",

        (Locale::De, Msg::ResetTitle) => "Anmeldepasswort zurücksetzen",
        (Locale::Fr, Msg::ResetTitle) => "Réinitialiser un mot de passe de connexion",
        (Locale::Ar, Msg::ResetTitle) => "إعادة تعيين كلمة مرور الدخول",
        (_, Msg::ResetTitle) => "Reset a login password",

        (Locale::De, Msg::ResetHint) => "Mit dem wiederhergestellten Schlüssel ein neues Passwort für ein Konto setzen. MeDoc vorher schließen. Wird im Audit-Protokoll und in logs/recovery.log festgehalten.",
        (Locale::Fr, Msg::ResetHint) => "Avec la clé récupérée, définir un nouveau mot de passe pour un compte. Fermez MeDoc avant. Inscrit au journal d'audit et dans logs/recovery.log.",
        (Locale::Ar, Msg::ResetHint) => "باستخدام المفتاح المستعاد، عيّن كلمة مرور جديدة لحساب. أغلق MeDoc أولًا. يُسجَّل في سجل التدقيق وفي logs/recovery.log.",
        (_, Msg::ResetHint) => "With the recovered key, set a new password for one account. Close MeDoc first. Recorded in the audit log and in logs/recovery.log.",

        (Locale::De, Msg::PracticeDir) => "Praxisordner (enthält medoc.db)",
        (Locale::Fr, Msg::PracticeDir) => "Dossier du cabinet (contient medoc.db)",
        (Locale::Ar, Msg::PracticeDir) => "مجلد العيادة (يحتوي medoc.db)",
        (_, Msg::PracticeDir) => "Practice folder (holds medoc.db)",

        (Locale::De, Msg::LoadAccounts) => "Konten laden",
        (Locale::Fr, Msg::LoadAccounts) => "Charger les comptes",
        (Locale::Ar, Msg::LoadAccounts) => "تحميل الحسابات",
        (_, Msg::LoadAccounts) => "Load accounts",

        (Locale::De, Msg::Account) => "Konto",
        (Locale::Fr, Msg::Account) => "Compte",
        (Locale::Ar, Msg::Account) => "الحساب",
        (_, Msg::Account) => "Account",

        (Locale::De, Msg::NewLoginPassword) => "Neues Anmeldepasswort",
        (Locale::Fr, Msg::NewLoginPassword) => "Nouveau mot de passe de connexion",
        (Locale::Ar, Msg::NewLoginPassword) => "كلمة مرور الدخول الجديدة",
        (_, Msg::NewLoginPassword) => "New login password",

        (Locale::De, Msg::RepeatLoginPassword) => "Passwort wiederholen",
        (Locale::Fr, Msg::RepeatLoginPassword) => "Répéter le mot de passe",
        (Locale::Ar, Msg::RepeatLoginPassword) => "أعد كتابة كلمة المرور",
        (_, Msg::RepeatLoginPassword) => "Repeat the password",

        (Locale::De, Msg::PasswordPolicy) => "Gleiche Regeln wie in MeDoc: mindestens 12 Zeichen, Groß- und Kleinbuchstaben, eine Ziffer.",
        (Locale::Fr, Msg::PasswordPolicy) => "Mêmes règles que dans MeDoc : au moins 12 caractères, majuscules et minuscules, un chiffre.",
        (Locale::Ar, Msg::PasswordPolicy) => "القواعد نفسها كما في MeDoc: 12 حرفًا على الأقل، أحرف كبيرة وصغيرة، ورقم.",
        (_, Msg::PasswordPolicy) => "Same rules as in MeDoc: at least 12 characters, upper and lower case, a digit.",

        (Locale::De, Msg::ResetButton) => "Neues Passwort setzen",
        (Locale::Fr, Msg::ResetButton) => "Définir le nouveau mot de passe",
        (Locale::Ar, Msg::ResetButton) => "تعيين كلمة المرور الجديدة",
        (_, Msg::ResetButton) => "Set new password",
    }
}

pub fn bridge_label(locale: Locale, idx: usize) -> &'static str {
    match idx {
        0 => t(locale, Msg::BridgeA),
        1 => t(locale, Msg::BridgeB),
        _ => t(locale, Msg::BridgeC),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_chrome_message_resolves_for_all_locales() {
        let msgs = [
            Msg::Title,
            Msg::Subtitle,
            Msg::Build,
            Msg::Recover,
            Msg::BridgeA,
            Msg::BridgeB,
            Msg::BridgeC,
            Msg::ResetTitle,
            Msg::ResetHint,
            Msg::PracticeDir,
            Msg::LoadAccounts,
            Msg::Account,
            Msg::NewLoginPassword,
            Msg::RepeatLoginPassword,
            Msg::PasswordPolicy,
            Msg::ResetButton,
        ];
        for locale in Locale::ALL {
            for msg in msgs {
                assert!(!t(locale, msg).is_empty(), "{locale:?} {msg:?}");
            }
            assert!(!bridge_label(locale, 2).is_empty());
        }
    }
}
