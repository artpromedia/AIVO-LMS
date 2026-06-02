#!/usr/bin/env node
/**
 * seed-onboarding-i18n — translator for the `onboarding` namespace.
 *
 * The onboarding slice (welcome → sign-in/up → role → family setup →
 * learner → consent → permissions → PIN → verify → privacy/terms →
 * IEP upload → invites → error states; 20 screens) was extracted into
 * `onboarding.*` keys. This script holds the human-reviewed copy for all
 * ten shipped locales — English included, as the authored source — and
 * writes the `onboarding` subtree into each `messages/<locale>.json`,
 * preserving every other namespace.
 *
 * Re-runnable: it overwrites only the `onboarding` key. Brand tokens
 * (AIVO, IEP, 504, PIN, COPPA, FERPA, SOC 2, OS) and example codes are
 * intentionally left as-is.
 *
 *   node scripts/seed-onboarding-i18n.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const messagesDir = join(repoRoot, "apps/web-v2/lib/i18n/messages");

const ONBOARDING = {
  en: {
    common: {
      back: "Back",
      continue: "Continue",
      terms: "Terms",
      privacy: "Privacy",
      copyright: "© AIVO Learning",
      email: "Email",
      password: "Password",
      show: "Show",
      hide: "Hide",
      show_password: "Show password",
      hide_password: "Hide password",
      back_to_consent: "Back to consent",
      badge_required: "Required",
      badge_optional: "Optional",
      badge_recommended: "Recommended",
      badge_explicit: "Explicit",
      contact_support: "Contact support",
    },
    steps: {
      about_you: "About you",
      role: "Role",
      consent: "Consent",
      family: "Family",
      join_school: "Join school",
      join_district: "Join district",
    },
    welcome: {
      brand_title: "Learning that meets every child where they are.",
      brand_body:
        "AIVO is a calm, accessible learning platform built with families, teachers, and learners — including children who learn differently.",
      eyebrow: "Welcome",
      title: "Let's get started.",
      subtitle:
        "Sign in to continue, or create a new account for your family, school, or district.",
      sign_in: "Sign in",
      create_account: "Create an account",
      invite_lead: "Have an invite code from a school or district?",
      invite_link: "Use an invite link",
      body: "AIVO works on the web, on tablets, and on phones. You can switch between devices anytime — your progress comes with you.",
    },
    signin: {
      trouble: "Trouble signing in?",
      eyebrow: "Welcome back",
      title: "Sign in",
      subtitle: "Use the email you set up with your family, school, or district.",
      reassure_title: "We never sell your data.",
      reassure_body:
        "Your email is used only to identify your account. Read the privacy notice for more.",
      reassure_link: "Read the privacy notice",
      submit: "Sign in",
      forgot: "Forgot password?",
      create_account: "Create an account",
    },
    signup: {
      eyebrow: "Create your account",
      title_invite: "Accept your invite",
      title_default: "Tell us a little about you",
      subtitle_invite:
        "Paste the code from your school or district invitation. You can finish setting up your role next.",
      subtitle_default:
        "We'll personalize the next steps based on who you are setting up AIVO for.",
      reassure_title: "Adults set up accounts, not children.",
      reassure_body:
        "If you are creating an account for a child, you'll add them on the next step. AIVO never asks a child to create their own account.",
      already_have: "Already have an account?",
      sign_in: "Sign in",
      invite_label: "Invite code",
      invite_helper: "Your school or district sent this in the welcome email.",
      name_label: "Your name",
      password_helper:
        "At least 12 characters. We'll check it isn't in any known leak before saving it.",
    },
    role: {
      eyebrow: "Choose your role",
      title: "Who are you setting up AIVO for?",
      subtitle:
        "We'll customize the next steps. You can add other roles later — many adults are both a parent and a teacher.",
      reassure_title: "Children don't pick a role.",
      reassure_body:
        "A parent or teacher adds a learner. The learner sees a kid-friendly view with their schoolwork — never this page.",
      parent_label: "A parent or caregiver",
      parent_desc: "Set up AIVO for one or more children at home.",
      teacher_label: "A teacher",
      teacher_desc: "Join a school that already uses AIVO, or start a class.",
      school_admin_label: "A school administrator",
      school_admin_desc: "Manage staff, classes, and compliance for a school.",
      district_admin_label: "A district administrator",
      district_admin_desc: "Oversee multiple schools, billing, and reporting.",
    },
    parent_setup: {
      eyebrow: "Family setup",
      title: "Tell us about your household.",
      subtitle:
        "You'll add your children on the next step. This information helps us route invitations and share progress with the right grown-ups.",
      reassure_title: "Household details stay private.",
      reassure_body:
        "We never sell household information. Co-parents only see learners they are added to.",
      reassure_link: "What we collect",
      continue: "Continue — add a learner",
      household_label: "Household name (optional)",
      household_placeholder: "e.g. The Okafor family",
      household_helper: "Shown to teachers when they message you. You can change it later.",
      coparent_label: "Invite a co-parent or caregiver (optional)",
      coparent_helper:
        "They'll get an email with their own sign-in. You can both approve consents and view progress.",
    },
    learner_new: {
      eyebrow: "Add a learner",
      title: "Tell us about your child.",
      subtitle:
        "Use only what you'd say out loud — first name is fine. You can add more learners later from your home screen.",
      reassure_title: "We collect the minimum needed.",
      reassure_body:
        "No surname, no date of birth, no address required here. You'll see exactly what teachers and AI use on the consent step.",
      reassure_link: "What we use",
      continue: "Continue to consent",
      first_name_label: "Learner first name (or nickname)",
      first_name_placeholder: "e.g. Emma",
      grade_band_label: "Grade band",
      grade_band_placeholder: "Pick a band",
      grade_band_help: "We use a band, not a birthday. You can change it any time.",
      iep_legend: "Does your child have an IEP or 504 plan?",
      iep_help:
        "You can upload it on the next steps — only with your explicit consent. Skip if you'd rather decide later.",
      iep_yes: "Yes",
      iep_no: "No",
      iep_unsure: "Not sure yet",
    },
    consent: {
      eyebrow: "Your consent — your control",
      title: "Choose what AIVO can do.",
      subtitle:
        "Each row is a separate choice. You can change any of these later from Settings → Privacy.",
      reassure_title: "No bundles. No dark patterns.",
      reassure_body:
        "School data sharing and AI personalization are independent. You can say yes to one and no to the other.",
      reassure_link: "Read the full privacy notice",
      footer_note:
        "You'll be asked to re-confirm any choice that affects your child later — never silently changed.",
      row_parent_title: "Parent / guardian consent",
      row_parent_desc:
        "I confirm I am the parent or legal guardian for the learners on this account, and I agree to AIVO's Terms.",
      row_school_title: "Share progress with my child's school",
      row_school_desc:
        "Lets your child's teachers see mastery, lessons, and IEP supports. Independent from any AI choice below.",
      row_ai_title: "Use AI to personalize learning",
      row_ai_desc:
        "AIVO uses your child's responses to adjust pacing, examples, and hints. We never sell this data. Turning this off keeps your child in non-personalized lessons.",
      row_mkt_title: "Send me product news",
      row_mkt_desc: "A short monthly email. Never sent to learners.",
      legal_summary: "What each choice actually changes (plain English).",
      legal_parent_label: "Parent / guardian:",
      legal_parent_body:
        "required to create accounts for anyone under 18. Verifies you are the legal guardian.",
      legal_school_label: "School sharing:",
      legal_school_body:
        "teachers see mastery, lessons, and (if uploaded) IEP supports. No marketing or third-party sharing.",
      legal_ai_label: "AI personalization:",
      legal_ai_body:
        "AIVO adapts pacing and hints to your child. Training data is never used to identify an individual learner.",
      legal_mkt_label: "Product news:",
      legal_mkt_body: "a low-volume email list. Unsubscribe in one click.",
    },
    permissions: {
      eyebrow: "Device permissions",
      title: "What may AIVO use on this device?",
      subtitle:
        "These are the only device features AIVO ever asks for. We never request location, contacts, or photo library access.",
      reassure_title: "Your browser asks for these too.",
      reassure_body:
        "When AIVO actually needs the microphone or camera, your browser will pop its own permission prompt — you can deny it even if you said yes here.",
      continue: "Continue — set up a PIN",
      mic_title: "Microphone",
      mic_desc:
        "Used only for speak-to-read lessons and AI tutor voice mode. Off by default — turn on if your child wants to read aloud.",
      cam_title: "Camera",
      cam_desc: "Used only when scanning a homework page or document. AIVO never records video.",
      notifs_title: "Notifications",
      notifs_desc:
        "Approval requests, weekly progress digests, and safety messages. Lesson reminders are off by default — you can enable them later.",
    },
    pin: {
      eyebrow: "Learner PIN",
      title: "Pick a 4-digit PIN for your child.",
      subtitle:
        "Your child uses this PIN to unlock their learning on this device. The PIN never replaces your parent sign-in.",
      reassure_title: "A PIN is a soft lock, not a vault.",
      reassure_body:
        "It keeps a sibling from opening the wrong profile. Sensitive actions still require a parent sign-in.",
      save: "Save PIN",
      skip: "Skip — set a PIN later from Settings",
      choose_pin: "Choose PIN",
      confirm_pin: "Confirm PIN",
      mismatch: "Those don't match. Try again.",
    },
    parent_verify: {
      eyebrow: "Parent verification",
      title_phone: "Verify it's really you.",
      title_code: "Enter the 6-digit code.",
      subtitle_phone:
        "We'll text a one-time code to confirm you're the adult on this account. We never use this number for marketing.",
      subtitle_code: "We sent a code to your phone. It expires in 10 minutes.",
      reassure_title: "Children can't bypass this step.",
      reassure_body:
        "A child profile becomes active only after a parent has verified. This is how AIVO enforces parental approval.",
      send_code: "Send code",
      verify_continue: "Verify and continue",
      use_diff_phone: "Use a different phone number",
      phone_label: "Mobile phone",
      phone_helper: "We use this only for verification and account recovery.",
      code_label: "6-digit code",
    },
    privacy: {
      eyebrow: "Privacy",
      title: "What AIVO does — in plain English.",
      subtitle:
        "Below is the short version. Each section opens to the full legal text. You can re-read this any time from Settings.",
      reassure_title: "One promise above everything else.",
      reassure_body:
        "We never sell student data. Not to advertisers, not to vendors, not to AI training partners.",
      collect_summary: "What we collect — only what's needed to teach.",
      collect_account: "Account: parent / staff name, email.",
      collect_learner:
        "Learner: first name or nickname, grade band, optional accommodations (IEP / 504), responses to lessons.",
      collect_device: "Device: browser, OS, app version — for debugging only.",
      ai_summary: "How AI is used.",
      ai_body:
        "When AI personalization is on, your child's responses adjust their next lesson — pacing, examples, hints. We do not use these responses to identify your child. We do not train foundation models on identifiable student work. Model providers are bound by contract to delete prompt and completion data within 30 days.",
      who_summary: "Who sees what.",
      who_you: "You and any co-parent you added: full progress.",
      who_teachers:
        "Teachers at the school you opted in to: lesson mastery and IEP supports for their classes only.",
      who_staff:
        "AIVO staff: encrypted access for support, with audit logs. We never browse student work casually.",
      who_advertisers: "Advertisers: never.",
      rights_summary: "Your rights and how to delete.",
      rights_body:
        "You can export every record AIVO holds about your account or your child from Settings → Privacy → Export. You can delete the account the same way. Deletion is permanent within 30 days; you can cancel during the grace period.",
    },
    terms: {
      eyebrow: "Terms",
      title: "AIVO Terms of Use.",
      subtitle:
        "Summary first. Tap any section for the full legal text. Last updated: this page is a placeholder for the final legal-reviewed copy.",
      agree_summary: "What you agree to.",
      agree_body:
        "You agree to use AIVO for the purpose of educating yourself, your child, or your students. You won't try to bypass safety filters, re-sell access, or use AIVO output to train competing models.",
      aivo_summary: "What AIVO agrees to.",
      aivo_body:
        "We will keep your data private as described in our privacy notice, give you 30 days' notice of any material change to these terms, and let you export everything we hold at any time.",
      children_summary: "Children and families.",
      children_body:
        "For accounts that include learners under 13, a verified parent or guardian must consent. We do not knowingly create child-controlled accounts. Schools acting in loco parentis must have a signed data processing agreement on file.",
      wrong_summary: "If something goes wrong.",
      wrong_body:
        "Either of us can end this agreement. Your data export remains available for 90 days after closure. Disputes are governed by the laws of the jurisdiction in your billing address.",
    },
    recovery: {
      eyebrow: "Account recovery",
      title: "Trouble signing in? We'll send a link.",
      subtitle:
        "Enter the email on your AIVO account. We'll email a one-time link that lets you reset your password.",
      reassure_title: "We don't say whether the email exists.",
      reassure_body:
        "Either way, we'll show the same confirmation. This stops bad actors from learning which addresses have accounts.",
      submit: "Send recovery link",
      back_to_sign_in: "Back to sign in",
    },
    child_approval: {
      eyebrow: "Final step",
      title: "Approve your child's access.",
      subtitle:
        "These are the experiences your child can use on AIVO. You can change any of these from their profile later.",
      reassure_title: "Your child is waiting on you.",
      reassure_body:
        "Until you press Approve, this profile is in a holding state. Your child cannot sign in or start lessons.",
      approve: "Approve and finish",
      footer_note: "You'll arrive on the parent home with your child set up and ready.",
      comm_title: "Messages with teachers",
      comm_desc:
        "Your child can read messages from teachers and reply with adult-moderated quick responses.",
      ai_title: "AI tutor",
      ai_desc:
        "A conversational tutor that explains concepts, never produces final answers, and routes safety topics to an adult.",
      voice_title: "Voice mode",
      voice_desc:
        "Lets your child speak to the tutor and listen back. Off by default — uses the microphone.",
    },
    iep_upload: {
      eyebrow: "IEP / 504 supports",
      title: "Add your child's plan — only if you want to.",
      subtitle:
        "If you have an IEP or 504, AIVO can extract accommodations (extra time, read-aloud, etc.) so lessons match it from day one. You can do this later, or never.",
      reassure_title: "This is a sensitive document.",
      reassure_body:
        "Only you, any co-parent, and teachers at the schools you've opted in to will see it. AI extraction runs in-tenant. The original file is encrypted at rest.",
      reassure_link: "How IEPs are handled",
      upload_continue: "Upload and continue",
      skip: "Skip for now",
      footer_note: "You can upload later from your learner's profile.",
      consent_title: "I explicitly consent to upload an IEP / 504 plan",
      consent_desc:
        "AIVO will store the document, extract listed accommodations, and apply them to lessons. You can delete it any time.",
      choose_file: "Choose a PDF or Word file",
      file_help:
        "Files up to 20 MB. We'll show a preview of what we extracted before applying anything.",
      legal_summary: "What gets extracted, and what doesn't.",
      legal_extracted_label: "Extracted:",
      legal_extracted_body:
        "accommodation list (extra time, read aloud, breaks), goal categories, support service hours.",
      legal_never_label: "Never extracted:",
      legal_never_body:
        "medical diagnoses, psychological evaluations, parent statements, signatures.",
      legal_teachers_label: "Visible to teachers:",
      legal_teachers_body: "only the accommodations list, only at schools you've opted in to.",
    },
    invite_school: {
      eyebrow: "School invite",
      title: "Join your school on AIVO.",
      subtitle:
        "Paste the code your school sent you. If you don't have one, ask your school admin — only invited staff can join.",
      reassure_title: "School staff cannot self-enroll.",
      reassure_body: "An admin must invite you. This protects rosters and student data.",
      join: "Join school",
      code_label: "Invite code",
      email_label: "Your school email",
      email_helper: "Must match the email the admin invited.",
    },
    invite_district: {
      eyebrow: "District invite",
      title: "Join your district on AIVO.",
      subtitle:
        "District admin invites are issued by AIVO during onboarding. Your district success manager will send you a one-time code.",
      reassure_title: "District admin step-up is enforced.",
      reassure_body:
        "Every sign-in for this role requires a fresh biometric or PIN check. AIVO never lets a single password unlock district data.",
      code_label: "District invite code",
      email_label: "Your district email",
    },
    error: {
      expired_invite_eyebrow: "Invite expired",
      expired_invite_title: "This invite isn't valid anymore.",
      expired_invite_subtitle:
        "Invites expire after 30 days. Ask the person who sent it to issue a new one.",
      expired_invite_body:
        "If your school or district sent this, contact your admin. AIVO support can also re-send if you provide the original code.",
      expired_invite_reassure_title: "We didn't lose your spot.",
      expired_invite_reassure_body:
        "Your seat at the school or district is still reserved — only the link expired.",
      expired_invite_primary: "Back to welcome",
      expired_invite_secondary: "Need help signing in?",
      offline_eyebrow: "Offline",
      offline_title: "We can't reach AIVO right now.",
      offline_subtitle: "Check your connection and try again.",
      offline_body:
        "Some learner activities work offline once a lesson has loaded — but setup needs a live connection.",
      offline_reassure_title: "Nothing was lost.",
      offline_reassure_body:
        "We'll pick up exactly where you left off as soon as you're back online.",
      offline_primary: "Try again",
      blocked_eyebrow: "Account blocked",
      blocked_title: "This account is paused.",
      blocked_subtitle:
        "AIVO support has paused this account. This is usually a billing or compliance review.",
      blocked_body:
        "You'll get an email at the address on file once the review finishes, usually within one business day.",
      blocked_reassure_title: "Your child's data is safe.",
      blocked_reassure_body: "We don't delete anything during a review — pause and resume only.",
      blocked_primary: "Back to welcome",
      generic_eyebrow: "Something went wrong",
      generic_title: "We hit a snag.",
      generic_subtitle: "It's probably temporary — try again in a moment.",
      generic_body:
        "If this keeps happening, please contact AIVO support and mention what you were trying to do.",
      generic_reassure_title: "Nothing was charged or saved incorrectly.",
      generic_reassure_body: "AIVO never persists half-finished setup data.",
      generic_primary: "Start over",
    },
  },
  es: {
    common: {
      back: "Atrás",
      continue: "Continuar",
      terms: "Términos",
      privacy: "Privacidad",
      copyright: "© AIVO Learning",
      email: "Correo electrónico",
      password: "Contraseña",
      show: "Mostrar",
      hide: "Ocultar",
      show_password: "Mostrar contraseña",
      hide_password: "Ocultar contraseña",
      back_to_consent: "Volver al consentimiento",
      badge_required: "Obligatorio",
      badge_optional: "Opcional",
      badge_recommended: "Recomendado",
      badge_explicit: "Explícito",
      contact_support: "Contactar con soporte",
    },
    steps: {
      about_you: "Sobre ti",
      role: "Rol",
      consent: "Consentimiento",
      family: "Familia",
      join_school: "Unirse a la escuela",
      join_district: "Unirse al distrito",
    },
    welcome: {
      brand_title: "Aprendizaje que acompaña a cada niño donde está.",
      brand_body:
        "AIVO es una plataforma de aprendizaje tranquila y accesible, creada con familias, docentes y estudiantes, incluidos los niños que aprenden de forma diferente.",
      eyebrow: "Bienvenido",
      title: "Empecemos.",
      subtitle:
        "Inicia sesión para continuar o crea una nueva cuenta para tu familia, escuela o distrito.",
      sign_in: "Iniciar sesión",
      create_account: "Crear una cuenta",
      invite_lead: "¿Tienes un código de invitación de una escuela o distrito?",
      invite_link: "Usar un enlace de invitación",
      body: "AIVO funciona en la web, en tabletas y en teléfonos. Puedes cambiar de dispositivo en cualquier momento: tu progreso te acompaña.",
    },
    signin: {
      trouble: "¿Problemas para iniciar sesión?",
      eyebrow: "Bienvenido de nuevo",
      title: "Iniciar sesión",
      subtitle: "Usa el correo con el que te registraste con tu familia, escuela o distrito.",
      reassure_title: "Nunca vendemos tus datos.",
      reassure_body:
        "Tu correo se usa solo para identificar tu cuenta. Lee el aviso de privacidad para más información.",
      reassure_link: "Lee el aviso de privacidad",
      submit: "Iniciar sesión",
      forgot: "¿Olvidaste tu contraseña?",
      create_account: "Crear una cuenta",
    },
    signup: {
      eyebrow: "Crea tu cuenta",
      title_invite: "Acepta tu invitación",
      title_default: "Cuéntanos un poco sobre ti",
      subtitle_invite:
        "Pega el código de la invitación de tu escuela o distrito. Podrás terminar de configurar tu rol a continuación.",
      subtitle_default:
        "Personalizaremos los siguientes pasos según para quién estás configurando AIVO.",
      reassure_title: "Los adultos crean las cuentas, no los niños.",
      reassure_body:
        "Si estás creando una cuenta para un niño, lo añadirás en el siguiente paso. AIVO nunca pide a un niño que cree su propia cuenta.",
      already_have: "¿Ya tienes una cuenta?",
      sign_in: "Iniciar sesión",
      invite_label: "Código de invitación",
      invite_helper: "Tu escuela o distrito lo envió en el correo de bienvenida.",
      name_label: "Tu nombre",
      password_helper:
        "Al menos 12 caracteres. Comprobaremos que no esté en ninguna filtración conocida antes de guardarla.",
    },
    role: {
      eyebrow: "Elige tu rol",
      title: "¿Para quién estás configurando AIVO?",
      subtitle:
        "Personalizaremos los siguientes pasos. Puedes añadir otros roles después: muchos adultos son a la vez padres y docentes.",
      reassure_title: "Los niños no eligen un rol.",
      reassure_body:
        "Un padre o docente añade a un estudiante. El estudiante ve una vista pensada para niños con sus tareas, nunca esta página.",
      parent_label: "Madre, padre o cuidador",
      parent_desc: "Configura AIVO para uno o más niños en casa.",
      teacher_label: "Docente",
      teacher_desc: "Únete a una escuela que ya usa AIVO o crea una clase.",
      school_admin_label: "Administrador de escuela",
      school_admin_desc: "Gestiona el personal, las clases y el cumplimiento de una escuela.",
      district_admin_label: "Administrador de distrito",
      district_admin_desc: "Supervisa varias escuelas, la facturación y los informes.",
    },
    parent_setup: {
      eyebrow: "Configuración familiar",
      title: "Cuéntanos sobre tu hogar.",
      subtitle:
        "Añadirás a tus hijos en el siguiente paso. Esta información nos ayuda a dirigir las invitaciones y compartir el progreso con los adultos adecuados.",
      reassure_title: "Los datos del hogar son privados.",
      reassure_body:
        "Nunca vendemos la información del hogar. Los co-padres solo ven a los estudiantes a los que están vinculados.",
      reassure_link: "Qué recopilamos",
      continue: "Continuar — añadir un estudiante",
      household_label: "Nombre del hogar (opcional)",
      household_placeholder: "p. ej. La familia Okafor",
      household_helper: "Se muestra a los docentes cuando te escriben. Puedes cambiarlo después.",
      coparent_label: "Invitar a un co-padre o cuidador (opcional)",
      coparent_helper:
        "Recibirán un correo con su propio inicio de sesión. Ambos pueden aprobar consentimientos y ver el progreso.",
    },
    learner_new: {
      eyebrow: "Añadir un estudiante",
      title: "Cuéntanos sobre tu hijo.",
      subtitle:
        "Usa solo lo que dirías en voz alta: el nombre de pila es suficiente. Puedes añadir más estudiantes después desde tu pantalla de inicio.",
      reassure_title: "Recopilamos lo mínimo necesario.",
      reassure_body:
        "Aquí no se requiere apellido, fecha de nacimiento ni dirección. Verás exactamente qué usan los docentes y la IA en el paso de consentimiento.",
      reassure_link: "Qué usamos",
      continue: "Continuar al consentimiento",
      first_name_label: "Nombre del estudiante (o apodo)",
      first_name_placeholder: "p. ej. Emma",
      grade_band_label: "Nivel escolar",
      grade_band_placeholder: "Elige un nivel",
      grade_band_help:
        "Usamos un nivel, no una fecha de nacimiento. Puedes cambiarlo cuando quieras.",
      iep_legend: "¿Tu hijo tiene un plan IEP o 504?",
      iep_help:
        "Puedes subirlo en los siguientes pasos, solo con tu consentimiento explícito. Omítelo si prefieres decidir más tarde.",
      iep_yes: "Sí",
      iep_no: "No",
      iep_unsure: "Aún no estoy seguro",
    },
    consent: {
      eyebrow: "Tu consentimiento, tu control",
      title: "Elige lo que AIVO puede hacer.",
      subtitle:
        "Cada fila es una elección independiente. Puedes cambiar cualquiera de ellas después en Ajustes → Privacidad.",
      reassure_title: "Sin paquetes. Sin patrones engañosos.",
      reassure_body:
        "Compartir datos con la escuela y la personalización con IA son independientes. Puedes decir sí a una y no a la otra.",
      reassure_link: "Lee el aviso de privacidad completo",
      footer_note:
        "Te pediremos que vuelvas a confirmar cualquier elección que afecte a tu hijo: nunca se cambia en silencio.",
      row_parent_title: "Consentimiento del padre / tutor",
      row_parent_desc:
        "Confirmo que soy el padre o tutor legal de los estudiantes de esta cuenta y acepto los Términos de AIVO.",
      row_school_title: "Compartir el progreso con la escuela de mi hijo",
      row_school_desc:
        "Permite que los docentes de tu hijo vean el dominio, las lecciones y los apoyos del IEP. Independiente de cualquier elección de IA a continuación.",
      row_ai_title: "Usar IA para personalizar el aprendizaje",
      row_ai_desc:
        "AIVO usa las respuestas de tu hijo para ajustar el ritmo, los ejemplos y las pistas. Nunca vendemos estos datos. Desactivarlo mantiene a tu hijo en lecciones no personalizadas.",
      row_mkt_title: "Enviarme novedades del producto",
      row_mkt_desc: "Un correo mensual breve. Nunca se envía a los estudiantes.",
      legal_summary: "Qué cambia realmente cada elección (en lenguaje claro).",
      legal_parent_label: "Padre / tutor:",
      legal_parent_body:
        "obligatorio para crear cuentas de menores de 18 años. Verifica que eres el tutor legal.",
      legal_school_label: "Compartir con la escuela:",
      legal_school_body:
        "los docentes ven el dominio, las lecciones y (si se subieron) los apoyos del IEP. Sin marketing ni cesión a terceros.",
      legal_ai_label: "Personalización con IA:",
      legal_ai_body:
        "AIVO adapta el ritmo y las pistas a tu hijo. Los datos de entrenamiento nunca se usan para identificar a un estudiante.",
      legal_mkt_label: "Novedades del producto:",
      legal_mkt_body: "una lista de correo de bajo volumen. Cancela la suscripción con un clic.",
    },
    permissions: {
      eyebrow: "Permisos del dispositivo",
      title: "¿Qué puede usar AIVO en este dispositivo?",
      subtitle:
        "Estas son las únicas funciones del dispositivo que AIVO pide. Nunca solicitamos ubicación, contactos ni acceso a la galería de fotos.",
      reassure_title: "Tu navegador también los pide.",
      reassure_body:
        "Cuando AIVO realmente necesite el micrófono o la cámara, tu navegador mostrará su propia solicitud de permiso: puedes denegarla aunque hayas dicho que sí aquí.",
      continue: "Continuar — configurar un PIN",
      mic_title: "Micrófono",
      mic_desc:
        "Se usa solo en lecciones de lectura en voz alta y en el modo de voz del tutor con IA. Desactivado por defecto: actívalo si tu hijo quiere leer en voz alta.",
      cam_title: "Cámara",
      cam_desc:
        "Se usa solo al escanear una página de tarea o un documento. AIVO nunca graba video.",
      notifs_title: "Notificaciones",
      notifs_desc:
        "Solicitudes de aprobación, resúmenes semanales de progreso y mensajes de seguridad. Los recordatorios de lecciones están desactivados por defecto: puedes activarlos después.",
    },
    pin: {
      eyebrow: "PIN del estudiante",
      title: "Elige un PIN de 4 dígitos para tu hijo.",
      subtitle:
        "Tu hijo usa este PIN para desbloquear su aprendizaje en este dispositivo. El PIN nunca reemplaza tu inicio de sesión de padre.",
      reassure_title: "Un PIN es un cierre suave, no una caja fuerte.",
      reassure_body:
        "Evita que un hermano abra el perfil equivocado. Las acciones sensibles aún requieren el inicio de sesión de un padre.",
      save: "Guardar PIN",
      skip: "Omitir — configurar un PIN más tarde desde Ajustes",
      choose_pin: "Elegir PIN",
      confirm_pin: "Confirmar PIN",
      mismatch: "No coinciden. Inténtalo de nuevo.",
    },
    parent_verify: {
      eyebrow: "Verificación del padre",
      title_phone: "Verifica que eres realmente tú.",
      title_code: "Introduce el código de 6 dígitos.",
      subtitle_phone:
        "Te enviaremos un código de un solo uso por SMS para confirmar que eres el adulto de esta cuenta. Nunca usamos este número para marketing.",
      subtitle_code: "Enviamos un código a tu teléfono. Caduca en 10 minutos.",
      reassure_title: "Los niños no pueden saltarse este paso.",
      reassure_body:
        "El perfil de un niño se activa solo después de que un padre lo haya verificado. Así es como AIVO aplica la aprobación parental.",
      send_code: "Enviar código",
      verify_continue: "Verificar y continuar",
      use_diff_phone: "Usar otro número de teléfono",
      phone_label: "Teléfono móvil",
      phone_helper: "Lo usamos solo para la verificación y la recuperación de la cuenta.",
      code_label: "Código de 6 dígitos",
    },
    privacy: {
      eyebrow: "Privacidad",
      title: "Lo que hace AIVO, en lenguaje claro.",
      subtitle:
        "A continuación está la versión breve. Cada sección se abre con el texto legal completo. Puedes releer esto en cualquier momento desde Ajustes.",
      reassure_title: "Una promesa por encima de todo.",
      reassure_body:
        "Nunca vendemos los datos de los estudiantes. Ni a anunciantes, ni a proveedores, ni a socios de entrenamiento de IA.",
      collect_summary: "Qué recopilamos: solo lo necesario para enseñar.",
      collect_account: "Cuenta: nombre del padre / personal, correo electrónico.",
      collect_learner:
        "Estudiante: nombre o apodo, nivel escolar, adaptaciones opcionales (IEP / 504), respuestas a las lecciones.",
      collect_device: "Dispositivo: navegador, SO, versión de la app, solo para depuración.",
      ai_summary: "Cómo se usa la IA.",
      ai_body:
        "Cuando la personalización con IA está activada, las respuestas de tu hijo ajustan su siguiente lección: ritmo, ejemplos, pistas. No usamos estas respuestas para identificar a tu hijo. No entrenamos modelos fundacionales con trabajo identificable de los estudiantes. Los proveedores de modelos están obligados por contrato a eliminar los datos de prompts y respuestas en un plazo de 30 días.",
      who_summary: "Quién ve qué.",
      who_you: "Tú y cualquier co-padre que hayas añadido: progreso completo.",
      who_teachers:
        "Los docentes de la escuela a la que diste tu consentimiento: el dominio de las lecciones y los apoyos del IEP solo de sus clases.",
      who_staff:
        "Personal de AIVO: acceso cifrado para soporte, con registros de auditoría. Nunca revisamos el trabajo de los estudiantes sin motivo.",
      who_advertisers: "Anunciantes: nunca.",
      rights_summary: "Tus derechos y cómo eliminar.",
      rights_body:
        "Puedes exportar todos los registros que AIVO guarda sobre tu cuenta o tu hijo desde Ajustes → Privacidad → Exportar. Puedes eliminar la cuenta de la misma forma. La eliminación es permanente en un plazo de 30 días; puedes cancelarla durante el periodo de gracia.",
    },
    terms: {
      eyebrow: "Términos",
      title: "Términos de uso de AIVO.",
      subtitle:
        "Primero el resumen. Toca cualquier sección para ver el texto legal completo. Última actualización: esta página es un marcador de posición para la versión legal definitiva.",
      agree_summary: "Lo que aceptas.",
      agree_body:
        "Aceptas usar AIVO con el fin de educarte a ti mismo, a tu hijo o a tus estudiantes. No intentarás eludir los filtros de seguridad, revender el acceso ni usar los resultados de AIVO para entrenar modelos competidores.",
      aivo_summary: "Lo que acepta AIVO.",
      aivo_body:
        "Mantendremos tus datos privados como se describe en nuestro aviso de privacidad, te avisaremos con 30 días de antelación de cualquier cambio importante en estos términos y te dejaremos exportar todo lo que guardamos en cualquier momento.",
      children_summary: "Niños y familias.",
      children_body:
        "Para las cuentas que incluyen estudiantes menores de 13 años, un padre o tutor verificado debe dar su consentimiento. No creamos a sabiendas cuentas controladas por niños. Las escuelas que actúan in loco parentis deben tener un acuerdo de procesamiento de datos firmado en archivo.",
      wrong_summary: "Si algo sale mal.",
      wrong_body:
        "Cualquiera de las partes puede terminar este acuerdo. Tu exportación de datos sigue disponible durante 90 días tras el cierre. Las disputas se rigen por las leyes de la jurisdicción de tu dirección de facturación.",
    },
    recovery: {
      eyebrow: "Recuperación de la cuenta",
      title: "¿Problemas para iniciar sesión? Te enviaremos un enlace.",
      subtitle:
        "Introduce el correo de tu cuenta de AIVO. Te enviaremos un enlace de un solo uso para restablecer tu contraseña.",
      reassure_title: "No decimos si el correo existe.",
      reassure_body:
        "En cualquier caso, mostraremos la misma confirmación. Esto impide que los actores malintencionados sepan qué direcciones tienen cuenta.",
      submit: "Enviar enlace de recuperación",
      back_to_sign_in: "Volver a iniciar sesión",
    },
    child_approval: {
      eyebrow: "Paso final",
      title: "Aprueba el acceso de tu hijo.",
      subtitle:
        "Estas son las experiencias que tu hijo puede usar en AIVO. Puedes cambiar cualquiera de ellas desde su perfil después.",
      reassure_title: "Tu hijo te está esperando.",
      reassure_body:
        "Hasta que pulses Aprobar, este perfil está en espera. Tu hijo no puede iniciar sesión ni empezar las lecciones.",
      approve: "Aprobar y finalizar",
      footer_note: "Llegarás a la página de inicio de padres con tu hijo configurado y listo.",
      comm_title: "Mensajes con los docentes",
      comm_desc:
        "Tu hijo puede leer los mensajes de los docentes y responder con respuestas rápidas moderadas por un adulto.",
      ai_title: "Tutor con IA",
      ai_desc:
        "Un tutor conversacional que explica conceptos, nunca da las respuestas finales y deriva los temas de seguridad a un adulto.",
      voice_title: "Modo de voz",
      voice_desc:
        "Permite que tu hijo hable con el tutor y lo escuche. Desactivado por defecto: usa el micrófono.",
    },
    iep_upload: {
      eyebrow: "Apoyos IEP / 504",
      title: "Añade el plan de tu hijo, solo si quieres.",
      subtitle:
        "Si tienes un IEP o 504, AIVO puede extraer las adaptaciones (tiempo extra, lectura en voz alta, etc.) para que las lecciones se ajusten desde el primer día. Puedes hacerlo después, o nunca.",
      reassure_title: "Este es un documento sensible.",
      reassure_body:
        "Solo tú, cualquier co-padre y los docentes de las escuelas a las que diste tu consentimiento lo verán. La extracción con IA se ejecuta dentro del entorno. El archivo original se cifra en reposo.",
      reassure_link: "Cómo se gestionan los IEP",
      upload_continue: "Subir y continuar",
      skip: "Omitir por ahora",
      footer_note: "Puedes subirlo después desde el perfil de tu estudiante.",
      consent_title: "Doy mi consentimiento explícito para subir un plan IEP / 504",
      consent_desc:
        "AIVO almacenará el documento, extraerá las adaptaciones indicadas y las aplicará a las lecciones. Puedes eliminarlo en cualquier momento.",
      choose_file: "Elige un archivo PDF o Word",
      file_help:
        "Archivos de hasta 20 MB. Mostraremos una vista previa de lo que extrajimos antes de aplicar nada.",
      legal_summary: "Qué se extrae y qué no.",
      legal_extracted_label: "Se extrae:",
      legal_extracted_body:
        "lista de adaptaciones (tiempo extra, lectura en voz alta, descansos), categorías de objetivos, horas de servicios de apoyo.",
      legal_never_label: "Nunca se extrae:",
      legal_never_body:
        "diagnósticos médicos, evaluaciones psicológicas, declaraciones de los padres, firmas.",
      legal_teachers_label: "Visible para los docentes:",
      legal_teachers_body:
        "solo la lista de adaptaciones, solo en las escuelas a las que diste tu consentimiento.",
    },
    invite_school: {
      eyebrow: "Invitación de la escuela",
      title: "Únete a tu escuela en AIVO.",
      subtitle:
        "Pega el código que te envió tu escuela. Si no tienes uno, pídeselo a tu administrador escolar: solo el personal invitado puede unirse.",
      reassure_title: "El personal escolar no puede inscribirse por su cuenta.",
      reassure_body:
        "Un administrador debe invitarte. Esto protege las listas y los datos de los estudiantes.",
      join: "Unirse a la escuela",
      code_label: "Código de invitación",
      email_label: "Tu correo escolar",
      email_helper: "Debe coincidir con el correo al que el administrador te invitó.",
    },
    invite_district: {
      eyebrow: "Invitación del distrito",
      title: "Únete a tu distrito en AIVO.",
      subtitle:
        "Las invitaciones de administrador de distrito las emite AIVO durante la incorporación. Tu gestor de éxito del distrito te enviará un código de un solo uso.",
      reassure_title: "Se aplica la verificación reforzada del administrador de distrito.",
      reassure_body:
        "Cada inicio de sesión para este rol requiere una comprobación biométrica o de PIN nueva. AIVO nunca deja que una sola contraseña desbloquee los datos del distrito.",
      code_label: "Código de invitación del distrito",
      email_label: "Tu correo del distrito",
    },
    error: {
      expired_invite_eyebrow: "Invitación caducada",
      expired_invite_title: "Esta invitación ya no es válida.",
      expired_invite_subtitle:
        "Las invitaciones caducan a los 30 días. Pide a quien la envió que emita una nueva.",
      expired_invite_body:
        "Si la envió tu escuela o distrito, contacta con tu administrador. El soporte de AIVO también puede reenviarla si proporcionas el código original.",
      expired_invite_reassure_title: "No perdiste tu lugar.",
      expired_invite_reassure_body:
        "Tu plaza en la escuela o el distrito sigue reservada: solo caducó el enlace.",
      expired_invite_primary: "Volver a bienvenida",
      expired_invite_secondary: "¿Necesitas ayuda para iniciar sesión?",
      offline_eyebrow: "Sin conexión",
      offline_title: "No podemos acceder a AIVO ahora mismo.",
      offline_subtitle: "Comprueba tu conexión e inténtalo de nuevo.",
      offline_body:
        "Algunas actividades del estudiante funcionan sin conexión una vez cargada una lección, pero la configuración necesita una conexión activa.",
      offline_reassure_title: "No se perdió nada.",
      offline_reassure_body:
        "Retomaremos exactamente donde lo dejaste en cuanto vuelvas a estar en línea.",
      offline_primary: "Reintentar",
      blocked_eyebrow: "Cuenta bloqueada",
      blocked_title: "Esta cuenta está en pausa.",
      blocked_subtitle:
        "El soporte de AIVO ha pausado esta cuenta. Suele ser una revisión de facturación o de cumplimiento.",
      blocked_body:
        "Recibirás un correo en la dirección registrada cuando termine la revisión, normalmente en un día hábil.",
      blocked_reassure_title: "Los datos de tu hijo están seguros.",
      blocked_reassure_body: "No eliminamos nada durante una revisión: solo se pausa y se reanuda.",
      blocked_primary: "Volver a bienvenida",
      generic_eyebrow: "Algo salió mal",
      generic_title: "Tuvimos un problema.",
      generic_subtitle: "Probablemente sea temporal: inténtalo de nuevo en un momento.",
      generic_body:
        "Si esto sigue ocurriendo, contacta con el soporte de AIVO e indica qué estabas intentando hacer.",
      generic_reassure_title: "No se cobró ni se guardó nada de forma incorrecta.",
      generic_reassure_body: "AIVO nunca conserva datos de configuración a medias.",
      generic_primary: "Empezar de nuevo",
    },
  },
  fr: {
    common: {
      back: "Retour",
      continue: "Continuer",
      terms: "Conditions",
      privacy: "Confidentialité",
      copyright: "© AIVO Learning",
      email: "E-mail",
      password: "Mot de passe",
      show: "Afficher",
      hide: "Masquer",
      show_password: "Afficher le mot de passe",
      hide_password: "Masquer le mot de passe",
      back_to_consent: "Retour au consentement",
      badge_required: "Obligatoire",
      badge_optional: "Facultatif",
      badge_recommended: "Recommandé",
      badge_explicit: "Explicite",
      contact_support: "Contacter le support",
    },
    steps: {
      about_you: "À propos de vous",
      role: "Rôle",
      consent: "Consentement",
      family: "Famille",
      join_school: "Rejoindre l'école",
      join_district: "Rejoindre le district",
    },
    welcome: {
      brand_title: "Un apprentissage qui rejoint chaque enfant là où il en est.",
      brand_body:
        "AIVO est une plateforme d'apprentissage apaisée et accessible, conçue avec les familles, les enseignants et les apprenants — y compris les enfants qui apprennent différemment.",
      eyebrow: "Bienvenue",
      title: "Commençons.",
      subtitle:
        "Connectez-vous pour continuer, ou créez un nouveau compte pour votre famille, votre école ou votre district.",
      sign_in: "Se connecter",
      create_account: "Créer un compte",
      invite_lead: "Vous avez un code d'invitation d'une école ou d'un district ?",
      invite_link: "Utiliser un lien d'invitation",
      body: "AIVO fonctionne sur le web, sur tablette et sur téléphone. Vous pouvez changer d'appareil à tout moment — votre progression vous suit.",
    },
    signin: {
      trouble: "Problème de connexion ?",
      eyebrow: "Bon retour",
      title: "Se connecter",
      subtitle: "Utilisez l'e-mail créé avec votre famille, votre école ou votre district.",
      reassure_title: "Nous ne vendons jamais vos données.",
      reassure_body:
        "Votre e-mail sert uniquement à identifier votre compte. Consultez l'avis de confidentialité pour en savoir plus.",
      reassure_link: "Lire l'avis de confidentialité",
      submit: "Se connecter",
      forgot: "Mot de passe oublié ?",
      create_account: "Créer un compte",
    },
    signup: {
      eyebrow: "Créez votre compte",
      title_invite: "Acceptez votre invitation",
      title_default: "Parlez-nous un peu de vous",
      subtitle_invite:
        "Collez le code de l'invitation de votre école ou district. Vous pourrez finir de configurer votre rôle ensuite.",
      subtitle_default:
        "Nous personnaliserons les étapes suivantes selon la personne pour qui vous configurez AIVO.",
      reassure_title: "Ce sont les adultes qui créent les comptes, pas les enfants.",
      reassure_body:
        "Si vous créez un compte pour un enfant, vous l'ajouterez à l'étape suivante. AIVO ne demande jamais à un enfant de créer son propre compte.",
      already_have: "Vous avez déjà un compte ?",
      sign_in: "Se connecter",
      invite_label: "Code d'invitation",
      invite_helper: "Votre école ou district l'a envoyé dans l'e-mail de bienvenue.",
      name_label: "Votre nom",
      password_helper:
        "Au moins 12 caractères. Nous vérifierons qu'il ne figure dans aucune fuite connue avant de l'enregistrer.",
    },
    role: {
      eyebrow: "Choisissez votre rôle",
      title: "Pour qui configurez-vous AIVO ?",
      subtitle:
        "Nous personnaliserons les étapes suivantes. Vous pourrez ajouter d'autres rôles plus tard — beaucoup d'adultes sont à la fois parent et enseignant.",
      reassure_title: "Les enfants ne choisissent pas de rôle.",
      reassure_body:
        "Un parent ou un enseignant ajoute un apprenant. L'apprenant voit une vue adaptée aux enfants avec ses devoirs — jamais cette page.",
      parent_label: "Un parent ou un proche aidant",
      parent_desc: "Configurez AIVO pour un ou plusieurs enfants à la maison.",
      teacher_label: "Un enseignant",
      teacher_desc: "Rejoignez une école qui utilise déjà AIVO, ou créez une classe.",
      school_admin_label: "Un administrateur d'école",
      school_admin_desc: "Gérez le personnel, les classes et la conformité d'une école.",
      district_admin_label: "Un administrateur de district",
      district_admin_desc: "Supervisez plusieurs écoles, la facturation et les rapports.",
    },
    parent_setup: {
      eyebrow: "Configuration familiale",
      title: "Parlez-nous de votre foyer.",
      subtitle:
        "Vous ajouterez vos enfants à l'étape suivante. Ces informations nous aident à acheminer les invitations et à partager la progression avec les bons adultes.",
      reassure_title: "Les détails du foyer restent privés.",
      reassure_body:
        "Nous ne vendons jamais les informations du foyer. Les coparents ne voient que les apprenants auxquels ils sont rattachés.",
      reassure_link: "Ce que nous collectons",
      continue: "Continuer — ajouter un apprenant",
      household_label: "Nom du foyer (facultatif)",
      household_placeholder: "p. ex. La famille Okafor",
      household_helper:
        "Affiché aux enseignants quand ils vous écrivent. Vous pourrez le modifier plus tard.",
      coparent_label: "Inviter un coparent ou un proche aidant (facultatif)",
      coparent_helper:
        "Ils recevront un e-mail avec leur propre connexion. Vous pourrez tous deux approuver les consentements et consulter la progression.",
    },
    learner_new: {
      eyebrow: "Ajouter un apprenant",
      title: "Parlez-nous de votre enfant.",
      subtitle:
        "N'utilisez que ce que vous diriez à voix haute — le prénom suffit. Vous pourrez ajouter d'autres apprenants plus tard depuis votre écran d'accueil.",
      reassure_title: "Nous collectons le strict minimum.",
      reassure_body:
        "Aucun nom de famille, aucune date de naissance, aucune adresse requise ici. Vous verrez exactement ce que les enseignants et l'IA utilisent à l'étape du consentement.",
      reassure_link: "Ce que nous utilisons",
      continue: "Continuer vers le consentement",
      first_name_label: "Prénom de l'apprenant (ou surnom)",
      first_name_placeholder: "p. ex. Emma",
      grade_band_label: "Niveau scolaire",
      grade_band_placeholder: "Choisissez un niveau",
      grade_band_help:
        "Nous utilisons un niveau, pas une date de naissance. Vous pouvez le changer à tout moment.",
      iep_legend: "Votre enfant a-t-il un plan IEP ou 504 ?",
      iep_help:
        "Vous pourrez le téléverser aux étapes suivantes — uniquement avec votre consentement explicite. Ignorez si vous préférez décider plus tard.",
      iep_yes: "Oui",
      iep_no: "Non",
      iep_unsure: "Pas encore sûr",
    },
    consent: {
      eyebrow: "Votre consentement, votre contrôle",
      title: "Choisissez ce qu'AIVO peut faire.",
      subtitle:
        "Chaque ligne est un choix distinct. Vous pourrez en modifier n'importe lequel plus tard dans Paramètres → Confidentialité.",
      reassure_title: "Pas de paquets. Pas de dark patterns.",
      reassure_body:
        "Le partage des données avec l'école et la personnalisation par IA sont indépendants. Vous pouvez accepter l'un et refuser l'autre.",
      reassure_link: "Lire l'avis de confidentialité complet",
      footer_note:
        "Nous vous demanderons de reconfirmer tout choix qui concerne votre enfant — jamais de modification silencieuse.",
      row_parent_title: "Consentement du parent / tuteur",
      row_parent_desc:
        "Je confirme être le parent ou le tuteur légal des apprenants de ce compte, et j'accepte les Conditions d'AIVO.",
      row_school_title: "Partager la progression avec l'école de mon enfant",
      row_school_desc:
        "Permet aux enseignants de votre enfant de voir la maîtrise, les leçons et les aménagements IEP. Indépendant de tout choix d'IA ci-dessous.",
      row_ai_title: "Utiliser l'IA pour personnaliser l'apprentissage",
      row_ai_desc:
        "AIVO utilise les réponses de votre enfant pour ajuster le rythme, les exemples et les indices. Nous ne vendons jamais ces données. Désactiver cela maintient votre enfant dans des leçons non personnalisées.",
      row_mkt_title: "M'envoyer les actualités produit",
      row_mkt_desc: "Un court e-mail mensuel. Jamais envoyé aux apprenants.",
      legal_summary: "Ce que chaque choix change réellement (en langage clair).",
      legal_parent_label: "Parent / tuteur :",
      legal_parent_body:
        "obligatoire pour créer des comptes pour toute personne de moins de 18 ans. Vérifie que vous êtes le tuteur légal.",
      legal_school_label: "Partage avec l'école :",
      legal_school_body:
        "les enseignants voient la maîtrise, les leçons et (si téléversés) les aménagements IEP. Aucun marketing ni partage avec des tiers.",
      legal_ai_label: "Personnalisation par IA :",
      legal_ai_body:
        "AIVO adapte le rythme et les indices à votre enfant. Les données d'entraînement ne servent jamais à identifier un apprenant.",
      legal_mkt_label: "Actualités produit :",
      legal_mkt_body: "une liste e-mail à faible volume. Désabonnement en un clic.",
    },
    permissions: {
      eyebrow: "Autorisations de l'appareil",
      title: "Que peut utiliser AIVO sur cet appareil ?",
      subtitle:
        "Ce sont les seules fonctionnalités de l'appareil qu'AIVO demande. Nous ne demandons jamais la localisation, les contacts ou l'accès à la photothèque.",
      reassure_title: "Votre navigateur les demande aussi.",
      reassure_body:
        "Lorsque AIVO a réellement besoin du micro ou de la caméra, votre navigateur affichera sa propre demande d'autorisation — vous pouvez la refuser même si vous avez dit oui ici.",
      continue: "Continuer — configurer un code PIN",
      mic_title: "Microphone",
      mic_desc:
        "Utilisé uniquement pour les leçons de lecture à voix haute et le mode voix du tuteur IA. Désactivé par défaut — activez-le si votre enfant veut lire à voix haute.",
      cam_title: "Caméra",
      cam_desc:
        "Utilisée uniquement pour scanner une page de devoir ou un document. AIVO n'enregistre jamais de vidéo.",
      notifs_title: "Notifications",
      notifs_desc:
        "Demandes d'approbation, résumés hebdomadaires de progression et messages de sécurité. Les rappels de leçons sont désactivés par défaut — vous pourrez les activer plus tard.",
    },
    pin: {
      eyebrow: "Code PIN de l'apprenant",
      title: "Choisissez un code PIN à 4 chiffres pour votre enfant.",
      subtitle:
        "Votre enfant utilise ce code PIN pour déverrouiller son apprentissage sur cet appareil. Le code PIN ne remplace jamais votre connexion parent.",
      reassure_title: "Un code PIN est un verrou souple, pas un coffre-fort.",
      reassure_body:
        "Il empêche un frère ou une sœur d'ouvrir le mauvais profil. Les actions sensibles nécessitent toujours une connexion parent.",
      save: "Enregistrer le code PIN",
      skip: "Ignorer — définir un code PIN plus tard dans Paramètres",
      choose_pin: "Choisir le code PIN",
      confirm_pin: "Confirmer le code PIN",
      mismatch: "Ils ne correspondent pas. Réessayez.",
    },
    parent_verify: {
      eyebrow: "Vérification du parent",
      title_phone: "Vérifions que c'est bien vous.",
      title_code: "Saisissez le code à 6 chiffres.",
      subtitle_phone:
        "Nous enverrons un code à usage unique par SMS pour confirmer que vous êtes l'adulte de ce compte. Nous n'utilisons jamais ce numéro à des fins marketing.",
      subtitle_code: "Nous avons envoyé un code sur votre téléphone. Il expire dans 10 minutes.",
      reassure_title: "Les enfants ne peuvent pas contourner cette étape.",
      reassure_body:
        "Le profil d'un enfant ne devient actif qu'après vérification par un parent. C'est ainsi qu'AIVO applique l'approbation parentale.",
      send_code: "Envoyer le code",
      verify_continue: "Vérifier et continuer",
      use_diff_phone: "Utiliser un autre numéro de téléphone",
      phone_label: "Téléphone mobile",
      phone_helper:
        "Nous l'utilisons uniquement pour la vérification et la récupération du compte.",
      code_label: "Code à 6 chiffres",
    },
    privacy: {
      eyebrow: "Confidentialité",
      title: "Ce que fait AIVO — en langage clair.",
      subtitle:
        "Voici la version courte. Chaque section ouvre le texte légal complet. Vous pouvez relire ceci à tout moment dans Paramètres.",
      reassure_title: "Une promesse avant tout.",
      reassure_body:
        "Nous ne vendons jamais les données des élèves. Ni aux annonceurs, ni aux fournisseurs, ni aux partenaires d'entraînement d'IA.",
      collect_summary: "Ce que nous collectons — uniquement ce qui est nécessaire pour enseigner.",
      collect_account: "Compte : nom du parent / du personnel, e-mail.",
      collect_learner:
        "Apprenant : prénom ou surnom, niveau scolaire, aménagements facultatifs (IEP / 504), réponses aux leçons.",
      collect_device:
        "Appareil : navigateur, système d'exploitation, version de l'app — pour le débogage uniquement.",
      ai_summary: "Comment l'IA est utilisée.",
      ai_body:
        "Quand la personnalisation par IA est activée, les réponses de votre enfant ajustent sa prochaine leçon — rythme, exemples, indices. Nous n'utilisons pas ces réponses pour identifier votre enfant. Nous n'entraînons pas de modèles de fondation sur des travaux d'élèves identifiables. Les fournisseurs de modèles sont contractuellement tenus de supprimer les données de prompts et de réponses sous 30 jours.",
      who_summary: "Qui voit quoi.",
      who_you: "Vous et tout coparent ajouté : progression complète.",
      who_teachers:
        "Les enseignants de l'école pour laquelle vous avez consenti : la maîtrise des leçons et les aménagements IEP, pour leurs classes uniquement.",
      who_staff:
        "Personnel d'AIVO : accès chiffré pour le support, avec journaux d'audit. Nous ne parcourons jamais les travaux des élèves sans raison.",
      who_advertisers: "Annonceurs : jamais.",
      rights_summary: "Vos droits et comment supprimer.",
      rights_body:
        "Vous pouvez exporter chaque enregistrement qu'AIVO détient sur votre compte ou votre enfant depuis Paramètres → Confidentialité → Exporter. Vous pouvez supprimer le compte de la même façon. La suppression est définitive sous 30 jours ; vous pouvez l'annuler pendant le délai de grâce.",
    },
    terms: {
      eyebrow: "Conditions",
      title: "Conditions d'utilisation d'AIVO.",
      subtitle:
        "Le résumé d'abord. Touchez une section pour le texte légal complet. Dernière mise à jour : cette page est un espace réservé pour la version finale revue par le service juridique.",
      agree_summary: "Ce que vous acceptez.",
      agree_body:
        "Vous acceptez d'utiliser AIVO dans le but de vous éduquer, d'éduquer votre enfant ou vos élèves. Vous n'essaierez pas de contourner les filtres de sécurité, de revendre l'accès ni d'utiliser les résultats d'AIVO pour entraîner des modèles concurrents.",
      aivo_summary: "Ce qu'AIVO accepte.",
      aivo_body:
        "Nous garderons vos données privées comme décrit dans notre avis de confidentialité, vous préviendrons 30 jours à l'avance de tout changement important de ces conditions et vous laisserons exporter tout ce que nous détenons à tout moment.",
      children_summary: "Enfants et familles.",
      children_body:
        "Pour les comptes incluant des apprenants de moins de 13 ans, un parent ou tuteur vérifié doit consentir. Nous ne créons pas sciemment de comptes contrôlés par des enfants. Les écoles agissant in loco parentis doivent avoir un accord de traitement des données signé au dossier.",
      wrong_summary: "Si quelque chose tourne mal.",
      wrong_body:
        "Chacune des parties peut mettre fin à cet accord. Votre export de données reste disponible pendant 90 jours après la clôture. Les litiges sont régis par les lois de la juridiction de votre adresse de facturation.",
    },
    recovery: {
      eyebrow: "Récupération du compte",
      title: "Problème de connexion ? Nous enverrons un lien.",
      subtitle:
        "Saisissez l'e-mail de votre compte AIVO. Nous enverrons un lien à usage unique pour réinitialiser votre mot de passe.",
      reassure_title: "Nous ne disons pas si l'e-mail existe.",
      reassure_body:
        "Dans tous les cas, nous afficherons la même confirmation. Cela empêche les acteurs malveillants de savoir quelles adresses ont un compte.",
      submit: "Envoyer le lien de récupération",
      back_to_sign_in: "Retour à la connexion",
    },
    child_approval: {
      eyebrow: "Dernière étape",
      title: "Approuvez l'accès de votre enfant.",
      subtitle:
        "Voici les expériences que votre enfant peut utiliser sur AIVO. Vous pourrez en modifier n'importe laquelle depuis son profil plus tard.",
      reassure_title: "Votre enfant vous attend.",
      reassure_body:
        "Tant que vous n'appuyez pas sur Approuver, ce profil est en attente. Votre enfant ne peut pas se connecter ni commencer les leçons.",
      approve: "Approuver et terminer",
      footer_note: "Vous arriverez sur l'accueil parent avec votre enfant configuré et prêt.",
      comm_title: "Messages avec les enseignants",
      comm_desc:
        "Votre enfant peut lire les messages des enseignants et répondre par des réponses rapides modérées par un adulte.",
      ai_title: "Tuteur IA",
      ai_desc:
        "Un tuteur conversationnel qui explique les concepts, ne donne jamais les réponses finales et oriente les sujets de sécurité vers un adulte.",
      voice_title: "Mode voix",
      voice_desc:
        "Permet à votre enfant de parler au tuteur et de l'écouter. Désactivé par défaut — utilise le microphone.",
    },
    iep_upload: {
      eyebrow: "Aménagements IEP / 504",
      title: "Ajoutez le plan de votre enfant — seulement si vous le souhaitez.",
      subtitle:
        "Si vous avez un IEP ou un 504, AIVO peut en extraire les aménagements (temps supplémentaire, lecture à voix haute, etc.) pour que les leçons s'y conforment dès le premier jour. Vous pouvez le faire plus tard, ou jamais.",
      reassure_title: "C'est un document sensible.",
      reassure_body:
        "Seuls vous, tout coparent et les enseignants des écoles pour lesquelles vous avez consenti le verront. L'extraction par IA s'exécute dans le tenant. Le fichier original est chiffré au repos.",
      reassure_link: "Comment les IEP sont gérés",
      upload_continue: "Téléverser et continuer",
      skip: "Ignorer pour l'instant",
      footer_note: "Vous pourrez le téléverser plus tard depuis le profil de votre apprenant.",
      consent_title: "Je consens explicitement à téléverser un plan IEP / 504",
      consent_desc:
        "AIVO stockera le document, en extraira les aménagements listés et les appliquera aux leçons. Vous pourrez le supprimer à tout moment.",
      choose_file: "Choisir un fichier PDF ou Word",
      file_help:
        "Fichiers jusqu'à 20 Mo. Nous afficherons un aperçu de ce que nous avons extrait avant d'appliquer quoi que ce soit.",
      legal_summary: "Ce qui est extrait, et ce qui ne l'est pas.",
      legal_extracted_label: "Extrait :",
      legal_extracted_body:
        "liste des aménagements (temps supplémentaire, lecture à voix haute, pauses), catégories d'objectifs, heures de services de soutien.",
      legal_never_label: "Jamais extrait :",
      legal_never_body:
        "diagnostics médicaux, évaluations psychologiques, déclarations des parents, signatures.",
      legal_teachers_label: "Visible par les enseignants :",
      legal_teachers_body:
        "uniquement la liste des aménagements, uniquement dans les écoles pour lesquelles vous avez consenti.",
    },
    invite_school: {
      eyebrow: "Invitation de l'école",
      title: "Rejoignez votre école sur AIVO.",
      subtitle:
        "Collez le code envoyé par votre école. Si vous n'en avez pas, demandez à votre administrateur d'école — seul le personnel invité peut rejoindre.",
      reassure_title: "Le personnel scolaire ne peut pas s'inscrire seul.",
      reassure_body:
        "Un administrateur doit vous inviter. Cela protège les listes et les données des élèves.",
      join: "Rejoindre l'école",
      code_label: "Code d'invitation",
      email_label: "Votre e-mail scolaire",
      email_helper: "Doit correspondre à l'e-mail auquel l'administrateur vous a invité.",
    },
    invite_district: {
      eyebrow: "Invitation du district",
      title: "Rejoignez votre district sur AIVO.",
      subtitle:
        "Les invitations d'administrateur de district sont émises par AIVO lors de l'intégration. Votre responsable de la réussite du district vous enverra un code à usage unique.",
      reassure_title: "La vérification renforcée de l'administrateur de district est appliquée.",
      reassure_body:
        "Chaque connexion pour ce rôle nécessite une nouvelle vérification biométrique ou par code PIN. AIVO ne laisse jamais un seul mot de passe déverrouiller les données du district.",
      code_label: "Code d'invitation du district",
      email_label: "Votre e-mail du district",
    },
    error: {
      expired_invite_eyebrow: "Invitation expirée",
      expired_invite_title: "Cette invitation n'est plus valide.",
      expired_invite_subtitle:
        "Les invitations expirent après 30 jours. Demandez à la personne qui l'a envoyée d'en émettre une nouvelle.",
      expired_invite_body:
        "Si votre école ou district l'a envoyée, contactez votre administrateur. Le support AIVO peut aussi la renvoyer si vous fournissez le code original.",
      expired_invite_reassure_title: "Nous n'avons pas perdu votre place.",
      expired_invite_reassure_body:
        "Votre place à l'école ou au district reste réservée — seul le lien a expiré.",
      expired_invite_primary: "Retour à l'accueil",
      expired_invite_secondary: "Besoin d'aide pour vous connecter ?",
      offline_eyebrow: "Hors ligne",
      offline_title: "Nous ne pouvons pas joindre AIVO pour l'instant.",
      offline_subtitle: "Vérifiez votre connexion et réessayez.",
      offline_body:
        "Certaines activités de l'apprenant fonctionnent hors ligne une fois une leçon chargée — mais la configuration nécessite une connexion active.",
      offline_reassure_title: "Rien n'a été perdu.",
      offline_reassure_body:
        "Nous reprendrons exactement là où vous vous êtes arrêté dès votre retour en ligne.",
      offline_primary: "Réessayer",
      blocked_eyebrow: "Compte bloqué",
      blocked_title: "Ce compte est suspendu.",
      blocked_subtitle:
        "Le support AIVO a suspendu ce compte. Il s'agit généralement d'un examen de facturation ou de conformité.",
      blocked_body:
        "Vous recevrez un e-mail à l'adresse enregistrée une fois l'examen terminé, généralement sous un jour ouvré.",
      blocked_reassure_title: "Les données de votre enfant sont en sécurité.",
      blocked_reassure_body:
        "Nous ne supprimons rien pendant un examen — suspension et reprise uniquement.",
      blocked_primary: "Retour à l'accueil",
      generic_eyebrow: "Une erreur s'est produite",
      generic_title: "Nous avons rencontré un souci.",
      generic_subtitle: "C'est probablement temporaire — réessayez dans un instant.",
      generic_body:
        "Si cela persiste, veuillez contacter le support AIVO en précisant ce que vous essayiez de faire.",
      generic_reassure_title: "Rien n'a été facturé ni enregistré de façon incorrecte.",
      generic_reassure_body: "AIVO ne conserve jamais de données de configuration inachevées.",
      generic_primary: "Recommencer",
    },
  },
  de: {
    common: {
      back: "Zurück",
      continue: "Weiter",
      terms: "Nutzungsbedingungen",
      privacy: "Datenschutz",
      copyright: "© AIVO Learning",
      email: "E-Mail",
      password: "Passwort",
      show: "Anzeigen",
      hide: "Verbergen",
      show_password: "Passwort anzeigen",
      hide_password: "Passwort verbergen",
      back_to_consent: "Zurück zur Einwilligung",
      badge_required: "Erforderlich",
      badge_optional: "Optional",
      badge_recommended: "Empfohlen",
      badge_explicit: "Ausdrücklich",
      contact_support: "Support kontaktieren",
    },
    steps: {
      about_you: "Über dich",
      role: "Rolle",
      consent: "Einwilligung",
      family: "Familie",
      join_school: "Schule beitreten",
      join_district: "Bezirk beitreten",
    },
    welcome: {
      brand_title: "Lernen, das jedes Kind dort abholt, wo es steht.",
      brand_body:
        "AIVO ist eine ruhige, barrierefreie Lernplattform, die gemeinsam mit Familien, Lehrkräften und Lernenden entwickelt wurde – auch mit Kindern, die anders lernen.",
      eyebrow: "Willkommen",
      title: "Los geht's.",
      subtitle:
        "Melde dich an, um fortzufahren, oder erstelle ein neues Konto für deine Familie, Schule oder deinen Bezirk.",
      sign_in: "Anmelden",
      create_account: "Konto erstellen",
      invite_lead: "Hast du einen Einladungscode von einer Schule oder einem Bezirk?",
      invite_link: "Einladungslink verwenden",
      body: "AIVO funktioniert im Web, auf Tablets und auf Smartphones. Du kannst jederzeit das Gerät wechseln – dein Fortschritt kommt mit.",
    },
    signin: {
      trouble: "Probleme beim Anmelden?",
      eyebrow: "Willkommen zurück",
      title: "Anmelden",
      subtitle:
        "Verwende die E-Mail, mit der du dich für Familie, Schule oder Bezirk angemeldet hast.",
      reassure_title: "Wir verkaufen deine Daten niemals.",
      reassure_body:
        "Deine E-Mail dient nur zur Identifizierung deines Kontos. Mehr dazu im Datenschutzhinweis.",
      reassure_link: "Datenschutzhinweis lesen",
      submit: "Anmelden",
      forgot: "Passwort vergessen?",
      create_account: "Konto erstellen",
    },
    signup: {
      eyebrow: "Erstelle dein Konto",
      title_invite: "Nimm deine Einladung an",
      title_default: "Erzähl uns ein wenig über dich",
      subtitle_invite:
        "Füge den Code aus der Einladung deiner Schule oder deines Bezirks ein. Deine Rolle kannst du anschließend einrichten.",
      subtitle_default: "Wir passen die nächsten Schritte daran an, für wen du AIVO einrichtest.",
      reassure_title: "Erwachsene richten Konten ein, nicht Kinder.",
      reassure_body:
        "Wenn du ein Konto für ein Kind erstellst, fügst du es im nächsten Schritt hinzu. AIVO bittet niemals ein Kind, ein eigenes Konto zu erstellen.",
      already_have: "Hast du schon ein Konto?",
      sign_in: "Anmelden",
      invite_label: "Einladungscode",
      invite_helper: "Deine Schule oder dein Bezirk hat ihn in der Willkommens-E-Mail gesendet.",
      name_label: "Dein Name",
      password_helper:
        "Mindestens 12 Zeichen. Wir prüfen vor dem Speichern, dass es in keinem bekannten Leak vorkommt.",
    },
    role: {
      eyebrow: "Wähle deine Rolle",
      title: "Für wen richtest du AIVO ein?",
      subtitle:
        "Wir passen die nächsten Schritte an. Weitere Rollen kannst du später hinzufügen – viele Erwachsene sind sowohl Elternteil als auch Lehrkraft.",
      reassure_title: "Kinder wählen keine Rolle.",
      reassure_body:
        "Ein Elternteil oder eine Lehrkraft fügt einen Lernenden hinzu. Der Lernende sieht eine kindgerechte Ansicht mit seinen Aufgaben – niemals diese Seite.",
      parent_label: "Ein Elternteil oder eine Betreuungsperson",
      parent_desc: "Richte AIVO für ein oder mehrere Kinder zu Hause ein.",
      teacher_label: "Eine Lehrkraft",
      teacher_desc: "Tritt einer Schule bei, die AIVO bereits nutzt, oder starte eine Klasse.",
      school_admin_label: "Eine Schuladministratorin / ein Schuladministrator",
      school_admin_desc: "Verwalte Personal, Klassen und Compliance einer Schule.",
      district_admin_label: "Eine Bezirksadministratorin / ein Bezirksadministrator",
      district_admin_desc: "Überwache mehrere Schulen, Abrechnung und Berichte.",
    },
    parent_setup: {
      eyebrow: "Familieneinrichtung",
      title: "Erzähl uns von deinem Haushalt.",
      subtitle:
        "Deine Kinder fügst du im nächsten Schritt hinzu. Diese Angaben helfen uns, Einladungen weiterzuleiten und den Fortschritt mit den richtigen Erwachsenen zu teilen.",
      reassure_title: "Haushaltsdaten bleiben privat.",
      reassure_body:
        "Wir verkaufen Haushaltsinformationen niemals. Co-Eltern sehen nur die Lernenden, denen sie zugeordnet sind.",
      reassure_link: "Was wir erfassen",
      continue: "Weiter – einen Lernenden hinzufügen",
      household_label: "Haushaltsname (optional)",
      household_placeholder: "z. B. Familie Okafor",
      household_helper:
        "Wird Lehrkräften angezeigt, wenn sie dir schreiben. Du kannst ihn später ändern.",
      coparent_label: "Ein Co-Elternteil oder eine Betreuungsperson einladen (optional)",
      coparent_helper:
        "Sie erhalten eine E-Mail mit eigener Anmeldung. Ihr könnt beide Einwilligungen genehmigen und den Fortschritt einsehen.",
    },
    learner_new: {
      eyebrow: "Einen Lernenden hinzufügen",
      title: "Erzähl uns von deinem Kind.",
      subtitle:
        "Verwende nur, was du laut sagen würdest – der Vorname genügt. Weitere Lernende kannst du später über deinen Startbildschirm hinzufügen.",
      reassure_title: "Wir erfassen das Nötigste.",
      reassure_body:
        "Kein Nachname, kein Geburtsdatum, keine Adresse hier erforderlich. Im Einwilligungsschritt siehst du genau, was Lehrkräfte und die KI nutzen.",
      reassure_link: "Was wir nutzen",
      continue: "Weiter zur Einwilligung",
      first_name_label: "Vorname des Lernenden (oder Spitzname)",
      first_name_placeholder: "z. B. Emma",
      grade_band_label: "Klassenstufe",
      grade_band_placeholder: "Stufe wählen",
      grade_band_help:
        "Wir verwenden eine Stufe, kein Geburtsdatum. Du kannst sie jederzeit ändern.",
      iep_legend: "Hat dein Kind einen IEP- oder 504-Plan?",
      iep_help:
        "Du kannst ihn in den nächsten Schritten hochladen – nur mit deiner ausdrücklichen Einwilligung. Überspringe, wenn du später entscheiden möchtest.",
      iep_yes: "Ja",
      iep_no: "Nein",
      iep_unsure: "Noch nicht sicher",
    },
    consent: {
      eyebrow: "Deine Einwilligung – deine Kontrolle",
      title: "Wähle, was AIVO darf.",
      subtitle:
        "Jede Zeile ist eine eigene Entscheidung. Du kannst jede davon später unter Einstellungen → Datenschutz ändern.",
      reassure_title: "Keine Pakete. Keine Dark Patterns.",
      reassure_body:
        "Das Teilen von Schuldaten und die KI-Personalisierung sind unabhängig. Du kannst dem einen zustimmen und das andere ablehnen.",
      reassure_link: "Vollständigen Datenschutzhinweis lesen",
      footer_note:
        "Wir bitten dich, jede Entscheidung, die dein Kind betrifft, später erneut zu bestätigen – niemals wird sie stillschweigend geändert.",
      row_parent_title: "Einwilligung des Elternteils / Erziehungsberechtigten",
      row_parent_desc:
        "Ich bestätige, dass ich Elternteil oder gesetzliche/r Erziehungsberechtigte/r der Lernenden in diesem Konto bin, und akzeptiere die AIVO-Nutzungsbedingungen.",
      row_school_title: "Fortschritt mit der Schule meines Kindes teilen",
      row_school_desc:
        "Ermöglicht den Lehrkräften deines Kindes, Beherrschung, Lektionen und IEP-Hilfen zu sehen. Unabhängig von jeder KI-Entscheidung unten.",
      row_ai_title: "KI zur Personalisierung des Lernens nutzen",
      row_ai_desc:
        "AIVO nutzt die Antworten deines Kindes, um Tempo, Beispiele und Hinweise anzupassen. Wir verkaufen diese Daten niemals. Wenn du dies ausschaltest, bleibt dein Kind in nicht personalisierten Lektionen.",
      row_mkt_title: "Mir Produktneuigkeiten senden",
      row_mkt_desc: "Eine kurze monatliche E-Mail. Niemals an Lernende gesendet.",
      legal_summary: "Was jede Entscheidung tatsächlich ändert (in klarer Sprache).",
      legal_parent_label: "Elternteil / Erziehungsberechtigte/r:",
      legal_parent_body:
        "erforderlich, um Konten für Personen unter 18 Jahren zu erstellen. Bestätigt, dass du der/die gesetzliche Erziehungsberechtigte bist.",
      legal_school_label: "Teilen mit der Schule:",
      legal_school_body:
        "Lehrkräfte sehen Beherrschung, Lektionen und (falls hochgeladen) IEP-Hilfen. Kein Marketing, keine Weitergabe an Dritte.",
      legal_ai_label: "KI-Personalisierung:",
      legal_ai_body:
        "AIVO passt Tempo und Hinweise an dein Kind an. Trainingsdaten werden niemals zur Identifizierung eines Lernenden verwendet.",
      legal_mkt_label: "Produktneuigkeiten:",
      legal_mkt_body: "eine E-Mail-Liste mit geringem Volumen. Abmeldung mit einem Klick.",
    },
    permissions: {
      eyebrow: "Geräteberechtigungen",
      title: "Was darf AIVO auf diesem Gerät nutzen?",
      subtitle:
        "Dies sind die einzigen Gerätefunktionen, nach denen AIVO jemals fragt. Wir fragen niemals nach Standort, Kontakten oder Zugriff auf die Fotobibliothek.",
      reassure_title: "Dein Browser fragt ebenfalls danach.",
      reassure_body:
        "Wenn AIVO das Mikrofon oder die Kamera tatsächlich benötigt, zeigt dein Browser seine eigene Berechtigungsabfrage – du kannst sie ablehnen, auch wenn du hier zugestimmt hast.",
      continue: "Weiter – eine PIN einrichten",
      mic_title: "Mikrofon",
      mic_desc:
        "Wird nur für Vorlese-Lektionen und den Sprachmodus des KI-Tutors verwendet. Standardmäßig aus – aktiviere es, wenn dein Kind laut lesen möchte.",
      cam_title: "Kamera",
      cam_desc:
        "Wird nur beim Scannen einer Hausaufgabenseite oder eines Dokuments verwendet. AIVO nimmt niemals Videos auf.",
      notifs_title: "Benachrichtigungen",
      notifs_desc:
        "Genehmigungsanfragen, wöchentliche Fortschrittsübersichten und Sicherheitsmeldungen. Lektionserinnerungen sind standardmäßig aus – du kannst sie später aktivieren.",
    },
    pin: {
      eyebrow: "Lernenden-PIN",
      title: "Wähle eine 4-stellige PIN für dein Kind.",
      subtitle:
        "Dein Kind nutzt diese PIN, um sein Lernen auf diesem Gerät zu entsperren. Die PIN ersetzt niemals deine Eltern-Anmeldung.",
      reassure_title: "Eine PIN ist ein sanftes Schloss, kein Tresor.",
      reassure_body:
        "Sie verhindert, dass ein Geschwisterkind das falsche Profil öffnet. Sensible Aktionen erfordern weiterhin eine Eltern-Anmeldung.",
      save: "PIN speichern",
      skip: "Überspringen – PIN später in den Einstellungen festlegen",
      choose_pin: "PIN wählen",
      confirm_pin: "PIN bestätigen",
      mismatch: "Die stimmen nicht überein. Versuche es erneut.",
    },
    parent_verify: {
      eyebrow: "Eltern-Verifizierung",
      title_phone: "Bestätige, dass du es wirklich bist.",
      title_code: "Gib den 6-stelligen Code ein.",
      subtitle_phone:
        "Wir senden dir per SMS einen Einmalcode, um zu bestätigen, dass du der/die Erwachsene dieses Kontos bist. Wir nutzen diese Nummer niemals für Marketing.",
      subtitle_code: "Wir haben einen Code an dein Telefon gesendet. Er läuft in 10 Minuten ab.",
      reassure_title: "Kinder können diesen Schritt nicht umgehen.",
      reassure_body:
        "Ein Kinderprofil wird erst aktiv, nachdem ein Elternteil verifiziert hat. So setzt AIVO die elterliche Zustimmung durch.",
      send_code: "Code senden",
      verify_continue: "Verifizieren und fortfahren",
      use_diff_phone: "Eine andere Telefonnummer verwenden",
      phone_label: "Mobiltelefon",
      phone_helper: "Wir verwenden dies nur zur Verifizierung und Kontowiederherstellung.",
      code_label: "6-stelliger Code",
    },
    privacy: {
      eyebrow: "Datenschutz",
      title: "Was AIVO tut – in klaren Worten.",
      subtitle:
        "Unten steht die Kurzfassung. Jeder Abschnitt öffnet den vollständigen Rechtstext. Du kannst dies jederzeit in den Einstellungen erneut lesen.",
      reassure_title: "Ein Versprechen über allem.",
      reassure_body:
        "Wir verkaufen Schülerdaten niemals. Nicht an Werbetreibende, nicht an Anbieter, nicht an KI-Trainingspartner.",
      collect_summary: "Was wir erfassen – nur das, was zum Unterrichten nötig ist.",
      collect_account: "Konto: Name des Elternteils / Personals, E-Mail.",
      collect_learner:
        "Lernende/r: Vorname oder Spitzname, Klassenstufe, optionale Anpassungen (IEP / 504), Antworten auf Lektionen.",
      collect_device: "Gerät: Browser, Betriebssystem, App-Version – nur zur Fehlersuche.",
      ai_summary: "Wie KI eingesetzt wird.",
      ai_body:
        "Wenn die KI-Personalisierung aktiv ist, passen die Antworten deines Kindes die nächste Lektion an – Tempo, Beispiele, Hinweise. Wir verwenden diese Antworten nicht, um dein Kind zu identifizieren. Wir trainieren keine Foundation-Modelle mit identifizierbaren Schülerarbeiten. Modellanbieter sind vertraglich verpflichtet, Prompt- und Antwortdaten innerhalb von 30 Tagen zu löschen.",
      who_summary: "Wer was sieht.",
      who_you: "Du und jedes hinzugefügte Co-Elternteil: vollständiger Fortschritt.",
      who_teachers:
        "Lehrkräfte der Schule, der du zugestimmt hast: Lektionsbeherrschung und IEP-Hilfen nur für ihre Klassen.",
      who_staff:
        "AIVO-Personal: verschlüsselter Zugriff für den Support, mit Audit-Protokollen. Wir durchsuchen Schülerarbeiten niemals beiläufig.",
      who_advertisers: "Werbetreibende: niemals.",
      rights_summary: "Deine Rechte und wie du löschst.",
      rights_body:
        "Du kannst jeden Datensatz, den AIVO über dein Konto oder dein Kind hält, unter Einstellungen → Datenschutz → Exportieren exportieren. Auf demselben Weg kannst du das Konto löschen. Die Löschung ist innerhalb von 30 Tagen endgültig; während der Frist kannst du sie abbrechen.",
    },
    terms: {
      eyebrow: "Nutzungsbedingungen",
      title: "AIVO-Nutzungsbedingungen.",
      subtitle:
        "Zuerst die Zusammenfassung. Tippe auf einen Abschnitt für den vollständigen Rechtstext. Zuletzt aktualisiert: Diese Seite ist ein Platzhalter für die endgültige, rechtlich geprüfte Fassung.",
      agree_summary: "Wozu du dich verpflichtest.",
      agree_body:
        "Du verpflichtest dich, AIVO zur Bildung deiner selbst, deines Kindes oder deiner Schülerinnen und Schüler zu nutzen. Du wirst nicht versuchen, Sicherheitsfilter zu umgehen, den Zugang weiterzuverkaufen oder AIVO-Ausgaben zum Training konkurrierender Modelle zu verwenden.",
      aivo_summary: "Wozu sich AIVO verpflichtet.",
      aivo_body:
        "Wir halten deine Daten privat, wie in unserem Datenschutzhinweis beschrieben, geben dir 30 Tage im Voraus Bescheid über wesentliche Änderungen dieser Bedingungen und lassen dich jederzeit alles exportieren, was wir halten.",
      children_summary: "Kinder und Familien.",
      children_body:
        "Für Konten mit Lernenden unter 13 Jahren muss ein verifizierter Elternteil oder Erziehungsberechtigter einwilligen. Wir erstellen nicht wissentlich kindgesteuerte Konten. Schulen, die in loco parentis handeln, müssen eine unterschriebene Datenverarbeitungsvereinbarung im Bestand haben.",
      wrong_summary: "Wenn etwas schiefgeht.",
      wrong_body:
        "Jede Seite kann diese Vereinbarung beenden. Dein Datenexport bleibt 90 Tage nach Schließung verfügbar. Streitigkeiten unterliegen den Gesetzen der Gerichtsbarkeit deiner Rechnungsadresse.",
    },
    recovery: {
      eyebrow: "Kontowiederherstellung",
      title: "Probleme beim Anmelden? Wir senden einen Link.",
      subtitle:
        "Gib die E-Mail deines AIVO-Kontos ein. Wir senden dir per E-Mail einen Einmal-Link, mit dem du dein Passwort zurücksetzen kannst.",
      reassure_title: "Wir verraten nicht, ob die E-Mail existiert.",
      reassure_body:
        "In beiden Fällen zeigen wir dieselbe Bestätigung. So erfahren böswillige Akteure nicht, welche Adressen ein Konto haben.",
      submit: "Wiederherstellungslink senden",
      back_to_sign_in: "Zurück zur Anmeldung",
    },
    child_approval: {
      eyebrow: "Letzter Schritt",
      title: "Genehmige den Zugang deines Kindes.",
      subtitle:
        "Dies sind die Erlebnisse, die dein Kind auf AIVO nutzen kann. Du kannst jedes davon später im Profil ändern.",
      reassure_title: "Dein Kind wartet auf dich.",
      reassure_body:
        "Bis du auf Genehmigen drückst, befindet sich dieses Profil im Wartezustand. Dein Kind kann sich nicht anmelden und keine Lektionen starten.",
      approve: "Genehmigen und abschließen",
      footer_note: "Du gelangst zur Eltern-Startseite, mit eingerichtetem und startbereitem Kind.",
      comm_title: "Nachrichten mit Lehrkräften",
      comm_desc:
        "Dein Kind kann Nachrichten von Lehrkräften lesen und mit von Erwachsenen moderierten Schnellantworten antworten.",
      ai_title: "KI-Tutor",
      ai_desc:
        "Ein dialogorientierter Tutor, der Konzepte erklärt, niemals fertige Antworten liefert und Sicherheitsthemen an einen Erwachsenen weiterleitet.",
      voice_title: "Sprachmodus",
      voice_desc:
        "Ermöglicht deinem Kind, mit dem Tutor zu sprechen und zuzuhören. Standardmäßig aus – nutzt das Mikrofon.",
    },
    iep_upload: {
      eyebrow: "IEP- / 504-Hilfen",
      title: "Füge den Plan deines Kindes hinzu – nur wenn du möchtest.",
      subtitle:
        "Wenn du einen IEP oder 504 hast, kann AIVO Anpassungen (zusätzliche Zeit, Vorlesen usw.) extrahieren, damit die Lektionen von Anfang an dazu passen. Du kannst dies später tun – oder nie.",
      reassure_title: "Dies ist ein sensibles Dokument.",
      reassure_body:
        "Nur du, jedes Co-Elternteil und die Lehrkräfte der Schulen, denen du zugestimmt hast, sehen es. Die KI-Extraktion läuft im Tenant. Die Originaldatei ist im Ruhezustand verschlüsselt.",
      reassure_link: "Wie IEPs gehandhabt werden",
      upload_continue: "Hochladen und fortfahren",
      skip: "Vorerst überspringen",
      footer_note: "Du kannst es später über das Profil deines Lernenden hochladen.",
      consent_title: "Ich willige ausdrücklich ein, einen IEP- / 504-Plan hochzuladen",
      consent_desc:
        "AIVO speichert das Dokument, extrahiert die aufgeführten Anpassungen und wendet sie auf Lektionen an. Du kannst es jederzeit löschen.",
      choose_file: "Eine PDF- oder Word-Datei auswählen",
      file_help:
        "Dateien bis 20 MB. Wir zeigen dir eine Vorschau des Extrahierten, bevor etwas angewendet wird.",
      legal_summary: "Was extrahiert wird und was nicht.",
      legal_extracted_label: "Extrahiert:",
      legal_extracted_body:
        "Liste der Anpassungen (zusätzliche Zeit, Vorlesen, Pausen), Zielkategorien, Stunden für Unterstützungsleistungen.",
      legal_never_label: "Niemals extrahiert:",
      legal_never_body:
        "medizinische Diagnosen, psychologische Gutachten, Elternaussagen, Unterschriften.",
      legal_teachers_label: "Für Lehrkräfte sichtbar:",
      legal_teachers_body:
        "nur die Liste der Anpassungen, nur an Schulen, denen du zugestimmt hast.",
    },
    invite_school: {
      eyebrow: "Schuleinladung",
      title: "Tritt deiner Schule auf AIVO bei.",
      subtitle:
        "Füge den Code ein, den deine Schule dir gesendet hat. Wenn du keinen hast, frage deine Schuladministration – nur eingeladenes Personal kann beitreten.",
      reassure_title: "Schulpersonal kann sich nicht selbst eintragen.",
      reassure_body:
        "Eine Administration muss dich einladen. Das schützt Klassenlisten und Schülerdaten.",
      join: "Schule beitreten",
      code_label: "Einladungscode",
      email_label: "Deine Schul-E-Mail",
      email_helper:
        "Muss mit der E-Mail übereinstimmen, zu der die Administration dich eingeladen hat.",
    },
    invite_district: {
      eyebrow: "Bezirkseinladung",
      title: "Tritt deinem Bezirk auf AIVO bei.",
      subtitle:
        "Einladungen für Bezirksadministratoren werden von AIVO während des Onboardings ausgestellt. Dein Customer-Success-Manager des Bezirks sendet dir einen Einmalcode.",
      reassure_title:
        "Die verstärkte Authentifizierung für Bezirksadministratoren ist verpflichtend.",
      reassure_body:
        "Jede Anmeldung für diese Rolle erfordert eine erneute biometrische oder PIN-Prüfung. AIVO lässt niemals zu, dass ein einzelnes Passwort Bezirksdaten entsperrt.",
      code_label: "Bezirks-Einladungscode",
      email_label: "Deine Bezirks-E-Mail",
    },
    error: {
      expired_invite_eyebrow: "Einladung abgelaufen",
      expired_invite_title: "Diese Einladung ist nicht mehr gültig.",
      expired_invite_subtitle:
        "Einladungen laufen nach 30 Tagen ab. Bitte die Person, die sie gesendet hat, eine neue auszustellen.",
      expired_invite_body:
        "Wenn deine Schule oder dein Bezirk sie gesendet hat, kontaktiere deine Administration. Der AIVO-Support kann sie ebenfalls erneut senden, wenn du den Originalcode angibst.",
      expired_invite_reassure_title: "Wir haben deinen Platz nicht verloren.",
      expired_invite_reassure_body:
        "Dein Platz an der Schule oder im Bezirk ist weiterhin reserviert – nur der Link ist abgelaufen.",
      expired_invite_primary: "Zurück zur Begrüßung",
      expired_invite_secondary: "Brauchst du Hilfe beim Anmelden?",
      offline_eyebrow: "Offline",
      offline_title: "Wir erreichen AIVO gerade nicht.",
      offline_subtitle: "Prüfe deine Verbindung und versuche es erneut.",
      offline_body:
        "Einige Lernaktivitäten funktionieren offline, sobald eine Lektion geladen ist – die Einrichtung benötigt jedoch eine aktive Verbindung.",
      offline_reassure_title: "Nichts ging verloren.",
      offline_reassure_body:
        "Wir machen genau dort weiter, wo du aufgehört hast, sobald du wieder online bist.",
      offline_primary: "Erneut versuchen",
      blocked_eyebrow: "Konto gesperrt",
      blocked_title: "Dieses Konto ist pausiert.",
      blocked_subtitle:
        "Der AIVO-Support hat dieses Konto pausiert. Meist ist das eine Abrechnungs- oder Compliance-Prüfung.",
      blocked_body:
        "Du erhältst eine E-Mail an die hinterlegte Adresse, sobald die Prüfung abgeschlossen ist, in der Regel innerhalb eines Werktags.",
      blocked_reassure_title: "Die Daten deines Kindes sind sicher.",
      blocked_reassure_body:
        "Während einer Prüfung löschen wir nichts – nur Pausieren und Fortsetzen.",
      blocked_primary: "Zurück zur Begrüßung",
      generic_eyebrow: "Etwas ist schiefgelaufen",
      generic_title: "Wir hatten ein Problem.",
      generic_subtitle: "Es ist wahrscheinlich vorübergehend – versuche es gleich erneut.",
      generic_body:
        "Wenn das weiter passiert, kontaktiere bitte den AIVO-Support und nenne, was du tun wolltest.",
      generic_reassure_title: "Es wurde nichts falsch berechnet oder gespeichert.",
      generic_reassure_body: "AIVO speichert niemals halbfertige Einrichtungsdaten.",
      generic_primary: "Von vorn beginnen",
    },
  },
  pt: {
    common: {
      back: "Voltar",
      continue: "Continuar",
      terms: "Termos",
      privacy: "Privacidade",
      copyright: "© AIVO Learning",
      email: "E-mail",
      password: "Senha",
      show: "Mostrar",
      hide: "Ocultar",
      show_password: "Mostrar senha",
      hide_password: "Ocultar senha",
      back_to_consent: "Voltar ao consentimento",
      badge_required: "Obrigatório",
      badge_optional: "Opcional",
      badge_recommended: "Recomendado",
      badge_explicit: "Explícito",
      contact_support: "Falar com o suporte",
    },
    steps: {
      about_you: "Sobre você",
      role: "Função",
      consent: "Consentimento",
      family: "Família",
      join_school: "Entrar na escola",
      join_district: "Entrar no distrito",
    },
    welcome: {
      brand_title: "Aprendizado que encontra cada criança onde ela está.",
      brand_body:
        "A AIVO é uma plataforma de aprendizado calma e acessível, criada com famílias, professores e alunos — incluindo crianças que aprendem de forma diferente.",
      eyebrow: "Bem-vindo",
      title: "Vamos começar.",
      subtitle: "Entre para continuar ou crie uma nova conta para sua família, escola ou distrito.",
      sign_in: "Entrar",
      create_account: "Criar uma conta",
      invite_lead: "Tem um código de convite de uma escola ou distrito?",
      invite_link: "Usar um link de convite",
      body: "A AIVO funciona na web, em tablets e em celulares. Você pode trocar de dispositivo a qualquer momento — seu progresso vai junto.",
    },
    signin: {
      trouble: "Problemas para entrar?",
      eyebrow: "Bem-vindo de volta",
      title: "Entrar",
      subtitle: "Use o e-mail que você cadastrou com sua família, escola ou distrito.",
      reassure_title: "Nunca vendemos seus dados.",
      reassure_body:
        "Seu e-mail é usado apenas para identificar sua conta. Leia o aviso de privacidade para saber mais.",
      reassure_link: "Leia o aviso de privacidade",
      submit: "Entrar",
      forgot: "Esqueceu a senha?",
      create_account: "Criar uma conta",
    },
    signup: {
      eyebrow: "Crie sua conta",
      title_invite: "Aceite seu convite",
      title_default: "Conte-nos um pouco sobre você",
      subtitle_invite:
        "Cole o código do convite da sua escola ou distrito. Você poderá terminar de configurar sua função em seguida.",
      subtitle_default:
        "Vamos personalizar os próximos passos de acordo com quem você está configurando a AIVO.",
      reassure_title: "Adultos criam as contas, não as crianças.",
      reassure_body:
        "Se estiver criando uma conta para uma criança, você a adicionará na próxima etapa. A AIVO nunca pede que uma criança crie a própria conta.",
      already_have: "Já tem uma conta?",
      sign_in: "Entrar",
      invite_label: "Código de convite",
      invite_helper: "Sua escola ou distrito enviou no e-mail de boas-vindas.",
      name_label: "Seu nome",
      password_helper:
        "Pelo menos 12 caracteres. Verificaremos que não está em nenhum vazamento conhecido antes de salvá-la.",
    },
    role: {
      eyebrow: "Escolha sua função",
      title: "Para quem você está configurando a AIVO?",
      subtitle:
        "Vamos personalizar os próximos passos. Você pode adicionar outras funções depois — muitos adultos são pais e professores ao mesmo tempo.",
      reassure_title: "As crianças não escolhem uma função.",
      reassure_body:
        "Um pai/mãe ou professor adiciona um aluno. O aluno vê uma visão adequada para crianças com suas tarefas — nunca esta página.",
      parent_label: "Pai, mãe ou responsável",
      parent_desc: "Configure a AIVO para uma ou mais crianças em casa.",
      teacher_label: "Professor",
      teacher_desc: "Entre em uma escola que já usa a AIVO ou crie uma turma.",
      school_admin_label: "Administrador de escola",
      school_admin_desc: "Gerencie a equipe, as turmas e a conformidade de uma escola.",
      district_admin_label: "Administrador de distrito",
      district_admin_desc: "Supervisione várias escolas, faturamento e relatórios.",
    },
    parent_setup: {
      eyebrow: "Configuração da família",
      title: "Conte-nos sobre sua casa.",
      subtitle:
        "Você adicionará seus filhos na próxima etapa. Estas informações nos ajudam a direcionar convites e compartilhar o progresso com os adultos certos.",
      reassure_title: "Os detalhes da casa permanecem privados.",
      reassure_body:
        "Nunca vendemos informações da casa. Co-responsáveis só veem os alunos aos quais foram adicionados.",
      reassure_link: "O que coletamos",
      continue: "Continuar — adicionar um aluno",
      household_label: "Nome da casa (opcional)",
      household_placeholder: "ex.: Família Okafor",
      household_helper:
        "Mostrado aos professores quando eles enviam mensagens. Você pode mudar depois.",
      coparent_label: "Convidar um co-responsável ou cuidador (opcional)",
      coparent_helper:
        "Eles receberão um e-mail com o próprio acesso. Ambos podem aprovar consentimentos e ver o progresso.",
    },
    learner_new: {
      eyebrow: "Adicionar um aluno",
      title: "Conte-nos sobre seu filho.",
      subtitle:
        "Use só o que você diria em voz alta — o primeiro nome basta. Você pode adicionar mais alunos depois pela tela inicial.",
      reassure_title: "Coletamos o mínimo necessário.",
      reassure_body:
        "Sem sobrenome, sem data de nascimento, sem endereço aqui. Você verá exatamente o que professores e a IA usam na etapa de consentimento.",
      reassure_link: "O que usamos",
      continue: "Continuar para o consentimento",
      first_name_label: "Primeiro nome do aluno (ou apelido)",
      first_name_placeholder: "ex.: Emma",
      grade_band_label: "Faixa escolar",
      grade_band_placeholder: "Escolha uma faixa",
      grade_band_help: "Usamos uma faixa, não a data de nascimento. Você pode mudar quando quiser.",
      iep_legend: "Seu filho tem um plano IEP ou 504?",
      iep_help:
        "Você pode enviá-lo nas próximas etapas — apenas com seu consentimento explícito. Pule se preferir decidir depois.",
      iep_yes: "Sim",
      iep_no: "Não",
      iep_unsure: "Ainda não tenho certeza",
    },
    consent: {
      eyebrow: "Seu consentimento — seu controle",
      title: "Escolha o que a AIVO pode fazer.",
      subtitle:
        "Cada linha é uma escolha separada. Você pode mudar qualquer uma delas depois em Configurações → Privacidade.",
      reassure_title: "Sem pacotes. Sem dark patterns.",
      reassure_body:
        "Compartilhar dados com a escola e a personalização por IA são independentes. Você pode dizer sim a um e não ao outro.",
      reassure_link: "Leia o aviso de privacidade completo",
      footer_note:
        "Pediremos para você reconfirmar qualquer escolha que afete seu filho — nunca alterada silenciosamente.",
      row_parent_title: "Consentimento do pai/mãe / responsável",
      row_parent_desc:
        "Confirmo que sou o pai/mãe ou responsável legal pelos alunos desta conta e concordo com os Termos da AIVO.",
      row_school_title: "Compartilhar o progresso com a escola do meu filho",
      row_school_desc:
        "Permite que os professores do seu filho vejam o domínio, as lições e os apoios do IEP. Independente de qualquer escolha de IA abaixo.",
      row_ai_title: "Usar IA para personalizar o aprendizado",
      row_ai_desc:
        "A AIVO usa as respostas do seu filho para ajustar o ritmo, os exemplos e as dicas. Nunca vendemos esses dados. Desativar isso mantém seu filho em lições não personalizadas.",
      row_mkt_title: "Enviar-me novidades do produto",
      row_mkt_desc: "Um e-mail mensal curto. Nunca enviado aos alunos.",
      legal_summary: "O que cada escolha realmente muda (em linguagem simples).",
      legal_parent_label: "Pai/mãe / responsável:",
      legal_parent_body:
        "obrigatório para criar contas de menores de 18 anos. Verifica que você é o responsável legal.",
      legal_school_label: "Compartilhamento com a escola:",
      legal_school_body:
        "os professores veem o domínio, as lições e (se enviados) os apoios do IEP. Sem marketing nem compartilhamento com terceiros.",
      legal_ai_label: "Personalização por IA:",
      legal_ai_body:
        "a AIVO adapta o ritmo e as dicas ao seu filho. Os dados de treinamento nunca são usados para identificar um aluno.",
      legal_mkt_label: "Novidades do produto:",
      legal_mkt_body: "uma lista de e-mail de baixo volume. Cancele a inscrição com um clique.",
    },
    permissions: {
      eyebrow: "Permissões do dispositivo",
      title: "O que a AIVO pode usar neste dispositivo?",
      subtitle:
        "Estes são os únicos recursos do dispositivo que a AIVO pede. Nunca solicitamos localização, contatos ou acesso à galeria de fotos.",
      reassure_title: "Seu navegador também pede isso.",
      reassure_body:
        "Quando a AIVO realmente precisar do microfone ou da câmera, seu navegador exibirá o próprio pedido de permissão — você pode negar mesmo que tenha dito sim aqui.",
      continue: "Continuar — configurar um PIN",
      mic_title: "Microfone",
      mic_desc:
        "Usado apenas em lições de leitura em voz alta e no modo de voz do tutor de IA. Desativado por padrão — ative se seu filho quiser ler em voz alta.",
      cam_title: "Câmera",
      cam_desc:
        "Usada apenas ao digitalizar uma página de tarefa ou documento. A AIVO nunca grava vídeo.",
      notifs_title: "Notificações",
      notifs_desc:
        "Pedidos de aprovação, resumos semanais de progresso e mensagens de segurança. Lembretes de lições estão desativados por padrão — você pode ativá-los depois.",
    },
    pin: {
      eyebrow: "PIN do aluno",
      title: "Escolha um PIN de 4 dígitos para seu filho.",
      subtitle:
        "Seu filho usa este PIN para desbloquear o aprendizado neste dispositivo. O PIN nunca substitui o seu login de responsável.",
      reassure_title: "Um PIN é uma trava leve, não um cofre.",
      reassure_body:
        "Ele evita que um irmão abra o perfil errado. Ações sensíveis ainda exigem o login de um responsável.",
      save: "Salvar PIN",
      skip: "Pular — definir um PIN depois nas Configurações",
      choose_pin: "Escolher PIN",
      confirm_pin: "Confirmar PIN",
      mismatch: "Não conferem. Tente de novo.",
    },
    parent_verify: {
      eyebrow: "Verificação do responsável",
      title_phone: "Confirme que é realmente você.",
      title_code: "Digite o código de 6 dígitos.",
      subtitle_phone:
        "Enviaremos um código de uso único por SMS para confirmar que você é o adulto desta conta. Nunca usamos este número para marketing.",
      subtitle_code: "Enviamos um código para o seu telefone. Ele expira em 10 minutos.",
      reassure_title: "As crianças não podem pular esta etapa.",
      reassure_body:
        "O perfil de uma criança só fica ativo depois que um responsável verifica. É assim que a AIVO garante a aprovação dos pais.",
      send_code: "Enviar código",
      verify_continue: "Verificar e continuar",
      use_diff_phone: "Usar outro número de telefone",
      phone_label: "Telefone celular",
      phone_helper: "Usamos isto apenas para verificação e recuperação de conta.",
      code_label: "Código de 6 dígitos",
    },
    privacy: {
      eyebrow: "Privacidade",
      title: "O que a AIVO faz — em linguagem simples.",
      subtitle:
        "Abaixo está a versão curta. Cada seção abre o texto legal completo. Você pode reler isto a qualquer momento nas Configurações.",
      reassure_title: "Uma promessa acima de tudo.",
      reassure_body:
        "Nunca vendemos dados de alunos. Nem a anunciantes, nem a fornecedores, nem a parceiros de treinamento de IA.",
      collect_summary: "O que coletamos — apenas o necessário para ensinar.",
      collect_account: "Conta: nome do responsável / equipe, e-mail.",
      collect_learner:
        "Aluno: primeiro nome ou apelido, faixa escolar, adaptações opcionais (IEP / 504), respostas às lições.",
      collect_device: "Dispositivo: navegador, SO, versão do app — apenas para depuração.",
      ai_summary: "Como a IA é usada.",
      ai_body:
        "Quando a personalização por IA está ativada, as respostas do seu filho ajustam a próxima lição — ritmo, exemplos, dicas. Não usamos essas respostas para identificar seu filho. Não treinamos modelos fundamentais com trabalhos identificáveis de alunos. Os provedores de modelos são obrigados por contrato a excluir os dados de prompt e resposta em até 30 dias.",
      who_summary: "Quem vê o quê.",
      who_you: "Você e qualquer co-responsável que adicionou: progresso completo.",
      who_teachers:
        "Professores da escola para a qual você consentiu: domínio das lições e apoios do IEP apenas das turmas deles.",
      who_staff:
        "Equipe da AIVO: acesso criptografado para suporte, com registros de auditoria. Nunca navegamos nos trabalhos dos alunos sem motivo.",
      who_advertisers: "Anunciantes: nunca.",
      rights_summary: "Seus direitos e como excluir.",
      rights_body:
        "Você pode exportar todos os registros que a AIVO mantém sobre sua conta ou seu filho em Configurações → Privacidade → Exportar. Você pode excluir a conta da mesma forma. A exclusão é permanente em até 30 dias; você pode cancelar durante o período de carência.",
    },
    terms: {
      eyebrow: "Termos",
      title: "Termos de Uso da AIVO.",
      subtitle:
        "Resumo primeiro. Toque em qualquer seção para o texto legal completo. Última atualização: esta página é um espaço reservado para a versão final revisada juridicamente.",
      agree_summary: "Com o que você concorda.",
      agree_body:
        "Você concorda em usar a AIVO com o objetivo de educar a si mesmo, seu filho ou seus alunos. Você não tentará burlar os filtros de segurança, revender o acesso nem usar a saída da AIVO para treinar modelos concorrentes.",
      aivo_summary: "Com o que a AIVO concorda.",
      aivo_body:
        "Manteremos seus dados privados conforme descrito em nosso aviso de privacidade, avisaremos com 30 dias de antecedência sobre qualquer mudança importante nestes termos e deixaremos você exportar tudo o que mantemos a qualquer momento.",
      children_summary: "Crianças e famílias.",
      children_body:
        "Para contas que incluem alunos menores de 13 anos, um pai/mãe ou responsável verificado deve consentir. Não criamos conscientemente contas controladas por crianças. Escolas que atuam in loco parentis devem ter um acordo de processamento de dados assinado em arquivo.",
      wrong_summary: "Se algo der errado.",
      wrong_body:
        "Qualquer uma das partes pode encerrar este acordo. Sua exportação de dados permanece disponível por 90 dias após o encerramento. Disputas são regidas pelas leis da jurisdição do seu endereço de cobrança.",
    },
    recovery: {
      eyebrow: "Recuperação de conta",
      title: "Problemas para entrar? Enviaremos um link.",
      subtitle:
        "Digite o e-mail da sua conta AIVO. Enviaremos por e-mail um link de uso único para redefinir sua senha.",
      reassure_title: "Não dizemos se o e-mail existe.",
      reassure_body:
        "De qualquer forma, mostraremos a mesma confirmação. Isso impede que pessoas mal-intencionadas descubram quais endereços têm conta.",
      submit: "Enviar link de recuperação",
      back_to_sign_in: "Voltar para entrar",
    },
    child_approval: {
      eyebrow: "Etapa final",
      title: "Aprove o acesso do seu filho.",
      subtitle:
        "Estas são as experiências que seu filho pode usar na AIVO. Você pode mudar qualquer uma delas no perfil dele depois.",
      reassure_title: "Seu filho está esperando por você.",
      reassure_body:
        "Até você tocar em Aprovar, este perfil fica em espera. Seu filho não pode entrar nem começar as lições.",
      approve: "Aprovar e concluir",
      footer_note: "Você chegará à página inicial dos pais com seu filho configurado e pronto.",
      comm_title: "Mensagens com os professores",
      comm_desc:
        "Seu filho pode ler mensagens dos professores e responder com respostas rápidas moderadas por adultos.",
      ai_title: "Tutor de IA",
      ai_desc:
        "Um tutor conversacional que explica conceitos, nunca dá as respostas finais e encaminha temas de segurança a um adulto.",
      voice_title: "Modo de voz",
      voice_desc:
        "Permite que seu filho fale com o tutor e ouça as respostas. Desativado por padrão — usa o microfone.",
    },
    iep_upload: {
      eyebrow: "Apoios IEP / 504",
      title: "Adicione o plano do seu filho — só se quiser.",
      subtitle:
        "Se você tem um IEP ou 504, a AIVO pode extrair adaptações (tempo extra, leitura em voz alta, etc.) para que as lições se ajustem desde o primeiro dia. Você pode fazer isso depois, ou nunca.",
      reassure_title: "Este é um documento sensível.",
      reassure_body:
        "Apenas você, qualquer co-responsável e os professores das escolas para as quais você consentiu o verão. A extração por IA é executada dentro do ambiente. O arquivo original é criptografado em repouso.",
      reassure_link: "Como os IEPs são tratados",
      upload_continue: "Enviar e continuar",
      skip: "Pular por enquanto",
      footer_note: "Você pode enviar depois pelo perfil do seu aluno.",
      consent_title: "Consinto explicitamente em enviar um plano IEP / 504",
      consent_desc:
        "A AIVO armazenará o documento, extrairá as adaptações listadas e as aplicará às lições. Você pode excluí-lo a qualquer momento.",
      choose_file: "Escolha um arquivo PDF ou Word",
      file_help:
        "Arquivos de até 20 MB. Mostraremos uma prévia do que extraímos antes de aplicar qualquer coisa.",
      legal_summary: "O que é extraído e o que não é.",
      legal_extracted_label: "Extraído:",
      legal_extracted_body:
        "lista de adaptações (tempo extra, leitura em voz alta, pausas), categorias de metas, horas de serviços de apoio.",
      legal_never_label: "Nunca extraído:",
      legal_never_body:
        "diagnósticos médicos, avaliações psicológicas, declarações dos pais, assinaturas.",
      legal_teachers_label: "Visível para os professores:",
      legal_teachers_body:
        "apenas a lista de adaptações, apenas nas escolas para as quais você consentiu.",
    },
    invite_school: {
      eyebrow: "Convite da escola",
      title: "Entre na sua escola na AIVO.",
      subtitle:
        "Cole o código que sua escola enviou. Se você não tiver um, peça ao administrador da escola — apenas a equipe convidada pode entrar.",
      reassure_title: "A equipe escolar não pode se inscrever sozinha.",
      reassure_body:
        "Um administrador deve convidá-lo. Isso protege as listas e os dados dos alunos.",
      join: "Entrar na escola",
      code_label: "Código de convite",
      email_label: "Seu e-mail escolar",
      email_helper: "Deve corresponder ao e-mail para o qual o administrador o convidou.",
    },
    invite_district: {
      eyebrow: "Convite do distrito",
      title: "Entre no seu distrito na AIVO.",
      subtitle:
        "Os convites de administrador de distrito são emitidos pela AIVO durante a integração. Seu gerente de sucesso do distrito enviará um código de uso único.",
      reassure_title: "A verificação reforçada do administrador de distrito é obrigatória.",
      reassure_body:
        "Cada login para esta função exige uma nova verificação biométrica ou por PIN. A AIVO nunca deixa uma única senha desbloquear dados do distrito.",
      code_label: "Código de convite do distrito",
      email_label: "Seu e-mail do distrito",
    },
    error: {
      expired_invite_eyebrow: "Convite expirado",
      expired_invite_title: "Este convite não é mais válido.",
      expired_invite_subtitle:
        "Os convites expiram após 30 dias. Peça a quem o enviou para emitir um novo.",
      expired_invite_body:
        "Se sua escola ou distrito enviou, contate seu administrador. O suporte da AIVO também pode reenviar se você fornecer o código original.",
      expired_invite_reassure_title: "Não perdemos sua vaga.",
      expired_invite_reassure_body:
        "Sua vaga na escola ou no distrito continua reservada — apenas o link expirou.",
      expired_invite_primary: "Voltar às boas-vindas",
      expired_invite_secondary: "Precisa de ajuda para entrar?",
      offline_eyebrow: "Offline",
      offline_title: "Não conseguimos acessar a AIVO agora.",
      offline_subtitle: "Verifique sua conexão e tente de novo.",
      offline_body:
        "Algumas atividades do aluno funcionam offline depois que uma lição carrega — mas a configuração precisa de uma conexão ativa.",
      offline_reassure_title: "Nada foi perdido.",
      offline_reassure_body:
        "Continuaremos exatamente de onde você parou assim que voltar a ficar online.",
      offline_primary: "Tentar de novo",
      blocked_eyebrow: "Conta bloqueada",
      blocked_title: "Esta conta está pausada.",
      blocked_subtitle:
        "O suporte da AIVO pausou esta conta. Geralmente é uma revisão de faturamento ou conformidade.",
      blocked_body:
        "Você receberá um e-mail no endereço cadastrado quando a revisão terminar, normalmente em um dia útil.",
      blocked_reassure_title: "Os dados do seu filho estão seguros.",
      blocked_reassure_body: "Não excluímos nada durante uma revisão — apenas pausar e retomar.",
      blocked_primary: "Voltar às boas-vindas",
      generic_eyebrow: "Algo deu errado",
      generic_title: "Tivemos um problema.",
      generic_subtitle: "Provavelmente é temporário — tente de novo em um instante.",
      generic_body:
        "Se isso continuar acontecendo, contate o suporte da AIVO e mencione o que você estava tentando fazer.",
      generic_reassure_title: "Nada foi cobrado ou salvo incorretamente.",
      generic_reassure_body: "A AIVO nunca mantém dados de configuração pela metade.",
      generic_primary: "Começar de novo",
    },
  },
  zh: {
    common: {
      back: "返回",
      continue: "继续",
      terms: "条款",
      privacy: "隐私",
      copyright: "© AIVO Learning",
      email: "电子邮箱",
      password: "密码",
      show: "显示",
      hide: "隐藏",
      show_password: "显示密码",
      hide_password: "隐藏密码",
      back_to_consent: "返回同意页",
      badge_required: "必填",
      badge_optional: "可选",
      badge_recommended: "推荐",
      badge_explicit: "明确",
      contact_support: "联系支持",
    },
    steps: {
      about_you: "关于你",
      role: "角色",
      consent: "同意",
      family: "家庭",
      join_school: "加入学校",
      join_district: "加入学区",
    },
    welcome: {
      brand_title: "在每个孩子所处的水平上与他们相遇的学习。",
      brand_body:
        "AIVO 是一个平和、无障碍的学习平台，与家庭、教师和学习者共同打造——包括以不同方式学习的孩子。",
      eyebrow: "欢迎",
      title: "让我们开始吧。",
      subtitle: "登录以继续，或为你的家庭、学校或学区创建新账户。",
      sign_in: "登录",
      create_account: "创建账户",
      invite_lead: "有来自学校或学区的邀请码吗？",
      invite_link: "使用邀请链接",
      body: "AIVO 可在网页、平板和手机上使用。你可以随时切换设备——你的进度会随你而来。",
    },
    signin: {
      trouble: "登录遇到问题？",
      eyebrow: "欢迎回来",
      title: "登录",
      subtitle: "使用你为家庭、学校或学区设置的邮箱。",
      reassure_title: "我们绝不出售你的数据。",
      reassure_body: "你的邮箱仅用于识别你的账户。更多信息请阅读隐私声明。",
      reassure_link: "阅读隐私声明",
      submit: "登录",
      forgot: "忘记密码？",
      create_account: "创建账户",
    },
    signup: {
      eyebrow: "创建你的账户",
      title_invite: "接受你的邀请",
      title_default: "简单介绍一下你自己",
      subtitle_invite: "粘贴来自学校或学区邀请的代码。你可以在下一步完成角色设置。",
      subtitle_default: "我们将根据你为谁设置 AIVO 来个性化后续步骤。",
      reassure_title: "由成年人创建账户，而非孩子。",
      reassure_body:
        "如果你在为孩子创建账户，你将在下一步添加他们。AIVO 绝不会要求孩子创建自己的账户。",
      already_have: "已经有账户了？",
      sign_in: "登录",
      invite_label: "邀请码",
      invite_helper: "你的学校或学区在欢迎邮件中发送了它。",
      name_label: "你的姓名",
      password_helper: "至少 12 个字符。保存前我们会检查它是否出现在任何已知的泄露中。",
    },
    role: {
      eyebrow: "选择你的角色",
      title: "你在为谁设置 AIVO？",
      subtitle: "我们将定制后续步骤。你可以稍后添加其他角色——许多成年人既是家长也是教师。",
      reassure_title: "孩子不选择角色。",
      reassure_body:
        "由家长或教师添加学习者。学习者看到的是带有他们功课的儿童友好视图——绝不会是此页面。",
      parent_label: "家长或照护者",
      parent_desc: "在家为一个或多个孩子设置 AIVO。",
      teacher_label: "教师",
      teacher_desc: "加入已在使用 AIVO 的学校，或创建一个班级。",
      school_admin_label: "学校管理员",
      school_admin_desc: "管理学校的教职员工、班级与合规。",
      district_admin_label: "学区管理员",
      district_admin_desc: "监管多所学校、计费与报告。",
    },
    parent_setup: {
      eyebrow: "家庭设置",
      title: "告诉我们你的家庭情况。",
      subtitle: "你将在下一步添加孩子。这些信息帮助我们转发邀请，并与合适的大人共享进度。",
      reassure_title: "家庭信息保持私密。",
      reassure_body: "我们绝不出售家庭信息。共同家长只能看到他们被添加到的学习者。",
      reassure_link: "我们收集什么",
      continue: "继续 — 添加学习者",
      household_label: "家庭名称（可选）",
      household_placeholder: "例如：Okafor 一家",
      household_helper: "当教师给你发消息时会显示。你可以稍后更改。",
      coparent_label: "邀请共同家长或照护者（可选）",
      coparent_helper: "他们将收到一封带有自己登录方式的邮件。你们都可以批准同意并查看进度。",
    },
    learner_new: {
      eyebrow: "添加学习者",
      title: "告诉我们你孩子的情况。",
      subtitle: "只用你会大声说出来的内容——名字就够了。你可以稍后从主屏幕添加更多学习者。",
      reassure_title: "我们只收集最少的必要信息。",
      reassure_body: "这里不需要姓氏、出生日期或地址。你将在同意步骤看到教师和 AI 究竟使用什么。",
      reassure_link: "我们使用什么",
      continue: "继续到同意",
      first_name_label: "学习者名字（或昵称）",
      first_name_placeholder: "例如：Emma",
      grade_band_label: "年级段",
      grade_band_placeholder: "选择一个年级段",
      grade_band_help: "我们使用年级段，而不是生日。你可以随时更改。",
      iep_legend: "你的孩子有 IEP 或 504 计划吗？",
      iep_help: "你可以在后续步骤上传它——仅在你明确同意的情况下。如果你想稍后再决定，可以跳过。",
      iep_yes: "是",
      iep_no: "否",
      iep_unsure: "还不确定",
    },
    consent: {
      eyebrow: "你的同意——由你掌控",
      title: "选择 AIVO 可以做什么。",
      subtitle: "每一行都是单独的选择。你可以稍后在设置 → 隐私中更改其中任何一项。",
      reassure_title: "没有捆绑。没有暗黑模式。",
      reassure_body: "与学校共享数据和 AI 个性化是相互独立的。你可以对其中一个说是、对另一个说否。",
      reassure_link: "阅读完整的隐私声明",
      footer_note: "我们稍后会请你重新确认任何影响孩子的选择——绝不会悄悄更改。",
      row_parent_title: "家长／监护人同意",
      row_parent_desc: "我确认我是本账户中学习者的家长或法定监护人，并同意 AIVO 的条款。",
      row_school_title: "与孩子的学校共享进度",
      row_school_desc: "让孩子的教师看到掌握情况、课程和 IEP 支持。与下面任何 AI 选择相互独立。",
      row_ai_title: "使用 AI 个性化学习",
      row_ai_desc:
        "AIVO 使用孩子的回答来调整节奏、示例和提示。我们绝不出售这些数据。关闭此项会让孩子停留在非个性化课程中。",
      row_mkt_title: "向我发送产品资讯",
      row_mkt_desc: "一封简短的月度邮件。绝不发送给学习者。",
      legal_summary: "每个选择实际会改变什么（通俗易懂）。",
      legal_parent_label: "家长／监护人：",
      legal_parent_body: "为 18 岁以下任何人创建账户所必需。验证你是法定监护人。",
      legal_school_label: "学校共享：",
      legal_school_body:
        "教师可看到掌握情况、课程以及（如已上传）IEP 支持。无营销，也不与第三方共享。",
      legal_ai_label: "AI 个性化：",
      legal_ai_body: "AIVO 为你的孩子调整节奏与提示。训练数据绝不会用于识别某个学习者。",
      legal_mkt_label: "产品资讯：",
      legal_mkt_body: "一个低频邮件列表。一键取消订阅。",
    },
    permissions: {
      eyebrow: "设备权限",
      title: "AIVO 可以在此设备上使用什么？",
      subtitle: "这些是 AIVO 唯一会请求的设备功能。我们绝不请求位置、通讯录或相册访问权限。",
      reassure_title: "你的浏览器也会请求这些。",
      reassure_body:
        "当 AIVO 确实需要麦克风或摄像头时，你的浏览器会弹出它自己的权限提示——即使你在这里说了是，你也可以拒绝。",
      continue: "继续 — 设置 PIN",
      mic_title: "麦克风",
      mic_desc: "仅用于朗读式课程和 AI 导师语音模式。默认关闭——如果孩子想朗读，请开启。",
      cam_title: "摄像头",
      cam_desc: "仅在扫描作业页面或文档时使用。AIVO 绝不录制视频。",
      notifs_title: "通知",
      notifs_desc: "批准请求、每周进度摘要和安全消息。课程提醒默认关闭——你可以稍后启用。",
    },
    pin: {
      eyebrow: "学习者 PIN",
      title: "为你的孩子选择一个 4 位 PIN。",
      subtitle: "你的孩子使用此 PIN 在此设备上解锁学习。PIN 绝不替代你的家长登录。",
      reassure_title: "PIN 是一道软锁，而非保险箱。",
      reassure_body: "它能防止兄弟姐妹打开错误的个人资料。敏感操作仍需要家长登录。",
      save: "保存 PIN",
      skip: "跳过 — 稍后在设置中设置 PIN",
      choose_pin: "选择 PIN",
      confirm_pin: "确认 PIN",
      mismatch: "两者不一致。请重试。",
    },
    parent_verify: {
      eyebrow: "家长验证",
      title_phone: "验证确实是你本人。",
      title_code: "输入 6 位代码。",
      subtitle_phone:
        "我们将通过短信发送一次性代码，以确认你是此账户的成年人。我们绝不将此号码用于营销。",
      subtitle_code: "我们已向你的手机发送了一个代码。它将在 10 分钟后失效。",
      reassure_title: "孩子无法跳过此步骤。",
      reassure_body: "孩子的个人资料只有在家长验证后才会激活。AIVO 正是以此方式落实家长批准。",
      send_code: "发送代码",
      verify_continue: "验证并继续",
      use_diff_phone: "使用其他电话号码",
      phone_label: "手机",
      phone_helper: "我们仅将其用于验证和账户恢复。",
      code_label: "6 位代码",
    },
    privacy: {
      eyebrow: "隐私",
      title: "AIVO 做什么——通俗易懂。",
      subtitle: "下面是简短版本。每个部分都可展开完整的法律文本。你可以随时在设置中重新阅读此页。",
      reassure_title: "高于一切的一个承诺。",
      reassure_body: "我们绝不出售学生数据。不卖给广告商、不卖给供应商、也不卖给 AI 训练伙伴。",
      collect_summary: "我们收集什么——只收集教学所需的内容。",
      collect_account: "账户：家长／教职员姓名、电子邮箱。",
      collect_learner: "学习者：名字或昵称、年级段、可选的适应性支持（IEP / 504）、对课程的回答。",
      collect_device: "设备：浏览器、操作系统、应用版本——仅用于调试。",
      ai_summary: "如何使用 AI。",
      ai_body:
        "开启 AI 个性化后，孩子的回答会调整其下一节课——节奏、示例、提示。我们不会使用这些回答来识别你的孩子。我们不会用可识别的学生作业训练基础模型。模型提供商按合同约定须在 30 天内删除提示与回复数据。",
      who_summary: "谁能看到什么。",
      who_you: "你和你添加的任何共同家长：完整进度。",
      who_teachers: "你已同意的学校的教师：仅他们班级的课程掌握情况和 IEP 支持。",
      who_staff:
        "AIVO 员工：为提供支持而进行的加密访问，并带有审计日志。我们绝不随意浏览学生作业。",
      who_advertisers: "广告商：绝不。",
      rights_summary: "你的权利以及如何删除。",
      rights_body:
        "你可以在设置 → 隐私 → 导出中导出 AIVO 持有的关于你账户或孩子的每一条记录。你也可以以同样方式删除账户。删除将在 30 天内永久生效；你可以在宽限期内取消。",
    },
    terms: {
      eyebrow: "条款",
      title: "AIVO 使用条款。",
      subtitle:
        "先看摘要。点按任一部分查看完整法律文本。最后更新：本页是最终经法律审核文案的占位内容。",
      agree_summary: "你同意什么。",
      agree_body:
        "你同意将 AIVO 用于教育你自己、你的孩子或你的学生。你不会试图绕过安全过滤、转售访问权限，或使用 AIVO 的输出来训练竞争模型。",
      aivo_summary: "AIVO 同意什么。",
      aivo_body:
        "我们将按照隐私声明所述对你的数据保密，对这些条款的任何重大变更提前 30 天通知你，并允许你随时导出我们持有的一切。",
      children_summary: "儿童与家庭。",
      children_body:
        "对于包含 13 岁以下学习者的账户，必须由经过验证的家长或监护人同意。我们不会故意创建由儿童控制的账户。以 in loco parentis 身份行事的学校须有已签署的数据处理协议存档。",
      wrong_summary: "如果出了问题。",
      wrong_body:
        "我们任何一方都可以终止本协议。账户关闭后，你的数据导出仍可用 90 天。争议受你账单地址所在司法管辖区的法律管辖。",
    },
    recovery: {
      eyebrow: "账户恢复",
      title: "登录遇到问题？我们会发送一个链接。",
      subtitle: "输入你 AIVO 账户的邮箱。我们将通过邮件发送一个一次性链接，让你重置密码。",
      reassure_title: "我们不会说明该邮箱是否存在。",
      reassure_body: "无论如何，我们都会显示相同的确认。这能防止不法分子得知哪些地址拥有账户。",
      submit: "发送恢复链接",
      back_to_sign_in: "返回登录",
    },
    child_approval: {
      eyebrow: "最后一步",
      title: "批准你孩子的访问权限。",
      subtitle:
        "这些是你的孩子可以在 AIVO 上使用的体验。你可以稍后在其个人资料中更改其中任何一项。",
      reassure_title: "你的孩子在等你。",
      reassure_body: "在你按下批准之前，此个人资料处于等待状态。你的孩子无法登录或开始课程。",
      approve: "批准并完成",
      footer_note: "你将到达家长主页，孩子已设置好并准备就绪。",
      comm_title: "与教师的消息",
      comm_desc: "你的孩子可以阅读来自教师的消息，并以经成人审核的快捷回复进行回应。",
      ai_title: "AI 导师",
      ai_desc: "一个对话式导师，讲解概念、绝不给出最终答案，并将安全话题转交给成年人。",
      voice_title: "语音模式",
      voice_desc: "让你的孩子与导师对话并收听。默认关闭——使用麦克风。",
    },
    iep_upload: {
      eyebrow: "IEP / 504 支持",
      title: "添加你孩子的计划——仅当你愿意时。",
      subtitle:
        "如果你有 IEP 或 504，AIVO 可以提取适应性支持（额外时间、朗读等），让课程从第一天起就与之匹配。你可以稍后再做，或永不做。",
      reassure_title: "这是一份敏感文件。",
      reassure_body:
        "只有你、任何共同家长以及你已同意学校的教师才能看到它。AI 提取在租户内运行。原始文件在静态时加密。",
      reassure_link: "IEP 如何处理",
      upload_continue: "上传并继续",
      skip: "暂时跳过",
      footer_note: "你可以稍后从学习者的个人资料上传。",
      consent_title: "我明确同意上传 IEP / 504 计划",
      consent_desc: "AIVO 将存储该文件，提取列出的适应性支持，并将其应用于课程。你可以随时删除它。",
      choose_file: "选择 PDF 或 Word 文件",
      file_help: "文件最大 20 MB。在应用任何内容之前，我们会展示所提取内容的预览。",
      legal_summary: "提取什么，不提取什么。",
      legal_extracted_label: "提取：",
      legal_extracted_body: "适应性支持清单（额外时间、朗读、休息）、目标类别、支持服务时数。",
      legal_never_label: "绝不提取：",
      legal_never_body: "医疗诊断、心理评估、家长陈述、签名。",
      legal_teachers_label: "教师可见：",
      legal_teachers_body: "仅适应性支持清单，且仅限你已同意的学校。",
    },
    invite_school: {
      eyebrow: "学校邀请",
      title: "在 AIVO 上加入你的学校。",
      subtitle:
        "粘贴你学校发送给你的代码。如果你没有，请向学校管理员索取——只有受邀的教职员工才能加入。",
      reassure_title: "学校教职员工无法自行注册。",
      reassure_body: "必须由管理员邀请你。这能保护花名册和学生数据。",
      join: "加入学校",
      code_label: "邀请码",
      email_label: "你的学校邮箱",
      email_helper: "必须与管理员邀请的邮箱一致。",
    },
    invite_district: {
      eyebrow: "学区邀请",
      title: "在 AIVO 上加入你的学区。",
      subtitle: "学区管理员邀请由 AIVO 在引导期间发出。你的学区成功经理将向你发送一次性代码。",
      reassure_title: "学区管理员的强化验证为强制要求。",
      reassure_body:
        "此角色的每次登录都需要一次全新的生物识别或 PIN 检查。AIVO 绝不允许单个密码解锁学区数据。",
      code_label: "学区邀请码",
      email_label: "你的学区邮箱",
    },
    error: {
      expired_invite_eyebrow: "邀请已过期",
      expired_invite_title: "此邀请已不再有效。",
      expired_invite_subtitle: "邀请在 30 天后过期。请发送者重新签发一个。",
      expired_invite_body:
        "如果是你的学校或学区发送的，请联系你的管理员。若你提供原始代码，AIVO 支持也可以重新发送。",
      expired_invite_reassure_title: "我们没有丢失你的名额。",
      expired_invite_reassure_body: "你在学校或学区的席位仍为你保留——只是链接过期了。",
      expired_invite_primary: "返回欢迎页",
      expired_invite_secondary: "登录需要帮助？",
      offline_eyebrow: "离线",
      offline_title: "我们现在无法连接到 AIVO。",
      offline_subtitle: "检查你的连接并重试。",
      offline_body: "课程加载后，一些学习者活动可离线进行——但设置需要实时连接。",
      offline_reassure_title: "没有任何丢失。",
      offline_reassure_body: "一旦你恢复在线，我们会从你停下的地方继续。",
      offline_primary: "重试",
      blocked_eyebrow: "账户已封锁",
      blocked_title: "此账户已暂停。",
      blocked_subtitle: "AIVO 支持已暂停此账户。这通常是计费或合规审查。",
      blocked_body: "审查结束后，你将在登记的地址收到电子邮件，通常在一个工作日内。",
      blocked_reassure_title: "你孩子的数据是安全的。",
      blocked_reassure_body: "审查期间我们不会删除任何内容——只暂停和恢复。",
      blocked_primary: "返回欢迎页",
      generic_eyebrow: "出了点问题",
      generic_title: "我们遇到了一点麻烦。",
      generic_subtitle: "这可能是暂时的——请稍后重试。",
      generic_body: "如果此问题持续出现，请联系 AIVO 支持并说明你当时想做什么。",
      generic_reassure_title: "没有错误地扣费或保存任何内容。",
      generic_reassure_body: "AIVO 绝不保留未完成的设置数据。",
      generic_primary: "重新开始",
    },
  },
  ja: {
    common: {
      back: "戻る",
      continue: "続行",
      terms: "利用規約",
      privacy: "プライバシー",
      copyright: "© AIVO Learning",
      email: "メールアドレス",
      password: "パスワード",
      show: "表示",
      hide: "非表示",
      show_password: "パスワードを表示",
      hide_password: "パスワードを非表示",
      back_to_consent: "同意に戻る",
      badge_required: "必須",
      badge_optional: "任意",
      badge_recommended: "推奨",
      badge_explicit: "明示的",
      contact_support: "サポートに問い合わせる",
    },
    steps: {
      about_you: "あなたについて",
      role: "役割",
      consent: "同意",
      family: "家族",
      join_school: "学校に参加",
      join_district: "学区に参加",
    },
    welcome: {
      brand_title: "一人ひとりの子どもを今いる場所で迎える学び。",
      brand_body:
        "AIVO は、家族・教師・学習者とともに作られた、穏やかでアクセシブルな学習プラットフォームです。学び方の異なる子どもたちも含みます。",
      eyebrow: "ようこそ",
      title: "さあ、始めましょう。",
      subtitle:
        "サインインして続行するか、ご家族・学校・学区のための新しいアカウントを作成してください。",
      sign_in: "サインイン",
      create_account: "アカウントを作成",
      invite_lead: "学校または学区からの招待コードをお持ちですか？",
      invite_link: "招待リンクを使う",
      body: "AIVO はウェブ、タブレット、スマートフォンで使えます。いつでも端末を切り替えられ、進捗は一緒についてきます。",
    },
    signin: {
      trouble: "サインインでお困りですか？",
      eyebrow: "おかえりなさい",
      title: "サインイン",
      subtitle: "ご家族・学校・学区で設定したメールアドレスを使用してください。",
      reassure_title: "私たちはあなたのデータを販売しません。",
      reassure_body:
        "あなたのメールアドレスはアカウントの識別にのみ使用されます。詳しくはプライバシーに関する通知をご覧ください。",
      reassure_link: "プライバシーに関する通知を読む",
      submit: "サインイン",
      forgot: "パスワードをお忘れですか？",
      create_account: "アカウントを作成",
    },
    signup: {
      eyebrow: "アカウントを作成",
      title_invite: "招待を承認する",
      title_default: "あなたについて少し教えてください",
      subtitle_invite:
        "学校または学区の招待コードを貼り付けてください。役割の設定は次で完了できます。",
      subtitle_default:
        "誰のために AIVO を設定するかに合わせて、次のステップをカスタマイズします。",
      reassure_title: "アカウントを作成するのは大人であり、子どもではありません。",
      reassure_body:
        "子どものためにアカウントを作成する場合は、次のステップで追加します。AIVO が子どもに自分のアカウントを作成するよう求めることはありません。",
      already_have: "すでにアカウントをお持ちですか？",
      sign_in: "サインイン",
      invite_label: "招待コード",
      invite_helper: "学校または学区がウェルカムメールで送信しました。",
      name_label: "お名前",
      password_helper:
        "8 文字以上ではなく 12 文字以上。保存前に、既知の漏えいに含まれていないか確認します。",
    },
    role: {
      eyebrow: "役割を選ぶ",
      title: "誰のために AIVO を設定していますか？",
      subtitle:
        "次のステップをカスタマイズします。他の役割は後で追加できます。多くの大人は保護者であり教師でもあります。",
      reassure_title: "子どもは役割を選びません。",
      reassure_body:
        "保護者または教師が学習者を追加します。学習者には、自分の学習が表示される子ども向けのビューが表示され、このページは表示されません。",
      parent_label: "保護者またはケア提供者",
      parent_desc: "ご家庭で 1 人以上のお子さまのために AIVO を設定します。",
      teacher_label: "教師",
      teacher_desc: "すでに AIVO を使用している学校に参加するか、クラスを開始します。",
      school_admin_label: "学校管理者",
      school_admin_desc: "学校の職員、クラス、コンプライアンスを管理します。",
      district_admin_label: "学区管理者",
      district_admin_desc: "複数の学校、請求、レポートを統括します。",
    },
    parent_setup: {
      eyebrow: "家族の設定",
      title: "ご家庭について教えてください。",
      subtitle:
        "お子さまは次のステップで追加します。この情報は、招待の振り分けや、適切な大人との進捗共有に役立ちます。",
      reassure_title: "家庭の詳細は非公開のままです。",
      reassure_body:
        "家庭情報を販売することはありません。共同保護者は、自分が追加された学習者のみを見られます。",
      reassure_link: "収集する情報",
      continue: "続行 — 学習者を追加",
      household_label: "世帯名（任意）",
      household_placeholder: "例：オカフォー家",
      household_helper: "教師があなたにメッセージを送るときに表示されます。後で変更できます。",
      coparent_label: "共同保護者またはケア提供者を招待（任意）",
      coparent_helper:
        "本人専用のサインイン情報付きのメールが届きます。お二人とも同意を承認し、進捗を確認できます。",
    },
    learner_new: {
      eyebrow: "学習者を追加",
      title: "お子さまについて教えてください。",
      subtitle:
        "声に出して言える範囲だけで大丈夫です。下の名前で構いません。学習者はあとでホーム画面から追加できます。",
      reassure_title: "必要最小限のみ収集します。",
      reassure_body:
        "ここでは姓・生年月日・住所は不要です。教師や AI が使う内容は、同意のステップで正確に確認できます。",
      reassure_link: "使用する情報",
      continue: "同意へ進む",
      first_name_label: "学習者の名前（またはニックネーム）",
      first_name_placeholder: "例：Emma",
      grade_band_label: "学年区分",
      grade_band_placeholder: "区分を選択",
      grade_band_help: "生年月日ではなく区分を使用します。いつでも変更できます。",
      iep_legend: "お子さまに IEP または 504 プランはありますか？",
      iep_help:
        "次のステップでアップロードできます。あなたの明示的な同意がある場合のみです。あとで決めたい場合はスキップしてください。",
      iep_yes: "はい",
      iep_no: "いいえ",
      iep_unsure: "まだわからない",
    },
    consent: {
      eyebrow: "あなたの同意 — あなたの管理",
      title: "AIVO にできることを選んでください。",
      subtitle: "各行は個別の選択です。後から 設定 → プライバシー でいつでも変更できます。",
      reassure_title: "抱き合わせなし。ダークパターンなし。",
      reassure_body:
        "学校とのデータ共有と AI のパーソナライズは独立しています。一方に「はい」、もう一方に「いいえ」と言えます。",
      reassure_link: "プライバシーに関する通知の全文を読む",
      footer_note:
        "お子さまに影響する選択は、後で再確認をお願いします。黙って変更されることはありません。",
      row_parent_title: "保護者の同意",
      row_parent_desc:
        "私はこのアカウントの学習者の保護者または法定後見人であることを確認し、AIVO の利用規約に同意します。",
      row_school_title: "子どもの学校と進捗を共有する",
      row_school_desc:
        "お子さまの教師が習熟度、レッスン、IEP サポートを確認できます。下の AI の選択とは独立しています。",
      row_ai_title: "AI を使って学習をパーソナライズする",
      row_ai_desc:
        "AIVO はお子さまの回答を使ってペース、例、ヒントを調整します。このデータを販売することはありません。これをオフにすると、お子さまはパーソナライズされないレッスンのままになります。",
      row_mkt_title: "製品ニュースを送る",
      row_mkt_desc: "短い月次メールです。学習者には決して送りません。",
      legal_summary: "各選択が実際に何を変えるか（やさしい言葉で）。",
      legal_parent_label: "保護者：",
      legal_parent_body:
        "18 歳未満のアカウント作成に必須です。あなたが法定後見人であることを確認します。",
      legal_school_label: "学校との共有：",
      legal_school_body:
        "教師は習熟度、レッスン、（アップロードされていれば）IEP サポートを確認できます。マーケティングや第三者への共有はありません。",
      legal_ai_label: "AI のパーソナライズ：",
      legal_ai_body:
        "AIVO はお子さまに合わせてペースとヒントを調整します。学習データが学習者個人の特定に使われることはありません。",
      legal_mkt_label: "製品ニュース：",
      legal_mkt_body: "配信頻度の低いメールリストです。ワンクリックで配信停止できます。",
    },
    permissions: {
      eyebrow: "デバイスの権限",
      title: "このデバイスで AIVO が使えるものは？",
      subtitle:
        "これらは AIVO が求める唯一のデバイス機能です。位置情報、連絡先、フォトライブラリへのアクセスを求めることはありません。",
      reassure_title: "ブラウザもこれらを求めます。",
      reassure_body:
        "AIVO が実際にマイクやカメラを必要とするときは、ブラウザが独自の権限プロンプトを表示します。ここで「はい」と答えても拒否できます。",
      continue: "続行 — PIN を設定",
      mic_title: "マイク",
      mic_desc:
        "読み上げレッスンと AI チューターの音声モードでのみ使用します。既定はオフ。お子さまが音読したい場合はオンにしてください。",
      cam_title: "カメラ",
      cam_desc:
        "宿題のページや文書をスキャンするときのみ使用します。AIVO が動画を録画することはありません。",
      notifs_title: "通知",
      notifs_desc:
        "承認リクエスト、週次の進捗ダイジェスト、安全に関するメッセージ。レッスンのリマインダーは既定でオフです。後で有効にできます。",
    },
    pin: {
      eyebrow: "学習者 PIN",
      title: "お子さま用の 4 桁の PIN を選んでください。",
      subtitle:
        "お子さまはこの PIN を使って、このデバイスで学習のロックを解除します。PIN が保護者のサインインに代わることはありません。",
      reassure_title: "PIN はソフトロックであり、金庫ではありません。",
      reassure_body:
        "兄弟姉妹が誤ったプロフィールを開くのを防ぎます。重要な操作には引き続き保護者のサインインが必要です。",
      save: "PIN を保存",
      skip: "スキップ — あとで設定から PIN を設定",
      choose_pin: "PIN を選択",
      confirm_pin: "PIN を確認",
      mismatch: "一致しません。もう一度お試しください。",
    },
    parent_verify: {
      eyebrow: "保護者の確認",
      title_phone: "本当にご本人か確認します。",
      title_code: "6 桁のコードを入力してください。",
      subtitle_phone:
        "このアカウントの大人であることを確認するため、ワンタイムコードを SMS で送信します。この番号をマーケティングに使うことはありません。",
      subtitle_code: "コードをお使いの電話に送信しました。10 分で期限切れになります。",
      reassure_title: "子どもはこのステップを回避できません。",
      reassure_body:
        "子どものプロフィールは、保護者が確認した後にのみ有効になります。これが AIVO の保護者承認の仕組みです。",
      send_code: "コードを送信",
      verify_continue: "確認して続行",
      use_diff_phone: "別の電話番号を使う",
      phone_label: "携帯電話",
      phone_helper: "確認とアカウント復旧のためにのみ使用します。",
      code_label: "6 桁のコード",
    },
    privacy: {
      eyebrow: "プライバシー",
      title: "AIVO がすること — やさしい言葉で。",
      subtitle:
        "以下は短い版です。各セクションを開くと法的な全文が表示されます。設定からいつでも読み直せます。",
      reassure_title: "何よりも優先する一つの約束。",
      reassure_body:
        "私たちは生徒のデータを決して販売しません。広告主にも、ベンダーにも、AI 学習パートナーにも。",
      collect_summary: "収集するもの — 指導に必要なものだけ。",
      collect_account: "アカウント：保護者／職員の氏名、メールアドレス。",
      collect_learner:
        "学習者：名前またはニックネーム、学年区分、任意の配慮（IEP / 504）、レッスンへの回答。",
      collect_device: "デバイス：ブラウザ、OS、アプリのバージョン — デバッグ用のみ。",
      ai_summary: "AI の使われ方。",
      ai_body:
        "AI のパーソナライズがオンのとき、お子さまの回答が次のレッスン（ペース、例、ヒント）を調整します。これらの回答をお子さまの特定に使うことはありません。識別可能な生徒の作品で基盤モデルを学習させることもありません。モデル提供者は、プロンプトと応答のデータを 30 日以内に削除する契約上の義務を負います。",
      who_summary: "誰が何を見るか。",
      who_you: "あなたと、追加した共同保護者：すべての進捗。",
      who_teachers:
        "あなたが同意した学校の教師：自分の担当クラスのレッスン習熟度と IEP サポートのみ。",
      who_staff:
        "AIVO のスタッフ：サポートのための暗号化アクセス（監査ログ付き）。生徒の作品を不必要に閲覧することはありません。",
      who_advertisers: "広告主：決して。",
      rights_summary: "あなたの権利と削除方法。",
      rights_body:
        "AIVO が保持するあなたのアカウントやお子さまに関するすべての記録は、設定 → プライバシー → エクスポート からエクスポートできます。同じ方法でアカウントを削除できます。削除は 30 日以内に永続化されます。猶予期間中は取り消せます。",
    },
    terms: {
      eyebrow: "利用規約",
      title: "AIVO 利用規約。",
      subtitle:
        "まずは要約。各セクションをタップすると法的な全文が表示されます。最終更新：このページは、最終的な法務レビュー済み文面のためのプレースホルダーです。",
      agree_summary: "あなたが同意すること。",
      agree_body:
        "あなたは、自分自身、お子さま、または生徒を教育する目的で AIVO を使用することに同意します。安全フィルターの回避、アクセスの転売、競合モデルの学習への AIVO 出力の使用は行いません。",
      aivo_summary: "AIVO が同意すること。",
      aivo_body:
        "私たちは、プライバシーに関する通知に記載のとおりあなたのデータを非公開に保ち、本規約の重要な変更については 30 日前に通知し、保持する内容をいつでもエクスポートできるようにします。",
      children_summary: "子どもと家族。",
      children_body:
        "13 歳未満の学習者を含むアカウントについては、確認済みの保護者または後見人が同意する必要があります。子どもが管理するアカウントを意図的に作成することはありません。in loco parentis として行動する学校は、署名済みのデータ処理契約を保管しておく必要があります。",
      wrong_summary: "問題が起きた場合。",
      wrong_body:
        "どちらの当事者も本契約を終了できます。データのエクスポートは終了後 90 日間利用可能です。紛争は、請求先住所の管轄区域の法律に準拠します。",
    },
    recovery: {
      eyebrow: "アカウントの復旧",
      title: "サインインでお困りですか？リンクをお送りします。",
      subtitle:
        "AIVO アカウントのメールアドレスを入力してください。パスワードをリセットできるワンタイムリンクをメールで送ります。",
      reassure_title: "メールアドレスが存在するかどうかは明かしません。",
      reassure_body:
        "いずれの場合も同じ確認を表示します。これにより、悪意のある者がどのアドレスにアカウントがあるかを知るのを防ぎます。",
      submit: "復旧リンクを送信",
      back_to_sign_in: "サインインに戻る",
    },
    child_approval: {
      eyebrow: "最終ステップ",
      title: "お子さまのアクセスを承認してください。",
      subtitle:
        "これらは、お子さまが AIVO で使える体験です。後からプロフィールでいずれも変更できます。",
      reassure_title: "お子さまがあなたを待っています。",
      reassure_body:
        "あなたが「承認」を押すまで、このプロフィールは保留状態です。お子さまはサインインもレッスン開始もできません。",
      approve: "承認して完了",
      footer_note: "お子さまの設定が完了し準備が整った状態で、保護者ホームに移動します。",
      comm_title: "教師とのメッセージ",
      comm_desc: "お子さまは教師からのメッセージを読み、大人が確認したクイック返信で返信できます。",
      ai_title: "AI チューター",
      ai_desc:
        "概念を説明し、最終的な答えは決して出さず、安全に関する話題は大人に引き継ぐ対話型チューターです。",
      voice_title: "音声モード",
      voice_desc: "お子さまがチューターと話し、聞き返せます。既定はオフ — マイクを使用します。",
    },
    iep_upload: {
      eyebrow: "IEP / 504 サポート",
      title: "お子さまのプランを追加 — ご希望の場合のみ。",
      subtitle:
        "IEP または 504 をお持ちなら、AIVO が配慮（追加時間、読み上げなど）を抽出し、初日からレッスンを合わせられます。後からでも、しなくても構いません。",
      reassure_title: "これは機微な文書です。",
      reassure_body:
        "閲覧できるのは、あなた、共同保護者、そしてあなたが同意した学校の教師のみです。AI の抽出はテナント内で実行されます。元のファイルは保存時に暗号化されます。",
      reassure_link: "IEP の取り扱い方法",
      upload_continue: "アップロードして続行",
      skip: "今はスキップ",
      footer_note: "後で学習者のプロフィールからアップロードできます。",
      consent_title: "IEP / 504 プランのアップロードに明示的に同意します",
      consent_desc:
        "AIVO は文書を保存し、記載された配慮を抽出してレッスンに適用します。いつでも削除できます。",
      choose_file: "PDF または Word ファイルを選択",
      file_help: "最大 20 MB のファイル。適用する前に、抽出した内容のプレビューを表示します。",
      legal_summary: "抽出されるもの、されないもの。",
      legal_extracted_label: "抽出：",
      legal_extracted_body:
        "配慮の一覧（追加時間、読み上げ、休憩）、目標カテゴリ、支援サービス時間。",
      legal_never_label: "抽出しない：",
      legal_never_body: "医学的診断、心理評価、保護者の陳述、署名。",
      legal_teachers_label: "教師に表示：",
      legal_teachers_body: "配慮の一覧のみ、あなたが同意した学校でのみ。",
    },
    invite_school: {
      eyebrow: "学校への招待",
      title: "AIVO で学校に参加しましょう。",
      subtitle:
        "学校から送られたコードを貼り付けてください。お持ちでない場合は学校管理者に依頼してください。招待された職員のみ参加できます。",
      reassure_title: "学校職員は自己登録できません。",
      reassure_body:
        "管理者があなたを招待する必要があります。これにより名簿と生徒データを保護します。",
      join: "学校に参加",
      code_label: "招待コード",
      email_label: "学校のメールアドレス",
      email_helper: "管理者が招待したメールアドレスと一致している必要があります。",
    },
    invite_district: {
      eyebrow: "学区への招待",
      title: "AIVO で学区に参加しましょう。",
      subtitle:
        "学区管理者の招待は、オンボーディング中に AIVO が発行します。学区のカスタマーサクセスマネージャーがワンタイムコードを送ります。",
      reassure_title: "学区管理者の追加認証が強制されます。",
      reassure_body:
        "この役割のサインインごとに、新しい生体認証または PIN の確認が必要です。AIVO は、単一のパスワードで学区データのロックを解除させることは決してありません。",
      code_label: "学区の招待コード",
      email_label: "学区のメールアドレス",
    },
    error: {
      expired_invite_eyebrow: "招待の期限切れ",
      expired_invite_title: "この招待はもう有効ではありません。",
      expired_invite_subtitle:
        "招待は 30 日後に期限切れになります。送信した人に新しいものを発行してもらってください。",
      expired_invite_body:
        "学校または学区が送った場合は、管理者にご連絡ください。元のコードをお伝えいただければ、AIVO サポートからの再送も可能です。",
      expired_invite_reassure_title: "あなたの席は失われていません。",
      expired_invite_reassure_body:
        "学校や学区でのあなたの席はまだ確保されています。期限切れになったのはリンクだけです。",
      expired_invite_primary: "ようこそ画面に戻る",
      expired_invite_secondary: "サインインにお困りですか？",
      offline_eyebrow: "オフライン",
      offline_title: "現在 AIVO に接続できません。",
      offline_subtitle: "接続を確認してもう一度お試しください。",
      offline_body:
        "レッスンが読み込まれた後は、一部の学習者向けアクティビティはオフラインでも動作しますが、セットアップにはオンライン接続が必要です。",
      offline_reassure_title: "失われたものはありません。",
      offline_reassure_body: "オンラインに戻り次第、中断したところから正確に再開します。",
      offline_primary: "再試行",
      blocked_eyebrow: "アカウントがブロックされています",
      blocked_title: "このアカウントは一時停止中です。",
      blocked_subtitle:
        "AIVO サポートがこのアカウントを一時停止しました。通常は請求またはコンプライアンスの確認です。",
      blocked_body:
        "確認が完了すると、登録のアドレス宛にメールが届きます。通常は 1 営業日以内です。",
      blocked_reassure_title: "お子さまのデータは安全です。",
      blocked_reassure_body: "確認中に何かを削除することはありません。一時停止と再開のみです。",
      blocked_primary: "ようこそ画面に戻る",
      generic_eyebrow: "問題が発生しました",
      generic_title: "問題が発生しました。",
      generic_subtitle: "おそらく一時的なものです。少し待ってからもう一度お試しください。",
      generic_body:
        "問題が続く場合は、AIVO サポートに連絡し、何をしようとしていたかをお伝えください。",
      generic_reassure_title: "誤った課金や保存は行われていません。",
      generic_reassure_body: "AIVO が中途半端なセットアップデータを保持することはありません。",
      generic_primary: "最初からやり直す",
    },
  },
  ko: {
    common: {
      back: "뒤로",
      continue: "계속",
      terms: "약관",
      privacy: "개인정보",
      copyright: "© AIVO Learning",
      email: "이메일",
      password: "비밀번호",
      show: "표시",
      hide: "숨기기",
      show_password: "비밀번호 표시",
      hide_password: "비밀번호 숨기기",
      back_to_consent: "동의로 돌아가기",
      badge_required: "필수",
      badge_optional: "선택",
      badge_recommended: "권장",
      badge_explicit: "명시적",
      contact_support: "지원팀에 문의",
    },
    steps: {
      about_you: "당신에 대해",
      role: "역할",
      consent: "동의",
      family: "가족",
      join_school: "학교 참여",
      join_district: "교육구 참여",
    },
    welcome: {
      brand_title: "모든 아이를 있는 자리에서 맞이하는 배움.",
      brand_body:
        "AIVO는 가족, 교사, 학습자와 함께 만든 차분하고 접근성 높은 학습 플랫폼입니다. 다르게 배우는 아이들도 포함합니다.",
      eyebrow: "환영합니다",
      title: "시작해 볼까요.",
      subtitle: "로그인하여 계속하거나, 가족·학교·교육구를 위한 새 계정을 만드세요.",
      sign_in: "로그인",
      create_account: "계정 만들기",
      invite_lead: "학교나 교육구에서 받은 초대 코드가 있나요?",
      invite_link: "초대 링크 사용",
      body: "AIVO는 웹, 태블릿, 휴대폰에서 작동합니다. 언제든 기기를 전환할 수 있으며 진행 상황도 함께 따라옵니다.",
    },
    signin: {
      trouble: "로그인에 문제가 있나요?",
      eyebrow: "다시 오신 것을 환영합니다",
      title: "로그인",
      subtitle: "가족·학교·교육구로 설정한 이메일을 사용하세요.",
      reassure_title: "저희는 귀하의 데이터를 절대 판매하지 않습니다.",
      reassure_body:
        "이메일은 계정을 식별하는 데만 사용됩니다. 자세한 내용은 개인정보 처리방침을 읽어 보세요.",
      reassure_link: "개인정보 처리방침 읽기",
      submit: "로그인",
      forgot: "비밀번호를 잊으셨나요?",
      create_account: "계정 만들기",
    },
    signup: {
      eyebrow: "계정 만들기",
      title_invite: "초대 수락",
      title_default: "당신에 대해 조금 알려 주세요",
      subtitle_invite:
        "학교나 교육구 초대의 코드를 붙여 넣으세요. 역할 설정은 다음에 마칠 수 있습니다.",
      subtitle_default: "누구를 위해 AIVO를 설정하는지에 맞춰 다음 단계를 맞춤화합니다.",
      reassure_title: "계정은 아이가 아니라 어른이 만듭니다.",
      reassure_body:
        "아이를 위한 계정을 만드는 경우 다음 단계에서 추가합니다. AIVO는 아이에게 직접 계정을 만들라고 요구하지 않습니다.",
      already_have: "이미 계정이 있으신가요?",
      sign_in: "로그인",
      invite_label: "초대 코드",
      invite_helper: "학교나 교육구가 환영 이메일로 보냈습니다.",
      name_label: "이름",
      password_helper: "12자 이상. 저장하기 전에 알려진 유출에 포함되어 있지 않은지 확인합니다.",
    },
    role: {
      eyebrow: "역할 선택",
      title: "누구를 위해 AIVO를 설정하시나요?",
      subtitle:
        "다음 단계를 맞춤화합니다. 다른 역할은 나중에 추가할 수 있습니다. 많은 어른이 학부모이자 교사이기도 합니다.",
      reassure_title: "아이는 역할을 고르지 않습니다.",
      reassure_body:
        "학부모나 교사가 학습자를 추가합니다. 학습자는 자신의 학습이 담긴 어린이 친화적 화면을 보며, 이 페이지는 보지 않습니다.",
      parent_label: "학부모 또는 보호자",
      parent_desc: "집에서 한 명 이상의 아이를 위해 AIVO를 설정합니다.",
      teacher_label: "교사",
      teacher_desc: "이미 AIVO를 사용하는 학교에 참여하거나 학급을 시작합니다.",
      school_admin_label: "학교 관리자",
      school_admin_desc: "학교의 교직원, 학급, 규정 준수를 관리합니다.",
      district_admin_label: "교육구 관리자",
      district_admin_desc: "여러 학교, 청구, 보고를 총괄합니다.",
    },
    parent_setup: {
      eyebrow: "가족 설정",
      title: "가정에 대해 알려 주세요.",
      subtitle:
        "아이는 다음 단계에서 추가합니다. 이 정보는 초대를 전달하고 적절한 어른과 진행 상황을 공유하는 데 도움이 됩니다.",
      reassure_title: "가정 정보는 비공개로 유지됩니다.",
      reassure_body:
        "가정 정보를 절대 판매하지 않습니다. 공동 학부모는 자신이 추가된 학습자만 볼 수 있습니다.",
      reassure_link: "수집 항목",
      continue: "계속 — 학습자 추가",
      household_label: "가정 이름(선택)",
      household_placeholder: "예: 오카포르 가족",
      household_helper: "교사가 메시지를 보낼 때 표시됩니다. 나중에 변경할 수 있습니다.",
      coparent_label: "공동 학부모 또는 보호자 초대(선택)",
      coparent_helper:
        "그들은 자신의 로그인 정보가 담긴 이메일을 받습니다. 두 분 모두 동의를 승인하고 진행 상황을 볼 수 있습니다.",
    },
    learner_new: {
      eyebrow: "학습자 추가",
      title: "아이에 대해 알려 주세요.",
      subtitle:
        "소리 내어 말할 만한 것만 사용하세요. 이름만으로 충분합니다. 학습자는 나중에 홈 화면에서 더 추가할 수 있습니다.",
      reassure_title: "필요한 최소한만 수집합니다.",
      reassure_body:
        "여기서는 성, 생년월일, 주소가 필요 없습니다. 교사와 AI가 무엇을 사용하는지는 동의 단계에서 정확히 보게 됩니다.",
      reassure_link: "사용하는 항목",
      continue: "동의로 계속",
      first_name_label: "학습자 이름(또는 별명)",
      first_name_placeholder: "예: Emma",
      grade_band_label: "학년대",
      grade_band_placeholder: "학년대를 선택",
      grade_band_help: "생년월일이 아니라 학년대를 사용합니다. 언제든 변경할 수 있습니다.",
      iep_legend: "아이에게 IEP 또는 504 계획이 있나요?",
      iep_help:
        "다음 단계에서 업로드할 수 있으며, 귀하의 명시적 동의가 있을 때만 가능합니다. 나중에 결정하려면 건너뛰세요.",
      iep_yes: "예",
      iep_no: "아니요",
      iep_unsure: "아직 잘 모르겠어요",
    },
    consent: {
      eyebrow: "당신의 동의 — 당신의 통제",
      title: "AIVO가 할 수 있는 일을 선택하세요.",
      subtitle: "각 줄은 별개의 선택입니다. 나중에 설정 → 개인정보에서 언제든 변경할 수 있습니다.",
      reassure_title: "묶음 없음. 다크 패턴 없음.",
      reassure_body:
        "학교 데이터 공유와 AI 개인화는 독립적입니다. 하나에는 예, 다른 하나에는 아니요라고 할 수 있습니다.",
      reassure_link: "개인정보 처리방침 전문 읽기",
      footer_note:
        "아이에게 영향을 주는 선택은 나중에 다시 확인을 요청합니다. 절대 조용히 변경되지 않습니다.",
      row_parent_title: "학부모 / 보호자 동의",
      row_parent_desc:
        "이 계정의 학습자에 대한 학부모 또는 법적 보호자임을 확인하며, AIVO 약관에 동의합니다.",
      row_school_title: "아이의 학교와 진행 상황 공유",
      row_school_desc:
        "아이의 교사가 숙달도, 수업, IEP 지원을 볼 수 있습니다. 아래의 모든 AI 선택과 독립적입니다.",
      row_ai_title: "AI를 사용해 학습 개인화",
      row_ai_desc:
        "AIVO는 아이의 응답을 사용해 속도, 예시, 힌트를 조정합니다. 이 데이터를 절대 판매하지 않습니다. 이를 끄면 아이는 개인화되지 않은 수업에 머뭅니다.",
      row_mkt_title: "제품 소식 보내기",
      row_mkt_desc: "짧은 월간 이메일입니다. 학습자에게는 절대 보내지 않습니다.",
      legal_summary: "각 선택이 실제로 무엇을 바꾸는지(쉬운 말로).",
      legal_parent_label: "학부모 / 보호자:",
      legal_parent_body:
        "18세 미만의 계정을 만들 때 필수입니다. 귀하가 법적 보호자임을 확인합니다.",
      legal_school_label: "학교 공유:",
      legal_school_body:
        "교사는 숙달도, 수업, (업로드된 경우) IEP 지원을 봅니다. 마케팅이나 제3자 공유는 없습니다.",
      legal_ai_label: "AI 개인화:",
      legal_ai_body:
        "AIVO는 아이에게 맞춰 속도와 힌트를 조정합니다. 학습 데이터가 학습자 개인을 식별하는 데 사용되는 일은 없습니다.",
      legal_mkt_label: "제품 소식:",
      legal_mkt_body: "발송량이 적은 이메일 목록입니다. 한 번의 클릭으로 구독을 취소하세요.",
    },
    permissions: {
      eyebrow: "기기 권한",
      title: "이 기기에서 AIVO가 무엇을 사용할 수 있나요?",
      subtitle:
        "이것이 AIVO가 요청하는 유일한 기기 기능입니다. 위치, 연락처, 사진 보관함 접근은 절대 요청하지 않습니다.",
      reassure_title: "브라우저도 이를 요청합니다.",
      reassure_body:
        "AIVO가 실제로 마이크나 카메라가 필요할 때 브라우저가 자체 권한 요청을 표시합니다. 여기서 예라고 했어도 거부할 수 있습니다.",
      continue: "계속 — PIN 설정",
      mic_title: "마이크",
      mic_desc:
        "소리 내어 읽기 수업과 AI 튜터 음성 모드에만 사용됩니다. 기본값은 꺼짐 — 아이가 소리 내어 읽기를 원하면 켜세요.",
      cam_title: "카메라",
      cam_desc:
        "숙제 페이지나 문서를 스캔할 때만 사용됩니다. AIVO는 절대 영상을 녹화하지 않습니다.",
      notifs_title: "알림",
      notifs_desc:
        "승인 요청, 주간 진행 요약, 안전 메시지. 수업 알림은 기본적으로 꺼져 있으며 나중에 켤 수 있습니다.",
    },
    pin: {
      eyebrow: "학습자 PIN",
      title: "아이를 위한 4자리 PIN을 선택하세요.",
      subtitle:
        "아이는 이 PIN으로 이 기기에서 학습 잠금을 해제합니다. PIN은 절대 학부모 로그인을 대체하지 않습니다.",
      reassure_title: "PIN은 금고가 아니라 가벼운 잠금입니다.",
      reassure_body:
        "형제자매가 잘못된 프로필을 여는 것을 막아 줍니다. 민감한 작업에는 여전히 학부모 로그인이 필요합니다.",
      save: "PIN 저장",
      skip: "건너뛰기 — 나중에 설정에서 PIN 설정",
      choose_pin: "PIN 선택",
      confirm_pin: "PIN 확인",
      mismatch: "일치하지 않습니다. 다시 시도하세요.",
    },
    parent_verify: {
      eyebrow: "학부모 확인",
      title_phone: "정말 본인인지 확인합니다.",
      title_code: "6자리 코드를 입력하세요.",
      subtitle_phone:
        "이 계정의 어른임을 확인하기 위해 일회용 코드를 문자로 보냅니다. 이 번호를 마케팅에 절대 사용하지 않습니다.",
      subtitle_code: "코드를 휴대폰으로 보냈습니다. 10분 후 만료됩니다.",
      reassure_title: "아이는 이 단계를 건너뛸 수 없습니다.",
      reassure_body:
        "아이 프로필은 학부모가 확인한 후에만 활성화됩니다. 이것이 AIVO가 학부모 승인을 시행하는 방식입니다.",
      send_code: "코드 보내기",
      verify_continue: "확인하고 계속",
      use_diff_phone: "다른 전화번호 사용",
      phone_label: "휴대전화",
      phone_helper: "확인과 계정 복구에만 사용합니다.",
      code_label: "6자리 코드",
    },
    privacy: {
      eyebrow: "개인정보",
      title: "AIVO가 하는 일 — 쉬운 말로.",
      subtitle:
        "아래는 짧은 버전입니다. 각 섹션을 열면 전체 법률 문구가 표시됩니다. 설정에서 언제든 다시 읽을 수 있습니다.",
      reassure_title: "무엇보다 우선하는 하나의 약속.",
      reassure_body:
        "저희는 학생 데이터를 절대 판매하지 않습니다. 광고주에게도, 공급업체에게도, AI 학습 파트너에게도.",
      collect_summary: "수집 항목 — 가르치는 데 필요한 것만.",
      collect_account: "계정: 학부모 / 교직원 이름, 이메일.",
      collect_learner: "학습자: 이름 또는 별명, 학년대, 선택적 편의(IEP / 504), 수업 응답.",
      collect_device: "기기: 브라우저, OS, 앱 버전 — 디버깅용으로만.",
      ai_summary: "AI 사용 방식.",
      ai_body:
        "AI 개인화가 켜져 있으면 아이의 응답이 다음 수업의 속도, 예시, 힌트를 조정합니다. 이 응답을 아이를 식별하는 데 사용하지 않습니다. 식별 가능한 학생 작업으로 파운데이션 모델을 학습시키지 않습니다. 모델 제공업체는 계약상 프롬프트 및 응답 데이터를 30일 이내에 삭제할 의무가 있습니다.",
      who_summary: "누가 무엇을 보나.",
      who_you: "귀하와 추가한 모든 공동 학부모: 전체 진행 상황.",
      who_teachers: "동의한 학교의 교사: 자신의 학급에 한해 수업 숙달도와 IEP 지원만.",
      who_staff:
        "AIVO 직원: 감사 로그가 있는 지원용 암호화 접근. 학생 작업을 함부로 들여다보지 않습니다.",
      who_advertisers: "광고주: 절대.",
      rights_summary: "귀하의 권리와 삭제 방법.",
      rights_body:
        "AIVO가 귀하의 계정이나 아이에 대해 보유한 모든 기록을 설정 → 개인정보 → 내보내기에서 내보낼 수 있습니다. 같은 방법으로 계정을 삭제할 수 있습니다. 삭제는 30일 이내에 영구적이며, 유예 기간 동안 취소할 수 있습니다.",
    },
    terms: {
      eyebrow: "약관",
      title: "AIVO 이용약관.",
      subtitle:
        "요약 먼저. 전체 법률 문구를 보려면 아무 섹션이나 누르세요. 최종 업데이트: 이 페이지는 최종 법률 검토 문구의 자리표시자입니다.",
      agree_summary: "귀하가 동의하는 것.",
      agree_body:
        "귀하는 본인, 자녀 또는 학생을 교육할 목적으로 AIVO를 사용하는 데 동의합니다. 안전 필터 우회, 접근 권한 재판매, 경쟁 모델 학습을 위한 AIVO 출력 사용을 시도하지 않습니다.",
      aivo_summary: "AIVO가 동의하는 것.",
      aivo_body:
        "저희는 개인정보 처리방침에 설명된 대로 귀하의 데이터를 비공개로 유지하고, 본 약관의 중요한 변경은 30일 전에 알리며, 보유한 모든 것을 언제든 내보낼 수 있도록 합니다.",
      children_summary: "아동과 가족.",
      children_body:
        "13세 미만 학습자를 포함하는 계정의 경우, 확인된 학부모 또는 보호자가 동의해야 합니다. 저희는 아동이 통제하는 계정을 고의로 만들지 않습니다. in loco parentis로 행동하는 학교는 서명된 데이터 처리 계약을 보관해야 합니다.",
      wrong_summary: "문제가 생기면.",
      wrong_body:
        "어느 쪽이든 본 계약을 종료할 수 있습니다. 데이터 내보내기는 종료 후 90일 동안 이용할 수 있습니다. 분쟁은 청구 주소의 관할 법률을 따릅니다.",
    },
    recovery: {
      eyebrow: "계정 복구",
      title: "로그인에 문제가 있나요? 링크를 보내드립니다.",
      subtitle:
        "AIVO 계정의 이메일을 입력하세요. 비밀번호를 재설정할 수 있는 일회용 링크를 이메일로 보냅니다.",
      reassure_title: "이메일 존재 여부는 알려드리지 않습니다.",
      reassure_body:
        "어느 경우든 동일한 확인을 표시합니다. 이는 악의적인 사람이 어떤 주소에 계정이 있는지 알아내는 것을 막습니다.",
      submit: "복구 링크 보내기",
      back_to_sign_in: "로그인으로 돌아가기",
    },
    child_approval: {
      eyebrow: "마지막 단계",
      title: "아이의 접근을 승인하세요.",
      subtitle:
        "이것은 아이가 AIVO에서 사용할 수 있는 경험입니다. 나중에 프로필에서 언제든 변경할 수 있습니다.",
      reassure_title: "아이가 기다리고 있어요.",
      reassure_body:
        "승인을 누르기 전까지 이 프로필은 대기 상태입니다. 아이는 로그인하거나 수업을 시작할 수 없습니다.",
      approve: "승인하고 완료",
      footer_note: "아이가 설정되어 준비된 상태로 학부모 홈에 도착합니다.",
      comm_title: "교사와의 메시지",
      comm_desc: "아이는 교사의 메시지를 읽고 어른이 검토한 빠른 답장으로 응답할 수 있습니다.",
      ai_title: "AI 튜터",
      ai_desc:
        "개념을 설명하고, 최종 답을 절대 제공하지 않으며, 안전 주제는 어른에게 연결하는 대화형 튜터입니다.",
      voice_title: "음성 모드",
      voice_desc: "아이가 튜터와 말하고 들을 수 있게 합니다. 기본값은 꺼짐 — 마이크를 사용합니다.",
    },
    iep_upload: {
      eyebrow: "IEP / 504 지원",
      title: "아이의 계획 추가 — 원하실 때만.",
      subtitle:
        "IEP나 504가 있으면 AIVO가 편의(추가 시간, 소리 내어 읽기 등)를 추출해 수업이 첫날부터 맞춰지도록 할 수 있습니다. 나중에 하셔도, 안 하셔도 됩니다.",
      reassure_title: "이것은 민감한 문서입니다.",
      reassure_body:
        "귀하, 모든 공동 학부모, 그리고 동의한 학교의 교사만 볼 수 있습니다. AI 추출은 테넌트 내에서 실행됩니다. 원본 파일은 저장 시 암호화됩니다.",
      reassure_link: "IEP 처리 방식",
      upload_continue: "업로드하고 계속",
      skip: "지금은 건너뛰기",
      footer_note: "나중에 학습자 프로필에서 업로드할 수 있습니다.",
      consent_title: "IEP / 504 계획 업로드에 명시적으로 동의합니다",
      consent_desc:
        "AIVO는 문서를 저장하고, 나열된 편의를 추출하여 수업에 적용합니다. 언제든 삭제할 수 있습니다.",
      choose_file: "PDF 또는 Word 파일 선택",
      file_help: "최대 20MB 파일. 무언가를 적용하기 전에 추출한 내용의 미리보기를 보여드립니다.",
      legal_summary: "무엇이 추출되고 무엇이 추출되지 않는지.",
      legal_extracted_label: "추출:",
      legal_extracted_body:
        "편의 목록(추가 시간, 소리 내어 읽기, 휴식), 목표 범주, 지원 서비스 시간.",
      legal_never_label: "절대 추출하지 않음:",
      legal_never_body: "의학적 진단, 심리 평가, 학부모 진술, 서명.",
      legal_teachers_label: "교사에게 표시:",
      legal_teachers_body: "편의 목록만, 동의한 학교에서만.",
    },
    invite_school: {
      eyebrow: "학교 초대",
      title: "AIVO에서 학교에 참여하세요.",
      subtitle:
        "학교가 보낸 코드를 붙여 넣으세요. 없으면 학교 관리자에게 요청하세요. 초대받은 교직원만 참여할 수 있습니다.",
      reassure_title: "학교 교직원은 스스로 등록할 수 없습니다.",
      reassure_body: "관리자가 초대해야 합니다. 이는 명단과 학생 데이터를 보호합니다.",
      join: "학교 참여",
      code_label: "초대 코드",
      email_label: "학교 이메일",
      email_helper: "관리자가 초대한 이메일과 일치해야 합니다.",
    },
    invite_district: {
      eyebrow: "교육구 초대",
      title: "AIVO에서 교육구에 참여하세요.",
      subtitle:
        "교육구 관리자 초대는 온보딩 중에 AIVO가 발급합니다. 교육구 성공 매니저가 일회용 코드를 보냅니다.",
      reassure_title: "교육구 관리자의 강화 인증이 적용됩니다.",
      reassure_body:
        "이 역할의 모든 로그인에는 새로운 생체 인식 또는 PIN 확인이 필요합니다. AIVO는 단일 비밀번호로 교육구 데이터를 잠금 해제하도록 절대 허용하지 않습니다.",
      code_label: "교육구 초대 코드",
      email_label: "교육구 이메일",
    },
    error: {
      expired_invite_eyebrow: "초대 만료됨",
      expired_invite_title: "이 초대는 더 이상 유효하지 않습니다.",
      expired_invite_subtitle:
        "초대는 30일 후 만료됩니다. 보낸 사람에게 새로 발급해 달라고 요청하세요.",
      expired_invite_body:
        "학교나 교육구가 보낸 것이라면 관리자에게 문의하세요. 원본 코드를 제공하면 AIVO 지원팀에서도 다시 보낼 수 있습니다.",
      expired_invite_reassure_title: "자리를 잃지 않았습니다.",
      expired_invite_reassure_body:
        "학교나 교육구에서의 자리는 여전히 예약되어 있습니다 — 링크만 만료되었습니다.",
      expired_invite_primary: "환영 화면으로 돌아가기",
      expired_invite_secondary: "로그인에 도움이 필요하신가요?",
      offline_eyebrow: "오프라인",
      offline_title: "지금 AIVO에 연결할 수 없습니다.",
      offline_subtitle: "연결을 확인하고 다시 시도하세요.",
      offline_body:
        "수업이 로드된 후에는 일부 학습자 활동이 오프라인에서 작동하지만, 설정에는 실시간 연결이 필요합니다.",
      offline_reassure_title: "잃어버린 것은 없습니다.",
      offline_reassure_body: "다시 온라인이 되는 즉시 중단한 지점에서 정확히 이어집니다.",
      offline_primary: "다시 시도",
      blocked_eyebrow: "계정 차단됨",
      blocked_title: "이 계정은 일시 중지되었습니다.",
      blocked_subtitle:
        "AIVO 지원팀이 이 계정을 일시 중지했습니다. 보통 청구 또는 규정 준수 검토입니다.",
      blocked_body:
        "검토가 끝나면 등록된 주소로 이메일을 받게 됩니다. 보통 영업일 기준 하루 이내입니다.",
      blocked_reassure_title: "아이의 데이터는 안전합니다.",
      blocked_reassure_body: "검토 중에는 아무것도 삭제하지 않습니다 — 일시 중지와 재개만 합니다.",
      blocked_primary: "환영 화면으로 돌아가기",
      generic_eyebrow: "문제가 발생했습니다",
      generic_title: "문제가 생겼습니다.",
      generic_subtitle: "아마 일시적인 문제입니다 — 잠시 후 다시 시도하세요.",
      generic_body: "이 문제가 계속되면 AIVO 지원팀에 연락하여 무엇을 하려고 했는지 알려 주세요.",
      generic_reassure_title: "잘못 청구되거나 저장된 것은 없습니다.",
      generic_reassure_body: "AIVO는 완료되지 않은 설정 데이터를 절대 보관하지 않습니다.",
      generic_primary: "처음부터 다시 시작",
    },
  },
  ar: {
    common: {
      back: "رجوع",
      continue: "متابعة",
      terms: "الشروط",
      privacy: "الخصوصية",
      copyright: "© AIVO Learning",
      email: "البريد الإلكتروني",
      password: "كلمة المرور",
      show: "إظهار",
      hide: "إخفاء",
      show_password: "إظهار كلمة المرور",
      hide_password: "إخفاء كلمة المرور",
      back_to_consent: "العودة إلى الموافقة",
      badge_required: "إلزامي",
      badge_optional: "اختياري",
      badge_recommended: "موصى به",
      badge_explicit: "صريح",
      contact_support: "التواصل مع الدعم",
    },
    steps: {
      about_you: "عنك",
      role: "الدور",
      consent: "الموافقة",
      family: "العائلة",
      join_school: "الانضمام إلى المدرسة",
      join_district: "الانضمام إلى المنطقة التعليمية",
    },
    welcome: {
      brand_title: "تعلّم يلتقي بكل طفل حيث هو.",
      brand_body:
        "AIVO منصّة تعلّم هادئة وسهلة الوصول، صُمّمت مع العائلات والمعلّمين والمتعلّمين — بمن فيهم الأطفال الذين يتعلّمون بطريقة مختلفة.",
      eyebrow: "مرحبًا",
      title: "لنبدأ.",
      subtitle:
        "سجّل الدخول للمتابعة، أو أنشئ حسابًا جديدًا لعائلتك أو مدرستك أو منطقتك التعليمية.",
      sign_in: "تسجيل الدخول",
      create_account: "إنشاء حساب",
      invite_lead: "هل لديك رمز دعوة من مدرسة أو منطقة تعليمية؟",
      invite_link: "استخدام رابط دعوة",
      body: "يعمل AIVO على الويب وعلى الأجهزة اللوحية والهواتف. يمكنك التبديل بين الأجهزة في أي وقت — ويبقى تقدّمك معك.",
    },
    signin: {
      trouble: "هل تواجه مشكلة في تسجيل الدخول؟",
      eyebrow: "مرحبًا بعودتك",
      title: "تسجيل الدخول",
      subtitle: "استخدم البريد الإلكتروني الذي أعددته مع عائلتك أو مدرستك أو منطقتك التعليمية.",
      reassure_title: "نحن لا نبيع بياناتك أبدًا.",
      reassure_body:
        "يُستخدم بريدك الإلكتروني فقط لتحديد حسابك. اقرأ إشعار الخصوصية لمزيد من المعلومات.",
      reassure_link: "اقرأ إشعار الخصوصية",
      submit: "تسجيل الدخول",
      forgot: "هل نسيت كلمة المرور؟",
      create_account: "إنشاء حساب",
    },
    signup: {
      eyebrow: "أنشئ حسابك",
      title_invite: "اقبل دعوتك",
      title_default: "أخبرنا قليلًا عن نفسك",
      subtitle_invite:
        "الصق الرمز من دعوة مدرستك أو منطقتك التعليمية. يمكنك إكمال إعداد دورك بعد ذلك.",
      subtitle_default: "سنخصّص الخطوات التالية بناءً على مَن تُعدّ AIVO من أجله.",
      reassure_title: "البالغون من يُنشئون الحسابات، وليس الأطفال.",
      reassure_body:
        "إذا كنت تُنشئ حسابًا لطفل، فستضيفه في الخطوة التالية. لا تطلب AIVO أبدًا من طفل أن يُنشئ حسابه الخاص.",
      already_have: "هل لديك حساب بالفعل؟",
      sign_in: "تسجيل الدخول",
      invite_label: "رمز الدعوة",
      invite_helper: "أرسلته مدرستك أو منطقتك التعليمية في رسالة الترحيب.",
      name_label: "اسمك",
      password_helper: "‏12 حرفًا على الأقل. سنتحقّق من أنها ليست ضمن أي تسريب معروف قبل حفظها.",
    },
    role: {
      eyebrow: "اختر دورك",
      title: "لمن تُعدّ AIVO؟",
      subtitle:
        "سنخصّص الخطوات التالية. يمكنك إضافة أدوار أخرى لاحقًا — كثير من البالغين هم آباء ومعلّمون في الوقت نفسه.",
      reassure_title: "الأطفال لا يختارون دورًا.",
      reassure_body:
        "يضيف أحد الوالدين أو المعلّم متعلّمًا. يرى المتعلّم واجهة ملائمة للأطفال تضم واجباته الدراسية — لا هذه الصفحة أبدًا.",
      parent_label: "أحد الوالدين أو مقدّم رعاية",
      parent_desc: "أعدّ AIVO لطفل واحد أو أكثر في المنزل.",
      teacher_label: "معلّم",
      teacher_desc: "انضم إلى مدرسة تستخدم AIVO بالفعل، أو ابدأ صفًّا.",
      school_admin_label: "مدير مدرسة",
      school_admin_desc: "أدِر الموظفين والصفوف والامتثال لمدرسة.",
      district_admin_label: "مدير منطقة تعليمية",
      district_admin_desc: "أشرف على عدة مدارس والفوترة والتقارير.",
    },
    parent_setup: {
      eyebrow: "إعداد العائلة",
      title: "أخبرنا عن أسرتك.",
      subtitle:
        "ستضيف أطفالك في الخطوة التالية. تساعدنا هذه المعلومات في توجيه الدعوات ومشاركة التقدّم مع البالغين المناسبين.",
      reassure_title: "تبقى تفاصيل الأسرة خاصة.",
      reassure_body:
        "نحن لا نبيع معلومات الأسرة أبدًا. لا يرى الوالدان المشاركان إلا المتعلّمين المُضافين إليهم.",
      reassure_link: "ما الذي نجمعه",
      continue: "متابعة — إضافة متعلّم",
      household_label: "اسم الأسرة (اختياري)",
      household_placeholder: "مثال: عائلة أوكافور",
      household_helper: "يظهر للمعلّمين عند مراسلتك. يمكنك تغييره لاحقًا.",
      coparent_label: "دعوة والد مشارك أو مقدّم رعاية (اختياري)",
      coparent_helper:
        "سيتلقّون رسالة بريد إلكتروني بتسجيل دخول خاص بهم. يمكنكما الموافقة على الأذونات وعرض التقدّم معًا.",
    },
    learner_new: {
      eyebrow: "إضافة متعلّم",
      title: "أخبرنا عن طفلك.",
      subtitle:
        "استخدم فقط ما تقوله بصوت عالٍ — الاسم الأول يكفي. يمكنك إضافة المزيد من المتعلّمين لاحقًا من شاشتك الرئيسية.",
      reassure_title: "نجمع الحدّ الأدنى اللازم.",
      reassure_body:
        "لا حاجة هنا إلى اسم العائلة أو تاريخ الميلاد أو العنوان. سترى بالضبط ما يستخدمه المعلّمون والذكاء الاصطناعي في خطوة الموافقة.",
      reassure_link: "ما الذي نستخدمه",
      continue: "المتابعة إلى الموافقة",
      first_name_label: "الاسم الأول للمتعلّم (أو لقبه)",
      first_name_placeholder: "مثال: Emma",
      grade_band_label: "المرحلة الدراسية",
      grade_band_placeholder: "اختر مرحلة",
      grade_band_help: "نستخدم مرحلة، وليس تاريخ ميلاد. يمكنك تغييرها في أي وقت.",
      iep_legend: "هل لدى طفلك خطة IEP أو 504؟",
      iep_help:
        "يمكنك رفعها في الخطوات التالية — فقط بموافقتك الصريحة. تخطَّ إذا كنت تفضّل أن تقرّر لاحقًا.",
      iep_yes: "نعم",
      iep_no: "لا",
      iep_unsure: "لست متأكدًا بعد",
    },
    consent: {
      eyebrow: "موافقتك — تحكّمك",
      title: "اختر ما يمكن لـ AIVO فعله.",
      subtitle: "كل صف خيار منفصل. يمكنك تغيير أيٍّ منها لاحقًا من الإعدادات ← الخصوصية.",
      reassure_title: "لا حِزَم. لا أنماط خادعة.",
      reassure_body:
        "مشاركة بيانات المدرسة والتخصيص بالذكاء الاصطناعي مستقلّان. يمكنك الموافقة على أحدهما ورفض الآخر.",
      reassure_link: "اقرأ إشعار الخصوصية الكامل",
      footer_note: "سنطلب منك إعادة تأكيد أي خيار يؤثّر على طفلك لاحقًا — ولا يُغيَّر بصمت أبدًا.",
      row_parent_title: "موافقة الوالد / الوصي",
      row_parent_desc:
        "أؤكّد أنني الوالد أو الوصي القانوني للمتعلّمين في هذا الحساب، وأوافق على شروط AIVO.",
      row_school_title: "مشاركة التقدّم مع مدرسة طفلي",
      row_school_desc:
        "يتيح لمعلّمي طفلك رؤية الإتقان والدروس ودعم الـ IEP. مستقل عن أي خيار للذكاء الاصطناعي أدناه.",
      row_ai_title: "استخدام الذكاء الاصطناعي لتخصيص التعلّم",
      row_ai_desc:
        "يستخدم AIVO إجابات طفلك لضبط الإيقاع والأمثلة والتلميحات. لا نبيع هذه البيانات أبدًا. إيقاف هذا يُبقي طفلك في دروس غير مخصّصة.",
      row_mkt_title: "أرسل لي أخبار المنتج",
      row_mkt_desc: "رسالة شهرية قصيرة. لا تُرسل أبدًا إلى المتعلّمين.",
      legal_summary: "ما الذي يُغيّره كل خيار فعليًا (بلغة واضحة).",
      legal_parent_label: "الوالد / الوصي:",
      legal_parent_body: "مطلوب لإنشاء حسابات لأي شخص دون 18 عامًا. يتحقّق من أنك الوصي القانوني.",
      legal_school_label: "المشاركة مع المدرسة:",
      legal_school_body:
        "يرى المعلّمون الإتقان والدروس و(إن رُفعت) دعم الـ IEP. لا تسويق ولا مشاركة مع أطراف ثالثة.",
      legal_ai_label: "التخصيص بالذكاء الاصطناعي:",
      legal_ai_body:
        "يكيّف AIVO الإيقاع والتلميحات لطفلك. لا تُستخدم بيانات التدريب أبدًا لتحديد هوية متعلّم بعينه.",
      legal_mkt_label: "أخبار المنتج:",
      legal_mkt_body: "قائمة بريدية منخفضة الإرسال. ألغِ الاشتراك بنقرة واحدة.",
    },
    permissions: {
      eyebrow: "أذونات الجهاز",
      title: "ما الذي يمكن لـ AIVO استخدامه على هذا الجهاز؟",
      subtitle:
        "هذه هي ميزات الجهاز الوحيدة التي يطلبها AIVO على الإطلاق. لا نطلب أبدًا الموقع أو جهات الاتصال أو الوصول إلى مكتبة الصور.",
      reassure_title: "متصفّحك يطلبها أيضًا.",
      reassure_body:
        "عندما يحتاج AIVO فعليًا إلى الميكروفون أو الكاميرا، سيُظهر متصفّحك طلب الإذن الخاص به — ويمكنك رفضه حتى لو وافقت هنا.",
      continue: "متابعة — إعداد رمز PIN",
      mic_title: "الميكروفون",
      mic_desc:
        "يُستخدم فقط لدروس القراءة بصوت عالٍ ووضع الصوت لمعلّم الذكاء الاصطناعي. مُعطّل افتراضيًا — فعّله إذا أراد طفلك القراءة بصوت عالٍ.",
      cam_title: "الكاميرا",
      cam_desc: "تُستخدم فقط عند مسح صفحة واجب أو مستند ضوئيًا. لا يسجّل AIVO الفيديو أبدًا.",
      notifs_title: "الإشعارات",
      notifs_desc:
        "طلبات الموافقة، وملخّصات التقدّم الأسبوعية، ورسائل الأمان. تذكيرات الدروس مُعطّلة افتراضيًا — يمكنك تفعيلها لاحقًا.",
    },
    pin: {
      eyebrow: "رمز PIN للمتعلّم",
      title: "اختر رمز PIN من 4 أرقام لطفلك.",
      subtitle:
        "يستخدم طفلك رمز PIN هذا لفتح تعلّمه على هذا الجهاز. لا يحلّ رمز PIN أبدًا محلّ تسجيل دخولك كوالد.",
      reassure_title: "رمز PIN قفل خفيف، وليس خزنة.",
      reassure_body:
        "يمنع شقيقًا من فتح الملف الشخصي الخطأ. لا تزال الإجراءات الحسّاسة تتطلّب تسجيل دخول أحد الوالدين.",
      save: "حفظ رمز PIN",
      skip: "تخطٍّ — عيّن رمز PIN لاحقًا من الإعدادات",
      choose_pin: "اختر رمز PIN",
      confirm_pin: "أكّد رمز PIN",
      mismatch: "غير متطابقين. حاول مرة أخرى.",
    },
    parent_verify: {
      eyebrow: "التحقّق من الوالد",
      title_phone: "لنتأكّد أنك أنت فعلًا.",
      title_code: "أدخل الرمز المكوّن من 6 أرقام.",
      subtitle_phone:
        "سنرسل رمزًا لمرة واحدة عبر رسالة نصية لتأكيد أنك البالغ على هذا الحساب. لا نستخدم هذا الرقم أبدًا للتسويق.",
      subtitle_code: "أرسلنا رمزًا إلى هاتفك. تنتهي صلاحيته خلال 10 دقائق.",
      reassure_title: "لا يستطيع الأطفال تجاوز هذه الخطوة.",
      reassure_body:
        "لا يصبح ملف الطفل نشطًا إلا بعد تحقّق أحد الوالدين. هكذا تفرض AIVO موافقة الوالدين.",
      send_code: "إرسال الرمز",
      verify_continue: "التحقّق والمتابعة",
      use_diff_phone: "استخدام رقم هاتف آخر",
      phone_label: "الهاتف المحمول",
      phone_helper: "نستخدمه فقط للتحقّق واستعادة الحساب.",
      code_label: "رمز من 6 أرقام",
    },
    privacy: {
      eyebrow: "الخصوصية",
      title: "ما الذي يفعله AIVO — بلغة واضحة.",
      subtitle:
        "في الأسفل النسخة المختصرة. تفتح كل قسم على النص القانوني الكامل. يمكنك إعادة قراءة هذا في أي وقت من الإعدادات.",
      reassure_title: "وعد واحد فوق كل شيء.",
      reassure_body:
        "نحن لا نبيع بيانات الطلاب أبدًا. لا للمعلنين، ولا للموردين، ولا لشركاء تدريب الذكاء الاصطناعي.",
      collect_summary: "ما الذي نجمعه — فقط ما يلزم للتدريس.",
      collect_account: "الحساب: اسم الوالد / الموظف، البريد الإلكتروني.",
      collect_learner:
        "المتعلّم: الاسم الأول أو اللقب، المرحلة الدراسية، التيسيرات الاختيارية (IEP / 504)، الإجابات على الدروس.",
      collect_device: "الجهاز: المتصفّح، نظام التشغيل، إصدار التطبيق — لأغراض تصحيح الأخطاء فقط.",
      ai_summary: "كيف يُستخدم الذكاء الاصطناعي.",
      ai_body:
        "عند تفعيل التخصيص بالذكاء الاصطناعي، تضبط إجابات طفلك درسه التالي — الإيقاع والأمثلة والتلميحات. لا نستخدم هذه الإجابات لتحديد هوية طفلك. ولا ندرّب النماذج الأساسية على أعمال طلابية قابلة للتعريف. ومزوّدو النماذج ملزمون بموجب عقد بحذف بيانات الطلب والاستجابة خلال 30 يومًا.",
      who_summary: "مَن يرى ماذا.",
      who_you: "أنت وأي والد مشارك أضفته: التقدّم الكامل.",
      who_teachers: "معلّمو المدرسة التي وافقت عليها: إتقان الدروس ودعم الـ IEP لصفوفهم فقط.",
      who_staff:
        "موظفو AIVO: وصول مشفّر للدعم، مع سجلّات تدقيق. لا نتصفّح أعمال الطلاب عشوائيًا أبدًا.",
      who_advertisers: "المعلنون: أبدًا.",
      rights_summary: "حقوقك وكيفية الحذف.",
      rights_body:
        "يمكنك تصدير كل سجلّ تحتفظ به AIVO عن حسابك أو طفلك من الإعدادات ← الخصوصية ← تصدير. يمكنك حذف الحساب بالطريقة نفسها. الحذف نهائي خلال 30 يومًا؛ ويمكنك إلغاؤه خلال فترة السماح.",
    },
    terms: {
      eyebrow: "الشروط",
      title: "شروط استخدام AIVO.",
      subtitle:
        "الملخّص أولًا. انقر على أي قسم لعرض النص القانوني الكامل. آخر تحديث: هذه الصفحة عنصر نائب للنسخة النهائية المراجَعة قانونيًا.",
      agree_summary: "ما الذي توافق عليه.",
      agree_body:
        "توافق على استخدام AIVO بهدف تعليم نفسك أو طفلك أو طلابك. ولن تحاول تجاوز عوامل تصفية الأمان أو إعادة بيع الوصول أو استخدام مخرجات AIVO لتدريب نماذج منافسة.",
      aivo_summary: "ما الذي توافق عليه AIVO.",
      aivo_body:
        "سنحافظ على خصوصية بياناتك كما هو موضّح في إشعار الخصوصية، ونُشعرك قبل 30 يومًا بأي تغيير جوهري في هذه الشروط، ونتيح لك تصدير كل ما نحتفظ به في أي وقت.",
      children_summary: "الأطفال والعائلات.",
      children_body:
        "بالنسبة للحسابات التي تتضمّن متعلّمين دون 13 عامًا، يجب أن يوافق والد أو وصي مُتحقَّق منه. لا نُنشئ عن علم حسابات يتحكّم بها الأطفال. ويجب على المدارس التي تعمل بصفتها in loco parentis أن يكون لديها اتفاقية معالجة بيانات موقّعة في الملف.",
      wrong_summary: "إذا حدث خطأ ما.",
      wrong_body:
        "يمكن لأيّ منا إنهاء هذه الاتفاقية. يبقى تصدير بياناتك متاحًا لمدة 90 يومًا بعد الإغلاق. وتخضع النزاعات لقوانين الولاية القضائية لعنوان الفوترة الخاص بك.",
    },
    recovery: {
      eyebrow: "استعادة الحساب",
      title: "هل تواجه مشكلة في تسجيل الدخول؟ سنرسل رابطًا.",
      subtitle:
        "أدخل البريد الإلكتروني لحساب AIVO الخاص بك. سنرسل عبر البريد رابطًا لمرة واحدة يتيح لك إعادة تعيين كلمة مرورك.",
      reassure_title: "لا نُفصح عمّا إذا كان البريد موجودًا.",
      reassure_body:
        "في كلتا الحالتين سنُظهر التأكيد نفسه. هذا يمنع الجهات الخبيثة من معرفة العناوين التي لها حسابات.",
      submit: "إرسال رابط الاستعادة",
      back_to_sign_in: "العودة إلى تسجيل الدخول",
    },
    child_approval: {
      eyebrow: "الخطوة الأخيرة",
      title: "وافِق على وصول طفلك.",
      subtitle:
        "هذه هي التجارب التي يمكن لطفلك استخدامها على AIVO. يمكنك تغيير أيٍّ منها من ملفه الشخصي لاحقًا.",
      reassure_title: "طفلك ينتظرك.",
      reassure_body:
        "حتى تضغط على موافقة، يبقى هذا الملف في حالة انتظار. لا يستطيع طفلك تسجيل الدخول أو بدء الدروس.",
      approve: "الموافقة والإنهاء",
      footer_note: "ستصل إلى الصفحة الرئيسية للوالد وطفلك مُعدّ وجاهز.",
      comm_title: "الرسائل مع المعلّمين",
      comm_desc: "يمكن لطفلك قراءة رسائل المعلّمين والردّ بردود سريعة يراجعها بالغ.",
      ai_title: "معلّم الذكاء الاصطناعي",
      ai_desc:
        "معلّم حواري يشرح المفاهيم، ولا يقدّم الإجابات النهائية أبدًا، ويحوّل مواضيع الأمان إلى بالغ.",
      voice_title: "وضع الصوت",
      voice_desc:
        "يتيح لطفلك التحدّث إلى المعلّم والاستماع إليه. مُعطّل افتراضيًا — يستخدم الميكروفون.",
    },
    iep_upload: {
      eyebrow: "دعم IEP / 504",
      title: "أضف خطة طفلك — فقط إذا رغبت.",
      subtitle:
        "إذا كان لديك IEP أو 504، يمكن لـ AIVO استخراج التيسيرات (وقت إضافي، قراءة بصوت عالٍ، إلخ) لتطابق الدروس منذ اليوم الأول. يمكنك فعل ذلك لاحقًا، أو أبدًا.",
      reassure_title: "هذا مستند حسّاس.",
      reassure_body:
        "لن يراه إلا أنت وأي والد مشارك ومعلّمو المدارس التي وافقت عليها. يعمل الاستخراج بالذكاء الاصطناعي داخل المستأجر. ويُشفَّر الملف الأصلي أثناء التخزين.",
      reassure_link: "كيف تُعالَج خطط الـ IEP",
      upload_continue: "رفع ومتابعة",
      skip: "تخطٍّ الآن",
      footer_note: "يمكنك الرفع لاحقًا من ملف المتعلّم الخاص بك.",
      consent_title: "أوافق صراحةً على رفع خطة IEP / 504",
      consent_desc:
        "ستخزّن AIVO المستند، وتستخرج التيسيرات المذكورة، وتطبّقها على الدروس. يمكنك حذفه في أي وقت.",
      choose_file: "اختر ملف PDF أو Word",
      file_help: "ملفات حتى 20 ميغابايت. سنعرض معاينة لما استخرجناه قبل تطبيق أي شيء.",
      legal_summary: "ما الذي يُستخرج وما الذي لا يُستخرج.",
      legal_extracted_label: "يُستخرج:",
      legal_extracted_body:
        "قائمة التيسيرات (وقت إضافي، قراءة بصوت عالٍ، فترات راحة)، فئات الأهداف، ساعات خدمات الدعم.",
      legal_never_label: "لا يُستخرج أبدًا:",
      legal_never_body: "التشخيصات الطبية، التقييمات النفسية، إفادات الوالدين، التوقيعات.",
      legal_teachers_label: "مرئي للمعلّمين:",
      legal_teachers_body: "قائمة التيسيرات فقط، وفي المدارس التي وافقت عليها فقط.",
    },
    invite_school: {
      eyebrow: "دعوة المدرسة",
      title: "انضمّ إلى مدرستك على AIVO.",
      subtitle:
        "الصق الرمز الذي أرسلته مدرستك. إن لم يكن لديك واحد، فاطلبه من مدير مدرستك — لا ينضمّ إلا الموظفون المدعوون.",
      reassure_title: "لا يمكن لموظفي المدرسة التسجيل ذاتيًا.",
      reassure_body: "يجب أن يدعوك مدير. هذا يحمي القوائم وبيانات الطلاب.",
      join: "الانضمام إلى المدرسة",
      code_label: "رمز الدعوة",
      email_label: "بريدك المدرسي",
      email_helper: "يجب أن يطابق البريد الذي دعاك إليه المدير.",
    },
    invite_district: {
      eyebrow: "دعوة المنطقة التعليمية",
      title: "انضمّ إلى منطقتك التعليمية على AIVO.",
      subtitle:
        "تُصدر AIVO دعوات مدير المنطقة التعليمية أثناء الإعداد. سيرسل لك مدير نجاح المنطقة رمزًا لمرة واحدة.",
      reassure_title: "يُفرض التحقّق المعزّز لمدير المنطقة التعليمية.",
      reassure_body:
        "يتطلّب كل تسجيل دخول لهذا الدور تحقّقًا بيومتريًا جديدًا أو برمز PIN. لا تسمح AIVO أبدًا لكلمة مرور واحدة بفتح بيانات المنطقة التعليمية.",
      code_label: "رمز دعوة المنطقة التعليمية",
      email_label: "بريد منطقتك التعليمية",
    },
    error: {
      expired_invite_eyebrow: "انتهت صلاحية الدعوة",
      expired_invite_title: "لم تعد هذه الدعوة صالحة.",
      expired_invite_subtitle:
        "تنتهي صلاحية الدعوات بعد 30 يومًا. اطلب ممن أرسلها أن يُصدر واحدة جديدة.",
      expired_invite_body:
        "إذا أرسلتها مدرستك أو منطقتك التعليمية، فاتّصل بالمدير. يمكن لدعم AIVO أيضًا إعادة إرسالها إذا قدّمت الرمز الأصلي.",
      expired_invite_reassure_title: "لم نفقد مكانك.",
      expired_invite_reassure_body:
        "ما زال مقعدك في المدرسة أو المنطقة التعليمية محجوزًا — انتهت صلاحية الرابط فقط.",
      expired_invite_primary: "العودة إلى الترحيب",
      expired_invite_secondary: "هل تحتاج إلى مساعدة في تسجيل الدخول؟",
      offline_eyebrow: "غير متصل",
      offline_title: "لا يمكننا الوصول إلى AIVO الآن.",
      offline_subtitle: "تحقّق من اتصالك وحاول مرة أخرى.",
      offline_body:
        "تعمل بعض أنشطة المتعلّم دون اتصال بعد تحميل الدرس — لكن الإعداد يحتاج إلى اتصال نشط.",
      offline_reassure_title: "لم يُفقد شيء.",
      offline_reassure_body: "سنُكمل من حيث توقّفت بالضبط بمجرد عودتك للاتصال.",
      offline_primary: "إعادة المحاولة",
      blocked_eyebrow: "الحساب محظور",
      blocked_title: "هذا الحساب مُوقَف مؤقتًا.",
      blocked_subtitle:
        "أوقف دعم AIVO هذا الحساب مؤقتًا. عادةً ما يكون ذلك لمراجعة فوترة أو امتثال.",
      blocked_body:
        "ستتلقّى رسالة بريد إلكتروني على العنوان المُسجَّل بمجرد انتهاء المراجعة، عادةً خلال يوم عمل واحد.",
      blocked_reassure_title: "بيانات طفلك آمنة.",
      blocked_reassure_body: "لا نحذف أي شيء أثناء المراجعة — إيقاف مؤقت واستئناف فقط.",
      blocked_primary: "العودة إلى الترحيب",
      generic_eyebrow: "حدث خطأ ما",
      generic_title: "واجهتنا مشكلة.",
      generic_subtitle: "غالبًا ما تكون مؤقتة — حاول مرة أخرى بعد قليل.",
      generic_body: "إذا استمرّ هذا، فيرجى التواصل مع دعم AIVO وذكر ما كنت تحاول فعله.",
      generic_reassure_title: "لم يتم تحصيل أي مبلغ أو حفظ أي شيء بشكل خاطئ.",
      generic_reassure_body: "لا تحتفظ AIVO أبدًا ببيانات إعداد غير مكتملة.",
      generic_primary: "البدء من جديد",
    },
  },
  hi: {
    common: {
      back: "वापस",
      continue: "जारी रखें",
      terms: "शर्तें",
      privacy: "गोपनीयता",
      copyright: "© AIVO Learning",
      email: "ईमेल",
      password: "पासवर्ड",
      show: "दिखाएँ",
      hide: "छिपाएँ",
      show_password: "पासवर्ड दिखाएँ",
      hide_password: "पासवर्ड छिपाएँ",
      back_to_consent: "सहमति पर वापस जाएँ",
      badge_required: "आवश्यक",
      badge_optional: "वैकल्पिक",
      badge_recommended: "अनुशंसित",
      badge_explicit: "स्पष्ट",
      contact_support: "सहायता से संपर्क करें",
    },
    steps: {
      about_you: "आपके बारे में",
      role: "भूमिका",
      consent: "सहमति",
      family: "परिवार",
      join_school: "स्कूल से जुड़ें",
      join_district: "ज़िले से जुड़ें",
    },
    welcome: {
      brand_title: "ऐसा सीखना जो हर बच्चे से वहीं मिलता है जहाँ वह है।",
      brand_body:
        "AIVO एक शांत, सुलभ शिक्षण मंच है, जिसे परिवारों, शिक्षकों और सीखने वालों के साथ मिलकर बनाया गया है—जिनमें वे बच्चे भी शामिल हैं जो अलग ढंग से सीखते हैं।",
      eyebrow: "स्वागत है",
      title: "चलिए शुरू करें।",
      subtitle:
        "जारी रखने के लिए साइन इन करें, या अपने परिवार, स्कूल या ज़िले के लिए एक नया खाता बनाएँ।",
      sign_in: "साइन इन करें",
      create_account: "खाता बनाएँ",
      invite_lead: "क्या आपके पास किसी स्कूल या ज़िले का आमंत्रण कोड है?",
      invite_link: "आमंत्रण लिंक का उपयोग करें",
      body: "AIVO वेब पर, टैबलेट पर और फ़ोन पर काम करता है। आप कभी भी डिवाइस बदल सकते हैं—आपकी प्रगति आपके साथ आती है।",
    },
    signin: {
      trouble: "साइन इन करने में परेशानी?",
      eyebrow: "वापसी पर स्वागत है",
      title: "साइन इन करें",
      subtitle: "वही ईमेल उपयोग करें जो आपने परिवार, स्कूल या ज़िले के साथ सेट किया था।",
      reassure_title: "हम आपका डेटा कभी नहीं बेचते।",
      reassure_body:
        "आपका ईमेल केवल आपके खाते की पहचान के लिए उपयोग होता है। अधिक जानकारी के लिए गोपनीयता सूचना पढ़ें।",
      reassure_link: "गोपनीयता सूचना पढ़ें",
      submit: "साइन इन करें",
      forgot: "पासवर्ड भूल गए?",
      create_account: "खाता बनाएँ",
    },
    signup: {
      eyebrow: "अपना खाता बनाएँ",
      title_invite: "अपना आमंत्रण स्वीकार करें",
      title_default: "हमें अपने बारे में थोड़ा बताएँ",
      subtitle_invite:
        "अपने स्कूल या ज़िले के आमंत्रण का कोड चिपकाएँ। आप आगे अपनी भूमिका सेट करना पूरा कर सकते हैं।",
      subtitle_default: "आप किसके लिए AIVO सेट कर रहे हैं, उसके अनुसार हम अगले चरण निजीकृत करेंगे।",
      reassure_title: "खाते वयस्क बनाते हैं, बच्चे नहीं।",
      reassure_body:
        "यदि आप किसी बच्चे के लिए खाता बना रहे हैं, तो आप उसे अगले चरण में जोड़ेंगे। AIVO कभी किसी बच्चे से अपना खाता बनाने को नहीं कहता।",
      already_have: "पहले से खाता है?",
      sign_in: "साइन इन करें",
      invite_label: "आमंत्रण कोड",
      invite_helper: "आपके स्कूल या ज़िले ने इसे स्वागत ईमेल में भेजा था।",
      name_label: "आपका नाम",
      password_helper:
        "कम से कम 12 अक्षर। सहेजने से पहले हम जाँचेंगे कि यह किसी ज्ञात लीक में नहीं है।",
    },
    role: {
      eyebrow: "अपनी भूमिका चुनें",
      title: "आप किसके लिए AIVO सेट कर रहे हैं?",
      subtitle:
        "हम अगले चरण अनुकूलित करेंगे। आप बाद में अन्य भूमिकाएँ जोड़ सकते हैं—कई वयस्क अभिभावक और शिक्षक दोनों होते हैं।",
      reassure_title: "बच्चे कोई भूमिका नहीं चुनते।",
      reassure_body:
        "एक अभिभावक या शिक्षक एक सीखने वाला जोड़ता है। सीखने वाला अपने स्कूल-कार्य के साथ बच्चों के अनुकूल दृश्य देखता है—यह पृष्ठ कभी नहीं।",
      parent_label: "अभिभावक या देखभालकर्ता",
      parent_desc: "घर पर एक या अधिक बच्चों के लिए AIVO सेट करें।",
      teacher_label: "शिक्षक",
      teacher_desc: "ऐसे स्कूल से जुड़ें जो पहले से AIVO का उपयोग करता है, या एक कक्षा शुरू करें।",
      school_admin_label: "स्कूल प्रशासक",
      school_admin_desc: "किसी स्कूल के स्टाफ़, कक्षाओं और अनुपालन का प्रबंधन करें।",
      district_admin_label: "ज़िला प्रशासक",
      district_admin_desc: "कई स्कूलों, बिलिंग और रिपोर्टिंग की देखरेख करें।",
    },
    parent_setup: {
      eyebrow: "परिवार सेटअप",
      title: "हमें अपने घर के बारे में बताएँ।",
      subtitle:
        "आप अगले चरण में अपने बच्चों को जोड़ेंगे। यह जानकारी हमें आमंत्रण सही जगह भेजने और सही वयस्कों के साथ प्रगति साझा करने में मदद करती है।",
      reassure_title: "घर का विवरण निजी रहता है।",
      reassure_body:
        "हम घर की जानकारी कभी नहीं बेचते। सह-अभिभावक केवल उन्हीं सीखने वालों को देखते हैं जिनसे वे जुड़े हैं।",
      reassure_link: "हम क्या एकत्र करते हैं",
      continue: "जारी रखें — एक सीखने वाला जोड़ें",
      household_label: "घर का नाम (वैकल्पिक)",
      household_placeholder: "उदा. ओकाफ़ोर परिवार",
      household_helper:
        "जब शिक्षक आपको संदेश भेजते हैं तो दिखाया जाता है। आप इसे बाद में बदल सकते हैं।",
      coparent_label: "किसी सह-अभिभावक या देखभालकर्ता को आमंत्रित करें (वैकल्पिक)",
      coparent_helper:
        "उन्हें अपने स्वयं के साइन-इन के साथ एक ईमेल मिलेगा। आप दोनों सहमतियाँ स्वीकृत कर सकते हैं और प्रगति देख सकते हैं।",
    },
    learner_new: {
      eyebrow: "एक सीखने वाला जोड़ें",
      title: "हमें अपने बच्चे के बारे में बताएँ।",
      subtitle:
        "केवल वही उपयोग करें जो आप ज़ोर से कहेंगे—पहला नाम ठीक है। आप बाद में अपनी होम स्क्रीन से और सीखने वाले जोड़ सकते हैं।",
      reassure_title: "हम न्यूनतम आवश्यक ही एकत्र करते हैं।",
      reassure_body:
        "यहाँ कोई उपनाम, जन्मतिथि या पता आवश्यक नहीं है। आप सहमति चरण में ठीक-ठीक देखेंगे कि शिक्षक और AI क्या उपयोग करते हैं।",
      reassure_link: "हम क्या उपयोग करते हैं",
      continue: "सहमति पर जारी रखें",
      first_name_label: "सीखने वाले का पहला नाम (या उपनाम)",
      first_name_placeholder: "उदा. Emma",
      grade_band_label: "ग्रेड बैंड",
      grade_band_placeholder: "एक बैंड चुनें",
      grade_band_help: "हम जन्मदिन नहीं, बल्कि एक बैंड उपयोग करते हैं। आप इसे कभी भी बदल सकते हैं।",
      iep_legend: "क्या आपके बच्चे के पास IEP या 504 योजना है?",
      iep_help:
        "आप इसे अगले चरणों में अपलोड कर सकते हैं—केवल आपकी स्पष्ट सहमति से। यदि आप बाद में तय करना चाहें तो छोड़ दें।",
      iep_yes: "हाँ",
      iep_no: "नहीं",
      iep_unsure: "अभी पक्का नहीं",
    },
    consent: {
      eyebrow: "आपकी सहमति — आपका नियंत्रण",
      title: "चुनें कि AIVO क्या कर सकता है।",
      subtitle:
        "हर पंक्ति एक अलग विकल्प है। आप इनमें से किसी को भी बाद में सेटिंग्स → गोपनीयता से बदल सकते हैं।",
      reassure_title: "कोई बंडल नहीं। कोई डार्क पैटर्न नहीं।",
      reassure_body:
        "स्कूल के साथ डेटा साझा करना और AI निजीकरण स्वतंत्र हैं। आप एक के लिए हाँ और दूसरे के लिए ना कह सकते हैं।",
      reassure_link: "पूरी गोपनीयता सूचना पढ़ें",
      footer_note:
        "आपके बच्चे को प्रभावित करने वाले किसी भी विकल्प की हम बाद में फिर से पुष्टि माँगेंगे—कभी चुपचाप नहीं बदला जाएगा।",
      row_parent_title: "अभिभावक / संरक्षक सहमति",
      row_parent_desc:
        "मैं पुष्टि करता/करती हूँ कि मैं इस खाते के सीखने वालों का अभिभावक या कानूनी संरक्षक हूँ, और AIVO की शर्तों से सहमत हूँ।",
      row_school_title: "अपने बच्चे के स्कूल के साथ प्रगति साझा करें",
      row_school_desc:
        "आपके बच्चे के शिक्षकों को महारत, पाठ और IEP सहायताएँ देखने देता है। नीचे किसी भी AI विकल्प से स्वतंत्र।",
      row_ai_title: "सीखने को निजीकृत करने के लिए AI का उपयोग करें",
      row_ai_desc:
        "AIVO आपके बच्चे के उत्तरों का उपयोग गति, उदाहरण और संकेत समायोजित करने के लिए करता है। हम यह डेटा कभी नहीं बेचते। इसे बंद करने पर आपका बच्चा गैर-निजीकृत पाठों में रहता है।",
      row_mkt_title: "मुझे उत्पाद समाचार भेजें",
      row_mkt_desc: "एक छोटा मासिक ईमेल। सीखने वालों को कभी नहीं भेजा जाता।",
      legal_summary: "हर विकल्प वास्तव में क्या बदलता है (सरल भाषा में)।",
      legal_parent_label: "अभिभावक / संरक्षक:",
      legal_parent_body:
        "18 वर्ष से कम उम्र के किसी के लिए खाता बनाने हेतु आवश्यक। पुष्टि करता है कि आप कानूनी संरक्षक हैं।",
      legal_school_label: "स्कूल साझाकरण:",
      legal_school_body:
        "शिक्षक महारत, पाठ और (यदि अपलोड किए गए हों) IEP सहायताएँ देखते हैं। कोई मार्केटिंग या तृतीय-पक्ष साझाकरण नहीं।",
      legal_ai_label: "AI निजीकरण:",
      legal_ai_body:
        "AIVO आपके बच्चे के अनुसार गति और संकेत समायोजित करता है। प्रशिक्षण डेटा का उपयोग कभी किसी सीखने वाले की पहचान के लिए नहीं होता।",
      legal_mkt_label: "उत्पाद समाचार:",
      legal_mkt_body: "एक कम-मात्रा वाली ईमेल सूची। एक क्लिक में सदस्यता रद्द करें।",
    },
    permissions: {
      eyebrow: "डिवाइस अनुमतियाँ",
      title: "इस डिवाइस पर AIVO क्या उपयोग कर सकता है?",
      subtitle:
        "ये एकमात्र डिवाइस सुविधाएँ हैं जो AIVO कभी माँगता है। हम कभी स्थान, संपर्क या फ़ोटो लाइब्रेरी तक पहुँच नहीं माँगते।",
      reassure_title: "आपका ब्राउज़र भी इन्हें माँगता है।",
      reassure_body:
        "जब AIVO को वास्तव में माइक्रोफ़ोन या कैमरे की ज़रूरत होगी, तो आपका ब्राउज़र अपना स्वयं का अनुमति संकेत दिखाएगा—भले ही आपने यहाँ हाँ कहा हो, तब भी आप मना कर सकते हैं।",
      continue: "जारी रखें — एक PIN सेट करें",
      mic_title: "माइक्रोफ़ोन",
      mic_desc:
        "केवल बोलकर-पढ़ने वाले पाठों और AI ट्यूटर वॉइस मोड के लिए उपयोग होता है। डिफ़ॉल्ट रूप से बंद—यदि आपका बच्चा ज़ोर से पढ़ना चाहे तो चालू करें।",
      cam_title: "कैमरा",
      cam_desc:
        "केवल किसी होमवर्क पृष्ठ या दस्तावेज़ को स्कैन करते समय उपयोग होता है। AIVO कभी वीडियो रिकॉर्ड नहीं करता।",
      notifs_title: "सूचनाएँ",
      notifs_desc:
        "स्वीकृति अनुरोध, साप्ताहिक प्रगति सारांश और सुरक्षा संदेश। पाठ अनुस्मारक डिफ़ॉल्ट रूप से बंद हैं—आप उन्हें बाद में सक्षम कर सकते हैं।",
    },
    pin: {
      eyebrow: "सीखने वाले का PIN",
      title: "अपने बच्चे के लिए 4-अंकीय PIN चुनें।",
      subtitle:
        "आपका बच्चा इस PIN से इस डिवाइस पर अपना सीखना अनलॉक करता है। PIN कभी आपके अभिभावक साइन-इन की जगह नहीं लेता।",
      reassure_title: "PIN एक नरम ताला है, तिजोरी नहीं।",
      reassure_body:
        "यह किसी भाई-बहन को गलत प्रोफ़ाइल खोलने से रोकता है। संवेदनशील कार्यों के लिए अब भी अभिभावक साइन-इन आवश्यक है।",
      save: "PIN सहेजें",
      skip: "छोड़ें — बाद में सेटिंग्स से PIN सेट करें",
      choose_pin: "PIN चुनें",
      confirm_pin: "PIN की पुष्टि करें",
      mismatch: "ये मेल नहीं खाते। फिर से प्रयास करें।",
    },
    parent_verify: {
      eyebrow: "अभिभावक सत्यापन",
      title_phone: "पुष्टि करें कि यह वास्तव में आप हैं।",
      title_code: "6-अंकीय कोड दर्ज करें।",
      subtitle_phone:
        "हम एक बार उपयोग होने वाला कोड SMS से भेजेंगे ताकि पुष्टि हो सके कि आप इस खाते के वयस्क हैं। हम इस नंबर का उपयोग कभी मार्केटिंग के लिए नहीं करते।",
      subtitle_code: "हमने आपके फ़ोन पर एक कोड भेजा है। यह 10 मिनट में समाप्त हो जाता है।",
      reassure_title: "बच्चे इस चरण को बायपास नहीं कर सकते।",
      reassure_body:
        "किसी बच्चे की प्रोफ़ाइल तभी सक्रिय होती है जब कोई अभिभावक सत्यापित कर ले। AIVO इसी तरह अभिभावक की स्वीकृति लागू करता है।",
      send_code: "कोड भेजें",
      verify_continue: "सत्यापित करें और जारी रखें",
      use_diff_phone: "कोई दूसरा फ़ोन नंबर उपयोग करें",
      phone_label: "मोबाइल फ़ोन",
      phone_helper: "हम इसका उपयोग केवल सत्यापन और खाता पुनर्प्राप्ति के लिए करते हैं।",
      code_label: "6-अंकीय कोड",
    },
    privacy: {
      eyebrow: "गोपनीयता",
      title: "AIVO क्या करता है — सरल भाषा में।",
      subtitle:
        "नीचे संक्षिप्त संस्करण है। प्रत्येक खंड पूरा कानूनी पाठ खोलता है। आप इसे सेटिंग्स से कभी भी दोबारा पढ़ सकते हैं।",
      reassure_title: "सबसे ऊपर एक वादा।",
      reassure_body:
        "हम छात्र डेटा कभी नहीं बेचते। न विज्ञापनदाताओं को, न विक्रेताओं को, न AI प्रशिक्षण भागीदारों को।",
      collect_summary: "हम क्या एकत्र करते हैं — केवल वही जो पढ़ाने के लिए आवश्यक है।",
      collect_account: "खाता: अभिभावक / स्टाफ़ का नाम, ईमेल।",
      collect_learner:
        "सीखने वाला: पहला नाम या उपनाम, ग्रेड बैंड, वैकल्पिक सुविधाएँ (IEP / 504), पाठों के उत्तर।",
      collect_device: "डिवाइस: ब्राउज़र, OS, ऐप संस्करण — केवल डिबगिंग के लिए।",
      ai_summary: "AI का उपयोग कैसे होता है।",
      ai_body:
        "जब AI निजीकरण चालू होता है, तो आपके बच्चे के उत्तर उसके अगले पाठ को समायोजित करते हैं—गति, उदाहरण, संकेत। हम इन उत्तरों का उपयोग आपके बच्चे की पहचान के लिए नहीं करते। हम पहचान-योग्य छात्र कार्य पर फ़ाउंडेशन मॉडल प्रशिक्षित नहीं करते। मॉडल प्रदाता अनुबंध से बाध्य हैं कि वे प्रॉम्प्ट और प्रतिक्रिया डेटा 30 दिनों के भीतर हटा दें।",
      who_summary: "कौन क्या देखता है।",
      who_you: "आप और आपके द्वारा जोड़े गए किसी भी सह-अभिभावक: पूरी प्रगति।",
      who_teachers:
        "जिस स्कूल के लिए आपने सहमति दी उसके शिक्षक: केवल उनकी कक्षाओं के लिए पाठ महारत और IEP सहायताएँ।",
      who_staff:
        "AIVO स्टाफ़: ऑडिट लॉग के साथ सहायता हेतु एन्क्रिप्टेड पहुँच। हम छात्र कार्य को कभी यूँ ही नहीं देखते।",
      who_advertisers: "विज्ञापनदाता: कभी नहीं।",
      rights_summary: "आपके अधिकार और कैसे हटाएँ।",
      rights_body:
        "आप अपने खाते या अपने बच्चे के बारे में AIVO के पास मौजूद हर रिकॉर्ड को सेटिंग्स → गोपनीयता → निर्यात से निर्यात कर सकते हैं। आप इसी तरह खाता हटा सकते हैं। हटाना 30 दिनों के भीतर स्थायी है; आप छूट अवधि के दौरान रद्द कर सकते हैं।",
    },
    terms: {
      eyebrow: "शर्तें",
      title: "AIVO उपयोग की शर्तें।",
      subtitle:
        "पहले सारांश। पूरा कानूनी पाठ देखने के लिए किसी भी खंड पर टैप करें। अंतिम अद्यतन: यह पृष्ठ अंतिम कानूनी-समीक्षित प्रति के लिए एक प्लेसहोल्डर है।",
      agree_summary: "आप किससे सहमत हैं।",
      agree_body:
        "आप AIVO का उपयोग स्वयं को, अपने बच्चे को या अपने छात्रों को शिक्षित करने के उद्देश्य से करने हेतु सहमत हैं। आप सुरक्षा फ़िल्टर बायपास करने, पहुँच पुनः बेचने, या प्रतिस्पर्धी मॉडल प्रशिक्षित करने के लिए AIVO आउटपुट का उपयोग करने का प्रयास नहीं करेंगे।",
      aivo_summary: "AIVO किससे सहमत है।",
      aivo_body:
        "हम आपकी गोपनीयता सूचना में वर्णित अनुसार आपके डेटा को निजी रखेंगे, इन शर्तों में किसी भी महत्वपूर्ण बदलाव की 30 दिन पहले सूचना देंगे, और जो कुछ भी हमारे पास है उसे आप कभी भी निर्यात करने देंगे।",
      children_summary: "बच्चे और परिवार।",
      children_body:
        "13 वर्ष से कम उम्र के सीखने वालों वाले खातों के लिए, एक सत्यापित अभिभावक या संरक्षक की सहमति आवश्यक है। हम जानबूझकर बच्चे-नियंत्रित खाते नहीं बनाते। in loco parentis के रूप में कार्य करने वाले स्कूलों के पास फ़ाइल में एक हस्ताक्षरित डेटा प्रोसेसिंग समझौता होना चाहिए।",
      wrong_summary: "यदि कुछ गलत हो जाए।",
      wrong_body:
        "हम में से कोई भी इस समझौते को समाप्त कर सकता है। बंद होने के बाद आपका डेटा निर्यात 90 दिनों तक उपलब्ध रहता है। विवाद आपके बिलिंग पते के क्षेत्राधिकार के कानूनों द्वारा शासित होते हैं।",
    },
    recovery: {
      eyebrow: "खाता पुनर्प्राप्ति",
      title: "साइन इन में परेशानी? हम एक लिंक भेजेंगे।",
      subtitle:
        "अपने AIVO खाते का ईमेल दर्ज करें। हम एक बार उपयोग होने वाला लिंक ईमेल करेंगे जिससे आप अपना पासवर्ड रीसेट कर सकें।",
      reassure_title: "हम यह नहीं बताते कि ईमेल मौजूद है या नहीं।",
      reassure_body:
        "किसी भी स्थिति में, हम वही पुष्टि दिखाएँगे। यह बुरे इरादे वालों को यह जानने से रोकता है कि किन पतों के खाते हैं।",
      submit: "पुनर्प्राप्ति लिंक भेजें",
      back_to_sign_in: "साइन इन पर वापस जाएँ",
    },
    child_approval: {
      eyebrow: "अंतिम चरण",
      title: "अपने बच्चे की पहुँच स्वीकृत करें।",
      subtitle:
        "ये वे अनुभव हैं जिन्हें आपका बच्चा AIVO पर उपयोग कर सकता है। आप इनमें से किसी को भी बाद में उसकी प्रोफ़ाइल से बदल सकते हैं।",
      reassure_title: "आपका बच्चा आपका इंतज़ार कर रहा है।",
      reassure_body:
        "जब तक आप स्वीकृत नहीं दबाते, यह प्रोफ़ाइल प्रतीक्षा की स्थिति में रहती है। आपका बच्चा साइन इन या पाठ शुरू नहीं कर सकता।",
      approve: "स्वीकृत करें और समाप्त करें",
      footer_note: "आप अभिभावक होम पर पहुँचेंगे, जहाँ आपका बच्चा सेट और तैयार होगा।",
      comm_title: "शिक्षकों के साथ संदेश",
      comm_desc:
        "आपका बच्चा शिक्षकों के संदेश पढ़ सकता है और वयस्क-नियंत्रित त्वरित उत्तरों से जवाब दे सकता है।",
      ai_title: "AI ट्यूटर",
      ai_desc:
        "एक संवादात्मक ट्यूटर जो अवधारणाएँ समझाता है, कभी अंतिम उत्तर नहीं देता, और सुरक्षा विषयों को किसी वयस्क की ओर भेज देता है।",
      voice_title: "वॉइस मोड",
      voice_desc:
        "आपके बच्चे को ट्यूटर से बोलने और सुनने देता है। डिफ़ॉल्ट रूप से बंद—माइक्रोफ़ोन का उपयोग करता है।",
    },
    iep_upload: {
      eyebrow: "IEP / 504 सहायताएँ",
      title: "अपने बच्चे की योजना जोड़ें — केवल यदि आप चाहें।",
      subtitle:
        "यदि आपके पास IEP या 504 है, तो AIVO सुविधाएँ (अतिरिक्त समय, ज़ोर से पढ़ना, आदि) निकाल सकता है ताकि पाठ पहले दिन से उससे मेल खाएँ। आप यह बाद में कर सकते हैं, या कभी नहीं।",
      reassure_title: "यह एक संवेदनशील दस्तावेज़ है।",
      reassure_body:
        "इसे केवल आप, कोई भी सह-अभिभावक, और जिन स्कूलों के लिए आपने सहमति दी उनके शिक्षक देखेंगे। AI निष्कर्षण टेनेंट के भीतर चलता है। मूल फ़ाइल विश्राम में एन्क्रिप्टेड रहती है।",
      reassure_link: "IEP कैसे संभाले जाते हैं",
      upload_continue: "अपलोड करें और जारी रखें",
      skip: "अभी छोड़ें",
      footer_note: "आप बाद में अपने सीखने वाले की प्रोफ़ाइल से अपलोड कर सकते हैं।",
      consent_title: "मैं IEP / 504 योजना अपलोड करने की स्पष्ट सहमति देता/देती हूँ",
      consent_desc:
        "AIVO दस्तावेज़ संग्रहीत करेगा, सूचीबद्ध सुविधाएँ निकालेगा, और उन्हें पाठों पर लागू करेगा। आप इसे कभी भी हटा सकते हैं।",
      choose_file: "एक PDF या Word फ़ाइल चुनें",
      file_help:
        "20 MB तक की फ़ाइलें। कुछ भी लागू करने से पहले हम जो निकाला उसका पूर्वावलोकन दिखाएँगे।",
      legal_summary: "क्या निकाला जाता है, और क्या नहीं।",
      legal_extracted_label: "निकाला गया:",
      legal_extracted_body:
        "सुविधाओं की सूची (अतिरिक्त समय, ज़ोर से पढ़ना, विराम), लक्ष्य श्रेणियाँ, सहायता सेवा घंटे।",
      legal_never_label: "कभी नहीं निकाला:",
      legal_never_body: "चिकित्सा निदान, मनोवैज्ञानिक मूल्यांकन, अभिभावक के कथन, हस्ताक्षर।",
      legal_teachers_label: "शिक्षकों को दृश्य:",
      legal_teachers_body: "केवल सुविधाओं की सूची, केवल उन स्कूलों में जिनके लिए आपने सहमति दी।",
    },
    invite_school: {
      eyebrow: "स्कूल आमंत्रण",
      title: "AIVO पर अपने स्कूल से जुड़ें।",
      subtitle:
        "अपने स्कूल द्वारा भेजा गया कोड चिपकाएँ। यदि आपके पास नहीं है, तो अपने स्कूल प्रशासक से माँगें—केवल आमंत्रित स्टाफ़ ही जुड़ सकता है।",
      reassure_title: "स्कूल स्टाफ़ स्वयं नामांकन नहीं कर सकता।",
      reassure_body:
        "एक प्रशासक को आपको आमंत्रित करना होगा। यह नामावली और छात्र डेटा की रक्षा करता है।",
      join: "स्कूल से जुड़ें",
      code_label: "आमंत्रण कोड",
      email_label: "आपका स्कूल ईमेल",
      email_helper: "उस ईमेल से मेल खाना चाहिए जिस पर प्रशासक ने आपको आमंत्रित किया।",
    },
    invite_district: {
      eyebrow: "ज़िला आमंत्रण",
      title: "AIVO पर अपने ज़िले से जुड़ें।",
      subtitle:
        "ज़िला प्रशासक आमंत्रण AIVO द्वारा ऑनबोर्डिंग के दौरान जारी किए जाते हैं। आपका ज़िला सफलता प्रबंधक आपको एक बार उपयोग होने वाला कोड भेजेगा।",
      reassure_title: "ज़िला प्रशासक की प्रबलित जाँच लागू है।",
      reassure_body:
        "इस भूमिका के हर साइन-इन के लिए एक नई बायोमेट्रिक या PIN जाँच आवश्यक है। AIVO कभी किसी एकल पासवर्ड को ज़िला डेटा अनलॉक नहीं करने देता।",
      code_label: "ज़िला आमंत्रण कोड",
      email_label: "आपका ज़िला ईमेल",
    },
    error: {
      expired_invite_eyebrow: "आमंत्रण समाप्त",
      expired_invite_title: "यह आमंत्रण अब मान्य नहीं है।",
      expired_invite_subtitle:
        "आमंत्रण 30 दिनों के बाद समाप्त हो जाते हैं। जिसने भेजा था उससे नया जारी करने को कहें।",
      expired_invite_body:
        "यदि आपके स्कूल या ज़िले ने भेजा था, तो अपने प्रशासक से संपर्क करें। यदि आप मूल कोड दें तो AIVO सहायता भी इसे फिर से भेज सकती है।",
      expired_invite_reassure_title: "हमने आपकी जगह नहीं खोई।",
      expired_invite_reassure_body:
        "स्कूल या ज़िले में आपकी सीट अब भी आरक्षित है—केवल लिंक समाप्त हुआ।",
      expired_invite_primary: "स्वागत पर वापस जाएँ",
      expired_invite_secondary: "साइन इन में मदद चाहिए?",
      offline_eyebrow: "ऑफ़लाइन",
      offline_title: "हम अभी AIVO तक नहीं पहुँच सकते।",
      offline_subtitle: "अपना कनेक्शन जाँचें और फिर से प्रयास करें।",
      offline_body:
        "एक पाठ लोड हो जाने के बाद कुछ सीखने वाली गतिविधियाँ ऑफ़लाइन काम करती हैं—लेकिन सेटअप के लिए एक सक्रिय कनेक्शन चाहिए।",
      offline_reassure_title: "कुछ नहीं खोया।",
      offline_reassure_body:
        "जैसे ही आप वापस ऑनलाइन होंगे, हम ठीक वहीं से जारी रखेंगे जहाँ आपने छोड़ा था।",
      offline_primary: "फिर से प्रयास करें",
      blocked_eyebrow: "खाता अवरुद्ध",
      blocked_title: "यह खाता रोका गया है।",
      blocked_subtitle:
        "AIVO सहायता ने इस खाते को रोका है। यह आमतौर पर बिलिंग या अनुपालन समीक्षा होती है।",
      blocked_body:
        "समीक्षा समाप्त होने पर आपको फ़ाइल में दर्ज पते पर एक ईमेल मिलेगा, आमतौर पर एक कार्यदिवस के भीतर।",
      blocked_reassure_title: "आपके बच्चे का डेटा सुरक्षित है।",
      blocked_reassure_body: "समीक्षा के दौरान हम कुछ नहीं हटाते—केवल रोकना और फिर से शुरू करना।",
      blocked_primary: "स्वागत पर वापस जाएँ",
      generic_eyebrow: "कुछ गलत हो गया",
      generic_title: "हमें एक अड़चन आई।",
      generic_subtitle: "यह शायद अस्थायी है—थोड़ी देर में फिर से प्रयास करें।",
      generic_body:
        "यदि यह बार-बार होता है, तो कृपया AIVO सहायता से संपर्क करें और बताएँ कि आप क्या करने का प्रयास कर रहे थे।",
      generic_reassure_title: "कुछ भी गलत तरीके से चार्ज या सहेजा नहीं गया।",
      generic_reassure_body: "AIVO कभी अधूरा सेटअप डेटा नहीं रखता।",
      generic_primary: "फिर से शुरू करें",
    },
  },
};

let written = 0;
for (const [locale, onboarding] of Object.entries(ONBOARDING)) {
  // The "blocked" and "generic" error variants both render a "Contact
  // support" secondary link; reuse the localized common.contact_support
  // value so error/page.tsx's t(`${variant}_secondary`) always resolves.
  onboarding.error.blocked_secondary = onboarding.common.contact_support;
  onboarding.error.generic_secondary = onboarding.common.contact_support;
  const file = join(messagesDir, `${locale}.json`);
  const json = JSON.parse(readFileSync(file, "utf8"));
  json.onboarding = onboarding;
  writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
  written += 1;
  console.log(`seed-onboarding-i18n: merged onboarding namespace → messages/${locale}.json`);
}
console.log(`\nseed-onboarding-i18n: done — ${written} locale catalogs updated.`);
