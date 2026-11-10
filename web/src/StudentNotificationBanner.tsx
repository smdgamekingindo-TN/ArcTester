export interface StudentNotificationNotice {
  id: string;
  title: string;
  message: string;
  href: string;
}

interface StudentNotificationBannerProps {
  notification: StudentNotificationNotice;
  onRead: (id: string) => void;
}

export default function StudentNotificationBanner({
  notification,
  onRead,
}: StudentNotificationBannerProps) {
  return (
    <section className="panel student-notification-banner" role="status" aria-label="New notification">
      <div>
        <p className="eyebrow">NEW STUDENT UPDATE</p>
        <h2>{notification.title}</h2>
        <p>{notification.message}</p>
      </div>
      <div className="row">
        <a className="button button-secondary button-small" href={notification.href}>Open</a>
        <button className="button button-primary button-small" onClick={() => onRead(notification.id)}>
          Mark as read
        </button>
      </div>
    </section>
  );
}
