# Guide des statuts MeDoc

> Généré — ne pas modifier. Exécuter `node scripts/generate-manuals.mjs`.

Chaque élément a exactement un statut. Les indicateurs (p. ex. « Reporté ») sont des indications affichées à côté et ne remplacent jamais le statut. Les listes sont toujours triées : à traiter en priorité → à faire → en cours → en attente de revue → terminé → clôturé.

## Rendez-vous

Commence par: **Planifié** · `appointment.status · domain/status.rs AppointmentStatus`

| Statut | Signification | Phase | Peut passer à | L'application permet |
|---|---|---|---|---|
| **Planifié** (`PLANNED`) | Réservé, pas encore confirmé. Modifiable, déplaçable par glisser-déposer, rappel possible, supprimable. | À faire | Confirmé, Terminé, Annulé, Absent | Modifiable, Supprimable, Déplaçable, Rappels |
| **Confirmé** (`CONFIRMED`) | Patient attendu. Encore déplaçable ; passez à « En cours » à l'arrivée du patient. | À faire | En cours, Terminé, Annulé, Absent | Modifiable, Déplaçable, Rappels |
| **En cours** (`IN_PROGRESS`) | Patient en cours de traitement. Plus déplaçable ; terminez par « Terminé ». | En cours | Terminé | Modifiable |
| **Terminé** (`COMPLETED`) | La visite a eu lieu. Verrouillé dans l'agenda ; facturable et imprimable. | Terminé | Définitif | Facturable, Imprimable |
| **Absent** (`NO_SHOW`) | Le patient n'est pas venu sans prévenir. Créneau libéré ; peut être replanifié. | Clôturé | Planifié | Réouvrable |
| **Annulé** (`CANCELLED`) | Annulé par le patient ou le cabinet. Créneau libéré ; réouvrable ou supprimable. | Clôturé | Planifié | Réouvrable, Supprimable |

Indicateurs (pas des statuts): Reporté · Urgence

## Patient

Commence par: **Nouveau** · `patient.status · domain/status.rs PatientStatus`

| Statut | Signification | Phase | Peut passer à | L'application permet |
|---|---|---|---|---|
| **Nouveau** (`NEW`) | Première visite ; données incomplètes. Modifiable ; encore supprimable. | À faire | En traitement, Traitement terminé, Clôturé (lecture seule), Archivé | Modifiable, Supprimable |
| **En traitement** (`ACTIVE`) | Patient en cours de soins. Modifiable ; facturable. | En cours | Traitement terminé, Clôturé (lecture seule), Archivé | Modifiable, Facturable |
| **Traitement terminé** (`VALIDATED`) | Traitement terminé et vérifié par un médecin. Toujours modifiable et facturable. | Terminé | Clôturé (lecture seule), Archivé | Modifiable, Facturable, Imprimable |
| **Clôturé (lecture seule)** (`READONLY`) | Dossier verrouillé pour conservation. Aucune modification ; impression possible. | Clôturé | Archivé | Imprimable |
| **Archivé** (`ARCHIVED`) | Masqué des listes (« Afficher les archivés »). Réactivable. | Clôturé | En traitement | Réouvrable, Masqué des listes |

## Onglets de la liste des patients

Commence par: **Nouveaux patients** · `Patients page tabs · patient_repo::filter_counts / patient-status-filter.ts` · _Défini automatiquement par l'application_

| Statut | Signification | Phase | Peut passer à | L'application permet |
|---|---|---|---|---|
| **Nouveaux patients** (`NEW_PATIENT`) | Patients au statut Nouveau. | À faire | En traitement | Verrouillé |
| **En traitement** (`IN_TREATMENT`) | Patients au statut En traitement. | En cours | Traitement terminé | Verrouillé |
| **Traitement terminé** (`CLOSED`) | Patients au traitement terminé ou clôturé. Chaque patient est dans exactement un onglet Nouveau / En traitement / Terminé. | Terminé | Définitif | Verrouillé |
| **Facture ouverte** (`INVOICE_OPEN`) | Au moins un paiement impayé ou partiel. Peut recouper les autres onglets. | À traiter en priorité | Définitif | Verrouillé |
| **Dossier ouvert** (`CHART_OPEN`) | Le dossier est un brouillon, en revue ou refusé — documentation à compléter. | À traiter en priorité | Définitif | Verrouillé |

## Dossier patient

Commence par: **Brouillon** · `patient_chart.status · workflow_transitions.rs (forward / validate / decline)`

| Statut | Signification | Phase | Peut passer à | L'application permet |
|---|---|---|---|---|
| **Brouillon** (`DRAFT`) | En cours de documentation. Modifiable ; envoyez-le au médecin. | À faire | En revue, Validé, Refusé | Modifiable |
| **En revue** (`IN_PROGRESS`) | En attente dans la file de validation du médecin. | En attente de revue | Validé, Refusé | Modifiable |
| **Refusé** (`DECLINED`) | Renvoyé par le médecin avec un motif. Corrigez puis renvoyez. | À traiter en priorité | Brouillon, En revue | Modifiable |
| **Validé** (`VALIDATED`) | Approuvé par un médecin. Facturation libérable ; la réouverture le renvoie en revue. | Terminé | En revue | Facturable, Imprimable |
| **Clôturé (lecture seule)** (`READONLY`) | Verrouillé pour conservation. Imprimable, non modifiable. | Clôturé | Définitif | Imprimable |

## Traitement

Commence par: **Planifié** · `treatment.treatment_status`

| Statut | Signification | Phase | Peut passer à | L'application permet |
|---|---|---|---|---|
| **Planifié** (`PLANNED`) | Traitement planifié. Modifiable, supprimable, planifiable. | À faire | En cours, Terminé, Annulé | Modifiable, Supprimable, Déplaçable |
| **En cours** (`IN_PROGRESS`) | Traitement commencé (p. ex. plusieurs séances). Terminez ou interrompez. | En cours | Terminé, Interrompu | Modifiable |
| **Terminé** (`COMPLETED`) | Traitement terminé. Facturable et imprimable. | Terminé | Définitif | Facturable, Imprimable |
| **Interrompu** (`DISCONTINUED`) | Arrêté avant la fin. Le travail réalisé peut être facturé. | Clôturé | Définitif | Facturable, Imprimable |
| **Annulé** (`CANCELLED`) | Ne sera pas réalisé. Non facturable. | Clôturé | Définitif | Verrouillé |

## Ordonnance

Commence par: **Délivrée** · `prescription.status`

| Statut | Signification | Phase | Peut passer à | L'application permet |
|---|---|---|---|---|
| **Brouillon** (`DRAFT`) | Pas encore délivrée. Modifiable et supprimable. | À faire | Délivrée | Modifiable, Supprimable |
| **Délivrée** (`ISSUED`) | Signée et remise. Modifier crée une nouvelle version ; l'ancienne devient Remplacée. | Terminé | Remplacée | Modifiable, Imprimable |
| **Remplacée** (`REPLACED`) | Remplacée par une version corrigée. Masquée ; conservée pour l'audit. | Clôturé | Définitif | Masqué des listes |

## Certificat / document émis

Commence par: **Émis** · `issued_document.status (certificates, letters, invoices)`

| Statut | Signification | Phase | Peut passer à | L'application permet |
|---|---|---|---|---|
| **Émis** (`ISSUED`) | Document valide numéroté. Réimprimable ; annulez-le pour corriger. | Terminé | Annulé | Imprimable |
| **Annulé** (`CANCELLED`) | Annulé avec un document d'annulation. Conservé et imprimable. | Clôturé | Définitif | Imprimable |

## Arrêt de travail

Commence par: **En cours** · `sick_leave_certificate.status`

| Statut | Signification | Phase | Peut passer à | L'application permet |
|---|---|---|---|---|
| **En cours** (`ACTIVE`) | Arrêt en cours. Modifiable et imprimable. | En cours | Terminé | Modifiable, Imprimable |
| **Terminé** (`ENDED`) | Période terminée. Imprimable uniquement. | Clôturé | Définitif | Imprimable |

## Paiement

Commence par: **En attente** · `payment.status · domain/status.rs PaymentStatus`

| Statut | Signification | Phase | Peut passer à | L'application permet |
|---|---|---|---|---|
| **En attente** (`OUTSTANDING`) | Rien payé. Modifiable, supprimable ; rappel possible. | À faire | Partiellement payé, Payé, Annulé | Modifiable, Supprimable, Rappels |
| **Partiellement payé** (`PARTIALLY_PAID`) | Partiellement payé ; le reste est dû. Le statut suit les encaissements. | En cours | Payé, Annulé | Modifiable, Supprimable, Rappels |
| **Payé** (`PAID`) | Payé intégralement. Verrouillé ; reçu imprimable. | Terminé | Définitif | Imprimable |
| **Annulé** (`CANCELLED`) | Annulé. Exclu du chiffre d'affaires et de la clôture. | Clôturé | Définitif | Verrouillé |

## Facture

Commence par: **Ouverte** · `receivables.rs status_row (derived from linked payments and due date)` · _Défini automatiquement par l'application_

| Statut | Signification | Phase | Peut passer à | L'application permet |
|---|---|---|---|---|
| **En retard** (`OVERDUE`) | Échéance dépassée avec solde. Un rappel peut être émis. | À traiter en priorité | Payée, Annulée | Rappels, Imprimable |
| **Aucun paiement lié** (`UNLINKED`) | État de paiement incalculable : aucun encaissement lié. | À traiter en priorité | Définitif | Imprimable |
| **Ouverte** (`OPEN`) | Émise, impayée, non échue. | À faire | Partiellement payée, Payée, En retard, Annulée | Imprimable |
| **Partiellement payée** (`PARTIAL`) | Paiements partiels reçus ; solde dû. | En cours | Payée, En retard, Annulée | Imprimable |
| **Payée** (`PAID`) | Les paiements liés couvrent le total. | Terminé | Définitif | Imprimable |
| **Annulée** (`CANCELLED`) | Facture annulée par un avoir. | Clôturé | Définitif | Imprimable |
| **Avoir** (`CANCELLATION`) | Document annulant une autre facture. | Clôturé | Définitif | Imprimable |
| **Importée** (`LEGACY`) | Importée d'une ancienne version ; paiement non suivi. | Clôturé | Définitif | Imprimable |

## Commande

Commence par: **Ouverte** · `purchase_order.status · workflow_transitions.rs`

| Statut | Signification | Phase | Peut passer à | L'application permet |
|---|---|---|---|---|
| **Ouverte** (`OPEN`) | Commandée, pas encore expédiée. Modifiable et supprimable. | À faire | En transit, Livrée, Annulée | Modifiable, Supprimable |
| **En transit** (`IN_TRANSIT`) | Expédiée. Marquez Livrée à l'arrivée pour le stock. | En cours | Livrée, Annulée | Modifiable |
| **Livrée** (`DELIVERED`) | Reçue et ajoutée au stock. Verrouillée. | Terminé | Définitif | Imprimable |
| **Annulée** (`CANCELLED`) | Commande retirée. Verrouillée. | Clôturé | Définitif | Verrouillé |

Indicateurs (pas des statuts): En retard

## Contrat

Commence par: **Actif** · `Administration → Contracts (activation + start/end dates)`

| Statut | Signification | Phase | Peut passer à | L'application permet |
|---|---|---|---|---|
| **Pas encore commencé** (`NOT_STARTED`) | Date de début future. Aucun coût compté. | À faire | Actif, Désactivé | Modifiable, Supprimable |
| **Actif** (`ACTIVE`) | En cours. Coût compté à chaque période jusqu'à désactivation ou fin. | En cours | Désactivé, Expiré | Modifiable |
| **Désactivé** (`INACTIVE`) | Arrêté à la date de désactivation. Coût compté jusqu'à cette date ; réactivable. | Clôturé | Actif | Modifiable, Réouvrable, Supprimable |
| **Expiré** (`EXPIRED`) | Date de fin dépassée. Plus de coût. | Clôturé | Actif | Modifiable, Réouvrable |

## Produit / prestation

Commence par: **Actif** · `product.active / treatment_catalog.active`

| Statut | Signification | Phase | Peut passer à | L'application permet |
|---|---|---|---|---|
| **Actif** (`ACTIVE`) | Sélectionnable pour la réservation et la facturation. | En cours | Inactif | Modifiable, Facturable |
| **Inactif** (`INACTIVE`) | Masqué de la sélection ; les réservations existantes le gardent. Réactivable. | Clôturé | Actif | Modifiable, Réouvrable, Masqué des listes |

## Clôture journalière

Commence par: **Définitif** · `day_close_protocol`

| Statut | Signification | Phase | Peut passer à | L'application permet |
|---|---|---|---|---|
| **Définitif** (`FINAL`) | Caisse rapprochée et procès-verbal enregistré. Une correction crée une nouvelle version. | Terminé | Corrigé | Imprimable |
| **Corrigé** (`CORRECTED`) | Remplacé par un procès-verbal corrigé ; conservé pour l'audit. | Clôturé | Définitif | Imprimable |

## Tâche du cabinet

Commence par: **Ouverte** · `practice_task.status · workflow_transitions.rs (verify + simple track)`

| Statut | Signification | Phase | Peut passer à | L'application permet |
|---|---|---|---|---|
| **Renvoyée** (`BACK`) | Renvoyée par le créateur avec un motif. Toujours en tête ; à retravailler. | À traiter en priorité | Ouverte, En cours | Modifiable |
| **Ouverte** (`OPEN`) | En attente de prise en charge. | À faire | En cours, Vue | Modifiable, Supprimable |
| **Vue** (`VIEWED`) | Parcours simple (tickets, rendez-vous) : vue ; marquez Terminée une fois traitée. | En cours | Terminée, Ouverte | Modifiable |
| **En cours** (`IN_PROGRESS`) | La personne assignée y travaille. | En cours | Terminée — en attente de revue, Ouverte | Modifiable |
| **Terminée — en attente de revue** (`DONE_RECEPTION`) | Terminée ; le créateur valide ou renvoie. | En attente de revue | Validée, Renvoyée | Verrouillé |
| **Validée** (`VALIDATED`) | Vérifiée et clôturée. Quitte la boîte de réception. | Terminé | Définitif | Verrouillé |
| **Terminée** (`DONE`) | Parcours simple terminé. Quitte la boîte. | Terminé | Définitif | Verrouillé |

## Ticket

Commence par: **Ouvert** · `practice_ticket.status (legacy tickets)`

| Statut | Signification | Phase | Peut passer à | L'application permet |
|---|---|---|---|---|
| **Ouvert** (`OPEN`) | Nouveau message pour un médecin. | À faire | En cours, Terminé | Modifiable |
| **En cours** (`IN_PROGRESS`) | En traitement. | En cours | Terminé, Ouvert | Modifiable |
| **Terminé** (`DONE`) | Résolu. | Terminé | Définitif | Verrouillé |

## Retour

Commence par: **Ouvert** · `feedback.status`

| Statut | Signification | Phase | Peut passer à | L'application permet |
|---|---|---|---|---|
| **Ouvert** (`OPEN`) | Soumis, non examiné. | À faire | En cours, Traité | Modifiable |
| **En cours** (`IN_PROGRESS`) | En cours d'examen. | En cours | Traité, Ouvert | Modifiable |
| **Traité** (`DONE`) | Traité. | Terminé | Définitif | Verrouillé |

## Confiance de session

Commence par: **Non vérifiée** · `device_session trust flags`

| Statut | Signification | Phase | Peut passer à | L'application permet |
|---|---|---|---|---|
| **Suspecte** (`SUSPECTED`) | Signalée suspecte. Notification envoyée ; terminez-la si inconnue. | À traiter en priorité | Approuvée, Non vérifiée | Supprimable |
| **Non vérifiée** (`UNCHECKED`) | Nouvelle connexion non vérifiée. | À faire | Approuvée, Suspecte | Supprimable |
| **Approuvée** (`TRUSTED`) | Appareil connu du cabinet. | Terminé | Suspecte | Supprimable |

## Enregistrement d'appareil

Commence par: **En attente** · `provisioning_state.device_status`

| Statut | Signification | Phase | Peut passer à | L'application permet |
|---|---|---|---|---|
| **En attente** (`PENDING`) | Enregistrement en cours ; en attente d'approbation. | À faire | Actif, Bloqué | Verrouillé |
| **Actif** (`ACTIVE`) | Enregistré et autorisé. | Terminé | Révoqué, Bloqué | Verrouillé |
| **Bloqué** (`BLOCKED`) | Bloqué temporairement ; déblocable. | À traiter en priorité | Actif | Réouvrable |
| **Révoqué** (`REVOKED`) | Retiré définitivement. Nouvel appairage requis. | Clôturé | Définitif | Verrouillé |

## Appairage

Commence par: **En attente** · `pairing_request.status`

| Statut | Signification | Phase | Peut passer à | L'application permet |
|---|---|---|---|---|
| **En attente** (`PENDING`) | Demande reçue ; approuvez ou refusez sur l'hôte. | À faire | Acceptée, Refusée | Verrouillé |
| **Acceptée** (`ACCEPTED`) | Appairé ; l'appareil synchronise. | Terminé | Révoquée | Verrouillé |
| **Refusée** (`REJECTED`) | Demande refusée. | Clôturé | Définitif | Verrouillé |
| **Révoquée** (`REVOKED`) | Appareil retiré. | Clôturé | Définitif | Verrouillé |

Indicateurs (pas des statuts): Confirmer le code

## Session de temps de travail

Commence par: **En cours** · `work_time_session.status`

| Statut | Signification | Phase | Peut passer à | L'application permet |
|---|---|---|---|---|
| **En cours** (`RUNNING`) | Temps enregistré. | En cours | En pause, Terminée | Modifiable |
| **En pause** (`PAUSED`) | Pause ; temps non compté. | À faire | En cours, Terminée | Modifiable |
| **Terminée** (`ENDED`) | Session close ; corrigeable par l'admin. | Clôturé | Définitif | Modifiable |

## Connexion

Commence par: **Connecté** · `Top bar connectivity + replica outbox (connectivity.controller.ts, sync-status-badge.tsx)` · _Défini automatiquement par l'application_

| Statut | Signification | Phase | Peut passer à | L'application permet |
|---|---|---|---|---|
| **Hors ligne** (`OFFLINE`) | Hôte injoignable. Les modifications attendent la connexion. | À traiter en priorité | Connecté | Verrouillé |
| **Synchronisation** (`SYNC_PENDING`) | Modifications enregistrées localement, envoi en cours. | En cours | Connecté, Hors ligne | Verrouillé |
| **Connecté** (`ONLINE`) | Modifications enregistrées et partagées immédiatement. | Terminé | Synchronisation, Hors ligne | Verrouillé |
