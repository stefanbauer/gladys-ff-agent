# FF-Agent pour Gladys Assistant

Cette intégration externe de type provider nécessite Gladys Assistant 5.2.1 ou plus.
**Les actions accepter/refuser envoient de vraies requêtes HTTP à FF-Agent.** La
réception des alertes n'est pas encore implémentée. Un succès HTTP ne prouve pas
l'enregistrement de la réponse opérationnelle ; vérifiez-la dans FF-Agent.

## Configuration et utilisation

Installez l'image de développement et le manifest local selon le README du dépôt,
puis démarrez le processus Node local. Dans Configuration, cliquez sur **Simuler
une intervention**. Ajoutez **Intervention FF-Agent** au tableau de bord pour voir
la dernière intervention et les boutons de réponse avec confirmation. Ils envoient
de vraies requêtes, même pour une alerte de test. **Les scènes de test peuvent aussi
envoyer des réponses réelles.** Les actions de configuration et de scène ne demandent
ni identifiant d'intervention supplémentaire ni alerte préalable.

L'UUID reste visible et modifiable. Une acceptation nécessite aussi le déplacement
(CAR/BICYCLE/FEET) et une maison Gladys. Le refus utilise uniquement l'UUID.
Les coordonnées proviennent de la maison sélectionnée,
avec l'autorisation de localisation déclarée. **Vérifier la configuration** contrôle
ces données sans contacter FF-Agent ni afficher l'UUID ou les coordonnées. La
simulation n'exige pas ces réglages. Ne partagez jamais de liens personnels de réponse.

## Préparer le webhook générique FF-Agent

La page de configuration explique directement les champs FF-Agent. N'activez pas
encore l'envoi : la réception et le JSON final ne sont pas implémentés. Préparez
POST, HTTPS, aucune authentification basique, aucun en-tête supplémentaire et le
format JSON (FF-Agent définit Content-Type automatiquement). Une fois la réception
implémentée, la section Webhooks native de Gladys permettra d'enregistrer la clé
Open API Plus et d'obtenir l'URL complète. Retirez `https://` du champ URL FF-Agent
si son sélecteur de protocole l'ajoute déjà. L'URL est secrète ; ne pas utiliser le
lien personnel d'acceptation ou de refus comme point d'entrée des alertes.

Le corps nécessite des variables FF-Agent et leur échappement JSON confirmés,
pas des variables inventées. Le formulaire limite connexion et traitement à cinq
secondes chacun. Testez l'envoi avant tout usage réel. FF-Agent ne peut pas joindre
ce Mac via localhost ; la simulation REST locale est distincte du futur test via
Plus. Ne modifiez pas la liaison Plus de production existante.

Le déclencheur **Intervention reçue** expose `incident_id`, `title`, `category`,
`location`, `received_at` et `simulated`. Le filtre de catégorie optionnel accepte
`exercise` pour les tests. **Accepter** et **Refuser** n'ont pas de champs. Sorties :
`response`, `http_status` et `confirmed: false`. Le champ `simulated` du déclencheur
décrit uniquement l'alerte. Délai de cinq secondes, sans nouvelle tentative ni
redirection automatique. Vérifiez FF-Agent avant de répéter un résultat incertain.

## Limites et dépannage

Seule la dernière intervention fictive reste en mémoire ; un redémarrage l'efface.
Docker Desktop et Node 24 sont requis pour le développement local. Laissez le
conteneur d'enregistrement actif et ne connectez qu'un seul processus SDK par selector.
`npm run dev` synchronise automatiquement l'enregistrement et le jeton. Ne commitez jamais de jetons
ni de données opérationnelles. Consultez le README pour les instructions détaillées.
