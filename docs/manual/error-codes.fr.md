# Manuel des codes d'erreur MeDoc

> Généré — ne pas modifier. Exécuter `node scripts/generate-manuals.mjs`.

Chaque message d'erreur affiche un code comme MD-PAY-004. Recherchez-le ici pour connaître la cause et la solution. Les codes ne changent jamais d'une version à l'autre.

## Droits d’accès

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-APP-055` | Ces données appartiennent à un autre dentiste, qui ne vous a pas autorisé à les modifier. | Action bloquée | Votre rôle n'a pas l'autorisation pour cette action. | Demandez à un médecin ou à l'administrateur de l'effectuer ou de vous accorder l'autorisation. |
| `MD-APP-042` | Vous ne pouvez modifier que vos propres rendez-vous. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Général

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-APP-001` | Conflit : … | Action de votre part | La modification entre en conflit avec des données existantes (doublon ou édition concurrente). | Utilisez une autre valeur, ou rechargez et appliquez à nouveau la modification. |
| `MD-APP-002` | Les données n'ont pas pu être enregistrées ou chargées (référence …). Réessayez ; si le problème persiste, contactez le support avec cette référence. | Problème système · Réessayer peut aider | Un problème technique inattendu s'est produit sur cet appareil ou le serveur. | Réessayez une fois. Si cela se répète, notez le code et la référence et contactez le support (Aide → Erreurs récentes → Copier). |
| `MD-APP-015` | Cette fonction est désactivée pour ce cabinet (…). | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-APP-003` | Accès refusé. | Action bloquée | Votre rôle n'a pas l'autorisation pour cette action. | Demandez à un médecin ou à l'administrateur de l'effectuer ou de vous accorder l'autorisation. |
| `MD-APP-004` | Une erreur interne inattendue s'est produite (référence …). | Problème système · Réessayer peut aider | Un problème technique inattendu s'est produit sur cet appareil ou le serveur. | Réessayez une fois. Si cela se répète, notez le code et la référence et contactez le support (Aide → Erreurs récentes → Copier). |
| `MD-APP-005` | Le serveur du cabinet est injoignable. Vérifiez la connexion réseau. | Action bloquée · Réessayer peut aider | Cet appareil ne parvient pas à joindre l'hôte du cabinet ou le serveur LAN. | Vérifiez le Wi-Fi/LAN, assurez-vous que l'hôte fonctionne, puis réessayez. Paramètres → Réseau affiche la connexion. |
| `MD-APP-006` | … introuvable. | Action de votre part | L'élément n'existe plus ou a été supprimé sur un autre appareil. | Actualisez la liste (Ctrl/⌘ R) et rouvrez l'élément. |
| `MD-APP-007` | Cet appareil est hors ligne. Les modifications seront envoyées une fois la connexion rétablie. | Action bloquée · Réessayer peut aider | Cet appareil ne parvient pas à joindre l'hôte du cabinet ou le serveur LAN. | Vérifiez le Wi-Fi/LAN, assurez-vous que l'hôte fonctionne, puis réessayez. Paramètres → Réseau affiche la connexion. |
| `MD-APP-008` | Trop de tentatives — veuillez patienter … secondes. | Action bloquée | Connexion ou vérification à deux facteurs requise ou échouée. | Reconnectez-vous ; si vous êtes bloqué, attendez le délai indiqué ou contactez l'administrateur. |
| `MD-APP-009` | Le serveur a mis trop de temps à répondre. Veuillez réessayer. | Action bloquée · Réessayer peut aider | Cet appareil ne parvient pas à joindre l'hôte du cabinet ou le serveur LAN. | Vérifiez le Wi-Fi/LAN, assurez-vous que l'hôte fonctionne, puis réessayez. Paramètres → Réseau affiche la connexion. |
| `MD-APP-010` | Configuration à deux facteurs requise. | Action bloquée | Connexion ou vérification à deux facteurs requise ou échouée. | Reconnectez-vous ; si vous êtes bloqué, attendez le délai indiqué ou contactez l'administrateur. |
| `MD-APP-011` | Code à deux facteurs requis. | Action bloquée | Connexion ou vérification à deux facteurs requise ou échouée. | Reconnectez-vous ; si vous êtes bloqué, attendez le délai indiqué ou contactez l'administrateur. |
| `MD-APP-012` | Non autorisé. | Action bloquée | Connexion ou vérification à deux facteurs requise ou échouée. | Reconnectez-vous ; si vous êtes bloqué, attendez le délai indiqué ou contactez l'administrateur. |
| `MD-APP-013` | Une erreur s'est produite. | Problème système · Réessayer peut aider | Un problème technique inattendu s'est produit sur cet appareil ou le serveur. | Réessayez une fois. Si cela se répète, notez le code et la référence et contactez le support (Aide → Erreurs récentes → Copier). |
| `MD-APP-014` | … | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-100` | Le port LAN … est utilisé (autre instance MeDoc). Aucun second service LAN n'est lancé. | Action de votre part | La modification entre en conflit avec des données existantes (doublon ou édition concurrente). | Utilisez une autre valeur, ou rechargez et appliquez à nouveau la modification. |
| `MD-APP-101` | Le serveur LAN est déjà en marche. | Action de votre part | La modification entre en conflit avec des données existantes (doublon ou édition concurrente). | Utilisez une autre valeur, ou rechargez et appliquez à nouveau la modification. |
| `MD-APP-132` | MeDoc Dentist is already running (database in use). Open the existing window instead of starting a second copy. _(contrôle technique, affiché en anglais)_ | Action de votre part | La modification entre en conflit avec des données existantes (doublon ou édition concurrente). | Utilisez une autre valeur, ou rechargez et appliquez à nouveau la modification. |
| `MD-APP-133` | remote commands are not available yet _(contrôle technique, affiché en anglais)_ | Action de votre part | La modification entre en conflit avec des données existantes (doublon ou édition concurrente). | Utilisez une autre valeur, ou rechargez et appliquez à nouveau la modification. |
| `MD-APP-103` | Le cabinet a déjà des comptes. | Action de votre part | La modification entre en conflit avec des données existantes (doublon ou édition concurrente). | Utilisez une autre valeur, ou rechargez et appliquez à nouveau la modification. |
| `MD-APP-104` | … doit être supérieur ou égal à zéro. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-129` | … must be hex _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-APP-134` | …: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-APP-130` | cache name not allowed: … _(contrôle technique, affiché en anglais)_ | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-105` | CSV header must contain at least 'name' and 'date_of_birth' _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-APP-106` | CSV header: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-APP-107` | La base de données est verrouillée — saisissez la phrase secrète. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-109` | Invalid bind_addr/http_port combination. _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-APP-110` | Identifiant invalide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-135` | Bloc de numéros invalide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-111` | Invalid provider token (expected pm_ or tok_ prefix) _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-APP-141` | invalid sequence _(contrôle technique, affiché en anglais)_ | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-112` | Keyring account already in use: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-APP-113` | LAN config: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-APP-136` | missing argument … _(contrôle technique, affiché en anglais)_ | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-114` | Nom et e-mail valide requis. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-115` | Aucun programme de numérisation compatible (p. ex. simple-scan). Installez-en un ou déposez les fichiers dans le dossier surveillé. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-137` | Ce n'est pas un fichier support MeDoc, ou pas pour cette clé. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-138` | Le bloc de numéros doit avoir un appareil détenteur. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-131` | offline cache not allowed: … _(contrôle technique, affiché en anglais)_ | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-117` | Le chemin n'a pas de nom de fichier. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-118` | Le chemin est hors du dossier autorisé. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-119` | Le chemin ne doit pas contenir « .. ». | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-120` | Path: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-APP-121` | Le port doit être supérieur à 0. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-122` | Le préfixe doit compter 1 à 16 lettres ou chiffres. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-139` | Des enregistrements de … n'ont pas de propriétaire. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-123` | Root path: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-APP-124` | settingsJson: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-APP-125` | Le scanner système n'est pas pris en charge sur cette plateforme. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-126` | The password must have at least … characters. _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-APP-140` | this record names no dentist _(contrôle technique, affiché en anglais)_ | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-127` | ui-prefs JSON: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-APP-128` | Format de numéro inconnu : … | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Rendez-vous

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-APT-100` | Un nouveau rendez-vous commence comme Planifié ou Confirmé. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APT-101` | Praticien introuvable sur cet appareil. Connectez-vous avec un compte local ou attendez la synchronisation des comptes depuis l'appareil principal. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APT-102` | Le commentaire ne doit pas être vide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APT-103` | Date range must be 0-… days _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-APT-104` | La durée doit être comprise entre 5 et 720 minutes. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APT-105` | Patient introuvable. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APT-106` | Le motif du renvoi à l'accueil est requis. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APT-107` | Note courte ou lien de paiement requis. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APT-108` | Unknown task type: … (allowed: {}) _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |

## Pièces jointes

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-ATT-001` | Le type de document ne doit pas être vide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-ATT-002` | Fichier trop volumineux (max. 50 Mo). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-ATT-003` | Ce type de fichier n'est pas pris en charge. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-ATT-004` | La désignation ne doit pas être vide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Journal d'audit

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-AUD-100` | La chaîne d'audit est intacte — aucune confirmation nécessaire. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-AUD-101` | patient_id missing _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |

## Connexion et double authentification

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-AUTH-001` | Aucun ID de session appareil | Action bloquée | Connexion ou vérification à deux facteurs requise ou échouée. | Reconnectez-vous ; si vous êtes bloqué, attendez le délai indiqué ou contactez l'administrateur. |
| `MD-AUTH-002` | Code invalide — veuillez réessayer | Action bloquée | Connexion ou vérification à deux facteurs requise ou échouée. | Reconnectez-vous ; si vous êtes bloqué, attendez le délai indiqué ou contactez l'administrateur. |
| `MD-AUTH-003` | L'authentification à deux facteurs est facultative pour ce rôle — configurez-la après la connexion | Action bloquée | Connexion ou vérification à deux facteurs requise ou échouée. | Reconnectez-vous ; si vous êtes bloqué, attendez le délai indiqué ou contactez l'administrateur. |
| `MD-AUTH-004` | Veuillez d'abord lancer la configuration | Action bloquée | Connexion ou vérification à deux facteurs requise ou échouée. | Reconnectez-vous ; si vous êtes bloqué, attendez le délai indiqué ou contactez l'administrateur. |

## Sauvegarde et restauration

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-BAK-006` | Une autre opération de sauvegarde est en cours. Réessayez dans un instant. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-BAK-007` | La sauvegarde n'a pas pu être compressée et chiffrée (référence …). | Problème système · Réessayer peut aider | Un problème technique inattendu s'est produit sur cet appareil ou le serveur. | Réessayez une fois. Si cela se répète, notez le code et la référence et contactez le support (Aide → Erreurs récentes → Copier). |
| `MD-BAK-008` | Cette sauvegarde ne s'ouvre pas avec la clé de ce cabinet. Elle appartient à un autre cabinet ou a été modifiée. | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-BAK-009` | La sauvegarde n'a pas pu être supprimée (référence …). | Problème système · Réessayer peut aider | Un problème technique inattendu s'est produit sur cet appareil ou le serveur. | Réessayez une fois. Si cela se répète, notez le code et la référence et contactez le support (Aide → Erreurs récentes → Copier). |
| `MD-BAK-010` | Le disque est plein : la sauvegarde n'a pas pu être écrite. Libérez de l'espace et réessayez (référence …). | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-BAK-001` | Fichier de sauvegarde introuvable. | Action de votre part | L'élément n'existe plus ou a été supprimé sur un autre appareil. | Actualisez la liste (Ctrl/⌘ R) et rouvrez l'élément. |
| `MD-BAK-024` | Choisissez un chemin de dossier complet. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-BAK-025` | MeDoc ne peut pas écrire dans ce dossier. Vérifiez que le disque est branché et pas en lecture seule. | Action bloquée | Votre rôle n'a pas l'autorisation pour cette action. | Demandez à un médecin ou à l'administrateur de l'effectuer ou de vous accorder l'autorisation. |
| `MD-BAK-011` | Le dossier de sauvegarde ne peut pas être ouvert ou créé (référence …). | Problème système · Réessayer peut aider | Un problème technique inattendu s'est produit sur cet appareil ou le serveur. | Réessayez une fois. Si cela se répète, notez le code et la référence et contactez le support (Aide → Erreurs récentes → Copier). |
| `MD-BAK-002` | Le fichier restauré n'est pas une base MeDoc valide. | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-BAK-003` | Le fichier n'est pas une sauvegarde SQLite valide (pas de signature, en-tête invalide). | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-BAK-012` | C'est la dernière sauvegarde : elle ne peut pas être supprimée. Utilisez « Supprimer et recommencer » pour la remplacer. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-BAK-013` | La clé du cabinet n'a pas pu être chargée : les sauvegardes ne peuvent être ni scellées ni ouvertes (référence …). | Problème système · Réessayer peut aider | Un problème technique inattendu s'est produit sur cet appareil ou le serveur. | Réessayez une fois. Si cela se répète, notez le code et la référence et contactez le support (Aide → Erreurs récentes → Copier). |
| `MD-BAK-014` | MeDoc n'a pas le droit d'écrire dans le dossier de sauvegarde. Vérifiez les droits du dossier (référence …). | Action bloquée | Votre rôle n'a pas l'autorisation pour cette action. | Demandez à un médecin ou à l'administrateur de l'effectuer ou de vous accorder l'autorisation. |
| `MD-BAK-015` | Ce fichier n'est pas une sauvegarde MeDoc. | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-BAK-004` | Seuls les fichiers .db peuvent être restaurés. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-BAK-016` | Seules les sauvegardes du dossier de sauvegarde MeDoc peuvent être supprimées. | Action bloquée | Votre rôle n'a pas l'autorisation pour cette action. | Demandez à un médecin ou à l'administrateur de l'effectuer ou de vous accorder l'autorisation. |
| `MD-BAK-017` | Le fichier de sauvegarde n'a pas pu être lu (référence …). | Problème système · Réessayer peut aider | Un problème technique inattendu s'est produit sur cet appareil ou le serveur. | Réessayez une fois. Si cela se répète, notez le code et la référence et contactez le support (Aide → Erreurs récentes → Copier). |
| `MD-BAK-018` | Indiquez un motif (au moins 3 caractères). Il est conservé dans le journal d'audit. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-BAK-019` | La restauration n'a pas pu remplacer la base. Les données actuelles sont conservées (référence …). | Problème système · Réessayer peut aider | Un problème technique inattendu s'est produit sur cet appareil ou le serveur. | Réessayez une fois. Si cela se répète, notez le code et la référence et contactez le support (Aide → Erreurs récentes → Copier). |
| `MD-BAK-020` | Restauration annulée : la sauvegarde de sécurité des données actuelles a échoué. Rien n'a été modifié (référence …). | Problème système · Réessayer peut aider | Un problème technique inattendu s'est produit sur cet appareil ou le serveur. | Réessayez une fois. Si cela se répète, notez le code et la référence et contactez le support (Aide → Erreurs récentes → Copier). |
| `MD-BAK-005` | Signature de sauvegarde invalide — restauration annulée. | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-BAK-021` | La copie de la base pour la sauvegarde a échoué (référence …). | Problème système · Réessayer peut aider | Un problème technique inattendu s'est produit sur cet appareil ou le serveur. | Réessayez une fois. Si cela se répète, notez le code et la référence et contactez le support (Aide → Erreurs récentes → Copier). |
| `MD-BAK-022` | La sauvegarde n'a pas pu être décompressée (référence …). | Problème système · Réessayer peut aider | Un problème technique inattendu s'est produit sur cet appareil ou le serveur. | Réessayez une fois. Si cela se répète, notez le code et la référence et contactez le support (Aide → Erreurs récentes → Copier). |
| `MD-BAK-023` | Le fichier de sauvegarde n'a pas pu être écrit (référence …). | Problème système · Réessayer peut aider | Un problème technique inattendu s'est produit sur cet appareil ou le serveur. | Réessayez une fois. Si cela se répète, notez le code et la référence et contactez le support (Aide → Erreurs récentes → Copier). |
| `MD-BAK-100` | audit json: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-BAK-101` | audit missing: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-BAK-102` | ciphertext: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-BAK-103` | invalid nonce length _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-BAK-104` | invalid password verifier _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-BAK-105` | json: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-BAK-106` | nonce: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-BAK-107` | salt: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-BAK-108` | vault json: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-BAK-109` | vault missing: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-BAK-110` | verifier key: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-BAK-111` | verifier salt: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-BAK-112` | Mot de passe du kit USB incorrect. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Validation de facturation

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-BIL-001` | … n'est pas encore libéré pour la facturation. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |

## Plantage d'écran

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-BND-001` | L'écran s'est arrêté de façon inattendue. | Problème système · Réessayer peut aider | Un problème technique inattendu s'est produit sur cet appareil ou le serveur. | Réessayez une fois. Si cela se répète, notez le code et la référence et contactez le support (Aide → Erreurs récentes → Copier). |

## Accès d'urgence

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-BRG-001` | La justification doit comporter au moins 10 caractères. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Livre de caisse

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-APP-016` | Ce mouvement de caisse a déjà été annulé. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-APP-017` | Veuillez saisir un montant supérieur à 0. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-018` | Type de mouvement de caisse inconnu. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-019` | Les écritures de caisse comptabilisées ne peuvent être ni modifiées ni supprimées. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-020` | Veuillez indiquer un motif. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-021` | Les dépenses en espèces nécessitent un numéro de justificatif. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Certificats

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-CRT-100` | date_from: YYYY-MM-DD _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CRT-101` | date_to must not be before date_from _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CRT-102` | date_to: YYYY-MM-DD _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CRT-103` | Le document est requis. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-CRT-104` | La date de fin ne doit pas précéder la date de début. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Dossier patient

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-CHT-001` | Le message ne doit pas être vide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-CHT-002` | Pas un médecin : … | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-CHT-003` | Veuillez sélectionner au moins un médecin. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-CHT-004` | La cible doit être un médecin. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-CHT-005` | Médecin inconnu : … | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-CHT-100` | Un paiement a déjà commencé pour cette ligne ; créez plutôt une correction. | Action de votre part | La modification entre en conflit avec des données existantes (doublon ou édition concurrente). | Utilisez une autre valeur, ou rechargez et appliquez à nouveau la modification. |
| `MD-CHT-101` | Invalid Base64 data. _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CHT-103` | invalid patient list tab _(contrôle technique, affiché en anglais)_ | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-CHT-102` | Filtre de statut patient invalide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Réseau du cabinet (cluster)

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-CLU-001` | Phrase secrète requise. | Action bloquée · Réessayer peut aider | Cet appareil ne parvient pas à joindre l'hôte du cabinet ou le serveur LAN. | Vérifiez le Wi-Fi/LAN, assurez-vous que l'hôte fonctionne, puis réessayez. Paramètres → Réseau affiche la connexion. |
| `MD-CLU-100` | Cet appareil est déjà appairé. Révoquez-le sur l'appareil principal avant de l'appairer à nouveau. | Action de votre part | La modification entre en conflit avec des données existantes (doublon ou édition concurrente). | Utilisez une autre valeur, ou rechargez et appliquez à nouveau la modification. |
| `MD-CLU-101` | Activation manifest version {} not supported _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-102` | admin endpoint kv: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-103` | Hôte et port de l'administrateur requis. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-CLU-104` | Ciphertext: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-105` | La clé du réseau du cabinet ne correspond pas à la clé publiée. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-CLU-106` | Cluster full: maximum {} devices _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-107` | cluster_ca_pubkey length invalid _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-108` | cluster_ca_pubkey: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-109` | cluster_id length {} (expected 16) _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-110` | cluster_id: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-111` | La phrase de confirmation ne correspond pas. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-CLU-112` | Échec du déchiffrement (phrase secrète erronée ou fichier modifié). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-CLU-113` | deployment json: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-114` | Appareil déjà configuré (une seule fois). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-CLU-115` | La clé de l'appareil ne correspond pas à la clé publiée. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-CLU-116` | Device key signature verification failed _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-117` | device secret hex: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-118` | device secret utf8: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-119` | device_pubkey invalid: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-120` | device_pubkey length invalid _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-121` | device_pubkey must be 32 bytes _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-122` | device_pubkey: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-123` | handshake transcript base64: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-124` | Handshake transcript missing. The joining device must send a new join request, then accept it again. _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-125` | join lan auth kv: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-126` | KDF salt: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-127` | Aucune réinitialisation en attente. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-CLU-128` | Adresse de l'appareil principal invalide — rejoignez à nouveau le réseau. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-CLU-129` | Manifest {} not readable: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-130` | Manifest JSON invalid: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-131` | MEDOC_CLUSTER_DEVICE_SECRET must be 64 hex chars _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-132` | No ADMIN seat available (max {}). Request again as MEMBER. _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-133` | Aucun réseau de cabinet. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-CLU-134` | Aucun réseau de cabinet activé. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-CLU-135` | Aucun appareil principal enregistré — rejoignez à nouveau le réseau. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-CLU-136` | No MEMBER seat available (max {}) _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-137` | Aucun compte reçu de l'appareil principal — il doit être connecté. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-CLU-138` | Nonce: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-139` | Le réseau du cabinet exige une licence active (titulaire) ou licence/configuration (membre). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-CLU-140` | provisioning json: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-141` | Provisioning-Settings: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-142` | Remplacement : ancienne et nouvelle empreinte identiques. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-CLU-143` | Reset mode must be network_only or full_wipe. _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-144` | Reset token invalid: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-145` | Reset token is for a different cluster _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-146` | Reset token signature invalid _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-147` | Reset token signed by an unknown cluster key _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-148` | SAS does not match _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-149` | SAS must be 4 digits _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-150` | Seat certificate decode: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-151` | Seat certificate JSON: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-152` | Seat certificate: expected prefix `…` _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-153` | Seat certificate: missing separator _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-154` | Session not ready for SAS _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-155` | sidecar json: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-156` | Staff directory invalid: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-157` | Version de l'annuaire du personnel non prise en charge. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-CLU-158` | L'appareil principal n'a pas encore accepté cette demande. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-CLU-159` | L'appareil principal est injoignable. Démarrez-le puis réessayez. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-CLU-160` | Too many wrong SAS entries. Accept the request again on the main device. _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-161` | Unexpected KDF algorithm _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-CLU-162` | Unexpected plaintext length {} (expected 160) _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |

## Clôture journalière

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-DCL-001` | Cette journée est déjà clôturée. Saisissez une correction pour la modifier. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-DCL-002` | Montant invalide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-DCL-003` | Date invalide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-DCL-004` | Coupure ou quantité invalide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-DCL-005` | Une correction nécessite un motif. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-DCL-006` | Le montant compté et les coupures ne correspondent pas. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-DCL-007` | La caisse doit être comptée pour clôturer la journée. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-DCL-008` | Une journée future ne peut pas être clôturée. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-DCL-009` | Une clôture enregistrée est définitive. Veuillez saisir une correction. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-DCL-010` | Une clôture du {…} existe déjà. Les jours antérieurs ne peuvent plus être clôturés. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-DCL-011` | Aucun rapport de caisse pour cette clôture (ancienne entrée). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-DCL-012` | Cette clôture a déjà été corrigée. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-DCL-013` | Seule la dernière clôture peut être corrigée. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-DCL-014` | Le rapport de caisse est créé lors de la clôture journalière. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-DCL-015` | Un écart nécessite un motif. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Appareil principal et répliques

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-APP-047` | Cette installation est endommagée : ses composants appartiennent à des éditions différentes de MeDoc. Réinstallez MeDoc. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-043` | Une connexion à l'appareil principal est nécessaire. Déconnectez-vous puis reconnectez-vous quand il est joignable. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-044` | Cette action n'est possible que sur l'appareil principal. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-045` | L'appareil principal est injoignable. Vérifiez qu'il est allumé et sur le même réseau. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-048` | Cette édition fonctionne sur un seul ordinateur et n'a pas de réseau de cabinet. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-046` | L'application réplique rejoint un cabinet existant ; elle ne peut pas en créer. Utilisez l'application principale. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |

## Sessions d'appareils

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-DEV-001` | La session actuelle ne peut pas être terminée ici — veuillez vous déconnecter. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-DEV-002` | La session actuelle est déjà de confiance. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |

## Documents et PDF

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-DOC-100` | layout must be a JSON object _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-DOC-101` | PDF-Layout: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-DOC-102` | Template JSON: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |

## Documents et PDF

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-APP-022` | Les stupéfiants doivent être prescrits sur le formulaire officiel BtM. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-023` | Veuillez indiquer un motif d'annulation. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-024` | Les ordonnances de l'assurance maladie obligatoire sont émises en e-ordonnance via la télématique, pas en PDF. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-025` | Les documents émis ne peuvent être ni modifiés ni supprimés. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-026` | Les documents officiels ne peuvent être émis que sur l'appareil principal (MASTER). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-027` | Un document groupé ne peut contenir que les éléments d'un seul patient. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-028` | Ce document ne peut pas être annulé (déjà annulé ou pas une facture). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-029` | Données du cabinet incomplètes : le nom et l'adresse du cabinet manquent (Paramètres → Cabinet). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-030` | Un reçu ne peut être émis que pour un paiement réglé. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-031` | La réimpression n'est pas disponible pour ce type de document. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-032` | Exemplaire inconnu. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-033` | Type de document inconnu. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-034` | Le document contient des caractères qui ne peuvent pas être imprimés correctement dans le PDF (p. ex. écriture arabe ou cyrillique). Vérifiez l'orthographe. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Export

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-EXP-001` | Le dossier cible doit être un chemin absolu. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-EXP-004` | Le dossier cible est en dehors du dossier d'export autorisé. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-EXP-002` | Données d'export invalides (Base64). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-EXP-003` | Nom de fichier invalide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-EXP-100` | error reports to the MeDoc server are not available yet _(contrôle technique, affiché en anglais)_ | Action de votre part | La modification entre en conflit avec des données existantes (doublon ou édition concurrente). | Utilisez une autre valeur, ou rechargez et appliquez à nouveau la modification. |

## Fonctions désactivées

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-FEA-100` | Cette fonction est désactivée pour ce cabinet (Imagerie DICOM). | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-FEA-101` | Cette fonction est désactivée pour ce cabinet (e-ordonnance). | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-FEA-102` | Cette fonction est désactivée pour ce cabinet (Interface GDT). | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-FEA-103` | Cette fonction est désactivée pour ce cabinet (Scanner). | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |

## Protection des données (RGPD)

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-APP-035` | Effacement impossible : la durée légale de conservation court jusqu'au {…} (§ 630f BGB, § 147 AO). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Compte invité

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-APP-054` | Ce cabinet a déjà le nombre maximal de comptes : le compte invité ne peut pas être ajouté. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-049` | Seul l'invité envoie des propositions ; l'administrateur enregistre directement. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-050` | Cette proposition a déjà été ajoutée ou refusée. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-APP-051` | Le compte invité est désactivé. Demandez à l'administrateur. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-052` | L'invité ne peut pas proposer cette modification. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-057` | L'invité ne peut pas créer de commandes. Confirmez seulement les livraisons, ou demandez à l'administrateur. | Action bloquée | Votre rôle n'a pas l'autorisation pour cette action. | Demandez à un médecin ou à l'administrateur de l'effectuer ou de vous accorder l'autorisation. |
| `MD-APP-053` | Définissez un mot de passe pour le compte invité. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Historique

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-APP-058` | Ce type d'enregistrement n'a pas d'historique. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Stock et commandes

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-INVT-100` | Article requis. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INVT-101` | La quantité doit être positive. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INVT-102` | Le stock doit être supérieur ou égal à zéro. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INVT-103` | Fournisseur requis. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INVT-104` | Montant total invalide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INVT-105` | Statut inconnu : … | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Factures

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-INV-001` | « {…} » figure déjà sur la facture {…}. Annulez-la d'abord. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-INV-002` | La prestation n'appartient pas à ce patient. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-003` | Une facture d'annulation doit citer la facture d'origine. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-004` | La date de facture est manquante ou invalide (AAAA-MM-JJ). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-005` | Seules les anciennes entrées sans numéro de registre peuvent être importées. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-006` | Poste … : le montant doit être supérieur à 0. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-007` | Poste … : le montant ne correspond pas aux points × valeur du point × coefficient. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-008` | Poste … : la facturation analogique n'est admise que pour le GOZ. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-009` | Poste … : une ligne d'annulation doit être négative. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-010` | Poste … : la date de la prestation est manquante. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-011` | Poste … : la description de la prestation est manquante. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-012` | Poste … : le coefficient … au-dessus de 3,5 exige un accord écrit. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-013` | Poste … : un coefficient inférieur à 1,0 n'est pas admis. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-014` | Poste … : le coefficient est manquant. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-015` | Poste … : le coefficient … au-dessus de 2,3 exige une justification écrite. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-016` | Poste … : le numéro d'honoraire est manquant. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-017` | Poste … : le nombre de points est manquant. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-018` | Poste … : un débours supérieur à 25,56 EUR exige le justificatif. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-028` | L'ICE du cabinet manque. Une facture marocaine doit l'indiquer — ajoutez-le dans Paramètres → Cabinet → Données de facturation. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-029` | L'identifiant fiscal (IF) du cabinet manque. Une facture marocaine doit l'indiquer — ajoutez-le dans Paramètres → Cabinet → Données de facturation. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-019` | La facture ne contient aucune prestation. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-020` | « {…} » n'a pas encore été validé pour facturation. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-INV-021` | Le numéro de facture est manquant. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-022` | Le nom et la date de naissance de la personne traitée sont manquants. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-023` | Le nom et l'adresse du cabinet sont manquants. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-024` | Le nom et l'adresse du destinataire sont manquants. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-025` | Une ligne taxable exige un numéro fiscal ou un n° de TVA. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-026` | La facture contient des caractères que le PDF ne peut pas imprimer. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-027` | La mention d'exonération de TVA est manquante. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-100` | Document déjà annulé. | Action de votre part | La modification entre en conflit avec des données existantes (doublon ou édition concurrente). | Utilisez une autre valeur, ou rechargez et appliquez à nouveau la modification. |
| `MD-APP-108` | La date doit être au format AAAA-MM-JJ. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-101` | id and patient_id are required _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-INV-102` | Intervalle invalide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-103` | Libellé requis. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-104` | Message trop court (10 caractères min.). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-105` | Période requise. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-106` | Objet trop court (3 caractères min.). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-INV-107` | Catégorie inconnue : … | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Connexion LAN

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-LAN-001` | Client LAN : la commande « … » n'est pas disponible sur le serveur API — utilisez l'application bureau Practice Host. | Action bloquée · Réessayer peut aider | Cet appareil ne parvient pas à joindre l'hôte du cabinet ou le serveur LAN. | Vérifiez le Wi-Fi/LAN, assurez-vous que l'hôte fonctionne, puis réessayez. Paramètres → Réseau affiche la connexion. |
| `MD-LAN-002` | Configuration client LAN incomplète (URL de base ou jeton manquant). | Action bloquée · Réessayer peut aider | Cet appareil ne parvient pas à joindre l'hôte du cabinet ou le serveur LAN. | Vérifiez le Wi-Fi/LAN, assurez-vous que l'hôte fonctionne, puis réessayez. Paramètres → Réseau affiche la connexion. |
| `MD-LAN-003` | Configuration client LAN incomplète (URL de base manquante). | Action bloquée · Réessayer peut aider | Cet appareil ne parvient pas à joindre l'hôte du cabinet ou le serveur LAN. | Vérifiez le Wi-Fi/LAN, assurez-vous que l'hôte fonctionne, puis réessayez. Paramètres → Réseau affiche la connexion. |
| `MD-LAN-004` | LAN HTTP … : … | Action bloquée · Réessayer peut aider | Cet appareil ne parvient pas à joindre l'hôte du cabinet ou le serveur LAN. | Vérifiez le Wi-Fi/LAN, assurez-vous que l'hôte fonctionne, puis réessayez. Paramètres → Réseau affiche la connexion. |
| `MD-LAN-100` | Clé de paramètre inconnue : … | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-LAN-101` | Unknown KV key: {} _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |

## Licence

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-LIC-001` | Cette licence a été émise pour un autre ordinateur. Collez la clé émise pour cet ordinateur, ou rattachez cet ordinateur à l'appareil principal. | Action bloquée | Connexion ou vérification à deux facteurs requise ou échouée. | Reconnectez-vous ; si vous êtes bloqué, attendez le délai indiqué ou contactez l'administrateur. |
| `MD-LIC-100` | Nom de l'administrateur trop court. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-LIC-101` | Mot de passe administrateur requis (8 caractères min.). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-LIC-102` | device_id empty _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-LIC-103` | Adresse e-mail invalide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-LIC-104` | Code de licence manquant. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-LIC-105` | Appareils membres uniquement après avoir rejoint le réseau du cabinet. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-LIC-106` | Nom trop court. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-LIC-107` | Nouveau compte uniquement après avoir rejoint un cabinet existant. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-LIC-108` | Aucun compte n'existe — créez un administrateur. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-LIC-109` | Mot de passe requis (8 caractères min.). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-LIC-110` | L'offre doit être BASIC, PRO ou ENTERPRISE. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-LIC-111` | La configuration du cabinet est déjà terminée. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-LIC-112` | Configuration du cabinet uniquement sur l'appareil principal sous licence. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-LIC-113` | Registration failed (HTTP {}): {} _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-LIC-114` | Le rôle doit être Médecin ou Accueil. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-LIC-115` | Ignorer n'est autorisé que sur l'appareil principal sous licence. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-LIC-116` | URL de base du portail fournisseur manquante. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-LIC-117` | Vendor portal not configured — set base URL in settings or MEDOC_COMPANY_API_BASE. _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-LIC-118` | L'URL du portail fournisseur est vide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-LIC-119` | L'URL du portail fournisseur n'a pas d'hôte. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-LIC-120` | L'URL du portail fournisseur ne doit pas contenir d'identifiants. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-LIC-121` | L'URL du portail fournisseur doit utiliser https. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-LIC-122` | Vendor portal: API key missing (configuration or MEDOC_COMPANY_API_KEY). _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-LIC-123` | Vendor portal: practice_slug (tenant id) is missing. _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |

## Données de base

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-MST-001` | Catégorie et nom requis. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-MST-002` | Contact : nom requis. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-MST-003` | Dates de début et de fin requises. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-MST-004` | Contact invalide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-MST-005` | Produit invalide ou inactif. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-MST-006` | Fournisseur invalide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-MST-007` | Sélectionnez fournisseur, contact et produit. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-MST-008` | Fournisseur : nom requis. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-MST-009` | kind doit être PRESCRIPTION ou CERTIFICATE. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-MST-010` | Titre requis. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-MST-011` | Le type ne doit pas être vide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Notifications

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-NTF-100` | Aucun destinataire disponible pour cette notification. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-NTF-101` | Type et titre de la notification requis. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Numérotation des documents

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-APP-056` | Les numéros … de la séquence … manquent sur cet ordinateur. Aucun numéro n'est attribué avant qu'un admin les vérifie (Aide → Support). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Appairage d'appareils

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-PAR-001` | Code de confirmation expiré. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-PAR-002` | Code de confirmation incorrect. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAR-003` | ID d'appareil vide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAR-006` | Aucun appairage accepté pour cet appareil. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAR-004` | Le PIN doit comporter exactement 6 chiffres. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAR-007` | L'ordinateur principal rattrape encore les changements après un redémarrage. Réessayez dans quelques minutes. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAR-005` | Clé publique replica vide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAR-100` | Une demande d'appairage est déjà en attente pour cet appareil. | Action de votre part | La modification entre en conflit avec des données existantes (doublon ou édition concurrente). | Utilisez une autre valeur, ou rechargez et appliquez à nouveau la modification. |
| `MD-PAR-101` | La demande d'appairage attend déjà la confirmation du PIN. | Action de votre part | La modification entre en conflit avec des données existantes (doublon ou édition concurrente). | Utilisez une autre valeur, ou rechargez et appliquez à nouveau la modification. |
| `MD-PAR-102` | pairing_request already decided (status={}) _(contrôle technique, affiché en anglais)_ | Action de votre part | La modification entre en conflit avec des données existantes (doublon ou édition concurrente). | Utilisez une autre valeur, ou rechargez et appliquez à nouveau la modification. |
| `MD-PAR-103` | La demande d'appairage n'attend pas de confirmation de PIN. | Action de votre part | La modification entre en conflit avec des données existantes (doublon ou édition concurrente). | Utilisez une autre valeur, ou rechargez et appliquez à nouveau la modification. |
| `MD-PAR-104` | Activation token decode: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-PAR-105` | Activation token JSON: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-PAR-106` | Activation token version {} (expected 2) _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-PAR-107` | Activation token: expected prefix `…` _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-PAR-108` | Activation token: invalid prefix _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-PAR-109` | Activation token: missing separator _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-PAR-110` | Cluster handshake missing; send a new join request from the replica. _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-PAR-111` | Master response incomplete (pubkey/deviceId missing) _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-PAR-112` | Aucun adaptateur Bluetooth trouvé. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAR-113` | Échec de la confirmation du PIN (…) : … | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAR-114` | Trop de tentatives de PIN — soumettez une nouvelle demande. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Paiements

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-PAY-001` | Montant invalide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAY-002` | Le montant doit être supérieur à 0. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAY-013` | De l'argent a déjà été reçu pour cette écriture. Annulez-la au lieu de la supprimer. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAY-003` | Seuls les paiements en attente ou partiellement payés peuvent être supprimés. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-PAY-004` | Veuillez lier une seule cible : traitement ou examen. | Action de votre part | La modification entre en conflit avec des données existantes (doublon ou édition concurrente). | Utilisez une autre valeur, ou rechargez et appliquez à nouveau la modification. |
| `MD-PAY-005` | Seuls les paiements en attente ou partiellement payés peuvent être modifiés. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-PAY-006` | Examen introuvable ou n'appartient pas à ce patient. | Action de votre part | L'élément n'existe plus ou a été supprimé sur un autre appareil. | Actualisez la liste (Ctrl/⌘ R) et rouvrez l'élément. |
| `MD-PAY-007` | Le paiement dépasse la limite autorisée pour cet examen (max. … € incluant cette écriture). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAY-008` | Le paiement dépasse la limite autorisée pour ce traitement (max. … € incluant cette écriture). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAY-009` | Le paiement dépasse le montant ouvert pour cet examen (max. … €, payé … €, cible … €). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAY-010` | Le paiement dépasse le montant ouvert pour ce traitement (max. … €, payé … €, cible … €). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAY-011` | Un montant positif est requis pour la réservation d'un prix de prestation. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAY-014` | Le statut découle des montants. Seul « annulé » peut être défini manuellement. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-PAY-012` | Traitement introuvable ou n'appartient pas à ce patient. | Action de votre part | L'élément n'existe plus ou a été supprimé sur un autre appareil. | Actualisez la liste (Ctrl/⌘ R) et rouvrez l'élément. |
| `MD-PAY-100` | Le montant doit être positif. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAY-101` | La date limite doit être au format AAAA-MM-JJ. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAY-102` | Date limite requise. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAY-103` | Montants invalides. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAY-104` | Montant compté invalide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAY-105` | Invalid metrics _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-PAY-106` | Écart invalide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAY-107` | Devise inconnue. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Rapport de période

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-APP-036` | Période invalide (deux ans maximum). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-037` | Ce rapport n'a pas de PDF dans le registre des documents. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-038` | Seules les périodes terminées peuvent être enregistrées. L'aperçu reste disponible. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Tâches du cabinet

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-TSK-001` | Veuillez indiquer le médecin assigné. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-TSK-002` | Patient requis. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-TSK-003` | La cible doit être un médecin. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-TSK-004` | La cible doit être un membre du personnel d'accueil. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-TSK-005` | Le titre ne doit pas être vide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-TSK-100` | Le destinataire n'est pas un compte du personnel sur cet appareil. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Ordonnances

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-RXP-001` | Alerte allergie : le patient est allergique à …, et cette ordonnance contient …. Vérifiez l'anamnèse avant de l'établir. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-RXP-100` | Cette ordonnance a déjà été corrigée ; modifiez la version la plus récente. | Action de votre part | La modification entre en conflit avec des données existantes (doublon ou édition concurrente). | Utilisez une autre valeur, ou rechargez et appliquez à nouveau la modification. |
| `MD-RXP-101` | Adresse KIM invalide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-RXP-102` | Invalid KVNR format: {} _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-RXP-103` | Invalid PZN: {} _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-RXP-104` | Le LANR doit contenir 9 chiffres. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-RXP-105` | La quantité doit être comprise entre 1 et 99. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Profil

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-PRF-001` | L'e-mail ne doit pas être vide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PRF-002` | Le nom ne doit pas être vide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PRF-003` | Nom trop long (max. 120 caractères). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PRF-004` | Aucun champ soumis pour la mise à jour. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Rappels de paiement

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-APP-039` | Des frais ne sont autorisés qu'à partir de la première mise en demeure. | Action bloquée | Votre rôle n'a pas l'autorisation pour cette action. | Demandez à un médecin ou à l'administrateur de l'effectuer ou de vous accorder l'autorisation. |
| `MD-APP-040` | Le niveau suivant n'est possible qu'après l'expiration du dernier délai. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-APP-041` | Aucune relance n'est possible pour cette facture. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Scanner

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-SCN-100` | La source n'a pas de nom de fichier. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Sécurité et chiffrement

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-SEC-100` | La double authentification n'est pas active. | Action de votre part | La modification entre en conflit avec des données existantes (doublon ou édition concurrente). | Utilisez une autre valeur, ou rechargez et appliquez à nouveau la modification. |
| `MD-SEC-101` | Code d'authentification requis. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-SEC-102` | L'accès d'urgence est actuellement désactivé. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-SEC-103` | Could not open database with SQLCipher (check passphrase). _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SEC-104` | Code invalide — veuillez réessayer. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-SEC-105` | Invalid signature _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SEC-106` | Invalid signature length _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SEC-107` | Politique de mot de passe : … | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-SEC-108` | rekey: old key does not open the database _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SEC-109` | Signature missing _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SEC-110` | Signature not decodable: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SEC-111` | La double authentification est actuellement désactivée. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Paramètres

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-SET-100` | Les horaires enregistrés sont invalides. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-SET-103` | The compliance checklist is invalid _(contrôle technique, affiché en anglais)_ | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-SET-102` | The medication list is invalid _(contrôle technique, affiché en anglais)_ | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-SET-101` | Clé de paramètre inconnue : … | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Configuration

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-SUP-100` | Les phrases secrètes ne correspondent pas. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Personnel

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-STF-001` | Adresse e-mail déjà utilisée. | Action de votre part | La modification entre en conflit avec des données existantes (doublon ou édition concurrente). | Utilisez une autre valeur, ou rechargez et appliquez à nouveau la modification. |
| `MD-STF-002` | L'authentification à deux facteurs est déjà active. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-STF-003` | Code invalide — veuillez réessayer. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-STF-100` | La double authentification est déjà active. | Action de votre part | La modification entre en conflit avec des données existantes (doublon ou édition concurrente). | Utilisez une autre valeur, ou rechargez et appliquez à nouveau la modification. |
| `MD-STF-101` | {} cannot exceed "{}" for this role _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-STF-102` | … ne peut pas être accordé à ce rôle. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-STF-103` | Les droits d'accès sont gérés sur l'appareil principal. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-STF-104` | L'action ne doit pas être vide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-STF-105` | Au moins une personne active doit garder le droit de gérer les accès. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-STF-106` | L'effet doit être Autoriser ou Refuser. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-STF-107` | Ce profil d'accès est destiné à un autre rôle. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-STF-108` | Ce compte possède encore des rendez-vous ou documents cliniques. Attribuez d'abord un autre praticien, puis supprimez le compte. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-STF-116` | Cette zone ne peut pas être limitée aux propres dossiers : … | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-STF-109` | Unknown access area: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-STF-110` | Unknown access level: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-STF-111` | Profil d'accès inconnu : … | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-STF-112` | Action d'autorisation inconnue. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-STF-113` | Vous ne pouvez pas modifier vos propres droits d'accès. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-STF-114` | You cannot grant more than your own access to {} _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-STF-115` | Vous ne pouvez pas supprimer le compte avec lequel vous êtes connecté. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Synchronisation des appareils

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-SYN-001` | Une modification reçue a une signature invalide et n'a pas été appliquée. Les données ont été modifiées en chemin ou l'expéditeur n'est pas authentique. | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-002` | Des modifications sont arrivées signées par une clé que cet appareil ne connaît pas pour l'expéditeur. Associez à nouveau l'appareil. | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-003` | Cet appareil a envoyé des modifications sans signature. Mettez-le à jour vers la version actuelle, puis synchronisez à nouveau. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-SYN-004` | Synchronisation en pause : cet ordinateur et l'ordinateur principal ont des versions qui ne peuvent pas se synchroniser. Mettez à jour le plus ancien ; le travail fait entre-temps est conservé et envoyé ensuite. | Action bloquée · Réessayer peut aider | Cet appareil ne parvient pas à joindre l'hôte du cabinet ou le serveur LAN. | Vérifiez le Wi-Fi/LAN, assurez-vous que l'hôte fonctionne, puis réessayez. Paramètres → Réseau affiche la connexion. |
| `MD-SYN-100` | Le port réseau … est déjà utilisé (autre instance MeDoc). | Action de votre part | La modification entre en conflit avec des données existantes (doublon ou édition concurrente). | Utilisez une autre valeur, ou rechargez et appliquez à nouveau la modification. |
| `MD-SYN-101` | blob hash mismatch _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-102` | cbor decode: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-103` | cipher frame length invalid _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-104` | cipher read timed out _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-105` | Le réseau du cabinet a refusé … (…) : … | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-SYN-106` | Adhésion au réseau du cabinet refusée (…) : … | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-SYN-152` | conflict payload: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-107` | Le réseau du cabinet n'accepte que des adresses LAN privées (refusé : …). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-SYN-108` | Frame too large _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-109` | Frame too short _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-110` | handshake message too large _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-111` | handshake timed out _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-112` | Invalid frame length _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-113` | L'empreinte du certificat LAN n'est pas un SHA-256. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-SYN-114` | Appareil principal injoignable — les numéros de document sont émis par l'appareil principal (…) | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-115` | L'appareil principal a refusé l'attribution de numéros (…) : … | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-SYN-116` | Master pubkey invalid: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-117` | Master pubkey length {} (expected 32) _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-118` | Master pubkey not decodable: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-119` | master secret hex: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-120` | master secret utf8: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-121` | master_base_url missing _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-122` | master_base_url missing for mesh sync _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-123` | master_pubkey missing for mesh peer-list verification _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-124` | MEDOC_PAIRING_MASTER_SECRET must be 64 hex chars (32 bytes) _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-125` | mesh sync requires serverless_peer REPLICA _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-126` | Message trop volumineux. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-SYN-127` | no known sync queue in the exchange request _(contrôle technique, affiché en anglais)_ | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-SYN-128` | Aucun appareil principal enregistré. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-SYN-153` | not a field conflict table _(contrôle technique, affiché en anglais)_ | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-SYN-154` | Bloc de numéros refusé (…) | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-155` | Bloc de numéros : … | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-129` | peer … has no TLS pin _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-130` | Nouvel appairage requis. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-SYN-131` | reconcile rows request exceeds … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-132` | La réconciliation ne s'exécute que sur un appareil secondaire. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-SYN-133` | reconcile waits until the outbox is empty _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-134` | Authentification secondaire : l'empreinte n'est pas celle de cet appareil. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-SYN-135` | Appareil secondaire non appairé — terminez l'appairage. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-SYN-136` | Annuaire du personnel refusé (…) : … | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-SYN-137` | sync app_kv: payload key does not match entity id _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-138` | sync entity_table not allow-listed: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-139` | Synchronisation : appareil émetteur manquant. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-SYN-140` | sync payload json: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-141` | sync payload must be a JSON object _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-142` | sync pull requires serverless_peer REPLICA _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-143` | sync push device_id mismatch _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-144` | sync push requires serverless_peer mode _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-145` | Envoi vers l'appareil principal uniquement depuis un appareil secondaire. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-SYN-146` | Empreinte de certificat manquante — certificat non épinglé refusé. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-SYN-147` | sync.deployment.v1: … _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-148` | table … is not on a sync queue _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-149` | unknown sync op: {} _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-150` | wire frame overrun _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-SYN-151` | wire frame too large _(contrôle technique, affiché en anglais)_ | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |

## Traitements

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-TRT-001` | Un coefficient supérieur à 3,5 nécessite un accord selon § 2 GOZ. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-TRT-002` | Le coefficient doit être compris entre 1,0 et 3,5 (au-delà seulement avec un accord selon § 2 GOZ). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-TRT-003` | Un coefficient supérieur à 2,3 nécessite une justification écrite (§ 10 al. 3 GOZ). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-TRT-004` | Les actes GOZ/GOÄ nécessitent un numéro d'acte et des points. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-TRT-005` | Barème invalide (autorisés : GOZ, GOÄ, matériel, laboratoire, autre). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Écrans de l'application

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-UIX-500` | Un reçu ne peut être émis que pour un paiement réglé. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-UIX-501` | error catalog is missing … _(contrôle technique, affiché en anglais)_ | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-UIX-502` | Configuration du client LAN incomplète (URL de base manquante). | Action bloquée · Réessayer peut aider | Cet appareil ne parvient pas à joindre l'hôte du cabinet ou le serveur LAN. | Vérifiez le Wi-Fi/LAN, assurez-vous que l'hôte fonctionne, puis réessayez. Paramètres → Réseau affiche la connexion. |
| `MD-UIX-503` | Configuration du client LAN incomplète (URL ou jeton manquant). | Action bloquée · Réessayer peut aider | Cet appareil ne parvient pas à joindre l'hôte du cabinet ou le serveur LAN. | Vérifiez le Wi-Fi/LAN, assurez-vous que l'hôte fonctionne, puis réessayez. Paramètres → Réseau affiche la connexion. |
| `MD-UIX-505` | MeDoc repository root not found from … _(contrôle technique, affiché en anglais)_ | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-UIX-506` | native-go-menu: missing label key for "…" _(contrôle technique, affiché en anglais)_ | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-UIX-507` | native-go-menu: missing ROUTE_VISIBILITY for path "…" _(contrôle technique, affiché en anglais)_ | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-UIX-514` | not loaded _(contrôle technique, affiché en anglais)_ | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-UIX-508` | Pairing handle missing _(contrôle technique, affiché en anglais)_ | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-UIX-509` | Pairing handle missing sessionId _(contrôle technique, affiché en anglais)_ | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-UIX-510` | PDF manquant. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-UIX-511` | Données du cabinet incomplètes pour les reçus. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-UIX-512` | SAS digits missing from accept response _(contrôle technique, affiché en anglais)_ | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-UIX-513` | Les horaires enregistrés sont invalides. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Mises à jour

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-APP-116` | Aucune mise à jour disponible. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-UPD-100` | Cette mise à jour ne peut pas être installée sur cette version. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-UPD-101` | La mise à jour est pour …/…, cet ordinateur exécute …/… | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-UPD-102` | Le manifeste de mise à jour n'est pas signé par MeDoc. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-UPD-103` | Les versions du manifeste de mise à jour ne correspondent pas. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-UPD-104` | Manifeste de mise à jour : … | Action bloquée | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |

## Temps de travail

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-WTM-001` | Aucune session ouverte. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-WTM-002` | Aucune session en pause. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-WTM-003` | Aucune session en cours. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-WTM-004` | Une session de temps de travail est déjà en cours. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-WTM-005` | La session n'est pas en pause. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-WTM-006` | La session n'est pas active. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-WTM-007` | La semaine doit commencer à une date calendaire (AAAA-MM-JJ). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Flux de statuts

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-WFL-001` | Le dossier est déjà validé ou archivé. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-WFL-002` | Ce dossier est archivé (lecture seule) et ne peut pas être modifié. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-WFL-003` | Le statut du dossier … ne peut pas être validé. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-WFL-004` | Statut de commande inconnu : … | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-WFL-005` | Transition de statut …→… non autorisée. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-WFL-010` | Statut inconnu : … | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-WFL-006` | La tâche est déjà clôturée (VALIDÉ). | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-WFL-007` | Statut de tâche inconnu : … | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-WFL-008` | Seules les tâches terminées peuvent être validées ou renvoyées. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-WFL-009` | Statut de ticket inconnu : … | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
