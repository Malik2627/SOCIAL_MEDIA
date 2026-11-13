import { useEffect, useRef, useState } from 'react';
import UserCard from '../components/UserCard.jsx';
import { searchUsers } from '../services/api.js';
import { getSafeErrorMessage } from '../utils/apiError.js';
import '../styles/search.css';

export default function Search() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState('');

  const debounceTimerRef = useRef(null);

  // Perform the search
  async function executeSearch(queryToSearch) {
    const trimmed = queryToSearch.trim();

    if (!trimmed) {
      setResults([]);
      setHasSearched(false);
      setLoading(false);
      setError('');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await searchUsers(trimmed);
      const userList = Array.isArray(response?.data?.users)
        ? response.data.users
        : [];
      setResults(userList);
      setHasSearched(true);
    } catch (err) {
      setError(getSafeErrorMessage(err, 'Failed to perform search.'));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  // Handle live search typing with 300ms debounce
  function handleInputChange(e) {
    const nextVal = e.target.value;
    setSearchTerm(nextVal);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!nextVal.trim()) {
      setResults([]);
      setHasSearched(false);
      setLoading(false);
      setError('');
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      executeSearch(nextVal);
    }, 300);
  }

  // Handle immediate form submit
  function handleSubmit(e) {
    e.preventDefault();
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    executeSearch(searchTerm);
  }

  // Handle clear input
  function handleClear() {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setSearchTerm('');
    setResults([]);
    setHasSearched(false);
    setError('');
  }

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="search-page">
      <header className="search-header">
        <h1 className="search-title">Search People</h1>
        <p className="search-subtitle">
          Find and connect with friends, creators, and other members.
        </p>
      </header>

      <form className="search-form" onSubmit={handleSubmit} role="search">
        <div className="search-input-wrap">
          <span className="search-input-icon" aria-hidden="true">
            🔍
          </span>
          <input
            type="search"
            value={searchTerm}
            onChange={handleInputChange}
            placeholder="Search by name or @username..."
            className="search-input"
            aria-label="Search users"
            autoFocus
          />
          {searchTerm && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={handleClear}
              aria-label="Clear search input"
            >
              ✕
            </button>
          )}
        </div>
      </form>

      {error && (
        <div className="auth-banner-error search-error-banner" role="alert">
          {error}
        </div>
      )}

      <main className="search-results-container" aria-live="polite">
        {loading ? (
          <div className="search-state search-state--loading" aria-busy="true">
            <span className="comment-spinner" aria-hidden="true" />
            <span>Searching for members...</span>
          </div>
        ) : !hasSearched ? (
          <div className="search-state search-state--prompt">
            <span className="search-state-icon" aria-hidden="true">
              👥
            </span>
            <h3>Find other people</h3>
            <p>Type a name or username above to discover people to follow.</p>
          </div>
        ) : results.length === 0 ? (
          <div className="search-state search-state--empty">
            <span className="search-state-icon" aria-hidden="true">
              🔎
            </span>
            <h3>No users found</h3>
            <p>No members matched your search for "{searchTerm.trim()}".</p>
          </div>
        ) : (
          <div className="search-results-list" role="feed" aria-label="Search results">
            <div className="search-results-header">
              <span className="search-results-count">
                Found {results.length} {results.length === 1 ? 'member' : 'members'}
              </span>
            </div>
            {results.map((user) => (
              <UserCard key={user._id} user={user} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

