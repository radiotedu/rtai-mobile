import type {AppLanguage} from './index';

export interface EcosystemText {
  navTitle: string;
  kicker: string;
  heroTitle: string;
  heroSubtitle: string;
  accountTitle: string;
  accountBody: string;
  signIn: string;
  ticketsTitle: string;
  ticketsBody: string;
  ticketsEmpty: string;
  ticketsError: string;
  openTicket: string;
  newTicket: string;
  checkedIn: string;
  ready: string;
  reservationTitle: string;
  reservationBody: string;
  openReservation: string;
  roomTitle: string;
  roomBody: string;
  roomVerified: string;
  refresh: string;
  openFailed: string;
}

const COPY: Record<AppLanguage, EcosystemText> = {
  en: {
    navTitle: 'Dashboard',
    kicker: 'RadioTEDU Ecosystem',
    heroTitle: 'Tickets, appointments and crew access in one place.',
    heroSubtitle: 'Your RadioTEDU account connects the services you are eligible to use.',
    accountTitle: 'Sign in to see your services',
    accountBody: 'Tickets and account-linked services are available after RadioTEDU sign-in.',
    signIn: 'Sign in',
    ticketsTitle: 'My tickets',
    ticketsBody: 'Tickets are matched securely using your RadioTEDU account email.',
    ticketsEmpty: 'No tickets are linked to this account yet.',
    ticketsError: 'Tickets could not be loaded right now.',
    openTicket: 'Open ticket & QR',
    newTicket: 'Browse events',
    checkedIn: 'Checked in',
    ready: 'Ready',
    reservationTitle: 'Studio appointment',
    reservationBody: 'Open the official RadioTEDU studio reservation form.',
    openReservation: 'Open reservation',
    roomTitle: 'Oda QR',
    roomBody: 'Your linked crew account is eligible. Scan the rotating room QR with your phone camera and confirm in ERP.',
    roomVerified: 'ERP access verified',
    refresh: 'Refresh',
    openFailed: 'The secure RadioTEDU page could not be opened.',
  },
  tr: {
    navTitle: 'Panel',
    kicker: 'RadioTEDU Ekosistemi',
    heroTitle: 'Biletler, randevular ve ekip erişimi tek yerde.',
    heroSubtitle: 'RadioTEDU hesabın, kullanmaya yetkili olduğun servisleri birbirine bağlar.',
    accountTitle: 'Servislerini görmek için giriş yap',
    accountBody: 'Biletler ve hesaba bağlı servisler RadioTEDU girişinden sonra kullanılabilir.',
    signIn: 'Giriş yap',
    ticketsTitle: 'Biletlerim',
    ticketsBody: 'Biletler RadioTEDU hesabındaki e-posta ile güvenli biçimde eşleştirilir.',
    ticketsEmpty: 'Bu hesaba bağlı bir bilet henüz yok.',
    ticketsError: 'Biletler şu anda yüklenemedi.',
    openTicket: 'Bileti ve QR’ı aç',
    newTicket: 'Etkinliklere bak',
    checkedIn: 'Giriş yapıldı',
    ready: 'Hazır',
    reservationTitle: 'Stüdyo randevusu',
    reservationBody: 'Resmî RadioTEDU stüdyo rezervasyon formunu aç.',
    openReservation: 'Rezervasyonu aç',
    roomTitle: 'Oda QR',
    roomBody: 'Bağlı ekip hesabının erişimi doğrulandı. Dönen oda QR kodunu telefon kamerasıyla tara ve ERP’de onayla.',
    roomVerified: 'ERP erişimi doğrulandı',
    refresh: 'Yenile',
    openFailed: 'Güvenli RadioTEDU sayfası açılamadı.',
  },
  ru: {
    navTitle: 'Панель',
    kicker: 'Экосистема RadioTEDU',
    heroTitle: 'Билеты, записи и доступ команды в одном месте.',
    heroSubtitle: 'Аккаунт RadioTEDU объединяет доступные вам сервисы.',
    accountTitle: 'Войдите, чтобы увидеть сервисы',
    accountBody: 'Билеты и связанные сервисы доступны после входа в RadioTEDU.',
    signIn: 'Войти',
    ticketsTitle: 'Мои билеты',
    ticketsBody: 'Билеты безопасно сопоставляются с почтой аккаунта RadioTEDU.',
    ticketsEmpty: 'К этому аккаунту пока не привязаны билеты.',
    ticketsError: 'Сейчас не удалось загрузить билеты.',
    openTicket: 'Открыть билет и QR',
    newTicket: 'Смотреть события',
    checkedIn: 'Вход отмечен',
    ready: 'Готово',
    reservationTitle: 'Запись в студию',
    reservationBody: 'Откройте официальную форму бронирования студии RadioTEDU.',
    openReservation: 'Открыть запись',
    roomTitle: 'Oda QR',
    roomBody: 'Доступ связанного аккаунта команды подтверждён. Отсканируйте обновляемый QR комнаты камерой и подтвердите в ERP.',
    roomVerified: 'Доступ ERP подтверждён',
    refresh: 'Обновить',
    openFailed: 'Не удалось открыть защищённую страницу RadioTEDU.',
  },
  ar: {
    navTitle: 'لوحة التحكم',
    kicker: 'منظومة RadioTEDU',
    heroTitle: 'التذاكر والمواعيد ووصول الفريق في مكان واحد.',
    heroSubtitle: 'يربط حساب RadioTEDU الخدمات المتاحة لك.',
    accountTitle: 'سجّل الدخول لعرض خدماتك',
    accountBody: 'تتوفر التذاكر والخدمات المرتبطة بالحساب بعد تسجيل الدخول إلى RadioTEDU.',
    signIn: 'تسجيل الدخول',
    ticketsTitle: 'تذاكري',
    ticketsBody: 'تُطابق التذاكر بأمان مع بريد حساب RadioTEDU.',
    ticketsEmpty: 'لا توجد تذاكر مرتبطة بهذا الحساب بعد.',
    ticketsError: 'تعذر تحميل التذاكر الآن.',
    openTicket: 'فتح التذكرة وQR',
    newTicket: 'عرض الفعاليات',
    checkedIn: 'تم تسجيل الدخول',
    ready: 'جاهزة',
    reservationTitle: 'موعد الاستوديو',
    reservationBody: 'افتح نموذج حجز استوديو RadioTEDU الرسمي.',
    openReservation: 'فتح الحجز',
    roomTitle: 'Oda QR',
    roomBody: 'تم التحقق من صلاحية حساب الفريق المرتبط. امسح رمز الغرفة المتجدد بالكاميرا وأكّد في ERP.',
    roomVerified: 'تم التحقق من وصول ERP',
    refresh: 'تحديث',
    openFailed: 'تعذر فتح صفحة RadioTEDU الآمنة.',
  },
  de: {
    navTitle: 'Dashboard',
    kicker: 'RadioTEDU-Ökosystem',
    heroTitle: 'Tickets, Termine und Teamzugang an einem Ort.',
    heroSubtitle: 'Dein RadioTEDU-Konto verbindet die Dienste, die du nutzen darfst.',
    accountTitle: 'Anmelden, um deine Dienste zu sehen',
    accountBody: 'Tickets und kontogebundene Dienste sind nach der RadioTEDU-Anmeldung verfügbar.',
    signIn: 'Anmelden',
    ticketsTitle: 'Meine Tickets',
    ticketsBody: 'Tickets werden sicher über die E-Mail deines RadioTEDU-Kontos zugeordnet.',
    ticketsEmpty: 'Mit diesem Konto sind noch keine Tickets verknüpft.',
    ticketsError: 'Tickets konnten gerade nicht geladen werden.',
    openTicket: 'Ticket und QR öffnen',
    newTicket: 'Events ansehen',
    checkedIn: 'Eingecheckt',
    ready: 'Bereit',
    reservationTitle: 'Studiotermin',
    reservationBody: 'Öffne das offizielle RadioTEDU-Formular für Studioreservierungen.',
    openReservation: 'Reservierung öffnen',
    roomTitle: 'Oda QR',
    roomBody: 'Der Zugang des verknüpften Teamkontos wurde bestätigt. Scanne den wechselnden Raum-QR-Code und bestätige in ERP.',
    roomVerified: 'ERP-Zugang bestätigt',
    refresh: 'Aktualisieren',
    openFailed: 'Die sichere RadioTEDU-Seite konnte nicht geöffnet werden.',
  },
  fr: {
    navTitle: 'Tableau de bord',
    kicker: 'Écosystème RadioTEDU',
    heroTitle: 'Billets, rendez-vous et accès équipe au même endroit.',
    heroSubtitle: 'Votre compte RadioTEDU relie les services auxquels vous avez droit.',
    accountTitle: 'Connectez-vous pour voir vos services',
    accountBody: 'Les billets et services liés au compte sont disponibles après connexion à RadioTEDU.',
    signIn: 'Se connecter',
    ticketsTitle: 'Mes billets',
    ticketsBody: 'Les billets sont associés en toute sécurité à l’e-mail du compte RadioTEDU.',
    ticketsEmpty: 'Aucun billet n’est encore lié à ce compte.',
    ticketsError: 'Les billets ne peuvent pas être chargés pour le moment.',
    openTicket: 'Ouvrir le billet et le QR',
    newTicket: 'Voir les événements',
    checkedIn: 'Entrée validée',
    ready: 'Prêt',
    reservationTitle: 'Rendez-vous studio',
    reservationBody: 'Ouvrez le formulaire officiel de réservation du studio RadioTEDU.',
    openReservation: 'Ouvrir la réservation',
    roomTitle: 'Oda QR',
    roomBody: 'L’accès du compte équipe lié est vérifié. Scannez le QR tournant de la salle avec la caméra et confirmez dans ERP.',
    roomVerified: 'Accès ERP vérifié',
    refresh: 'Actualiser',
    openFailed: 'La page sécurisée RadioTEDU n’a pas pu être ouverte.',
  },
};

function normalizeLanguage(language?: string): AppLanguage {
  const code = (language ?? 'en').split(/[-_]/)[0] as AppLanguage;
  return COPY[code] ? code : 'en';
}

export function ecosystemCopy(language?: string): EcosystemText {
  return COPY[normalizeLanguage(language)];
}
