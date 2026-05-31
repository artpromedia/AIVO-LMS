#!/usr/bin/env node
/**
 * seed-auth-i18n — one-shot translator for the `auth` namespace.
 *
 * The auth slice (login / signup / forgot-password / reset-password / MFA)
 * was extracted into `auth.*` keys in web-v2's message catalog. English is
 * authored directly in `messages/en.json`; this script carries the human-
 * reviewed translations for the other nine shipped locales and merges the
 * `auth` subtree into each `messages/<locale>.json`, preserving every other
 * namespace already present.
 *
 * Re-runnable: it overwrites only the `auth` key. Brand tokens (AIVO,
 * COPPA, FERPA, SOC 2, IEP, MFA, AES-256) are intentionally left untranslated.
 *
 *   node scripts/seed-auth-i18n.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const messagesDir = join(repoRoot, "apps/web-v2/lib/i18n/messages");

const AUTH = {
  es: {
    common: {
      email: "Correo electrónico",
      password: "Contraseña",
      show_password: "Mostrar contraseña",
      hide_password: "Ocultar contraseña",
    },
    login: {
      brand_heading: "Inicia sesión para continuar tu viaje con AIVO.",
      brand_body:
        "Tus tutores, misiones e información para la familia, todo en un solo lugar, ajustado a la forma en que aprende tu estudiante.",
      trust_badge: "COPPA · FERPA · SOC 2",
      quote:
        "AIVO se adapta a cómo aprende realmente mi hija. La primera plataforma que no nos hizo sentir que luchábamos contra ella.",
      quote_attribution: "— Madre de una estudiante de 3.º grado",
      welcome_back: "Bienvenido de nuevo.",
      card_eyebrow: "Iniciar sesión",
      card_title: "Continúa con tu cuenta de AIVO",
      card_subtitle: "Inicia sesión con tu correo y contraseña de AIVO.",
      submit: "Iniciar sesión",
      new_here: "¿Eres nuevo?",
      create_account: "Crear una cuenta",
      forgot_password: "¿Olvidaste tu contraseña?",
      privacy_lead: "Nunca vendemos tus datos.",
      privacy_link: "Lee el aviso de privacidad",
      errors: {
        invalid_credentials: "El correo o la contraseña son incorrectos.",
        invalid_role: "Ese rol no está disponible para esta cuenta.",
        missing_credentials:
          "Introduce tu correo y contraseña para iniciar sesión.",
        mfa_required:
          "Necesitamos un código de verificación para completar tu inicio de sesión. Introdúcelo en la siguiente pantalla.",
        mfa_session_expired:
          "Tu sesión de verificación expiró. Inicia sesión de nuevo.",
        wrong_surface:
          "Esta cuenta inicia sesión en otro entorno (distrito o administración). Usa el portal correcto.",
        unsupported_role:
          "El rol de tu cuenta aún no es compatible con este entorno.",
        login_failed: "No pudimos iniciar tu sesión. Inténtalo de nuevo.",
      },
      notices: {
        password_reset:
          "Tu contraseña se ha restablecido. Inicia sesión con tu nueva contraseña.",
        logged_out: "Has cerrado sesión.",
      },
    },
    signup: {
      promo_eyebrow: "Comienza tu prueba familiar",
      promo_title: "Una forma más cálida de aprender, para cada niño de la familia.",
      promo_subtitle:
        "Configura estudiantes en minutos. Tutores de IA adaptativos, modos sensorialmente amables y progreso que todo padre puede ver.",
      benefit_tutors:
        "Tutores de IA adaptativos que acompañan a cada estudiante donde está.",
      benefit_sensory:
        "Modos sensorialmente amables: Estándar, Calma, Alto contraste.",
      benefit_progress:
        "Progreso que todo padre puede ver, consciente del IEP y honesto con discreción.",
      reassurance_title: "Los adultos crean las cuentas, no los niños.",
      reassurance_body:
        "Añadirás estudiantes en el siguiente paso. AIVO nunca pide a un niño que cree su propia cuenta, y las protecciones COPPA / FERPA / SOC 2 se aplican a todo desde el primer día.",
      card_eyebrow: "Crea tu cuenta",
      card_title: "Cuéntanos un poco sobre ti",
      already_have: "¿Ya tienes una?",
      sign_in: "Iniciar sesión",
      submit: "Crear cuenta",
      submitting: "Creando tu cuenta…",
      name_label: "Tu nombre",
      email_label: "Correo electrónico",
      password_label: "Contraseña",
      password_helper: "Al menos 8 caracteres con un número y un símbolo.",
    },
    forgot: {
      heading: "Restablece tu contraseña",
      error_invalid_email:
        "Introduce un correo válido para que podamos encontrar tu cuenta.",
      sent_eyebrow: "Revisa tu bandeja de entrada",
      sent_title: "Si ese correo está registrado, el enlace de restablecimiento está en camino.",
      sent_subtitle:
        "Por tu seguridad, no revelamos si una cuenta existe. El enlace caduca en 1 hora.",
      sent_body:
        "Revisa el spam o las promociones si no lo ves después de un minuto. El enlace funciona una vez y luego caduca; solicita uno nuevo si necesitas empezar de nuevo.",
      back_to_sign_in: "Volver a iniciar sesión",
      didnt_get_it: "¿No lo recibiste?",
      try_different_email: "Prueba con otro correo",
      form_eyebrow: "Olvidé mi contraseña",
      form_title: "Introduce el correo de tu cuenta",
      form_subtitle:
        "Te enviaremos un enlace seguro por correo para crear una nueva contraseña.",
      submit: "Enviar enlace de restablecimiento",
      remembered: "¿La recordaste?",
      sign_in: "Iniciar sesión",
      email_label: "Correo electrónico",
    },
    reset: {
      heading: "Elige una nueva contraseña",
      errors: {
        missing_token:
          "A este enlace de restablecimiento le falta su token de seguridad. Solicita uno nuevo en la página de contraseña olvidada.",
        weak_password:
          "Tu nueva contraseña debe tener al menos 12 caracteres.",
        mismatch:
          "Las dos contraseñas aún no coinciden. Intenta introducirlas de nuevo.",
        invalid_token:
          "Este enlace de restablecimiento ha caducado o ya se ha usado. Solicita uno nuevo para continuar.",
        policy_violation:
          "Esa contraseña no cumple nuestra política. Mira los detalles abajo y prueba con una más segura.",
        reset_failed:
          "No pudimos restablecer tu contraseña. Inténtalo de nuevo en un momento.",
        mock_mode:
          "El restablecimiento de contraseña está deshabilitado en modo de prueba. Ejecuta con AUTH_MODE=custom y el servicio de identidad para probar este flujo.",
      },
      no_token_eyebrow: "Restablecer contraseña",
      no_token_title: "Este enlace de restablecimiento está incompleto",
      no_token_subtitle:
        "Al enlace de tu correo le falta su token de seguridad. Solicita uno nuevo para continuar.",
      no_token_cta: "Solicitar un nuevo enlace",
      no_token_body:
        "Por tu seguridad, los enlaces de restablecimiento caducan tras 1 hora y solo se pueden usar una vez.",
      form_eyebrow: "Restablecer contraseña",
      form_title: "Crea tu nueva contraseña",
      form_subtitle:
        "Elige algo memorable pero difícil de adivinar. Cerraremos tu sesión en todos los dispositivos cuando termines.",
      submit: "Guardar nueva contraseña",
      need_link: "¿Necesitas un nuevo enlace?",
      start_over: "Empezar de nuevo",
      new_password_label: "Nueva contraseña",
      confirm_password_label: "Confirmar nueva contraseña",
      helper_too_short:
        "Usa al menos 12 caracteres con una mezcla de letras, números y símbolos.",
      helper_default:
        "Usa al menos 12 caracteres. Rechazaremos contraseñas reutilizadas o débiles.",
      mismatch_helper: "Las contraseñas aún no coinciden.",
    },
    mfa: {
      heading: "Verifica que eres tú",
      card_eyebrow: "Inicio de sesión con varios factores",
      totp_title: "Introduce el código de tu autenticador",
      totp_subtitle:
        "Abre tu app de autenticación e introduce el código de 6 dígitos que muestra para AIVO Learning.",
      totp_cta: "Verificar código",
      webauthn_title: "Usa tu llave de acceso para continuar",
      webauthn_subtitle:
        "Tu cuenta está protegida con una llave de acceso. El inicio con llave de acceso aún no es compatible con este entorno; usa un código de recuperación abajo.",
      webauthn_cta: "Verificar código de recuperación",
      email_title: "Introduce tu código de verificación",
      email_subtitle:
        "Enviamos un código de 6 dígitos al correo registrado. Caduca en 10 minutos.",
      email_cta: "Verificar código",
      resend_code: "Reenviar código",
      cancel: "Cancelar e iniciar sesión de nuevo",
      code_label: "Código de verificación",
      recovery_hint:
        "¿Perdiste el acceso? Usa uno de los códigos de recuperación que guardaste al activar MFA: introdúcelo en el campo de arriba.",
      errors: {
        missing_code: "Introduce el código de verificación que enviamos para continuar.",
        invalid_code: "Ese código no coincide. Compruébalo e inténtalo de nuevo.",
        locked:
          "Demasiados intentos fallidos. Tu cuenta está bloqueada temporalmente; inténtalo de nuevo en unos minutos.",
        resend_failed: "No pudimos enviar un nuevo código. Inténtalo de nuevo.",
        resend_exhausted:
          "Has alcanzado el límite de reenvíos. Inicia sesión de nuevo para obtener un código nuevo.",
      },
      notices: {
        resent: "Se ha enviado un nuevo código a tu correo.",
      },
    },
  },

  fr: {
    common: {
      email: "E-mail",
      password: "Mot de passe",
      show_password: "Afficher le mot de passe",
      hide_password: "Masquer le mot de passe",
    },
    login: {
      brand_heading: "Connectez-vous pour continuer votre parcours AIVO.",
      brand_body:
        "Vos tuteurs, vos missions et les informations pour la famille, réunis au même endroit et adaptés à la façon dont votre apprenant réfléchit.",
      trust_badge: "COPPA · FERPA · SOC 2",
      quote:
        "AIVO s'adapte à la façon dont ma fille apprend vraiment. La première plateforme qui ne nous a pas donné l'impression de lutter contre elle.",
      quote_attribution: "— Parent d'une élève de CE2",
      welcome_back: "Bon retour.",
      card_eyebrow: "Connexion",
      card_title: "Continuez avec votre compte AIVO",
      card_subtitle: "Connectez-vous avec votre e-mail et votre mot de passe AIVO.",
      submit: "Se connecter",
      new_here: "Nouveau ici ?",
      create_account: "Créer un compte",
      forgot_password: "Mot de passe oublié ?",
      privacy_lead: "Nous ne vendons jamais vos données.",
      privacy_link: "Lire l'avis de confidentialité",
      errors: {
        invalid_credentials: "L'e-mail ou le mot de passe est incorrect.",
        invalid_role: "Ce rôle n'est pas disponible pour ce compte.",
        missing_credentials:
          "Saisissez votre e-mail et votre mot de passe pour vous connecter.",
        mfa_required:
          "Nous avons besoin d'un code de vérification pour finaliser votre connexion. Saisissez-le sur l'écran suivant.",
        mfa_session_expired:
          "Votre session de vérification a expiré. Veuillez vous reconnecter.",
        wrong_surface:
          "Ce compte se connecte sur un autre espace (district ou administration). Utilisez le bon portail.",
        unsupported_role:
          "Le rôle de votre compte n'est pas encore pris en charge sur cet espace.",
        login_failed: "Nous n'avons pas pu vous connecter. Veuillez réessayer.",
      },
      notices: {
        password_reset:
          "Votre mot de passe a été réinitialisé. Connectez-vous avec votre nouveau mot de passe.",
        logged_out: "Vous avez été déconnecté.",
      },
    },
    signup: {
      promo_eyebrow: "Démarrez votre essai familial",
      promo_title: "Une façon plus chaleureuse d'apprendre, pour chaque enfant de la famille.",
      promo_subtitle:
        "Configurez des apprenants en quelques minutes. Des tuteurs IA adaptatifs, des modes adaptés à la sensibilité et des progrès que chaque parent peut voir.",
      benefit_tutors:
        "Des tuteurs IA adaptatifs qui rejoignent chaque apprenant là où il en est.",
      benefit_sensory:
        "Modes adaptés à la sensibilité : Standard, Calme, Contraste élevé.",
      benefit_progress:
        "Des progrès que chaque parent peut voir, sensibles au PEI et honnêtes en toute discrétion.",
      reassurance_title: "Ce sont les adultes qui créent les comptes, pas les enfants.",
      reassurance_body:
        "Vous ajouterez des apprenants à l'étape suivante. AIVO ne demande jamais à un enfant de créer son propre compte, et les protections COPPA / FERPA / SOC 2 s'appliquent à tout dès le premier jour.",
      card_eyebrow: "Créez votre compte",
      card_title: "Parlez-nous un peu de vous",
      already_have: "Vous en avez déjà un ?",
      sign_in: "Se connecter",
      submit: "Créer un compte",
      submitting: "Création de votre compte…",
      name_label: "Votre nom",
      email_label: "E-mail",
      password_label: "Mot de passe",
      password_helper: "Au moins 8 caractères avec un chiffre et un symbole.",
    },
    forgot: {
      heading: "Réinitialisez votre mot de passe",
      error_invalid_email:
        "Saisissez une adresse e-mail valide pour que nous puissions retrouver votre compte.",
      sent_eyebrow: "Vérifiez votre boîte de réception",
      sent_title: "Si cet e-mail est enregistré, un lien de réinitialisation est en route.",
      sent_subtitle:
        "Pour votre sécurité, nous ne révélons pas si un compte existe. Le lien expire dans 1 heure.",
      sent_body:
        "Vérifiez les spams ou les promotions si vous ne le voyez pas après une minute. Le lien fonctionne une seule fois puis expire ; demandez-en un nouveau si vous devez recommencer.",
      back_to_sign_in: "Retour à la connexion",
      didnt_get_it: "Vous ne l'avez pas reçu ?",
      try_different_email: "Essayez une autre adresse",
      form_eyebrow: "Mot de passe oublié",
      form_title: "Saisissez l'e-mail de votre compte",
      form_subtitle:
        "Nous vous enverrons un lien sécurisé par e-mail pour définir un nouveau mot de passe.",
      submit: "Envoyer le lien de réinitialisation",
      remembered: "Vous vous en souvenez ?",
      sign_in: "Se connecter",
      email_label: "E-mail",
    },
    reset: {
      heading: "Choisissez un nouveau mot de passe",
      errors: {
        missing_token:
          "Ce lien de réinitialisation n'a pas son jeton de sécurité. Demandez-en un nouveau depuis la page de mot de passe oublié.",
        weak_password:
          "Votre nouveau mot de passe doit comporter au moins 12 caractères.",
        mismatch:
          "Les deux mots de passe ne correspondent pas encore. Réessayez de les saisir.",
        invalid_token:
          "Ce lien de réinitialisation a expiré ou a déjà été utilisé. Demandez-en un nouveau pour continuer.",
        policy_violation:
          "Ce mot de passe ne respecte pas notre politique. Consultez les détails ci-dessous et essayez-en un plus solide.",
        reset_failed:
          "Nous n'avons pas pu réinitialiser votre mot de passe. Réessayez dans un instant.",
        mock_mode:
          "La réinitialisation du mot de passe est désactivée en mode test. Exécutez avec AUTH_MODE=custom et le service d'identité pour tester ce flux.",
      },
      no_token_eyebrow: "Réinitialiser le mot de passe",
      no_token_title: "Ce lien de réinitialisation est incomplet",
      no_token_subtitle:
        "Le lien dans votre e-mail n'a pas son jeton de sécurité. Demandez-en un nouveau pour continuer.",
      no_token_cta: "Demander un nouveau lien",
      no_token_body:
        "Pour votre sécurité, les liens de réinitialisation expirent après 1 heure et ne peuvent être utilisés qu'une seule fois.",
      form_eyebrow: "Réinitialiser le mot de passe",
      form_title: "Définissez votre nouveau mot de passe",
      form_subtitle:
        "Choisissez quelque chose de mémorable mais difficile à deviner. Nous vous déconnecterons de tous les appareils une fois terminé.",
      submit: "Enregistrer le nouveau mot de passe",
      need_link: "Besoin d'un nouveau lien ?",
      start_over: "Recommencer",
      new_password_label: "Nouveau mot de passe",
      confirm_password_label: "Confirmer le nouveau mot de passe",
      helper_too_short:
        "Utilisez au moins 12 caractères en mélangeant lettres, chiffres et symboles.",
      helper_default:
        "Utilisez au moins 12 caractères. Nous rejetons les mots de passe réutilisés ou faibles.",
      mismatch_helper: "Les mots de passe ne correspondent pas encore.",
    },
    mfa: {
      heading: "Vérifions que c'est bien vous",
      card_eyebrow: "Connexion multifacteur",
      totp_title: "Saisissez le code de votre authentificateur",
      totp_subtitle:
        "Ouvrez votre application d'authentification et saisissez le code à 6 chiffres affiché pour AIVO Learning.",
      totp_cta: "Vérifier le code",
      webauthn_title: "Utilisez votre clé d'accès pour continuer",
      webauthn_subtitle:
        "Votre compte est protégé par une clé d'accès. La connexion par clé d'accès n'est pas encore prise en charge sur cet espace ; utilisez un code de récupération ci-dessous.",
      webauthn_cta: "Vérifier le code de récupération",
      email_title: "Saisissez votre code de vérification",
      email_subtitle:
        "Nous avons envoyé un code à 6 chiffres à l'e-mail enregistré. Il expire dans 10 minutes.",
      email_cta: "Vérifier le code",
      resend_code: "Renvoyer le code",
      cancel: "Annuler et se reconnecter",
      code_label: "Code de vérification",
      recovery_hint:
        "Accès perdu ? Utilisez l'un des codes de récupération enregistrés lors de l'activation de la MFA, et saisissez-le dans le champ ci-dessus.",
      errors: {
        missing_code: "Saisissez le code de vérification que nous avons envoyé pour continuer.",
        invalid_code: "Ce code ne correspond pas. Vérifiez-le et réessayez.",
        locked:
          "Trop de tentatives échouées. Votre compte est temporairement verrouillé ; réessayez dans quelques minutes.",
        resend_failed: "Nous n'avons pas pu envoyer un nouveau code. Veuillez réessayer.",
        resend_exhausted:
          "Vous avez atteint la limite de renvois. Reconnectez-vous pour obtenir un nouveau code.",
      },
      notices: {
        resent: "Un nouveau code a été envoyé à votre e-mail.",
      },
    },
  },

  de: {
    common: {
      email: "E-Mail",
      password: "Passwort",
      show_password: "Passwort anzeigen",
      hide_password: "Passwort verbergen",
    },
    login: {
      brand_heading: "Melde dich an, um deine AIVO-Reise fortzusetzen.",
      brand_body:
        "Deine Tutoren, Missionen und Familieneinblicke – alles an einem Ort, abgestimmt darauf, wie dein Lernender denkt.",
      trust_badge: "COPPA · FERPA · SOC 2",
      quote:
        "AIVO passt sich daran an, wie meine Tochter wirklich lernt. Die erste Plattform, bei der wir nicht das Gefühl hatten, dagegen anzukämpfen.",
      quote_attribution: "— Elternteil einer Drittklässlerin",
      welcome_back: "Willkommen zurück.",
      card_eyebrow: "Anmelden",
      card_title: "Mit deinem AIVO-Konto fortfahren",
      card_subtitle: "Melde dich mit deiner AIVO-E-Mail und deinem Passwort an.",
      submit: "Anmelden",
      new_here: "Neu hier?",
      create_account: "Konto erstellen",
      forgot_password: "Passwort vergessen?",
      privacy_lead: "Wir verkaufen deine Daten niemals.",
      privacy_link: "Datenschutzhinweis lesen",
      errors: {
        invalid_credentials: "E-Mail oder Passwort ist falsch.",
        invalid_role: "Diese Rolle ist für dieses Konto nicht verfügbar.",
        missing_credentials:
          "Gib deine E-Mail und dein Passwort ein, um dich anzumelden.",
        mfa_required:
          "Wir benötigen einen Bestätigungscode, um deine Anmeldung abzuschließen. Gib ihn auf dem nächsten Bildschirm ein.",
        mfa_session_expired:
          "Deine Bestätigungssitzung ist abgelaufen. Bitte melde dich erneut an.",
        wrong_surface:
          "Dieses Konto meldet sich in einem anderen Bereich an (Bezirk oder Verwaltung). Verwende das richtige Portal.",
        unsupported_role:
          "Die Rolle deines Kontos wird in diesem Bereich noch nicht unterstützt.",
        login_failed: "Wir konnten dich nicht anmelden. Bitte versuche es erneut.",
      },
      notices: {
        password_reset:
          "Dein Passwort wurde zurückgesetzt. Bitte melde dich mit deinem neuen Passwort an.",
        logged_out: "Du wurdest abgemeldet.",
      },
    },
    signup: {
      promo_eyebrow: "Starte deine Familien-Testphase",
      promo_title: "Eine wärmere Art zu lernen – für jedes Kind in der Familie.",
      promo_subtitle:
        "Richte Lernende in Minuten ein. Adaptive KI-Tutoren, sensorisch freundliche Modi und Fortschritte, die jedes Elternteil sehen kann.",
      benefit_tutors:
        "Adaptive KI-Tutoren, die jeden Lernenden dort abholen, wo er steht.",
      benefit_sensory:
        "Sensorisch freundliche Modi: Standard, Ruhe, Hoher Kontrast.",
      benefit_progress:
        "Fortschritte, die jedes Elternteil sehen kann – IEP-bewusst und ruhig ehrlich.",
      reassurance_title: "Erwachsene richten Konten ein, nicht Kinder.",
      reassurance_body:
        "Im nächsten Schritt fügst du Lernende hinzu. AIVO bittet niemals ein Kind, ein eigenes Konto zu erstellen, und COPPA-/FERPA-/SOC-2-Schutz gilt von Tag eins an für alles.",
      card_eyebrow: "Erstelle dein Konto",
      card_title: "Erzähl uns ein wenig über dich",
      already_have: "Hast du schon eins?",
      sign_in: "Anmelden",
      submit: "Konto erstellen",
      submitting: "Dein Konto wird erstellt…",
      name_label: "Dein Name",
      email_label: "E-Mail",
      password_label: "Passwort",
      password_helper: "Mindestens 8 Zeichen mit einer Zahl und einem Symbol.",
    },
    forgot: {
      heading: "Setze dein Passwort zurück",
      error_invalid_email:
        "Gib eine gültige E-Mail-Adresse ein, damit wir dein Konto finden können.",
      sent_eyebrow: "Prüfe deinen Posteingang",
      sent_title: "Wenn diese E-Mail registriert ist, ist ein Link zum Zurücksetzen unterwegs.",
      sent_subtitle:
        "Zu deiner Sicherheit verraten wir nicht, ob ein Konto existiert. Der Link läuft in 1 Stunde ab.",
      sent_body:
        "Prüfe Spam oder Werbung, falls du ihn nach einer Minute nicht siehst. Der Link funktioniert einmal und läuft dann ab – fordere einen neuen an, wenn du von vorn beginnen musst.",
      back_to_sign_in: "Zurück zur Anmeldung",
      didnt_get_it: "Nicht erhalten?",
      try_different_email: "Andere E-Mail versuchen",
      form_eyebrow: "Passwort vergessen",
      form_title: "Gib die E-Mail deines Kontos ein",
      form_subtitle:
        "Wir senden dir per E-Mail einen sicheren Link, um ein neues Passwort festzulegen.",
      submit: "Link zum Zurücksetzen senden",
      remembered: "Wieder eingefallen?",
      sign_in: "Anmelden",
      email_label: "E-Mail",
    },
    reset: {
      heading: "Wähle ein neues Passwort",
      errors: {
        missing_token:
          "Diesem Link zum Zurücksetzen fehlt sein Sicherheitstoken. Fordere auf der Seite „Passwort vergessen“ einen neuen an.",
        weak_password:
          "Dein neues Passwort muss mindestens 12 Zeichen lang sein.",
        mismatch:
          "Die beiden Passwörter stimmen noch nicht überein. Gib sie erneut ein.",
        invalid_token:
          "Dieser Link zum Zurücksetzen ist abgelaufen oder wurde bereits verwendet. Fordere einen neuen an, um fortzufahren.",
        policy_violation:
          "Dieses Passwort erfüllt unsere Richtlinie nicht. Sieh dir die Details unten an und versuche es mit einem stärkeren.",
        reset_failed:
          "Wir konnten dein Passwort nicht zurücksetzen. Bitte versuche es gleich noch einmal.",
        mock_mode:
          "Das Zurücksetzen des Passworts ist im Mock-Modus deaktiviert. Führe es mit AUTH_MODE=custom und dem Identitätsdienst aus, um diesen Ablauf zu testen.",
      },
      no_token_eyebrow: "Passwort zurücksetzen",
      no_token_title: "Dieser Link zum Zurücksetzen ist unvollständig",
      no_token_subtitle:
        "Dem Link in deiner E-Mail fehlt sein Sicherheitstoken. Fordere einen neuen an, um fortzufahren.",
      no_token_cta: "Neuen Link anfordern",
      no_token_body:
        "Zu deiner Sicherheit laufen Links zum Zurücksetzen nach 1 Stunde ab und können nur einmal verwendet werden.",
      form_eyebrow: "Passwort zurücksetzen",
      form_title: "Lege dein neues Passwort fest",
      form_subtitle:
        "Wähle etwas Einprägsames, aber schwer zu Erratendes. Wir melden dich nach Abschluss von allen Geräten ab.",
      submit: "Neues Passwort speichern",
      need_link: "Brauchst du einen neuen Link?",
      start_over: "Von vorn beginnen",
      new_password_label: "Neues Passwort",
      confirm_password_label: "Neues Passwort bestätigen",
      helper_too_short:
        "Verwende mindestens 12 Zeichen aus einer Mischung von Buchstaben, Zahlen und Symbolen.",
      helper_default:
        "Verwende mindestens 12 Zeichen. Wir lehnen wiederverwendete oder schwache Passwörter ab.",
      mismatch_helper: "Die Passwörter stimmen noch nicht überein.",
    },
    mfa: {
      heading: "Bestätige, dass du es bist",
      card_eyebrow: "Anmeldung mit mehreren Faktoren",
      totp_title: "Gib deinen Authenticator-Code ein",
      totp_subtitle:
        "Öffne deine Authenticator-App und gib den 6-stelligen Code ein, der für AIVO Learning angezeigt wird.",
      totp_cta: "Code bestätigen",
      webauthn_title: "Verwende deinen Passkey, um fortzufahren",
      webauthn_subtitle:
        "Dein Konto ist durch einen Passkey geschützt. Die Passkey-Anmeldung wird in diesem Bereich noch nicht unterstützt – verwende unten einen Wiederherstellungscode.",
      webauthn_cta: "Wiederherstellungscode bestätigen",
      email_title: "Gib deinen Bestätigungscode ein",
      email_subtitle:
        "Wir haben einen 6-stelligen Code an die hinterlegte E-Mail gesendet. Er läuft in 10 Minuten ab.",
      email_cta: "Code bestätigen",
      resend_code: "Code erneut senden",
      cancel: "Abbrechen und erneut anmelden",
      code_label: "Bestätigungscode",
      recovery_hint:
        "Zugriff verloren? Verwende einen der Wiederherstellungscodes, die du beim Aktivieren von MFA gespeichert hast – gib ihn im Feld oben ein.",
      errors: {
        missing_code: "Gib den gesendeten Bestätigungscode ein, um fortzufahren.",
        invalid_code: "Dieser Code stimmt nicht. Überprüfe ihn und versuche es erneut.",
        locked:
          "Zu viele fehlgeschlagene Versuche. Dein Konto ist vorübergehend gesperrt – versuche es in ein paar Minuten erneut.",
        resend_failed: "Wir konnten keinen neuen Code senden. Bitte versuche es erneut.",
        resend_exhausted:
          "Du hast das Sendelimit erreicht. Melde dich erneut an, um einen neuen Code zu erhalten.",
      },
      notices: {
        resent: "Ein neuer Code wurde an deine E-Mail gesendet.",
      },
    },
  },

  pt: {
    common: {
      email: "E-mail",
      password: "Senha",
      show_password: "Mostrar senha",
      hide_password: "Ocultar senha",
    },
    login: {
      brand_heading: "Entre para continuar a sua jornada na AIVO.",
      brand_body:
        "Seus tutores, missões e informações para a família, tudo em um só lugar, ajustado à forma como seu aluno pensa.",
      trust_badge: "COPPA · FERPA · SOC 2",
      quote:
        "A AIVO se adapta à forma como minha filha realmente aprende. A primeira plataforma que não nos fez sentir que estávamos lutando contra ela.",
      quote_attribution: "— Mãe de uma aluna do 3.º ano",
      welcome_back: "Bem-vindo de volta.",
      card_eyebrow: "Entrar",
      card_title: "Continue com sua conta AIVO",
      card_subtitle: "Entre com seu e-mail e senha da AIVO.",
      submit: "Entrar",
      new_here: "Novo por aqui?",
      create_account: "Criar uma conta",
      forgot_password: "Esqueceu a senha?",
      privacy_lead: "Nunca vendemos seus dados.",
      privacy_link: "Leia o aviso de privacidade",
      errors: {
        invalid_credentials: "E-mail ou senha incorretos.",
        invalid_role: "Esse perfil não está disponível para esta conta.",
        missing_credentials: "Digite seu e-mail e senha para entrar.",
        mfa_required:
          "Precisamos de um código de verificação para concluir seu acesso. Digite-o na próxima tela.",
        mfa_session_expired:
          "Sua sessão de verificação expirou. Entre novamente.",
        wrong_surface:
          "Esta conta entra em outro ambiente (distrito ou administração). Use o portal correto.",
        unsupported_role:
          "O perfil da sua conta ainda não é compatível com este ambiente.",
        login_failed: "Não conseguimos fazer seu acesso. Tente novamente.",
      },
      notices: {
        password_reset:
          "Sua senha foi redefinida. Entre com sua nova senha.",
        logged_out: "Você saiu da conta.",
      },
    },
    signup: {
      promo_eyebrow: "Comece seu teste em família",
      promo_title: "Um jeito mais acolhedor de aprender, para cada criança da família.",
      promo_subtitle:
        "Configure alunos em minutos. Tutores de IA adaptativos, modos sensorialmente amigáveis e progresso que todo pai e mãe podem ver.",
      benefit_tutors:
        "Tutores de IA adaptativos que encontram cada aluno onde ele está.",
      benefit_sensory:
        "Modos sensorialmente amigáveis: Padrão, Calmo, Alto contraste.",
      benefit_progress:
        "Progresso que todo pai e mãe podem ver — consciente do IEP e honesto com discrição.",
      reassurance_title: "Adultos criam as contas, não as crianças.",
      reassurance_body:
        "Você adicionará alunos na próxima etapa. A AIVO nunca pede que uma criança crie a própria conta, e as proteções COPPA / FERPA / SOC 2 se aplicam a tudo desde o primeiro dia.",
      card_eyebrow: "Crie sua conta",
      card_title: "Conte-nos um pouco sobre você",
      already_have: "Já tem uma?",
      sign_in: "Entrar",
      submit: "Criar conta",
      submitting: "Criando sua conta…",
      name_label: "Seu nome",
      email_label: "E-mail",
      password_label: "Senha",
      password_helper: "Pelo menos 8 caracteres com um número e um símbolo.",
    },
    forgot: {
      heading: "Redefina sua senha",
      error_invalid_email:
        "Digite um e-mail válido para que possamos encontrar sua conta.",
      sent_eyebrow: "Verifique sua caixa de entrada",
      sent_title: "Se esse e-mail estiver registrado, um link de redefinição está a caminho.",
      sent_subtitle:
        "Por sua segurança, não revelamos se uma conta existe. O link expira em 1 hora.",
      sent_body:
        "Verifique o spam ou as promoções se não vir após um minuto. O link funciona uma vez e depois expira — solicite um novo se precisar recomeçar.",
      back_to_sign_in: "Voltar para entrar",
      didnt_get_it: "Não recebeu?",
      try_different_email: "Tente outro e-mail",
      form_eyebrow: "Esqueci a senha",
      form_title: "Digite o e-mail da sua conta",
      form_subtitle:
        "Enviaremos por e-mail um link seguro para definir uma nova senha.",
      submit: "Enviar link de redefinição",
      remembered: "Lembrou?",
      sign_in: "Entrar",
      email_label: "E-mail",
    },
    reset: {
      heading: "Escolha uma nova senha",
      errors: {
        missing_token:
          "Falta o token de segurança neste link de redefinição. Solicite um novo na página de esqueci a senha.",
        weak_password: "Sua nova senha deve ter pelo menos 12 caracteres.",
        mismatch:
          "As duas senhas ainda não coincidem. Tente digitá-las novamente.",
        invalid_token:
          "Este link de redefinição expirou ou já foi usado. Solicite um novo para continuar.",
        policy_violation:
          "Essa senha não atende à nossa política. Veja os detalhes abaixo e tente uma mais forte.",
        reset_failed:
          "Não conseguimos redefinir sua senha. Tente novamente em um instante.",
        mock_mode:
          "A redefinição de senha está desativada no modo de teste. Execute com AUTH_MODE=custom e o serviço de identidade para testar este fluxo.",
      },
      no_token_eyebrow: "Redefinir senha",
      no_token_title: "Este link de redefinição está incompleto",
      no_token_subtitle:
        "Falta o token de segurança no link do seu e-mail. Solicite um novo para continuar.",
      no_token_cta: "Solicitar um novo link",
      no_token_body:
        "Por sua segurança, os links de redefinição expiram após 1 hora e só podem ser usados uma vez.",
      form_eyebrow: "Redefinir senha",
      form_title: "Defina sua nova senha",
      form_subtitle:
        "Escolha algo memorável, mas difícil de adivinhar. Vamos desconectar você de todos os dispositivos quando terminar.",
      submit: "Salvar nova senha",
      need_link: "Precisa de um novo link?",
      start_over: "Recomeçar",
      new_password_label: "Nova senha",
      confirm_password_label: "Confirmar nova senha",
      helper_too_short:
        "Use pelo menos 12 caracteres com uma mistura de letras, números e símbolos.",
      helper_default:
        "Use pelo menos 12 caracteres. Recusaremos senhas reutilizadas ou fracas.",
      mismatch_helper: "As senhas ainda não coincidem.",
    },
    mfa: {
      heading: "Confirme que é você",
      card_eyebrow: "Acesso com múltiplos fatores",
      totp_title: "Digite o código do seu autenticador",
      totp_subtitle:
        "Abra seu app autenticador e digite o código de 6 dígitos exibido para o AIVO Learning.",
      totp_cta: "Verificar código",
      webauthn_title: "Use sua chave de acesso para continuar",
      webauthn_subtitle:
        "Sua conta é protegida por uma chave de acesso. O acesso por chave ainda não é compatível com este ambiente — use um código de recuperação abaixo.",
      webauthn_cta: "Verificar código de recuperação",
      email_title: "Digite seu código de verificação",
      email_subtitle:
        "Enviamos um código de 6 dígitos para o e-mail cadastrado. Ele expira em 10 minutos.",
      email_cta: "Verificar código",
      resend_code: "Reenviar código",
      cancel: "Cancelar e entrar novamente",
      code_label: "Código de verificação",
      recovery_hint:
        "Perdeu o acesso? Use um dos códigos de recuperação que você salvou ao ativar o MFA — digite-o no campo acima.",
      errors: {
        missing_code: "Digite o código de verificação que enviamos para continuar.",
        invalid_code: "Esse código não confere. Verifique e tente novamente.",
        locked:
          "Tentativas demais. Sua conta está temporariamente bloqueada — tente novamente em alguns minutos.",
        resend_failed: "Não conseguimos enviar um novo código. Tente novamente.",
        resend_exhausted:
          "Você atingiu o limite de reenvios. Entre novamente para obter um código novo.",
      },
      notices: {
        resent: "Um novo código foi enviado para o seu e-mail.",
      },
    },
  },

  zh: {
    common: {
      email: "电子邮箱",
      password: "密码",
      show_password: "显示密码",
      hide_password: "隐藏密码",
    },
    login: {
      brand_heading: "登录以继续你的 AIVO 之旅。",
      brand_body: "你的导师、任务和家庭洞察，全都集中在一处，并根据你的学习者的思维方式进行调整。",
      trust_badge: "COPPA · FERPA · SOC 2",
      quote: "AIVO 会适应我女儿真正的学习方式。这是第一个不会让我们觉得在与之对抗的平台。",
      quote_attribution: "——一位三年级学生的家长",
      welcome_back: "欢迎回来。",
      card_eyebrow: "登录",
      card_title: "使用你的 AIVO 账户继续",
      card_subtitle: "使用你的 AIVO 邮箱和密码登录。",
      submit: "登录",
      new_here: "第一次来？",
      create_account: "创建账户",
      forgot_password: "忘记密码？",
      privacy_lead: "我们绝不出售你的数据。",
      privacy_link: "阅读隐私声明",
      errors: {
        invalid_credentials: "邮箱或密码不正确。",
        invalid_role: "该角色不适用于此账户。",
        missing_credentials: "请输入你的邮箱和密码以登录。",
        mfa_required: "我们需要一个验证码来完成你的登录。请在下一屏输入。",
        mfa_session_expired: "你的验证会话已过期。请重新登录。",
        wrong_surface: "此账户在其他端登录（学区或管理端）。请使用正确的门户。",
        unsupported_role: "你账户的角色尚不支持此端。",
        login_failed: "我们无法为你登录。请重试。",
      },
      notices: {
        password_reset: "你的密码已重置。请使用新密码登录。",
        logged_out: "你已退出登录。",
      },
    },
    signup: {
      promo_eyebrow: "开始你的家庭试用",
      promo_title: "一种更温暖的学习方式——为家庭中的每个孩子。",
      promo_subtitle: "几分钟即可设置学习者。自适应 AI 导师、感官友好模式，以及每位家长都能看到的进步。",
      benefit_tutors: "自适应 AI 导师，在每位学习者所处的水平上陪伴他们。",
      benefit_sensory: "感官友好模式：标准、舒缓、高对比度。",
      benefit_progress: "每位家长都能看到的进步——了解 IEP，并安静而真诚。",
      reassurance_title: "由成年人创建账户，而非孩子。",
      reassurance_body:
        "你将在下一步添加学习者。AIVO 绝不会要求孩子创建自己的账户，COPPA / FERPA / SOC 2 保护从第一天起就适用于一切。",
      card_eyebrow: "创建你的账户",
      card_title: "简单介绍一下你自己",
      already_have: "已经有账户了？",
      sign_in: "登录",
      submit: "创建账户",
      submitting: "正在创建你的账户……",
      name_label: "你的姓名",
      email_label: "电子邮箱",
      password_label: "密码",
      password_helper: "至少 8 个字符，包含一个数字和一个符号。",
    },
    forgot: {
      heading: "重置你的密码",
      error_invalid_email: "请输入有效的邮箱，以便我们找到你的账户。",
      sent_eyebrow: "查看你的收件箱",
      sent_title: "如果该邮箱已注册，重置链接即将送达。",
      sent_subtitle: "为了你的安全，我们不会透露账户是否存在。该链接将在 1 小时后失效。",
      sent_body: "如果一分钟后仍未看到，请查看垃圾邮件或促销邮件。该链接仅可使用一次，随后失效——如需重新开始，请申请新的链接。",
      back_to_sign_in: "返回登录",
      didnt_get_it: "没有收到？",
      try_different_email: "尝试其他邮箱",
      form_eyebrow: "忘记密码",
      form_title: "输入你账户的邮箱",
      form_subtitle: "我们将通过邮件向你发送一个安全链接以设置新密码。",
      submit: "发送重置链接",
      remembered: "想起来了？",
      sign_in: "登录",
      email_label: "电子邮箱",
    },
    reset: {
      heading: "选择一个新密码",
      errors: {
        missing_token: "此重置链接缺少安全令牌。请在忘记密码页面申请新的链接。",
        weak_password: "你的新密码必须至少 12 个字符。",
        mismatch: "两个密码尚不一致。请重新输入。",
        invalid_token: "此重置链接已过期或已被使用。请申请新的链接以继续。",
        policy_violation: "该密码不符合我们的策略。请查看下方详情并尝试更强的密码。",
        reset_failed: "我们无法重置你的密码。请稍后重试。",
        mock_mode:
          "在模拟模式下，密码重置已禁用。请使用 AUTH_MODE=custom 和身份服务运行以测试此流程。",
      },
      no_token_eyebrow: "重置密码",
      no_token_title: "此重置链接不完整",
      no_token_subtitle: "你邮件中的链接缺少安全令牌。请申请新的链接以继续。",
      no_token_cta: "申请新链接",
      no_token_body: "为了你的安全，重置链接在 1 小时后失效，且只能使用一次。",
      form_eyebrow: "重置密码",
      form_title: "设置你的新密码",
      form_subtitle: "选择一个好记但难以猜到的密码。完成后我们会让你在所有设备上退出登录。",
      submit: "保存新密码",
      need_link: "需要新链接？",
      start_over: "重新开始",
      new_password_label: "新密码",
      confirm_password_label: "确认新密码",
      helper_too_short: "请使用至少 12 个字符，混合字母、数字和符号。",
      helper_default: "请使用至少 12 个字符。我们会拒绝重复使用或薄弱的密码。",
      mismatch_helper: "密码尚不一致。",
    },
    mfa: {
      heading: "验证是你本人",
      card_eyebrow: "多因素登录",
      totp_title: "输入你的身份验证器代码",
      totp_subtitle: "打开你的身份验证器应用，输入为 AIVO Learning 显示的 6 位代码。",
      totp_cta: "验证代码",
      webauthn_title: "使用通行密钥继续",
      webauthn_subtitle: "你的账户由通行密钥保护。此端尚不支持通行密钥登录——请使用下方的恢复代码。",
      webauthn_cta: "验证恢复代码",
      email_title: "输入你的验证码",
      email_subtitle: "我们已向你登记的邮箱发送了一个 6 位验证码。它将在 10 分钟后失效。",
      email_cta: "验证代码",
      resend_code: "重新发送代码",
      cancel: "取消并重新登录",
      code_label: "验证码",
      recovery_hint: "无法访问？请使用你在开启 MFA 时保存的某个恢复代码——在上方字段中输入。",
      errors: {
        missing_code: "请输入我们发送的验证码以继续。",
        invalid_code: "该代码不匹配。请核对后重试。",
        locked: "失败次数过多。你的账户已被临时锁定——请几分钟后重试。",
        resend_failed: "我们无法发送新代码。请重试。",
        resend_exhausted: "你已达到重新发送上限。请重新登录以获取新代码。",
      },
      notices: {
        resent: "新代码已发送至你的邮箱。",
      },
    },
  },

  ja: {
    common: {
      email: "メールアドレス",
      password: "パスワード",
      show_password: "パスワードを表示",
      hide_password: "パスワードを非表示",
    },
    login: {
      brand_heading: "サインインして AIVO の旅を続けましょう。",
      brand_body:
        "チューター、ミッション、家族向けのインサイトをひとつの場所に。お子さまの考え方に合わせて調整されています。",
      trust_badge: "COPPA · FERPA · SOC 2",
      quote:
        "AIVO は娘の実際の学び方に合わせてくれます。私たちが対抗していると感じさせなかった初めてのプラットフォームです。",
      quote_attribution: "— 3年生の保護者",
      welcome_back: "おかえりなさい。",
      card_eyebrow: "サインイン",
      card_title: "AIVO アカウントで続行",
      card_subtitle: "AIVO のメールアドレスとパスワードでサインインします。",
      submit: "サインイン",
      new_here: "初めてですか？",
      create_account: "アカウントを作成",
      forgot_password: "パスワードをお忘れですか？",
      privacy_lead: "私たちはあなたのデータを販売しません。",
      privacy_link: "プライバシーに関する通知を読む",
      errors: {
        invalid_credentials: "メールアドレスまたはパスワードが正しくありません。",
        invalid_role: "そのロールはこのアカウントでは利用できません。",
        missing_credentials: "サインインするにはメールアドレスとパスワードを入力してください。",
        mfa_required:
          "サインインを完了するには確認コードが必要です。次の画面で入力してください。",
        mfa_session_expired: "確認セッションの有効期限が切れました。もう一度サインインしてください。",
        wrong_surface:
          "このアカウントは別の画面（学区または管理）でサインインします。正しいポータルをご利用ください。",
        unsupported_role: "お使いのアカウントのロールはこの画面ではまだサポートされていません。",
        login_failed: "サインインできませんでした。もう一度お試しください。",
      },
      notices: {
        password_reset: "パスワードがリセットされました。新しいパスワードでサインインしてください。",
        logged_out: "サインアウトしました。",
      },
    },
    signup: {
      promo_eyebrow: "ご家族向けトライアルを始める",
      promo_title: "より温かい学び方を、家族の一人ひとりの子どもに。",
      promo_subtitle:
        "数分で学習者を設定。適応型 AI チューター、感覚にやさしいモード、そしてすべての保護者が確認できる進捗。",
      benefit_tutors: "一人ひとりの学習者を今いる場所で迎える適応型 AI チューター。",
      benefit_sensory: "感覚にやさしいモード：標準、カーム、ハイコントラスト。",
      benefit_progress: "すべての保護者が確認できる進捗 — IEP に配慮し、静かに誠実に。",
      reassurance_title: "アカウントを作成するのは大人であり、子どもではありません。",
      reassurance_body:
        "次のステップで学習者を追加します。AIVO が子どもに自分のアカウントを作成するよう求めることはありません。COPPA / FERPA / SOC 2 の保護が初日からすべてに適用されます。",
      card_eyebrow: "アカウントを作成",
      card_title: "あなたについて少し教えてください",
      already_have: "すでにお持ちですか？",
      sign_in: "サインイン",
      submit: "アカウントを作成",
      submitting: "アカウントを作成しています…",
      name_label: "お名前",
      email_label: "メールアドレス",
      password_label: "パスワード",
      password_helper: "数字と記号を含む 8 文字以上。",
    },
    forgot: {
      heading: "パスワードをリセット",
      error_invalid_email: "アカウントを見つけられるよう、有効なメールアドレスを入力してください。",
      sent_eyebrow: "受信トレイをご確認ください",
      sent_title: "そのメールアドレスが登録されている場合、リセットリンクをお送りします。",
      sent_subtitle:
        "セキュリティのため、アカウントの有無はお伝えしません。リンクは 1 時間で期限切れになります。",
      sent_body:
        "1 分待っても表示されない場合は、迷惑メールやプロモーションをご確認ください。リンクは一度のみ有効で、その後期限切れになります。最初からやり直す場合は新しいものをリクエストしてください。",
      back_to_sign_in: "サインインに戻る",
      didnt_get_it: "届きませんでしたか？",
      try_different_email: "別のメールアドレスで試す",
      form_eyebrow: "パスワードを忘れた",
      form_title: "アカウントのメールアドレスを入力",
      form_subtitle: "新しいパスワードを設定するための安全なリンクをメールでお送りします。",
      submit: "リセットリンクを送信",
      remembered: "思い出しましたか？",
      sign_in: "サインイン",
      email_label: "メールアドレス",
    },
    reset: {
      heading: "新しいパスワードを選択",
      errors: {
        missing_token:
          "このリセットリンクにはセキュリティトークンがありません。パスワードを忘れたページから新しいリンクをリクエストしてください。",
        weak_password: "新しいパスワードは 12 文字以上にする必要があります。",
        mismatch: "2 つのパスワードがまだ一致しません。もう一度入力してください。",
        invalid_token:
          "このリセットリンクは期限切れか、すでに使用されています。続行するには新しいリンクをリクエストしてください。",
        policy_violation:
          "そのパスワードはポリシーを満たしていません。下記の詳細を確認し、より強力なものをお試しください。",
        reset_failed: "パスワードをリセットできませんでした。しばらくしてからもう一度お試しください。",
        mock_mode:
          "モックモードではパスワードのリセットは無効です。このフローをテストするには AUTH_MODE=custom と ID サービスで実行してください。",
      },
      no_token_eyebrow: "パスワードをリセット",
      no_token_title: "このリセットリンクは不完全です",
      no_token_subtitle:
        "メール内のリンクにはセキュリティトークンがありません。続行するには新しいものをリクエストしてください。",
      no_token_cta: "新しいリンクをリクエスト",
      no_token_body:
        "セキュリティのため、リセットリンクは 1 時間後に期限切れになり、一度のみ使用できます。",
      form_eyebrow: "パスワードをリセット",
      form_title: "新しいパスワードを設定",
      form_subtitle:
        "覚えやすく、推測されにくいものを選んでください。完了するとすべての端末からサインアウトします。",
      submit: "新しいパスワードを保存",
      need_link: "新しいリンクが必要ですか？",
      start_over: "最初からやり直す",
      new_password_label: "新しいパスワード",
      confirm_password_label: "新しいパスワードの確認",
      helper_too_short: "文字・数字・記号を組み合わせて 12 文字以上を使用してください。",
      helper_default: "12 文字以上を使用してください。使い回しや弱いパスワードは拒否されます。",
      mismatch_helper: "パスワードがまだ一致しません。",
    },
    mfa: {
      heading: "ご本人確認",
      card_eyebrow: "多要素サインイン",
      totp_title: "認証アプリのコードを入力",
      totp_subtitle: "認証アプリを開き、AIVO Learning に表示されている 6 桁のコードを入力してください。",
      totp_cta: "コードを確認",
      webauthn_title: "パスキーを使って続行",
      webauthn_subtitle:
        "お使いのアカウントはパスキーで保護されています。この画面ではパスキーのサインインはまだサポートされていません。下のリカバリーコードをご利用ください。",
      webauthn_cta: "リカバリーコードを確認",
      email_title: "確認コードを入力",
      email_subtitle: "登録済みのメールに 6 桁のコードを送信しました。10 分で期限切れになります。",
      email_cta: "コードを確認",
      resend_code: "コードを再送",
      cancel: "キャンセルして再度サインイン",
      code_label: "確認コード",
      recovery_hint:
        "アクセスできませんか？MFA を有効にしたときに保存したリカバリーコードのいずれかを、上のフィールドに入力してください。",
      errors: {
        missing_code: "続行するには、お送りした確認コードを入力してください。",
        invalid_code: "そのコードは一致しません。もう一度確認してお試しください。",
        locked:
          "失敗回数が多すぎます。アカウントは一時的にロックされています。数分後にもう一度お試しください。",
        resend_failed: "新しいコードを送信できませんでした。もう一度お試しください。",
        resend_exhausted: "再送の上限に達しました。新しいコードを取得するには、もう一度サインインしてください。",
      },
      notices: {
        resent: "新しいコードをメールに送信しました。",
      },
    },
  },

  ko: {
    common: {
      email: "이메일",
      password: "비밀번호",
      show_password: "비밀번호 표시",
      hide_password: "비밀번호 숨기기",
    },
    login: {
      brand_heading: "로그인하여 AIVO 여정을 계속하세요.",
      brand_body:
        "튜터, 미션, 가족 인사이트를 한곳에 모았습니다. 학습자가 생각하는 방식에 맞춰 조정됩니다.",
      trust_badge: "COPPA · FERPA · SOC 2",
      quote:
        "AIVO는 제 딸이 실제로 배우는 방식에 맞춰 줍니다. 우리가 맞서 싸운다는 느낌을 주지 않은 첫 번째 플랫폼입니다.",
      quote_attribution: "— 3학년 학습자의 학부모",
      welcome_back: "다시 오신 것을 환영합니다.",
      card_eyebrow: "로그인",
      card_title: "AIVO 계정으로 계속하기",
      card_subtitle: "AIVO 이메일과 비밀번호로 로그인하세요.",
      submit: "로그인",
      new_here: "처음이신가요?",
      create_account: "계정 만들기",
      forgot_password: "비밀번호를 잊으셨나요?",
      privacy_lead: "저희는 귀하의 데이터를 절대 판매하지 않습니다.",
      privacy_link: "개인정보 처리방침 읽기",
      errors: {
        invalid_credentials: "이메일 또는 비밀번호가 올바르지 않습니다.",
        invalid_role: "이 역할은 이 계정에서 사용할 수 없습니다.",
        missing_credentials: "로그인하려면 이메일과 비밀번호를 입력하세요.",
        mfa_required: "로그인을 완료하려면 인증 코드가 필요합니다. 다음 화면에서 입력하세요.",
        mfa_session_expired: "인증 세션이 만료되었습니다. 다시 로그인하세요.",
        wrong_surface:
          "이 계정은 다른 화면(교육구 또는 관리자)에서 로그인합니다. 올바른 포털을 사용하세요.",
        unsupported_role: "이 계정의 역할은 아직 이 화면에서 지원되지 않습니다.",
        login_failed: "로그인할 수 없습니다. 다시 시도하세요.",
      },
      notices: {
        password_reset: "비밀번호가 재설정되었습니다. 새 비밀번호로 로그인하세요.",
        logged_out: "로그아웃되었습니다.",
      },
    },
    signup: {
      promo_eyebrow: "가족 체험판 시작하기",
      promo_title: "더 따뜻한 배움의 방식, 가족의 모든 아이를 위해.",
      promo_subtitle:
        "몇 분 만에 학습자를 설정하세요. 적응형 AI 튜터, 감각 친화 모드, 그리고 모든 부모가 볼 수 있는 진행 상황.",
      benefit_tutors: "각 학습자가 있는 자리에서 함께하는 적응형 AI 튜터.",
      benefit_sensory: "감각 친화 모드: 표준, 차분, 고대비.",
      benefit_progress: "모든 부모가 볼 수 있는 진행 상황 — IEP를 이해하고 조용히 정직하게.",
      reassurance_title: "계정은 아이가 아니라 어른이 만듭니다.",
      reassurance_body:
        "다음 단계에서 학습자를 추가합니다. AIVO는 아이에게 직접 계정을 만들라고 요구하지 않으며, COPPA / FERPA / SOC 2 보호가 첫날부터 모든 것에 적용됩니다.",
      card_eyebrow: "계정 만들기",
      card_title: "당신에 대해 조금 알려 주세요",
      already_have: "이미 계정이 있으신가요?",
      sign_in: "로그인",
      submit: "계정 만들기",
      submitting: "계정을 만드는 중…",
      name_label: "이름",
      email_label: "이메일",
      password_label: "비밀번호",
      password_helper: "숫자와 기호를 포함해 8자 이상.",
    },
    forgot: {
      heading: "비밀번호 재설정",
      error_invalid_email: "계정을 찾을 수 있도록 유효한 이메일을 입력하세요.",
      sent_eyebrow: "받은편지함을 확인하세요",
      sent_title: "해당 이메일이 등록되어 있다면 재설정 링크가 곧 전송됩니다.",
      sent_subtitle: "보안을 위해 계정 존재 여부는 알려드리지 않습니다. 링크는 1시간 후 만료됩니다.",
      sent_body:
        "1분 후에도 보이지 않으면 스팸 또는 프로모션을 확인하세요. 링크는 한 번만 작동한 후 만료됩니다. 다시 시작해야 한다면 새 링크를 요청하세요.",
      back_to_sign_in: "로그인으로 돌아가기",
      didnt_get_it: "받지 못하셨나요?",
      try_different_email: "다른 이메일로 시도",
      form_eyebrow: "비밀번호 찾기",
      form_title: "계정의 이메일을 입력하세요",
      form_subtitle: "새 비밀번호를 설정할 수 있는 보안 링크를 이메일로 보내드립니다.",
      submit: "재설정 링크 보내기",
      remembered: "기억나셨나요?",
      sign_in: "로그인",
      email_label: "이메일",
    },
    reset: {
      heading: "새 비밀번호 선택",
      errors: {
        missing_token:
          "이 재설정 링크에 보안 토큰이 없습니다. 비밀번호 찾기 페이지에서 새 링크를 요청하세요.",
        weak_password: "새 비밀번호는 12자 이상이어야 합니다.",
        mismatch: "두 비밀번호가 아직 일치하지 않습니다. 다시 입력해 보세요.",
        invalid_token: "이 재설정 링크는 만료되었거나 이미 사용되었습니다. 계속하려면 새 링크를 요청하세요.",
        policy_violation: "해당 비밀번호는 정책에 맞지 않습니다. 아래 세부 정보를 확인하고 더 강력한 것을 시도하세요.",
        reset_failed: "비밀번호를 재설정할 수 없습니다. 잠시 후 다시 시도하세요.",
        mock_mode:
          "모의 모드에서는 비밀번호 재설정이 비활성화됩니다. 이 흐름을 테스트하려면 AUTH_MODE=custom과 ID 서비스로 실행하세요.",
      },
      no_token_eyebrow: "비밀번호 재설정",
      no_token_title: "이 재설정 링크가 불완전합니다",
      no_token_subtitle: "이메일의 링크에 보안 토큰이 없습니다. 계속하려면 새 링크를 요청하세요.",
      no_token_cta: "새 링크 요청",
      no_token_body: "보안을 위해 재설정 링크는 1시간 후 만료되며 한 번만 사용할 수 있습니다.",
      form_eyebrow: "비밀번호 재설정",
      form_title: "새 비밀번호 설정",
      form_subtitle:
        "기억하기 쉽지만 추측하기 어려운 것을 선택하세요. 완료되면 모든 기기에서 로그아웃됩니다.",
      submit: "새 비밀번호 저장",
      need_link: "새 링크가 필요하신가요?",
      start_over: "다시 시작",
      new_password_label: "새 비밀번호",
      confirm_password_label: "새 비밀번호 확인",
      helper_too_short: "문자, 숫자, 기호를 섞어 12자 이상 사용하세요.",
      helper_default: "12자 이상 사용하세요. 재사용되거나 약한 비밀번호는 거부됩니다.",
      mismatch_helper: "비밀번호가 아직 일치하지 않습니다.",
    },
    mfa: {
      heading: "본인 확인",
      card_eyebrow: "다중 요소 로그인",
      totp_title: "인증 앱 코드를 입력하세요",
      totp_subtitle: "인증 앱을 열고 AIVO Learning에 표시된 6자리 코드를 입력하세요.",
      totp_cta: "코드 확인",
      webauthn_title: "패스키로 계속하기",
      webauthn_subtitle:
        "귀하의 계정은 패스키로 보호됩니다. 이 화면에서는 아직 패스키 로그인이 지원되지 않습니다. 아래의 복구 코드를 사용하세요.",
      webauthn_cta: "복구 코드 확인",
      email_title: "인증 코드를 입력하세요",
      email_subtitle: "등록된 이메일로 6자리 코드를 보냈습니다. 10분 후 만료됩니다.",
      email_cta: "코드 확인",
      resend_code: "코드 다시 보내기",
      cancel: "취소하고 다시 로그인",
      code_label: "인증 코드",
      recovery_hint:
        "접근할 수 없나요? MFA를 켤 때 저장한 복구 코드 중 하나를 위 입력란에 입력하세요.",
      errors: {
        missing_code: "계속하려면 보내드린 인증 코드를 입력하세요.",
        invalid_code: "코드가 일치하지 않습니다. 다시 확인하고 시도하세요.",
        locked: "실패가 너무 많습니다. 계정이 일시적으로 잠겼습니다. 몇 분 후 다시 시도하세요.",
        resend_failed: "새 코드를 보낼 수 없습니다. 다시 시도하세요.",
        resend_exhausted: "재전송 한도에 도달했습니다. 새 코드를 받으려면 다시 로그인하세요.",
      },
      notices: {
        resent: "새 코드가 이메일로 전송되었습니다.",
      },
    },
  },

  ar: {
    common: {
      email: "البريد الإلكتروني",
      password: "كلمة المرور",
      show_password: "إظهار كلمة المرور",
      hide_password: "إخفاء كلمة المرور",
    },
    login: {
      brand_heading: "سجّل الدخول لمواصلة رحلتك مع AIVO.",
      brand_body:
        "معلّموك ومهامك ورؤى العائلة، كلها في مكان واحد، ومضبوطة وفق طريقة تفكير المتعلّم لديك.",
      trust_badge: "COPPA · FERPA · SOC 2",
      quote:
        "تتكيّف AIVO مع الطريقة التي تتعلّم بها ابنتي فعلًا. إنها أول منصة لم تشعرنا بأننا نقاومها.",
      quote_attribution: "— أحد والدي طالبة في الصف الثالث",
      welcome_back: "مرحبًا بعودتك.",
      card_eyebrow: "تسجيل الدخول",
      card_title: "المتابعة بحساب AIVO الخاص بك",
      card_subtitle: "سجّل الدخول ببريد AIVO وكلمة المرور الخاصة بك.",
      submit: "تسجيل الدخول",
      new_here: "جديد هنا؟",
      create_account: "إنشاء حساب",
      forgot_password: "هل نسيت كلمة المرور؟",
      privacy_lead: "نحن لا نبيع بياناتك أبدًا.",
      privacy_link: "اقرأ إشعار الخصوصية",
      errors: {
        invalid_credentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
        invalid_role: "هذا الدور غير متاح لهذا الحساب.",
        missing_credentials: "أدخل بريدك الإلكتروني وكلمة المرور لتسجيل الدخول.",
        mfa_required: "نحتاج إلى رمز تحقّق لإتمام تسجيل دخولك. أدخله في الشاشة التالية.",
        mfa_session_expired: "انتهت صلاحية جلسة التحقّق. يرجى تسجيل الدخول مرة أخرى.",
        wrong_surface:
          "يسجّل هذا الحساب الدخول من واجهة أخرى (المنطقة التعليمية أو الإدارة). استخدم البوابة الصحيحة.",
        unsupported_role: "دور حسابك غير مدعوم بعد على هذه الواجهة.",
        login_failed: "تعذّر تسجيل دخولك. يرجى المحاولة مرة أخرى.",
      },
      notices: {
        password_reset: "تمت إعادة تعيين كلمة مرورك. يرجى تسجيل الدخول بكلمة المرور الجديدة.",
        logged_out: "تم تسجيل خروجك.",
      },
    },
    signup: {
      promo_eyebrow: "ابدأ تجربتك العائلية",
      promo_title: "طريقة أكثر دفئًا للتعلّم، لكل طفل في العائلة.",
      promo_subtitle:
        "أعدّ المتعلّمين خلال دقائق. معلّمو ذكاء اصطناعي متكيّفون، وأوضاع مراعية للحواس، وتقدّم يستطيع كل والد رؤيته.",
      benefit_tutors: "معلّمو ذكاء اصطناعي متكيّفون يلتقون بكل متعلّم حيث هو.",
      benefit_sensory: "أوضاع مراعية للحواس: قياسي، هادئ، تباين عالٍ.",
      benefit_progress: "تقدّم يستطيع كل والد رؤيته — يراعي خطة التعليم الفردية وصادق بهدوء.",
      reassurance_title: "البالغون من يُنشئون الحسابات، وليس الأطفال.",
      reassurance_body:
        "ستضيف المتعلّمين في الخطوة التالية. لا تطلب AIVO من أي طفل أن يُنشئ حسابه الخاص، وتنطبق حماية COPPA / FERPA / SOC 2 على كل شيء منذ اليوم الأول.",
      card_eyebrow: "أنشئ حسابك",
      card_title: "أخبرنا قليلًا عن نفسك",
      already_have: "هل لديك حساب بالفعل؟",
      sign_in: "تسجيل الدخول",
      submit: "إنشاء حساب",
      submitting: "جارٍ إنشاء حسابك…",
      name_label: "اسمك",
      email_label: "البريد الإلكتروني",
      password_label: "كلمة المرور",
      password_helper: "‏8 أحرف على الأقل مع رقم ورمز.",
    },
    forgot: {
      heading: "أعد تعيين كلمة المرور",
      error_invalid_email: "أدخل بريدًا إلكترونيًا صالحًا حتى نتمكّن من العثور على حسابك.",
      sent_eyebrow: "تحقّق من بريدك الوارد",
      sent_title: "إذا كان هذا البريد مسجّلًا، فإن رابط إعادة التعيين في طريقه إليك.",
      sent_subtitle:
        "لأمانك، لا نكشف ما إذا كان الحساب موجودًا. تنتهي صلاحية الرابط خلال ساعة واحدة.",
      sent_body:
        "تحقّق من البريد العشوائي أو العروض إذا لم تره بعد دقيقة. يعمل الرابط مرة واحدة ثم تنتهي صلاحيته — اطلب رابطًا جديدًا إذا احتجت إلى البدء من جديد.",
      back_to_sign_in: "العودة إلى تسجيل الدخول",
      didnt_get_it: "لم يصلك؟",
      try_different_email: "جرّب بريدًا آخر",
      form_eyebrow: "نسيت كلمة المرور",
      form_title: "أدخل البريد الإلكتروني لحسابك",
      form_subtitle: "سنرسل إليك عبر البريد رابطًا آمنًا لتعيين كلمة مرور جديدة.",
      submit: "إرسال رابط إعادة التعيين",
      remembered: "تذكّرتها؟",
      sign_in: "تسجيل الدخول",
      email_label: "البريد الإلكتروني",
    },
    reset: {
      heading: "اختر كلمة مرور جديدة",
      errors: {
        missing_token:
          "ينقص رابط إعادة التعيين هذا رمز الأمان الخاص به. اطلب رابطًا جديدًا من صفحة نسيان كلمة المرور.",
        weak_password: "يجب ألا تقل كلمة مرورك الجديدة عن 12 حرفًا.",
        mismatch: "كلمتا المرور غير متطابقتين بعد. حاول إدخالهما مرة أخرى.",
        invalid_token:
          "انتهت صلاحية رابط إعادة التعيين هذا أو سبق استخدامه. اطلب رابطًا جديدًا للمتابعة.",
        policy_violation:
          "لا تستوفي كلمة المرور هذه سياستنا. راجع التفاصيل أدناه وجرّب كلمة أقوى.",
        reset_failed: "تعذّر إعادة تعيين كلمة مرورك. يرجى المحاولة بعد قليل.",
        mock_mode:
          "إعادة تعيين كلمة المرور معطّلة في الوضع التجريبي. شغّل باستخدام AUTH_MODE=custom وخدمة الهوية لاختبار هذا المسار.",
      },
      no_token_eyebrow: "إعادة تعيين كلمة المرور",
      no_token_title: "رابط إعادة التعيين هذا غير مكتمل",
      no_token_subtitle:
        "ينقص الرابط الموجود في بريدك رمز الأمان الخاص به. اطلب رابطًا جديدًا للمتابعة.",
      no_token_cta: "طلب رابط جديد",
      no_token_body:
        "لأمانك، تنتهي صلاحية روابط إعادة التعيين بعد ساعة واحدة ولا يمكن استخدامها إلا مرة واحدة.",
      form_eyebrow: "إعادة تعيين كلمة المرور",
      form_title: "عيّن كلمة مرورك الجديدة",
      form_subtitle:
        "اختر شيئًا يسهل تذكّره ويصعب تخمينه. سنسجّل خروجك من كل الأجهزة بمجرد الانتهاء.",
      submit: "حفظ كلمة المرور الجديدة",
      need_link: "هل تحتاج إلى رابط جديد؟",
      start_over: "ابدأ من جديد",
      new_password_label: "كلمة المرور الجديدة",
      confirm_password_label: "تأكيد كلمة المرور الجديدة",
      helper_too_short: "استخدم 12 حرفًا على الأقل بمزيج من الحروف والأرقام والرموز.",
      helper_default: "استخدم 12 حرفًا على الأقل. سنرفض كلمات المرور المعاد استخدامها أو الضعيفة.",
      mismatch_helper: "كلمتا المرور غير متطابقتين بعد.",
    },
    mfa: {
      heading: "تأكّد أنك أنت",
      card_eyebrow: "تسجيل دخول متعدّد العوامل",
      totp_title: "أدخل رمز تطبيق المصادقة",
      totp_subtitle: "افتح تطبيق المصادقة وأدخل الرمز المكوّن من 6 أرقام المعروض لـ AIVO Learning.",
      totp_cta: "تحقّق من الرمز",
      webauthn_title: "استخدم مفتاح المرور للمتابعة",
      webauthn_subtitle:
        "حسابك محميّ بمفتاح مرور. تسجيل الدخول بمفتاح المرور غير مدعوم بعد على هذه الواجهة — استخدم رمز استرداد أدناه.",
      webauthn_cta: "تحقّق من رمز الاسترداد",
      email_title: "أدخل رمز التحقّق",
      email_subtitle: "أرسلنا رمزًا من 6 أرقام إلى البريد المسجّل. تنتهي صلاحيته خلال 10 دقائق.",
      email_cta: "تحقّق من الرمز",
      resend_code: "إعادة إرسال الرمز",
      cancel: "إلغاء وتسجيل الدخول مرة أخرى",
      code_label: "رمز التحقّق",
      recovery_hint:
        "فقدت إمكانية الوصول؟ استخدم أحد رموز الاسترداد التي حفظتها عند تفعيل MFA — أدخله في الحقل أعلاه.",
      errors: {
        missing_code: "أدخل رمز التحقّق الذي أرسلناه للمتابعة.",
        invalid_code: "هذا الرمز غير مطابق. تحقّق منه وحاول مرة أخرى.",
        locked: "محاولات فاشلة كثيرة. حسابك مقفل مؤقتًا — حاول مرة أخرى بعد بضع دقائق.",
        resend_failed: "تعذّر إرسال رمز جديد. يرجى المحاولة مرة أخرى.",
        resend_exhausted: "بلغت حدّ إعادة الإرسال. سجّل الدخول مرة أخرى للحصول على رمز جديد.",
      },
      notices: {
        resent: "تم إرسال رمز جديد إلى بريدك الإلكتروني.",
      },
    },
  },

  hi: {
    common: {
      email: "ईमेल",
      password: "पासवर्ड",
      show_password: "पासवर्ड दिखाएँ",
      hide_password: "पासवर्ड छिपाएँ",
    },
    login: {
      brand_heading: "अपनी AIVO यात्रा जारी रखने के लिए साइन इन करें।",
      brand_body:
        "आपके ट्यूटर, मिशन और परिवार की जानकारी—सब एक ही जगह, इस तरह से ढली कि आपका सीखने वाला कैसे सोचता है।",
      trust_badge: "COPPA · FERPA · SOC 2",
      quote:
        "AIVO इस बात के अनुसार ढल जाता है कि मेरी बेटी वास्तव में कैसे सीखती है। यह पहला प्लेटफ़ॉर्म है जिसने हमें ऐसा महसूस नहीं कराया कि हम इससे लड़ रहे हैं।",
      quote_attribution: "— कक्षा 3 के एक विद्यार्थी के अभिभावक",
      welcome_back: "वापसी पर स्वागत है।",
      card_eyebrow: "साइन इन",
      card_title: "अपने AIVO खाते के साथ जारी रखें",
      card_subtitle: "अपने AIVO ईमेल और पासवर्ड से साइन इन करें।",
      submit: "साइन इन करें",
      new_here: "यहाँ नए हैं?",
      create_account: "खाता बनाएँ",
      forgot_password: "पासवर्ड भूल गए?",
      privacy_lead: "हम आपका डेटा कभी नहीं बेचते।",
      privacy_link: "गोपनीयता सूचना पढ़ें",
      errors: {
        invalid_credentials: "ईमेल या पासवर्ड गलत है।",
        invalid_role: "यह भूमिका इस खाते के लिए उपलब्ध नहीं है।",
        missing_credentials: "साइन इन करने के लिए अपना ईमेल और पासवर्ड दर्ज करें।",
        mfa_required: "आपका साइन इन पूरा करने के लिए हमें एक सत्यापन कोड चाहिए। इसे अगली स्क्रीन पर दर्ज करें।",
        mfa_session_expired: "आपका सत्यापन सत्र समाप्त हो गया। कृपया फिर से साइन इन करें।",
        wrong_surface:
          "यह खाता किसी अन्य सतह (ज़िला या व्यवस्थापक) पर साइन इन करता है। सही पोर्टल का उपयोग करें।",
        unsupported_role: "आपके खाते की भूमिका अभी इस सतह पर समर्थित नहीं है।",
        login_failed: "हम आपको साइन इन नहीं कर सके। कृपया फिर से प्रयास करें।",
      },
      notices: {
        password_reset: "आपका पासवर्ड रीसेट कर दिया गया है। कृपया अपने नए पासवर्ड से साइन इन करें।",
        logged_out: "आपको साइन आउट कर दिया गया है।",
      },
    },
    signup: {
      promo_eyebrow: "अपना पारिवारिक परीक्षण शुरू करें",
      promo_title: "सीखने का एक अधिक आत्मीय तरीका—परिवार के हर बच्चे के लिए।",
      promo_subtitle:
        "मिनटों में सीखने वाले सेट करें। अनुकूली AI ट्यूटर, संवेदी-अनुकूल मोड, और प्रगति जिसे हर अभिभावक देख सकता है।",
      benefit_tutors: "अनुकूली AI ट्यूटर जो हर सीखने वाले से वहीं मिलते हैं जहाँ वह है।",
      benefit_sensory: "संवेदी-अनुकूल मोड: मानक, शांत, उच्च कंट्रास्ट।",
      benefit_progress: "प्रगति जिसे हर अभिभावक देख सकता है—IEP के प्रति सजग और चुपचाप ईमानदार।",
      reassurance_title: "खाते वयस्क बनाते हैं, बच्चे नहीं।",
      reassurance_body:
        "आप अगले चरण में सीखने वाले जोड़ेंगे। AIVO कभी किसी बच्चे से अपना खाता बनाने को नहीं कहता, और COPPA / FERPA / SOC 2 सुरक्षा पहले दिन से हर चीज़ पर लागू होती है।",
      card_eyebrow: "अपना खाता बनाएँ",
      card_title: "हमें अपने बारे में थोड़ा बताएँ",
      already_have: "पहले से एक है?",
      sign_in: "साइन इन करें",
      submit: "खाता बनाएँ",
      submitting: "आपका खाता बनाया जा रहा है…",
      name_label: "आपका नाम",
      email_label: "ईमेल",
      password_label: "पासवर्ड",
      password_helper: "एक संख्या और एक प्रतीक के साथ कम से कम 8 अक्षर।",
    },
    forgot: {
      heading: "अपना पासवर्ड रीसेट करें",
      error_invalid_email: "एक मान्य ईमेल दर्ज करें ताकि हम आपका खाता ढूँढ सकें।",
      sent_eyebrow: "अपना इनबॉक्स देखें",
      sent_title: "यदि वह ईमेल पंजीकृत है, तो एक रीसेट लिंक रास्ते में है।",
      sent_subtitle: "आपकी सुरक्षा के लिए, हम यह नहीं बताते कि कोई खाता मौजूद है या नहीं। लिंक 1 घंटे में समाप्त हो जाता है।",
      sent_body:
        "यदि एक मिनट बाद भी न दिखे तो स्पैम या प्रचार देखें। लिंक एक बार काम करता है और फिर समाप्त हो जाता है—यदि आपको फिर से शुरू करना हो तो नया अनुरोध करें।",
      back_to_sign_in: "साइन इन पर वापस जाएँ",
      didnt_get_it: "नहीं मिला?",
      try_different_email: "कोई दूसरा ईमेल आज़माएँ",
      form_eyebrow: "पासवर्ड भूल गए",
      form_title: "अपने खाते का ईमेल दर्ज करें",
      form_subtitle: "हम आपको नया पासवर्ड सेट करने के लिए एक सुरक्षित लिंक ईमेल करेंगे।",
      submit: "रीसेट लिंक भेजें",
      remembered: "याद आ गया?",
      sign_in: "साइन इन करें",
      email_label: "ईमेल",
    },
    reset: {
      heading: "एक नया पासवर्ड चुनें",
      errors: {
        missing_token:
          "इस रीसेट लिंक में इसका सुरक्षा टोकन गायब है। पासवर्ड-भूल पृष्ठ से नया लिंक अनुरोध करें।",
        weak_password: "आपका नया पासवर्ड कम से कम 12 अक्षरों का होना चाहिए।",
        mismatch: "दोनों पासवर्ड अभी मेल नहीं खाते। उन्हें फिर से दर्ज करने का प्रयास करें।",
        invalid_token:
          "यह रीसेट लिंक समाप्त हो गया है या पहले ही उपयोग किया जा चुका है। जारी रखने के लिए नया लिंक अनुरोध करें।",
        policy_violation:
          "वह पासवर्ड हमारी नीति पर खरा नहीं उतरता। नीचे विवरण देखें और कोई अधिक मज़बूत आज़माएँ।",
        reset_failed: "हम आपका पासवर्ड रीसेट नहीं कर सके। कृपया थोड़ी देर में फिर से प्रयास करें।",
        mock_mode:
          "मॉक मोड में पासवर्ड रीसेट अक्षम है। इस प्रवाह का परीक्षण करने के लिए AUTH_MODE=custom और पहचान सेवा के साथ चलाएँ।",
      },
      no_token_eyebrow: "पासवर्ड रीसेट करें",
      no_token_title: "यह रीसेट लिंक अधूरा है",
      no_token_subtitle: "आपके ईमेल के लिंक में इसका सुरक्षा टोकन गायब है। जारी रखने के लिए नया अनुरोध करें।",
      no_token_cta: "नया लिंक अनुरोध करें",
      no_token_body: "आपकी सुरक्षा के लिए, रीसेट लिंक 1 घंटे बाद समाप्त हो जाते हैं और केवल एक बार उपयोग किए जा सकते हैं।",
      form_eyebrow: "पासवर्ड रीसेट करें",
      form_title: "अपना नया पासवर्ड सेट करें",
      form_subtitle:
        "ऐसा कुछ चुनें जो याद रखने योग्य हो पर अनुमान लगाना कठिन हो। पूरा होने पर हम आपको हर डिवाइस से साइन आउट कर देंगे।",
      submit: "नया पासवर्ड सहेजें",
      need_link: "नए लिंक की ज़रूरत है?",
      start_over: "फिर से शुरू करें",
      new_password_label: "नया पासवर्ड",
      confirm_password_label: "नए पासवर्ड की पुष्टि करें",
      helper_too_short: "अक्षरों, संख्याओं और प्रतीकों के मिश्रण के साथ कम से कम 12 अक्षर उपयोग करें।",
      helper_default: "कम से कम 12 अक्षर उपयोग करें। हम दोबारा उपयोग किए गए या कमज़ोर पासवर्ड अस्वीकार करेंगे।",
      mismatch_helper: "पासवर्ड अभी मेल नहीं खाते।",
    },
    mfa: {
      heading: "पुष्टि करें कि यह आप हैं",
      card_eyebrow: "बहु-कारक साइन-इन",
      totp_title: "अपना प्रमाणक कोड दर्ज करें",
      totp_subtitle: "अपना प्रमाणक ऐप खोलें और AIVO Learning के लिए दिखाया गया 6-अंकीय कोड दर्ज करें।",
      totp_cta: "कोड सत्यापित करें",
      webauthn_title: "जारी रखने के लिए अपनी पासकी का उपयोग करें",
      webauthn_subtitle:
        "आपका खाता एक पासकी से सुरक्षित है। इस सतह पर पासकी साइन-इन अभी समर्थित नहीं है—नीचे एक पुनर्प्राप्ति कोड उपयोग करें।",
      webauthn_cta: "पुनर्प्राप्ति कोड सत्यापित करें",
      email_title: "अपना सत्यापन कोड दर्ज करें",
      email_subtitle: "हमने पंजीकृत ईमेल पर 6-अंकीय कोड भेजा है। यह 10 मिनट में समाप्त हो जाता है।",
      email_cta: "कोड सत्यापित करें",
      resend_code: "कोड फिर से भेजें",
      cancel: "रद्द करें और फिर से साइन इन करें",
      code_label: "सत्यापन कोड",
      recovery_hint:
        "पहुँच खो गई? MFA चालू करते समय आपने जो पुनर्प्राप्ति कोड सहेजे थे, उनमें से एक ऊपर के क्षेत्र में दर्ज करें।",
      errors: {
        missing_code: "जारी रखने के लिए हमारे भेजे गए सत्यापन कोड को दर्ज करें।",
        invalid_code: "वह कोड मेल नहीं खाता। दोबारा जाँचें और फिर से प्रयास करें।",
        locked: "बहुत अधिक असफल प्रयास। आपका खाता अस्थायी रूप से लॉक है—कृपया कुछ मिनटों में फिर से प्रयास करें।",
        resend_failed: "हम नया कोड नहीं भेज सके। कृपया फिर से प्रयास करें।",
        resend_exhausted: "आप फिर से भेजने की सीमा तक पहुँच गए हैं। नया कोड पाने के लिए कृपया फिर से साइन इन करें।",
      },
      notices: {
        resent: "आपके ईमेल पर एक नया कोड भेजा गया है।",
      },
    },
  },
};

let written = 0;
for (const [locale, auth] of Object.entries(AUTH)) {
  const file = join(messagesDir, `${locale}.json`);
  const json = JSON.parse(readFileSync(file, "utf8"));
  json.auth = auth;
  writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
  written += 1;
  console.log(`seed-auth-i18n: merged auth namespace → messages/${locale}.json`);
}
console.log(`\nseed-auth-i18n: done — ${written} locale catalogs updated.`);
