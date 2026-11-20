# Guide des statuts MeDoc

> Généré — ne pas modifier. Exécuter `node scripts/generate-manuals.mjs`.

Chaque élément a exactement un statut. Les indicateurs (p. ex. « Reporté ») sont des indications affichées à côté et ne remplacent jamais le statut. Les listes sont toujours triées : à traiter en priorité → à faire → en cours → en attente de revue → terminé → clôturé.

## Rendez-vous

Commence par: **Planifié** · `appointment.status (config/enums.yaml · AppointmentStatus)`

| Statut | Signification | Phase | Peut passer à |
|---|---|---|---|
| **Planifié** (`PLANNED`) | Réservé, pas encore confirmé par le patient ou le cabinet. | À faire | Confirmé, Terminé, Annulé, Absent |
| **Confirmé** (`CONFIRMED`) | Confirmé ; le patient est attendu à l'heure prévue. | En cours | Terminé, Annulé, Absent |
| **Terminé** (`COMPLETED`) | La visite a eu lieu. Prête pour la documentation et la facturation. | Terminé | Définitif |
| **Absent** (`NO_SHOW`) | Le patient ne s'est pas présenté sans annuler. Définitif. | Clôturé | Définitif |
| **Annulé** (`CANCELLED`) | Annulé par le patient ou le cabinet. Le créneau est libéré. Définitif. | Clôturé | Définitif |

Indicateurs (pas des statuts): Reporté · Urgence

## Patient

Commence par: **Nouveau** · `patient.status (config/enums.yaml · PatientStatus)`

| Statut | Signification | Phase | Peut passer à |
|---|---|---|---|
| **Nouveau** (`NEW`) | Première visite ; données de base incomplètes. | À faire | Actif, Validé, Archivé |
| **Actif** (`ACTIVE`) | Patient en cours de suivi. | En cours | Validé, Archivé |
| **Validé** (`VALIDATED`) | Données et dossier vérifiés par un médecin. | Terminé | Actif, Archivé |
| **Archivé** (`READONLY`) | Archivé : conservé, lecture seule. Définitif. | Clôturé | Définitif |

## Dossier patient

Commence par: **Brouillon** · `patient_chart.status (config/enums.yaml · ChartStatus)`

| Statut | Signification | Phase | Peut passer à |
|---|---|---|---|
| **Brouillon** (`DRAFT`) | En cours de documentation ; pas encore envoyé pour revue. | À faire | En revue, Validé, Refusé |
| **En revue** (`IN_PROGRESS`) | Envoyé à un médecin, en attente de validation. | En attente de revue | Validé, Refusé |
| **Refusé** (`DECLINED`) | Renvoyé par le médecin ; à corriger avant nouvel envoi. | À traiter en priorité | En revue, Validé |
| **Validé** (`VALIDATED`) | Approuvé par un médecin. La facturation peut être validée. | Terminé | En revue |
| **Archivé** (`READONLY`) | Verrouillé pour conservation ; plus de modifications. Définitif. | Clôturé | Définitif |

## Paiement

Commence par: **En attente** · `payment.status (config/enums.yaml · PaymentStatus)`

| Statut | Signification | Phase | Peut passer à |
|---|---|---|---|
| **En attente** (`OUTSTANDING`) | Rien n'a encore été payé. | À faire | Partiellement payé, Payé, Annulé |
| **Partiellement payé** (`PARTIALLY_PAID`) | Une partie est payée ; le reste est dû. | En cours | Payé, Annulé |
| **Payé** (`PAID`) | Entièrement payé. Définitif. | Terminé | Définitif |
| **Annulé** (`CANCELLED`) | Annulé ; non compté dans le chiffre d'affaires. Définitif. | Clôturé | Définitif |

## Commande

Commence par: **Ouverte** · `purchase_order.status (config/enums.yaml · OrderStatus)`

| Statut | Signification | Phase | Peut passer à |
|---|---|---|---|
| **Ouverte** (`OPEN`) | Créée, pas encore expédiée par le fournisseur. | À faire | En transit, Livrée, Annulée |
| **En transit** (`IN_TRANSIT`) | Expédiée et en route. | En cours | Livrée, Annulée |
| **Livrée** (`DELIVERED`) | Reçue et mise en stock. Définitif. | Terminé | Définitif |
| **Annulée** (`CANCELLED`) | Commande retirée. Définitif. | Clôturé | Définitif |

Indicateurs (pas des statuts): En retard

## Tâche du cabinet

Commence par: **Ouverte** · `practice_task.status (workflow_transitions.rs · TASK_STATUSES)`

| Statut | Signification | Phase | Peut passer à |
|---|---|---|---|
| **Renvoyée** (`BACK`) | Renvoyée par le créateur avec un motif ; à retravailler en priorité. | À traiter en priorité | Ouverte, En cours |
| **Ouverte** (`OPEN`) | En attente de prise en charge. | À faire | En cours |
| **En cours** (`IN_PROGRESS`) | La personne assignée y travaille. | En cours | Terminée — en attente de revue, Ouverte |
| **Terminée — en attente de revue** (`DONE_RECEPTION`) | Terminée par l'assigné ; le créateur doit valider ou renvoyer. | En attente de revue | Validée, Renvoyée |
| **Validée** (`VALIDATED`) | Vérifiée et clôturée par le créateur. Définitif. | Terminé | Définitif |

## Ticket

Commence par: **Ouvert** · `practice_ticket.status (workflow_transitions.rs)`

| Statut | Signification | Phase | Peut passer à |
|---|---|---|---|
| **Ouvert** (`OPEN`) | Nouveau message pour un médecin. | À faire | En cours, Terminé |
| **En cours** (`IN_PROGRESS`) | En cours de traitement. | En cours | Terminé, Ouvert |
| **Terminé** (`DONE`) | Résolu. Définitif. | Terminé | Définitif |

## Retour

Commence par: **Ouvert** · `feedback.status (config/enums.yaml · FeedbackStatus)`

| Statut | Signification | Phase | Peut passer à |
|---|---|---|---|
| **Ouvert** (`OPEN`) | Soumis, pas encore examiné. | À faire | En cours, Traité |
| **En cours** (`IN_PROGRESS`) | En cours d'examen. | En cours | Traité, Ouvert |
| **Traité** (`DONE`) | Traité. Définitif. | Terminé | Définitif |

## Ordonnance

Commence par: **Brouillon** · `prescription.status`

| Statut | Signification | Phase | Peut passer à |
|---|---|---|---|
| **Brouillon** (`DRAFT`) | Modifiable ; pas encore remise au patient. | À faire | Délivrée |
| **Délivrée** (`ISSUED`) | Signée et remise ou envoyée. Définitif. | Terminé | Définitif |

## Confiance de session d'appareil

Commence par: **Non vérifiée** · `device_session.trust_status`

| Statut | Signification | Phase | Peut passer à |
|---|---|---|---|
| **Suspecte** (`SUSPECTED`) | Signalée suspecte ; vérifiez et terminez-la si inconnue. | À traiter en priorité | Approuvée, Non vérifiée |
| **Non vérifiée** (`UNCHECKED`) | Nouvelle connexion depuis cet appareil ; non vérifiée. | À faire | Approuvée, Suspecte |
| **Approuvée** (`TRUSTED`) | Marquée comme appareil connu du cabinet. | Terminé | Suspecte |

## Appairage

Commence par: **En attente** · `pairing_request.status (sync_tables.rs CHECK)`

| Statut | Signification | Phase | Peut passer à |
|---|---|---|---|
| **En attente** (`PENDING`) | Demande reçue ; en attente d'approbation sur l'hôte. | À faire | Acceptée, Refusée |
| **Acceptée** (`ACCEPTED`) | L'appareil est appairé et peut synchroniser. | Terminé | Révoquée |
| **Refusée** (`REJECTED`) | Demande refusée. Définitif. | Clôturé | Définitif |
| **Révoquée** (`REVOKED`) | Appareil auparavant accepté retiré. Définitif. | Clôturé | Définitif |

Indicateurs (pas des statuts): Confirmer le code

## Session de temps de travail

Commence par: **En cours** · `work_time_session.status (rust_only.rs CHECK)`

| Statut | Signification | Phase | Peut passer à |
|---|---|---|---|
| **En cours** (`RUNNING`) | Le temps est enregistré. | En cours | En pause, Terminée |
| **En pause** (`PAUSED`) | Pause ; le temps n'est pas compté jusqu'à la reprise. | À faire | En cours, Terminée |
| **Terminée** (`ENDED`) | Session clôturée. Définitif. | Clôturé | Définitif |
