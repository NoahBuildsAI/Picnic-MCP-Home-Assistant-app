// Dashboard language follows the Picnic country; unknown countries use English.
const en = {
  lang: "en", locale: "en-GB",
  states: ["starting", "credentials not configured", "signing in", "signed in", "waiting for 2FA code", "sign-in failed"],
  groups: ["View products, recipes, cart and deliveries", "Change cart and save recipes", "Choose, cancel or rate deliveries and email invoices", "View account, payment and wallet details", "Request and enter 2FA codes through the assistant"],
  notConfigured: "Enter your Picnic email and password in Configuration and restart the app.",
  needs2fa: "Picnic requires two-factor authentication. Request a code below and enter it.",
  twofaTitle: "Two-factor authentication", twofaHelp: "If your Picnic account uses two-factor authentication, request a code and enter it below. The session is saved until Picnic ends it.",
  sendCode: "Send code by SMS", codePlaceholder: "Code from SMS", verify: "Verify",
  alwaysOn: "always on", on: "on", off: "off", none: "None.", unnamed: "(unnamed)", noClients: "No OAuth clients connected yet.",
  account: "Picnic account", status: "Status", relogin: "Sign in again", reloginConfirm: "Discard the session and sign in again? You may need a new 2FA code.",
  configHelp: "Set your email, password and country on the Configuration tab (administrators only), then restart the app.",
  connection: "Connection", copyUrl: "Copy URL", tokenHelp: "The bearer token is on the Configuration tab (mcp_auth_token). Clients can send it in an Authorization header, or connect using OAuth.",
  clients: "Connected OAuth clients", client: "Client", returnTo: "Redirect to", connectedOn: "Connected on", revoke: "Revoke all OAuth tokens", revokeConfirm: "Revoke all OAuth tokens? Connected apps will need to authorize again.",
  permissions: "Assistant permissions", group: "Group", option: "Option", toolsSummary: (published, withheld) => `${published} tools available, ${withheld} withheld. Change permissions in Configuration and restart the app.`,
  moreInfo: "More information", docsHelp: "Documentation is available on this app's Documentation tab.",
  unknownReason: "not reviewed by this app (new upstream tool)", disabledReason: "disabled",
  banners: { sent: "Code requested — check your SMS.", verified: "Code accepted.", relogin: "Sign-in attempted — see the status above.", revoked: "All OAuth tokens have been revoked." },
  wait: "A code was just sent; wait one minute.", invalidCode: "That does not look like a valid code.", noAccess: "Code accepted, but Picnic has not granted access yet.",
  authorize: "Authorize", oauthTitle: "Authorize client", oauthIntro: "This client wants to access your Picnic account through Home Assistant: search products, read your cart and deliveries, and change them if permitted.",
  oauthRedirect: "After approval you will return to", oauthCheck: "Only continue if this is the app you are connecting.", oauthToken: "Bearer token", oauthTokenHelp: "The token is mcp_auth_token on this app's Configuration tab in Home Assistant.", oauthLimit: "Too many attempts. Try again in 15 minutes.", oauthWrong: "That token is not correct.",
};

const de = {
  lang: "de", locale: "de-DE",
  states: ["wird gestartet", "Anmeldedaten fehlen", "Anmeldung läuft", "angemeldet", "wartet auf Bestätigungscode", "Anmeldung fehlgeschlagen"],
  groups: ["Produkte, Rezepte, Warenkorb und Lieferungen ansehen", "Warenkorb ändern und Rezepte speichern", "Lieferung auswählen, stornieren oder bewerten und Rechnung senden", "Konto-, Zahlungs- und Guthabendaten ansehen", "Bestätigungscode über den Assistenten anfordern und eingeben"],
  notConfigured: "Trage deine Picnic-E-Mail und dein Passwort unter Konfiguration ein und starte die App neu.", needs2fa: "Picnic benötigt eine Zwei-Faktor-Bestätigung. Fordere unten einen Code an und gib ihn ein.",
  twofaTitle: "Zwei-Faktor-Bestätigung", twofaHelp: "Falls dein Picnic-Konto eine Zwei-Faktor-Bestätigung nutzt, fordere einen Code an und gib ihn unten ein. Die Anmeldung bleibt bestehen, bis Picnic sie beendet.", sendCode: "Code per SMS senden", codePlaceholder: "Code aus der SMS", verify: "Bestätigen",
  alwaysOn: "immer an", on: "an", off: "aus", none: "Keine.", unnamed: "(ohne Namen)", noClients: "Noch keine OAuth-Clients verbunden.",
  account: "Picnic-Konto", status: "Status", relogin: "Erneut anmelden", reloginConfirm: "Die Sitzung beenden und erneut anmelden? Möglicherweise brauchst du einen neuen Bestätigungscode.",
  configHelp: "E-Mail, Passwort und Land stellst du unter Konfiguration ein (nur für Administratoren). Starte danach die App neu.",
  connection: "Verbindung", copyUrl: "URL kopieren", tokenHelp: "Der Zugangsschlüssel steht unter Konfiguration (mcp_auth_token). Clients können ihn im Authorization-Header senden oder sich über OAuth verbinden.",
  clients: "Verbundene OAuth-Clients", client: "Client", returnTo: "Weiterleitung zu", connectedOn: "Verbunden am", revoke: "Alle OAuth-Zugriffe widerrufen", revokeConfirm: "Alle OAuth-Zugriffe widerrufen? Verbundene Apps müssen erneut angemeldet werden.",
  permissions: "Berechtigungen des Assistenten", group: "Gruppe", option: "Option", toolsSummary: (published, withheld) => `${published} Werkzeuge verfügbar, ${withheld} gesperrt. Änderungen unter Konfiguration erfordern einen Neustart der App.`, moreInfo: "Weitere Informationen", docsHelp: "Die Dokumentation findest du im Tab Dokumentation dieser App.",
  unknownReason: "von dieser App noch nicht geprüft (neues Werkzeug)", disabledReason: "deaktiviert",
  banners: { sent: "Code angefordert – prüfe deine SMS.", verified: "Code bestätigt.", relogin: "Anmeldung versucht – siehe Status oben.", revoked: "Alle OAuth-Zugriffe wurden widerrufen." },
  wait: "Ein Code wurde gerade versendet. Bitte warte eine Minute.", invalidCode: "Das scheint kein gültiger Code zu sein.", noAccess: "Code bestätigt, aber Picnic hat noch keinen Zugriff gewährt.",
  authorize: "Autorisieren", oauthTitle: "Client autorisieren", oauthIntro: "Dieser Client möchte über Home Assistant auf dein Picnic-Konto zugreifen: Produkte suchen, Warenkorb und Lieferungen ansehen und diese je nach Berechtigung ändern.", oauthRedirect: "Nach der Bestätigung wirst du weitergeleitet zu", oauthCheck: "Fahre nur fort, wenn dies die App ist, die du verbinden möchtest.", oauthToken: "Zugangsschlüssel", oauthTokenHelp: "Der Schlüssel steht als mcp_auth_token unter Konfiguration dieser App in Home Assistant.", oauthLimit: "Zu viele Versuche. Bitte versuche es in 15 Minuten erneut.", oauthWrong: "Der Zugangsschlüssel ist nicht korrekt.",
};

const nl = {
  lang: "nl", locale: "nl-NL",
  states: ["bezig met starten", "geen inloggegevens ingesteld", "bezig met inloggen", "ingelogd", "wacht op 2FA-code", "inloggen mislukt"],
  groups: ["Producten, recepten, winkelwagen en bezorgingen bekijken", "Winkelwagen aanpassen en recepten bewaren", "Bezorging kiezen, annuleren of beoordelen en factuur mailen", "Account-, betaal- en portemonneegegevens bekijken", "2FA-code via de assistent aanvragen en invoeren"],
  notConfigured: "Vul je Picnic-e-mail en wachtwoord in bij Configuratie en herstart de app.", needs2fa: "Picnic vraagt om een tweede factor. Vraag hieronder een code aan en vul die in.", twofaTitle: "Tweestapsverificatie", twofaHelp: "Heeft je Picnic-account 2FA aan, vraag dan een code aan en vul die hieronder in. De sessie blijft bewaard totdat Picnic deze beëindigt.", sendCode: "Stuur code per sms", codePlaceholder: "Code uit de sms", verify: "Verifiëren",
  alwaysOn: "altijd aan", on: "aan", off: "uit", none: "Geen.", unnamed: "(naamloos)", noClients: "Nog geen OAuth-clients gekoppeld.",
  account: "Picnic-account", status: "Status", relogin: "Opnieuw inloggen", reloginConfirm: "Sessie weggooien en opnieuw inloggen? Mogelijk heb je een nieuwe code nodig.", configHelp: "E-mail, wachtwoord en land stel je in bij Configuratie (alleen voor beheerders). Herstart daarna de app.",
  connection: "Verbinding", copyUrl: "Kopieer URL", tokenHelp: "Het bearer-token staat bij Configuratie (mcp_auth_token). Clients kunnen het via een Authorization-header sturen of verbinden via OAuth.",
  clients: "Gekoppelde OAuth-clients", client: "Client", returnTo: "Terug naar", connectedOn: "Gekoppeld op", revoke: "Trek alle OAuth-tokens in", revokeConfirm: "Alle OAuth-tokens intrekken? Gekoppelde apps moeten opnieuw autoriseren.",
  permissions: "Wat de assistent mag", group: "Groep", option: "Optie", toolsSummary: (published, withheld) => `${published} tools beschikbaar, ${withheld} achtergehouden. Wijzigingen via Configuratie vereisen een herstart.`, moreInfo: "Meer info", docsHelp: "De documentatie staat op het tabblad Documentatie van deze app.",
  unknownReason: "niet beoordeeld door deze app (nieuwe upstream-tool)", disabledReason: "uitgeschakeld", banners: { sent: "Code aangevraagd — check je sms.", verified: "Code geaccepteerd.", relogin: "Inloggen geprobeerd — zie de status hierboven.", revoked: "Alle OAuth-tokens zijn ingetrokken." },
  wait: "Er is net een code verstuurd; wacht een minuut.", invalidCode: "Dat lijkt geen geldige code.", noAccess: "Code geaccepteerd, maar Picnic geeft nog geen toegang.", authorize: "Autoriseren", oauthTitle: "Client autoriseren", oauthIntro: "Deze client wil via Home Assistant je Picnic-account gebruiken: producten zoeken, winkelwagen en bezorgingen bekijken en deze afhankelijk van de rechten aanpassen.", oauthRedirect: "Na toestemming ga je terug naar", oauthCheck: "Ga alleen verder als dit de app is die je wilt koppelen.", oauthToken: "Bearer-token", oauthTokenHelp: "Het token staat als mcp_auth_token bij Configuratie van deze app in Home Assistant.", oauthLimit: "Te veel pogingen. Probeer het over 15 minuten opnieuw.", oauthWrong: "Het token is niet juist.",
};

const fr = {
  lang: "fr", locale: "fr-FR",
  states: ["démarrage", "identifiants non configurés", "connexion en cours", "connecté", "en attente du code de vérification", "échec de la connexion"],
  groups: ["Consulter les produits, recettes, panier et livraisons", "Modifier le panier et enregistrer des recettes", "Choisir, annuler ou évaluer une livraison et envoyer une facture", "Consulter le compte, les paiements et le portefeuille", "Demander et saisir le code de vérification via l’assistant"],
  notConfigured: "Saisissez votre e-mail et mot de passe Picnic dans Configuration, puis redémarrez l’application.", needs2fa: "Picnic demande une vérification en deux étapes. Demandez un code ci-dessous et saisissez-le.", twofaTitle: "Vérification en deux étapes", twofaHelp: "Si votre compte Picnic utilise la vérification en deux étapes, demandez un code et saisissez-le ci-dessous. La session reste active jusqu’à ce que Picnic y mette fin.", sendCode: "Envoyer un code par SMS", codePlaceholder: "Code reçu par SMS", verify: "Vérifier",
  alwaysOn: "toujours actif", on: "actif", off: "désactivé", none: "Aucun.", unnamed: "(sans nom)", noClients: "Aucun client OAuth connecté.", account: "Compte Picnic", status: "Statut", relogin: "Se reconnecter", reloginConfirm: "Fermer la session et se reconnecter ? Un nouveau code pourrait être nécessaire.", configHelp: "Définissez l’e-mail, le mot de passe et le pays dans Configuration (administrateurs uniquement), puis redémarrez l’application.",
  connection: "Connexion", copyUrl: "Copier l’URL", tokenHelp: "Le jeton se trouve dans Configuration (mcp_auth_token). Les clients peuvent l’envoyer dans un en-tête Authorization ou se connecter via OAuth.", clients: "Clients OAuth connectés", client: "Client", returnTo: "Redirection vers", connectedOn: "Connecté le", revoke: "Révoquer tous les accès OAuth", revokeConfirm: "Révoquer tous les accès OAuth ? Les applications connectées devront être autorisées à nouveau.",
  permissions: "Autorisations de l’assistant", group: "Groupe", option: "Option", toolsSummary: (published, withheld) => `${published} outils disponibles, ${withheld} bloqués. Toute modification dans Configuration nécessite un redémarrage.`, moreInfo: "Plus d’informations", docsHelp: "La documentation se trouve dans l’onglet Documentation de cette application.",
  unknownReason: "non vérifié par cette application (nouvel outil)", disabledReason: "désactivé", banners: { sent: "Code demandé : vérifiez vos SMS.", verified: "Code accepté.", relogin: "Tentative de connexion effectuée : voir le statut ci-dessus.", revoked: "Tous les accès OAuth ont été révoqués." },
  wait: "Un code vient d’être envoyé ; attendez une minute.", invalidCode: "Ce code ne semble pas valide.", noAccess: "Code accepté, mais Picnic n’a pas encore autorisé l’accès.", authorize: "Autoriser", oauthTitle: "Autoriser le client", oauthIntro: "Ce client souhaite accéder à votre compte Picnic via Home Assistant : rechercher des produits, consulter votre panier et vos livraisons et les modifier selon les autorisations.", oauthRedirect: "Après autorisation, vous serez redirigé vers", oauthCheck: "Continuez uniquement s’il s’agit de l’application que vous souhaitez connecter.", oauthToken: "Jeton d’accès", oauthTokenHelp: "Le jeton mcp_auth_token se trouve dans Configuration de cette application dans Home Assistant.", oauthLimit: "Trop de tentatives. Réessayez dans 15 minutes.", oauthWrong: "Le jeton est incorrect.",
};

const remote = {
  en: { remoteTitle: "Remote access", remoteHelp: "Copy the URL into ChatGPT as a custom MCP server and select OAuth. If setup is waiting, restart Home Assistant once. Keep this URL private.",
    remoteStates: { disabled: "off", starting: "starting", restart_required: "waiting for Home Assistant setup / restart", waiting_for_home_assistant: "waiting for Home Assistant", no_remote_url: "enable Nabu Casa remote access or configure an external HTTPS URL in Home Assistant", ready: "ready" } },
  de: { remoteTitle: "Remote-Zugang", remoteHelp: "Kopiere die URL in ChatGPT als eigenen MCP-Server und wähle OAuth. Falls die Einrichtung wartet, starte Home Assistant einmal neu. Behandle die URL vertraulich.",
    remoteStates: { disabled: "aus", starting: "wird vorbereitet", restart_required: "wartet auf Home-Assistant-Einrichtung / Neustart", waiting_for_home_assistant: "wartet auf Home Assistant", no_remote_url: "Nabu-Casa-Fernzugriff aktivieren oder eine externe HTTPS-Adresse in Home Assistant einrichten", ready: "bereit" } },
  nl: { remoteTitle: "Externe toegang", remoteHelp: "Kopieer de URL naar ChatGPT als eigen MCP-server en kies OAuth. Wacht de installatie, herstart Home Assistant dan eenmaal. Houd deze URL geheim.",
    remoteStates: { disabled: "uit", starting: "wordt voorbereid", restart_required: "wacht op Home Assistant-installatie / herstart", waiting_for_home_assistant: "wacht op Home Assistant", no_remote_url: "activeer externe toegang via Nabu Casa of stel een externe HTTPS-URL in Home Assistant in", ready: "gereed" } },
  fr: { remoteTitle: "Accès à distance", remoteHelp: "Copiez l’URL dans ChatGPT comme serveur MCP personnalisé et choisissez OAuth. Si la configuration attend, redémarrez Home Assistant une fois. Gardez cette URL privée.",
    remoteStates: { disabled: "désactivé", starting: "préparation", restart_required: "en attente de la configuration / du redémarrage de Home Assistant", waiting_for_home_assistant: "en attente de Home Assistant", no_remote_url: "activez l’accès distant Nabu Casa ou configurez une URL HTTPS externe dans Home Assistant", ready: "prêt" } },
};

export function messagesForCountry(country) {
  const messages = ({ DE: de, NL: nl, FR: fr })[String(country ?? "").toUpperCase()] ?? en;
  return { ...messages, ...remote[messages.lang] };
}
