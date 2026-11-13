import { useAuth } from '../context/AuthContext.jsx';
import PostFeed from '../components/PostFeed.jsx';
import '../styles/home.css';

const UPCOMING_SECTIONS = [
  {
    id: 'connections',
    title: 'Friends / Followers',
    description: 'Discover people, manage followers, and view following lists here.',
    status: 'Coming soon',
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Activity updates and real-time alerts will appear in this panel.',
    status: 'Coming soon',
  },
];

export default function Home() {
  const { user, isAuthenticated } = useAuth();

  const displayName = user?.name || user?.username || 'Member';
  const usernameHandle = user?.username ? `@${user.username}` : '';

  return (
    <div className="dashboard-content">
      <section className="dashboard-welcome-card" aria-labelledby="home-welcome-heading">
        <div className="dashboard-welcome-meta">
          {isAuthenticated && (
            <span className="dashboard-status-pill">Authenticated</span>
          )}
          {usernameHandle && (
            <span className="dashboard-handle">{usernameHandle}</span>
          )}
        </div>
        <h1 id="home-welcome-heading" className="dashboard-welcome-title">
          Welcome, {displayName}
        </h1>
        <p className="dashboard-welcome-subtitle">
          Share your thoughts, connect with friends, and check out what is happening on your feed.
        </p>
      </section>

      {/* Live Social Feed (STEP 7) */}
      <PostFeed />

      {/* Upcoming features teaser */}
      <section className="dashboard-grid" aria-label="Upcoming features">
        {UPCOMING_SECTIONS.map((section) => (
          <article key={section.id} className="dashboard-section-card">
            <div className="dashboard-section-head">
              <h2 className="dashboard-section-title">{section.title}</h2>
              <span className="dashboard-section-badge">{section.status}</span>
            </div>
            <p className="dashboard-section-desc">{section.description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
