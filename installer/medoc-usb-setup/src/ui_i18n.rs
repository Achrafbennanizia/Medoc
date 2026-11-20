//! UI language for the field activation / USB setup window (`de`|`en`|`fr`|`ar`).
//! Same principle as practice documents: one selected locale drives all chrome.

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_chrome_message_resolves_for_all_locales() {
        let msgs = [
            Msg::Title,
            Msg::Subtitle,
            Msg::Build,
            Msg::Password,
            Msg::ActivateLicense,
            Msg::Install,
            Msg::OpenMedoc,
        ];
        for locale in Locale::ALL {
            for msg in msgs {
                assert!(!t(locale, msg).is_empty(), "{locale:?} {msg:?}");
            }
            assert_eq!(locale.code().len(), 2);
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub enum Msg {
    Title,
    Subtitle,
    Build,
    Password,
    PasswordHint,
    Unlock,
    NewCampaign,
    CreateCampaignHint,
    Devices,
    CreateCampaign,
    Role,
    RoleNext,
    RoleMaster,
    RoleReplica,
    RoleServer,
    RoleLan,
    Install,
    UpdateFromBuild,
    UpdateHint,
    OpenMedoc,
    OpenHint,
    Wipe,
    WipeConfirm,
    Cancel,
    DeleteCancelled,
    LicenseHeading,
    LicenseHint,
    ActivateLicense,
    LicenseKeyHint,
    CopyLicense,
    Copied,
    ShortPassword,
}

pub fn t(locale: Locale, msg: Msg) -> &'static str {
    match (locale, msg) {
        (Locale::De, Msg::Title) => "MeDoc USB-Einrichtung",
        (Locale::Fr, Msg::Title) => "Installation USB MeDoc",
        (Locale::Ar, Msg::Title) => "إعداد MeDoc عبر USB",
        (_, Msg::Title) => "MeDoc USB Setup",

        (Locale::De, Msg::Subtitle) => {
            "Praxis-App installieren, dann MeDoc aus diesem Fenster öffnen."
        }
        (Locale::Fr, Msg::Subtitle) => {
            "Installez l'application cabinet, puis ouvrez MeDoc depuis cette fenêtre."
        }
        (Locale::Ar, Msg::Subtitle) => "ثبّت تطبيق العيادة ثم افتح MeDoc من هذه النافذة.",
        (_, Msg::Subtitle) => "Install the practice app, then Open MeDoc from this window.",

        (Locale::De, Msg::Build) => "Build",
        (Locale::Fr, Msg::Build) => "Build",
        (Locale::Ar, Msg::Build) => "الإصدار",
        (_, Msg::Build) => "Build",

        (Locale::De, Msg::Password) => "USB-Kit-Passwort",
        (Locale::Fr, Msg::Password) => "Mot de passe du kit USB",
        (Locale::Ar, Msg::Password) => "كلمة مرور مجموعة USB",
        (_, Msg::Password) => "USB kit password",

        (Locale::De, Msg::PasswordHint) => "gleiches Passwort wie bei init-campaign",
        (Locale::Fr, Msg::PasswordHint) => "même mot de passe que init-campaign",
        (Locale::Ar, Msg::PasswordHint) => "نفس كلمة مرور init-campaign",
        (_, Msg::PasswordHint) => "same password as init-campaign",

        (Locale::De, Msg::Unlock) => "Entsperren",
        (Locale::Fr, Msg::Unlock) => "Déverrouiller",
        (Locale::Ar, Msg::Unlock) => "فتح القفل",
        (_, Msg::Unlock) => "Unlock",

        (Locale::De, Msg::NewCampaign) => "Neue Kampagne",
        (Locale::Fr, Msg::NewCampaign) => "Nouvelle campagne",
        (Locale::Ar, Msg::NewCampaign) => "حملة جديدة",
        (_, Msg::NewCampaign) => "New campaign",

        (Locale::De, Msg::CreateCampaignHint) => {
            "Neue Kampagne anlegen (ersetzt den Tresor auf diesem Kit)."
        }
        (Locale::Fr, Msg::CreateCampaignHint) => {
            "Créer une campagne (remplace le coffre de ce kit)."
        }
        (Locale::Ar, Msg::CreateCampaignHint) => "إنشاء حملة جديدة (تستبدل خزنة هذه المجموعة).",
        (_, Msg::CreateCampaignHint) => "Create a new campaign (replaces the vault on this kit).",

        (Locale::De, Msg::Devices) => "Anzahl Geräte in dieser Kampagne",
        (Locale::Fr, Msg::Devices) => "Nombre d'appareils dans cette campagne",
        (Locale::Ar, Msg::Devices) => "عدد الأجهزة في هذه الحملة",
        (_, Msg::Devices) => "Number of devices in this campaign",

        (Locale::De, Msg::CreateCampaign) => "Kampagne erstellen",
        (Locale::Fr, Msg::CreateCampaign) => "Créer la campagne",
        (Locale::Ar, Msg::CreateCampaign) => "إنشاء الحملة",
        (_, Msg::CreateCampaign) => "Create campaign",

        (Locale::De, Msg::Role) => "Rolle für diesen PC",
        (Locale::Fr, Msg::Role) => "Rôle pour ce PC",
        (Locale::Ar, Msg::Role) => "دور هذا الجهاز",
        (_, Msg::Role) => "Role for this PC",

        (Locale::De, Msg::RoleNext) => "Nächsten Kettenplatz nutzen",
        (Locale::Fr, Msg::RoleNext) => "Utiliser le prochain emplacement",
        (Locale::Ar, Msg::RoleNext) => "استخدم الفتحة التالية في السلسلة",
        (_, Msg::RoleNext) => "Use next chain slot",

        (Locale::De, Msg::RoleMaster) => "Master",
        (Locale::Fr, Msg::RoleMaster) => "Master",
        (Locale::Ar, Msg::RoleMaster) => "رئيسي",
        (_, Msg::RoleMaster) => "Master",

        (Locale::De, Msg::RoleReplica) => "Replik / Benutzer",
        (Locale::Fr, Msg::RoleReplica) => "Réplica / utilisateur",
        (Locale::Ar, Msg::RoleReplica) => "نسخة / مستخدم",
        (_, Msg::RoleReplica) => "Replica / user",

        (Locale::De, Msg::RoleServer) => "Server-Host",
        (Locale::Fr, Msg::RoleServer) => "Hôte serveur",
        (Locale::Ar, Msg::RoleServer) => "مضيف الخادم",
        (_, Msg::RoleServer) => "Server host",

        (Locale::De, Msg::RoleLan) => "LAN-Client",
        (Locale::Fr, Msg::RoleLan) => "Client LAN",
        (Locale::Ar, Msg::RoleLan) => "عميل الشبكة المحلية",
        (_, Msg::RoleLan) => "LAN client",

        (Locale::De, Msg::Install) => "MeDoc installieren",
        (Locale::Fr, Msg::Install) => "Installer MeDoc",
        (Locale::Ar, Msg::Install) => "تثبيت MeDoc",
        (_, Msg::Install) => "Install MeDoc",

        (Locale::De, Msg::UpdateFromBuild) => "MeDoc aus aktuellem Build aktualisieren",
        (Locale::Fr, Msg::UpdateFromBuild) => "Mettre à jour MeDoc depuis le build actuel",
        (Locale::Ar, Msg::UpdateFromBuild) => "تحديث MeDoc من أحدث بناء",
        (_, Msg::UpdateFromBuild) => "Update MeDoc from latest build",

        (Locale::De, Msg::UpdateHint) => {
            "Kopiert das neueste kompilierte medoc auf diesem Mac in das USB-Kit und Applications. Zuerst kompilieren (npm + cargo). Löscht keine Daten."
        }
        (Locale::Fr, Msg::UpdateHint) => {
            "Copie le dernier medoc compilé sur ce Mac vers le kit USB et Applications. Compilez d'abord (npm + cargo). Ne supprime pas les données."
        }
        (Locale::Ar, Msg::UpdateHint) => {
            "ينسخ أحدث medoc مُجمَّع على هذا الجهاز إلى مجموعة USB وApplications. جمّع أولاً (npm + cargo). لا يحذف البيانات."
        }
        (_, Msg::UpdateHint) => {
            "Copies the newest compiled medoc on this Mac into the USB kit and Applications. Compile first (npm + cargo). Does not wipe data."
        }

        (Locale::De, Msg::OpenMedoc) => "MeDoc öffnen",
        (Locale::Fr, Msg::OpenMedoc) => "Ouvrir MeDoc",
        (Locale::Ar, Msg::OpenMedoc) => "فتح MeDoc",
        (_, Msg::OpenMedoc) => "Open MeDoc",

        (Locale::De, Msg::OpenHint) => {
            "MeDoc hier öffnen — startet ohne Terminal. Finder kann eine unsignierte USB-App nicht so starten."
        }
        (Locale::Fr, Msg::OpenHint) => {
            "Ouvrez MeDoc ici — démarrage sans Terminal. Le Finder ne peut pas lancer une app USB non signée ainsi."
        }
        (Locale::Ar, Msg::OpenHint) => {
            "افتح MeDoc من هنا — يبدأ بدون Terminal. لا يستطيع Finder تشغيل تطبيق USB غير موقّع بهذه الطريقة."
        }
        (_, Msg::OpenHint) => {
            "Use Open MeDoc in this window — that starts MeDoc with nohup and no Terminal. Finder cannot do that for an unsigned USB app."
        }

        (Locale::De, Msg::Wipe) => "Alles auf diesem Mac löschen",
        (Locale::Fr, Msg::Wipe) => "Tout supprimer sur ce Mac",
        (Locale::Ar, Msg::Wipe) => "حذف كل شيء على هذا الجهاز",
        (_, Msg::Wipe) => "Delete everything on this Mac",

        (Locale::De, Msg::WipeConfirm) => "Löschen bestätigen",
        (Locale::Fr, Msg::WipeConfirm) => "Confirmer la suppression",
        (Locale::Ar, Msg::WipeConfirm) => "تأكيد الحذف",
        (_, Msg::WipeConfirm) => "Confirm delete",

        (Locale::De, Msg::Cancel) => "Abbrechen",
        (Locale::Fr, Msg::Cancel) => "Annuler",
        (Locale::Ar, Msg::Cancel) => "إلغاء",
        (_, Msg::Cancel) => "Cancel",

        (Locale::De, Msg::DeleteCancelled) => "Löschen abgebrochen.",
        (Locale::Fr, Msg::DeleteCancelled) => "Suppression annulée.",
        (Locale::Ar, Msg::DeleteCancelled) => "تم إلغاء الحذف.",
        (_, Msg::DeleteCancelled) => "Delete cancelled.",

        (Locale::De, Msg::LicenseHeading) => "Lizenzschlüssel",
        (Locale::Fr, Msg::LicenseHeading) => "Clé de licence",
        (Locale::Ar, Msg::LicenseHeading) => "مفتاح الترخيص",
        (_, Msg::LicenseHeading) => "License key",

        (Locale::De, Msg::LicenseHint) => {
            "Aktiviert MeDoc auf diesem Mac (Cluster + LAN). MeDoc zuerst schließen, falls geöffnet."
        }
        (Locale::Fr, Msg::LicenseHint) => {
            "Active MeDoc sur ce Mac (cluster + LAN). Fermez MeDoc d'abord s'il est ouvert."
        }
        (Locale::Ar, Msg::LicenseHint) => {
            "يفعّل MeDoc على هذا الجهاز (المجموعة + الشبكة المحلية). أغلق MeDoc أولاً إن كان مفتوحًا."
        }
        (_, Msg::LicenseHint) => {
            "Activates MeDoc on this Mac (cluster + LAN). Close MeDoc first if it is open."
        }

        (Locale::De, Msg::ActivateLicense) => "Lizenz auf diesem Mac aktivieren",
        (Locale::Fr, Msg::ActivateLicense) => "Activer la licence sur ce Mac",
        (Locale::Ar, Msg::ActivateLicense) => "تفعيل الترخيص على هذا الجهاز",
        (_, Msg::ActivateLicense) => "Activate license on this Mac",

        (Locale::De, Msg::LicenseKeyHint) => "Lizenzschlüssel erscheint hier",
        (Locale::Fr, Msg::LicenseKeyHint) => "La clé de licence apparaît ici",
        (Locale::Ar, Msg::LicenseKeyHint) => "يظهر مفتاح الترخيص هنا",
        (_, Msg::LicenseKeyHint) => "License key appears here",

        (Locale::De, Msg::CopyLicense) => "Lizenzschlüssel kopieren",
        (Locale::Fr, Msg::CopyLicense) => "Copier la clé de licence",
        (Locale::Ar, Msg::CopyLicense) => "نسخ مفتاح الترخيص",
        (_, Msg::CopyLicense) => "Copy license key",

        (Locale::De, Msg::Copied) => "In die Zwischenablage kopiert.",
        (Locale::Fr, Msg::Copied) => "Copié dans le presse-papiers.",
        (Locale::Ar, Msg::Copied) => "تم النسخ إلى الحافظة.",
        (_, Msg::Copied) => "Copied to clipboard.",

        (Locale::De, Msg::ShortPassword) => "Passwort mindestens 4 Zeichen.",
        (Locale::Fr, Msg::ShortPassword) => "Mot de passe d'au moins 4 caractères.",
        (Locale::Ar, Msg::ShortPassword) => "كلمة المرور 4 أحرف على الأقل.",
        (_, Msg::ShortPassword) => "Choose a password of at least 4 characters.",
    }
}

pub fn role_label(locale: Locale, idx: usize) -> &'static str {
    match idx {
        0 => t(locale, Msg::RoleNext),
        1 => t(locale, Msg::RoleMaster),
        2 => t(locale, Msg::RoleReplica),
        3 => t(locale, Msg::RoleServer),
        4 => t(locale, Msg::RoleLan),
        _ => t(locale, Msg::RoleMaster),
    }
}
