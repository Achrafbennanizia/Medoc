# Manuel des codes d'erreur MeDoc

> Généré — ne pas modifier. Exécuter `node scripts/generate-manuals.mjs`.

Chaque message d'erreur affiche un code comme MD-PAY-004. Recherchez-le ici pour connaître la cause et la solution. Les codes ne changent jamais d'une version à l'autre.

## Général

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-APP-001` | Conflit : … | Action de votre part | La modification entre en conflit avec des données existantes (doublon ou édition concurrente). | Utilisez une autre valeur, ou rechargez et appliquez à nouveau la modification. |
| `MD-APP-002` | Les données n'ont pas pu être enregistrées ou chargées (référence …). Réessayez ; si le problème persiste, contactez le support avec cette référence. | Problème système · Réessayer peut aider | Un problème technique inattendu s'est produit sur cet appareil ou le serveur. | Réessayez une fois. Si cela se répète, notez le code et la référence et contactez le support (Aide → Erreurs récentes → Copier). |
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

## Pièces jointes

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-ATT-001` | Le type de document ne doit pas être vide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-ATT-002` | Fichier trop volumineux (max. 50 Mo). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-ATT-003` | Ce type de fichier n'est pas pris en charge. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-ATT-004` | La désignation ne doit pas être vide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

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
| `MD-BAK-001` | Fichier de sauvegarde introuvable. | Action de votre part | L'élément n'existe plus ou a été supprimé sur un autre appareil. | Actualisez la liste (Ctrl/⌘ R) et rouvrez l'élément. |
| `MD-BAK-002` | Le fichier restauré n'est pas une base MeDoc valide. | Problème système | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-BAK-003` | Le fichier n'est pas une sauvegarde SQLite valide (pas de signature, en-tête invalide). | Problème système | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |
| `MD-BAK-004` | Seuls les fichiers .db peuvent être restaurés. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-BAK-005` | Signature de sauvegarde invalide — restauration annulée. | Problème système | Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié. | Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier. |

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

## Dossier patient

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-CHT-001` | Le message ne doit pas être vide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-CHT-002` | Pas un médecin : … | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-CHT-003` | Veuillez sélectionner au moins un médecin. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-CHT-004` | La cible doit être un médecin. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-CHT-005` | Médecin inconnu : … | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Réseau du cabinet (cluster)

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-CLU-001` | Phrase secrète requise. | Action bloquée · Réessayer peut aider | Cet appareil ne parvient pas à joindre l'hôte du cabinet ou le serveur LAN. | Vérifiez le Wi-Fi/LAN, assurez-vous que l'hôte fonctionne, puis réessayez. Paramètres → Réseau affiche la connexion. |

## Sessions d'appareils

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-DEV-001` | La session actuelle ne peut pas être terminée ici — veuillez vous déconnecter. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-DEV-002` | La session actuelle est déjà de confiance. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |

## Export

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-EXP-001` | Le dossier cible doit être un chemin absolu. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-EXP-002` | Données d'export invalides (Base64). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-EXP-003` | Nom de fichier invalide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Connexion LAN

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-LAN-001` | Client LAN : la commande « … » n'est pas disponible sur le serveur API — utilisez l'application bureau Practice Host. | Action bloquée · Réessayer peut aider | Cet appareil ne parvient pas à joindre l'hôte du cabinet ou le serveur LAN. | Vérifiez le Wi-Fi/LAN, assurez-vous que l'hôte fonctionne, puis réessayez. Paramètres → Réseau affiche la connexion. |
| `MD-LAN-002` | Configuration client LAN incomplète (URL de base ou jeton manquant). | Action bloquée · Réessayer peut aider | Cet appareil ne parvient pas à joindre l'hôte du cabinet ou le serveur LAN. | Vérifiez le Wi-Fi/LAN, assurez-vous que l'hôte fonctionne, puis réessayez. Paramètres → Réseau affiche la connexion. |
| `MD-LAN-003` | Configuration client LAN incomplète (URL de base manquante). | Action bloquée · Réessayer peut aider | Cet appareil ne parvient pas à joindre l'hôte du cabinet ou le serveur LAN. | Vérifiez le Wi-Fi/LAN, assurez-vous que l'hôte fonctionne, puis réessayez. Paramètres → Réseau affiche la connexion. |
| `MD-LAN-004` | LAN HTTP … : … | Action bloquée · Réessayer peut aider | Cet appareil ne parvient pas à joindre l'hôte du cabinet ou le serveur LAN. | Vérifiez le Wi-Fi/LAN, assurez-vous que l'hôte fonctionne, puis réessayez. Paramètres → Réseau affiche la connexion. |

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

## Appairage d'appareils

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-PAR-001` | Code de confirmation expiré. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-PAR-002` | Code de confirmation incorrect. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAR-003` | ID d'appareil vide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAR-004` | Le PIN doit comporter exactement 4 chiffres. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAR-005` | Clé publique replica vide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Paiements

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-PAY-001` | Montant invalide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAY-002` | Le montant doit être supérieur à 0. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAY-003` | Seuls les paiements en attente ou partiellement payés peuvent être supprimés. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-PAY-004` | Veuillez lier une seule cible : traitement ou examen. | Action de votre part | La modification entre en conflit avec des données existantes (doublon ou édition concurrente). | Utilisez une autre valeur, ou rechargez et appliquez à nouveau la modification. |
| `MD-PAY-005` | Seuls les paiements en attente ou partiellement payés peuvent être modifiés. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-PAY-006` | Examen introuvable ou n'appartient pas à ce patient. | Action de votre part | L'élément n'existe plus ou a été supprimé sur un autre appareil. | Actualisez la liste (Ctrl/⌘ R) et rouvrez l'élément. |
| `MD-PAY-007` | Le paiement dépasse la limite autorisée pour cet examen (max. … € incluant cette écriture). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAY-008` | Le paiement dépasse la limite autorisée pour ce traitement (max. … € incluant cette écriture). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAY-009` | Le paiement dépasse le montant ouvert pour cet examen (max. … €, payé … €, cible … €). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAY-010` | Le paiement dépasse le montant ouvert pour ce traitement (max. … €, payé … €, cible … €). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAY-011` | Un montant positif est requis pour la réservation d'un prix de prestation. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PAY-012` | Traitement introuvable ou n'appartient pas à ce patient. | Action de votre part | L'élément n'existe plus ou a été supprimé sur un autre appareil. | Actualisez la liste (Ctrl/⌘ R) et rouvrez l'élément. |

## Tâches du cabinet

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-TSK-001` | Veuillez indiquer le praticien cible (assigneeUserId). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-TSK-002` | Patient requis. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-TSK-003` | La cible doit être un médecin. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-TSK-004` | La cible doit être un membre du personnel d'accueil. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-TSK-005` | Le titre ne doit pas être vide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Profil

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-PRF-001` | L'e-mail ne doit pas être vide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PRF-002` | Le nom ne doit pas être vide. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PRF-003` | Nom trop long (max. 120 caractères). | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |
| `MD-PRF-004` | Aucun champ soumis pour la mise à jour. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Personnel

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-STF-001` | Adresse e-mail déjà utilisée. | Action de votre part | La modification entre en conflit avec des données existantes (doublon ou édition concurrente). | Utilisez une autre valeur, ou rechargez et appliquez à nouveau la modification. |
| `MD-STF-002` | L'authentification à deux facteurs est déjà active. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-STF-003` | Code invalide — veuillez réessayer. | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Temps de travail

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-WTM-001` | Aucune session ouverte. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-WTM-002` | Aucune session en pause. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-WTM-003` | Aucune session en cours. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-WTM-004` | Une session de temps de travail est déjà en cours. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-WTM-005` | La session n'est pas en pause. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-WTM-006` | La session n'est pas active. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-WTM-007` | week_start : format AAAA-MM-JJ requis | Action de votre part | Une valeur saisie est manquante ou mal formatée. | Corrigez le champ indiqué puis enregistrez à nouveau. |

## Flux de statuts

| Code | Message | Gravité | Pourquoi | Que faire |
|---|---|---|---|---|
| `MD-WFL-001` | Le dossier est déjà validé ou archivé. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-WFL-002` | Ce dossier est archivé (lecture seule) et ne peut pas être modifié. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-WFL-003` | Le statut du dossier … ne peut pas être validé. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-WFL-004` | Statut de commande inconnu : … | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-WFL-005` | Transition de statut …→… non autorisée. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-WFL-006` | La tâche est déjà clôturée (VALIDÉ). | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-WFL-007` | Statut de tâche inconnu : … | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-WFL-008` | Seules les tâches terminées peuvent être validées ou renvoyées. | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
| `MD-WFL-009` | Statut de ticket inconnu : … | Action de votre part | L'élément est dans un statut qui n'autorise pas cette action. | Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée. |
