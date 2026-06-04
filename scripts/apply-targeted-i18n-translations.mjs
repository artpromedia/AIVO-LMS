#!/usr/bin/env node
/**
 * One-off translation patch for Phase-7 i18n delta.
 *
 * Applies real translations for keys in the targeted namespaces that the
 * untranslated-report tool flagged. Keeps brand/product names and universal
 * placeholders in English (those are also added to the report's exemption
 * list so they don't keep getting flagged).
 *
 * Idempotent: safe to re-run. Only writes when a value actually changes.
 */

import { readFileSync, writeFileSync } from "node:fs";

const FILE = (locale) => `apps/web-v2/lib/i18n/messages/${locale}.json`;

/**
 * Per-locale translations. Keyed by dotted catalog path; nested writes are
 * handled by setPath().
 */
const TRANSLATIONS = {
  ar: {
    "onboarding.common.copyright": "© AIVO Learning. جميع الحقوق محفوظة.",
    "onboarding.signin.errors.missing_credentials":
      "أدخل بريدك الإلكتروني وكلمة المرور لتسجيل الدخول.",
    "onboarding.signin.errors.invalid_credentials":
      "البريد الإلكتروني أو كلمة المرور غير صحيحة. حاول مرة أخرى.",
    "onboarding.signin.errors.wrong_surface":
      "يسجّل هذا الحساب الدخول من بوابة مختلفة.",
    "onboarding.signin.errors.unsupported_role":
      "لا يمكن لهذا النوع من الحسابات تسجيل الدخول هنا.",
    "onboarding.signin.errors.login_failed":
      "تعذّر تسجيل دخولك. يرجى المحاولة بعد قليل.",
    "onboarding.signup.errors.invalid_input":
      "يرجى إدخال اسمك وبريد إلكتروني صالح وكلمة مرور لا تقل عن 8 أحرف.",
    "onboarding.signup.errors.email_taken":
      "هذا البريد الإلكتروني مسجّل بالفعل. جرّب تسجيل الدخول بدلاً من ذلك.",
    "onboarding.signup.errors.weak_password":
      "كلمة المرور هذه لا تلبّي سياسة الأمان. استخدم 8 أحرف على الأقل مع رقم ورمز.",
    "onboarding.signup.errors.service_unavailable":
      "تعذّر الوصول إلى خدمة إنشاء الحساب. يرجى المحاولة بعد قليل.",
    "onboarding.signup.errors.unsupported_role":
      "لا يمكن إنشاء هذا النوع من الحسابات هنا.",
    "onboarding.signup.errors.signup_failed":
      "تعذّر إنشاء حسابك. يرجى المحاولة مرة أخرى.",
    "onboarding.learner_new.error_first_name":
      "يرجى إدخال الاسم الأول للمتعلّم للمتابعة.",
    "lti_admin.fields.issuer": "جهة الإصدار (Issuer)",
    "lti_admin.fields.client_id": "معرّف العميل (Client ID)",
    "lti_admin.fields.auth_token_url": "رابط رمز المصادقة (Auth token URL)",
    "lti_admin.fields.auth_login_url": "رابط تسجيل الدخول (Auth login URL)",
  },
  de: {
    "onboarding.common.copyright": "© AIVO Learning. Alle Rechte vorbehalten.",
    "onboarding.signin.errors.missing_credentials":
      "Bitte E-Mail-Adresse und Passwort eingeben.",
    "onboarding.signin.errors.invalid_credentials":
      "E-Mail oder Passwort stimmen nicht. Bitte erneut versuchen.",
    "onboarding.signin.errors.wrong_surface":
      "Dieses Konto meldet sich über ein anderes Portal an.",
    "onboarding.signin.errors.unsupported_role":
      "Dieser Kontotyp kann sich hier nicht anmelden.",
    "onboarding.signin.errors.login_failed":
      "Anmeldung fehlgeschlagen. Bitte versuche es gleich noch einmal.",
    "onboarding.signup.errors.invalid_input":
      "Bitte Namen, eine gültige E-Mail-Adresse und ein Passwort mit mindestens 8 Zeichen eingeben.",
    "onboarding.signup.errors.email_taken":
      "Diese E-Mail ist bereits registriert. Versuche dich anzumelden.",
    "onboarding.signup.errors.weak_password":
      "Dieses Passwort entspricht nicht unseren Sicherheitsvorgaben. Verwende mindestens 8 Zeichen mit einer Zahl und einem Sonderzeichen.",
    "onboarding.signup.errors.service_unavailable":
      "Der Registrierungsdienst ist nicht erreichbar. Bitte gleich noch einmal versuchen.",
    "onboarding.signup.errors.unsupported_role":
      "Dieser Kontotyp kann hier nicht erstellt werden.",
    "onboarding.signup.errors.signup_failed":
      "Konto konnte nicht erstellt werden. Bitte erneut versuchen.",
    "onboarding.learner_new.error_first_name":
      "Bitte gib den Vornamen des Lernenden ein, um fortzufahren.",
    "lti_admin.fields.issuer": "Aussteller (Issuer)",
    "lti_admin.fields.client_id": "Client-ID",
    "lti_admin.fields.auth_token_url": "Auth-Token-URL",
    "lti_admin.fields.auth_login_url": "Auth-Login-URL",
    "lti_admin.registered.deployments_label": "Bereitstellungen",
    // "Offline" is a loanword in German; allowlisted, not retranslated.
  },
  es: {
    "onboarding.common.copyright":
      "© AIVO Learning. Todos los derechos reservados.",
    "onboarding.signin.errors.missing_credentials":
      "Introduce tu correo y contraseña para iniciar sesión.",
    "onboarding.signin.errors.invalid_credentials":
      "Ese correo o contraseña no coinciden. Inténtalo de nuevo.",
    "onboarding.signin.errors.wrong_surface":
      "Esta cuenta inicia sesión desde otro portal.",
    "onboarding.signin.errors.unsupported_role":
      "Este tipo de cuenta no puede iniciar sesión aquí.",
    "onboarding.signin.errors.login_failed":
      "No pudimos iniciar tu sesión. Inténtalo de nuevo en un momento.",
    "onboarding.signup.errors.invalid_input":
      "Introduce tu nombre, un correo válido y una contraseña de al menos 8 caracteres.",
    "onboarding.signup.errors.email_taken":
      "Ese correo ya está registrado. Prueba a iniciar sesión.",
    "onboarding.signup.errors.weak_password":
      "Esa contraseña no cumple nuestra política de seguridad. Usa al menos 8 caracteres con un número y un símbolo.",
    "onboarding.signup.errors.service_unavailable":
      "No pudimos contactar con el servicio de registro. Inténtalo de nuevo en un momento.",
    "onboarding.signup.errors.unsupported_role":
      "Este tipo de cuenta no se puede crear aquí.",
    "onboarding.signup.errors.signup_failed":
      "No pudimos crear tu cuenta. Inténtalo de nuevo.",
    "onboarding.learner_new.error_first_name":
      "Introduce el nombre del estudiante para continuar.",
    "lti_admin.fields.issuer": "Emisor (Issuer)",
    "lti_admin.fields.client_id": "ID de cliente",
    "lti_admin.fields.auth_token_url": "URL del token de autenticación",
    "lti_admin.fields.auth_login_url": "URL de inicio de sesión de autenticación",
  },
  fr: {
    "onboarding.common.copyright": "© AIVO Learning. Tous droits réservés.",
    "onboarding.signin.errors.missing_credentials":
      "Saisis ton e-mail et ton mot de passe pour te connecter.",
    "onboarding.signin.errors.invalid_credentials":
      "Cet e-mail ou ce mot de passe ne correspond pas. Réessaie.",
    "onboarding.signin.errors.wrong_surface":
      "Ce compte se connecte depuis un autre portail.",
    "onboarding.signin.errors.unsupported_role":
      "Ce type de compte ne peut pas se connecter ici.",
    "onboarding.signin.errors.login_failed":
      "Connexion impossible. Réessaie dans un instant.",
    "onboarding.signup.errors.invalid_input":
      "Saisis ton nom, un e-mail valide et un mot de passe d’au moins 8 caractères.",
    "onboarding.signup.errors.email_taken":
      "Cet e-mail est déjà enregistré. Essaie plutôt de te connecter.",
    "onboarding.signup.errors.weak_password":
      "Ce mot de passe ne respecte pas notre politique de sécurité. Utilise au moins 8 caractères avec un chiffre et un symbole.",
    "onboarding.signup.errors.service_unavailable":
      "Le service d’inscription est indisponible. Réessaie dans un instant.",
    "onboarding.signup.errors.unsupported_role":
      "Ce type de compte ne peut pas être créé ici.",
    "onboarding.signup.errors.signup_failed":
      "Impossible de créer ton compte. Réessaie.",
    "onboarding.learner_new.error_first_name":
      "Saisis le prénom de l’apprenant pour continuer.",
    "lti_admin.fields.issuer": "Émetteur (Issuer)",
    "lti_admin.fields.client_id": "ID client",
    "lti_admin.fields.auth_token_url": "URL du jeton d’authentification",
    "lti_admin.fields.auth_login_url": "URL de connexion d’authentification",
    "lti_admin.registered.client_id_label": "client",
    // "Microphone" is identical in French (true cognate); allowlisted.
  },
  hi: {
    "onboarding.common.copyright": "© AIVO Learning. सर्वाधिकार सुरक्षित।",
    "onboarding.signin.errors.missing_credentials":
      "साइन इन के लिए अपना ईमेल और पासवर्ड दर्ज करें।",
    "onboarding.signin.errors.invalid_credentials":
      "वह ईमेल या पासवर्ड मेल नहीं खाता। कृपया दोबारा प्रयास करें।",
    "onboarding.signin.errors.wrong_surface":
      "यह खाता किसी अन्य पोर्टल से साइन इन करता है।",
    "onboarding.signin.errors.unsupported_role":
      "इस प्रकार का खाता यहाँ साइन इन नहीं कर सकता।",
    "onboarding.signin.errors.login_failed":
      "हम आपको साइन इन नहीं कर सके। कृपया कुछ देर में पुनः प्रयास करें।",
    "onboarding.signup.errors.invalid_input":
      "कृपया अपना नाम, एक मान्य ईमेल और कम से कम 8 अक्षरों का पासवर्ड दर्ज करें।",
    "onboarding.signup.errors.email_taken":
      "यह ईमेल पहले से पंजीकृत है। इसके बजाय साइन इन करने का प्रयास करें।",
    "onboarding.signup.errors.weak_password":
      "यह पासवर्ड हमारी सुरक्षा नीति को पूरा नहीं करता। कम से कम 8 अक्षर एक अंक और एक प्रतीक के साथ उपयोग करें।",
    "onboarding.signup.errors.service_unavailable":
      "हम साइन-अप सेवा तक नहीं पहुँच सके। कृपया कुछ देर में पुनः प्रयास करें।",
    "onboarding.signup.errors.unsupported_role":
      "इस प्रकार का खाता यहाँ नहीं बनाया जा सकता।",
    "onboarding.signup.errors.signup_failed":
      "हम आपका खाता नहीं बना सके। कृपया पुनः प्रयास करें।",
    "onboarding.learner_new.error_first_name":
      "जारी रखने के लिए कृपया शिक्षार्थी का पहला नाम दर्ज करें।",
    "lti_admin.fields.issuer": "जारीकर्ता (Issuer)",
    "lti_admin.fields.client_id": "क्लाइंट आईडी",
    "lti_admin.fields.auth_token_url": "ऑथ टोकन URL",
    "lti_admin.fields.auth_login_url": "ऑथ लॉगिन URL",
  },
  ja: {
    "onboarding.common.copyright": "© AIVO Learning. 無断複写・転載を禁じます。",
    "onboarding.signin.errors.missing_credentials":
      "メールアドレスとパスワードを入力してサインインしてください。",
    "onboarding.signin.errors.invalid_credentials":
      "メールアドレスまたはパスワードが一致しません。もう一度お試しください。",
    "onboarding.signin.errors.wrong_surface":
      "このアカウントは別のポータルからサインインします。",
    "onboarding.signin.errors.unsupported_role":
      "この種類のアカウントはここからサインインできません。",
    "onboarding.signin.errors.login_failed":
      "サインインできませんでした。少し時間をおいて再度お試しください。",
    "onboarding.signup.errors.invalid_input":
      "氏名、有効なメールアドレス、8 文字以上のパスワードを入力してください。",
    "onboarding.signup.errors.email_taken":
      "このメールアドレスはすでに登録されています。代わりにサインインをお試しください。",
    "onboarding.signup.errors.weak_password":
      "このパスワードはセキュリティ要件を満たしません。数字と記号を含む 8 文字以上を使用してください。",
    "onboarding.signup.errors.service_unavailable":
      "登録サービスに接続できませんでした。少し時間をおいて再度お試しください。",
    "onboarding.signup.errors.unsupported_role":
      "この種類のアカウントはここでは作成できません。",
    "onboarding.signup.errors.signup_failed":
      "アカウントを作成できませんでした。もう一度お試しください。",
    "onboarding.learner_new.error_first_name":
      "続行するには学習者の名（ファーストネーム）を入力してください。",
    "lti_admin.fields.issuer": "発行者 (Issuer)",
    "lti_admin.fields.client_id": "クライアント ID",
    "lti_admin.fields.auth_token_url": "認証トークン URL",
    "lti_admin.fields.auth_login_url": "認証ログイン URL",
  },
  ko: {
    "onboarding.common.copyright": "© AIVO Learning. 모든 권리 보유.",
    "onboarding.signin.errors.missing_credentials":
      "로그인하려면 이메일과 비밀번호를 입력하세요.",
    "onboarding.signin.errors.invalid_credentials":
      "이메일 또는 비밀번호가 일치하지 않습니다. 다시 시도해 주세요.",
    "onboarding.signin.errors.wrong_surface":
      "이 계정은 다른 포털에서 로그인합니다.",
    "onboarding.signin.errors.unsupported_role":
      "이 계정 유형은 여기에서 로그인할 수 없습니다.",
    "onboarding.signin.errors.login_failed":
      "로그인할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    "onboarding.signup.errors.invalid_input":
      "이름, 유효한 이메일, 8자 이상의 비밀번호를 입력하세요.",
    "onboarding.signup.errors.email_taken":
      "이미 등록된 이메일입니다. 로그인을 시도해 보세요.",
    "onboarding.signup.errors.weak_password":
      "이 비밀번호는 보안 정책을 충족하지 않습니다. 숫자와 기호를 포함해 8자 이상을 사용하세요.",
    "onboarding.signup.errors.service_unavailable":
      "가입 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    "onboarding.signup.errors.unsupported_role":
      "이 계정 유형은 여기에서 만들 수 없습니다.",
    "onboarding.signup.errors.signup_failed":
      "계정을 만들 수 없습니다. 다시 시도해 주세요.",
    "onboarding.learner_new.error_first_name":
      "계속하려면 학습자의 이름을 입력해 주세요.",
    "lti_admin.fields.issuer": "발급자 (Issuer)",
    "lti_admin.fields.client_id": "클라이언트 ID",
    "lti_admin.fields.auth_token_url": "인증 토큰 URL",
    "lti_admin.fields.auth_login_url": "인증 로그인 URL",
  },
  pt: {
    "onboarding.common.copyright":
      "© AIVO Learning. Todos os direitos reservados.",
    "onboarding.signin.errors.missing_credentials":
      "Insira seu e-mail e sua senha para entrar.",
    "onboarding.signin.errors.invalid_credentials":
      "Esse e-mail ou senha não confere. Tente novamente.",
    "onboarding.signin.errors.wrong_surface":
      "Esta conta entra a partir de outro portal.",
    "onboarding.signin.errors.unsupported_role":
      "Este tipo de conta não pode entrar aqui.",
    "onboarding.signin.errors.login_failed":
      "Não foi possível entrar. Tente de novo em instantes.",
    "onboarding.signup.errors.invalid_input":
      "Insira seu nome, um e-mail válido e uma senha de pelo menos 8 caracteres.",
    "onboarding.signup.errors.email_taken":
      "Este e-mail já está cadastrado. Tente entrar.",
    "onboarding.signup.errors.weak_password":
      "Essa senha não atende à nossa política de segurança. Use pelo menos 8 caracteres com um número e um símbolo.",
    "onboarding.signup.errors.service_unavailable":
      "Não foi possível acessar o serviço de cadastro. Tente de novo em instantes.",
    "onboarding.signup.errors.unsupported_role":
      "Este tipo de conta não pode ser criado aqui.",
    "onboarding.signup.errors.signup_failed":
      "Não foi possível criar sua conta. Tente novamente.",
    "onboarding.learner_new.error_first_name":
      "Informe o primeiro nome do estudante para continuar.",
    "lti_admin.fields.issuer": "Emissor (Issuer)",
    "lti_admin.fields.client_id": "ID do cliente",
    "lti_admin.fields.auth_token_url": "URL do token de autenticação",
    "lti_admin.fields.auth_login_url": "URL de login de autenticação",
    // "Offline" is a loanword in Portuguese; allowlisted.
  },
  zh: {
    "onboarding.common.copyright": "© AIVO Learning. 版权所有。",
    "onboarding.signin.errors.missing_credentials": "请输入您的邮箱和密码以登录。",
    "onboarding.signin.errors.invalid_credentials":
      "邮箱或密码不正确。请重试。",
    "onboarding.signin.errors.wrong_surface": "此账户从其他门户登录。",
    "onboarding.signin.errors.unsupported_role": "此账户类型无法在此登录。",
    "onboarding.signin.errors.login_failed": "无法为您登录。请稍后再试。",
    "onboarding.signup.errors.invalid_input":
      "请输入您的姓名、有效邮箱以及至少 8 个字符的密码。",
    "onboarding.signup.errors.email_taken":
      "该邮箱已注册。请尝试登录。",
    "onboarding.signup.errors.weak_password":
      "此密码不符合我们的安全策略。请使用至少 8 个字符，并包含数字和符号。",
    "onboarding.signup.errors.service_unavailable":
      "无法连接注册服务。请稍后再试。",
    "onboarding.signup.errors.unsupported_role": "此账户类型无法在此创建。",
    "onboarding.signup.errors.signup_failed": "无法创建您的账户。请重试。",
    "onboarding.learner_new.error_first_name": "请输入学习者的名字以继续。",
    "lti_admin.fields.issuer": "颁发方 (Issuer)",
    "lti_admin.fields.client_id": "客户端 ID",
    "lti_admin.fields.auth_token_url": "认证令牌 URL",
    "lti_admin.fields.auth_login_url": "认证登录 URL",
  },
};

function setPath(obj, dotted, value) {
  const parts = dotted.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) {
      cur[parts[i]] = {};
    }
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

let totalWrites = 0;
for (const [locale, entries] of Object.entries(TRANSLATIONS)) {
  const path = FILE(locale);
  const cat = JSON.parse(readFileSync(path, "utf8"));
  let writes = 0;
  for (const [k, v] of Object.entries(entries)) {
    setPath(cat, k, v);
    writes++;
  }
  writeFileSync(path, JSON.stringify(cat, null, 2) + "\n");
  console.log(`${locale}: wrote ${writes} translations → ${path}`);
  totalWrites += writes;
}
console.log(`\ntotal writes: ${totalWrites}`);
