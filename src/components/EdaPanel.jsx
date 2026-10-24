import { useState, useEffect, useRef, useCallback, useContext } from 'react';
import {
  Activity,
  Radio,
  ListChecks,
  BarChart3,
  Download,
  Play,
  AlertTriangle,
  RefreshCw,
  Trash2,
  X,
  Plug,
  PlugZap,
  Cpu
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { API_URLS } from '../config';
import './EdaPanel.css';

const TABS = [
  { id: 'stream', label: 'Live Stream', icon: Radio },
  { id: 'jobs', label: 'Async Jobs', icon: ListChecks },
  { id: 'telemetry', label: 'Telemetry & Stats', icon: BarChart3 }
];

const MAX_VISIBLE_EVENTS = 200;

const topicColor = (topic = '') => {
  if (topic.startsWith('task:')) return 'topic-task';
  if (topic.startsWith('job:completed')) return 'topic-ok';
  if (topic.startsWith('job:failed') || topic.startsWith('job:dead')) return 'topic-err';
  if (topic.startsWith('job:retry')) return 'topic-warn';
  if (topic.startsWith('job:')) return 'topic-job';
  if (topic.startsWith('notification:')) return 'topic-notif';
  if (topic.startsWith('ai:')) return 'topic-ai';
  return 'topic-default';
};

const statusBadge = (status) => {
  switch (status) {
    case 'completed': return 'job-badge badge-completed';
    case 'failed': return 'job-badge badge-failed';
    case 'running': return 'job-badge badge-running';
    default: return 'job-badge badge-queued';
  }
};

/**
 * Event-Driven Architecture drawer: Live Stream (SSE), Async Jobs, Telemetry.
 */
const EdaPanel = ({ open, onClose, onAuthError, onJobsCompleted }) => {
  const { user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('stream');

  // Live stream state
  const [streamStatus, setStreamStatus] = useState('disconnected'); // disconnected | connecting | connected
  const [events, setEvents] = useState([]);
  const abortRef = useRef(null);

  // Jobs state
  const [jobs, setJobs] = useState([]);
  const [queueStats, setQueueStats] = useState(null);
  const [submittingType, setSubmittingType] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  // Telemetry state
  const [stats, setStats] = useState(null);
  const [dlq, setDlq] = useState([]);

  // Tracks which jobs were already "completed" so we can notify the board once
  const prevCompletedRef = useRef(new Set());

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${user?.token}`
  };

  // ── Live Stream (fetch-based SSE so the Bearer token can be attached) ─────
  const connectStream = useCallback(async () => {
    if (!user?.token) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStreamStatus('connecting');
    try {
      const res = await fetch(`${API_URLS.events}/stream`, {
        headers: { Authorization: `Bearer ${user?.token}` },
        signal: controller.signal
      });
      if (res.status === 401) {
        setStreamStatus('disconnected');
        onAuthError?.();
        return;
      }
      if (!res.ok || !res.body) {
        throw new Error(`Stream error ${res.status}`);
      }

      setStreamStatus('connected');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const dispatchBlock = (block) => {
        let id = null;
        let eventName = 'message';
        let data = '';
        for (const line of block.split('\n')) {
          if (line.startsWith('id:')) id = line.slice(3).trim();
          else if (line.startsWith('event:')) eventName = line.slice(6).trim();
          else if (line.startsWith('data:')) data += line.slice(5).trim();
        }
        if (!data) return; // heartbeat comment / keep-alive
        try {
          const parsed = JSON.parse(data);
          setEvents((prev) => {
            const next = [...prev, { ...parsed, id: parsed.id || id, transportEvent: eventName }];
            return next.length > MAX_VISIBLE_EVENTS ? next.slice(-MAX_VISIBLE_EVENTS) : next;
          });
        } catch {
          /* ignore non-JSON frames */
        }
      };

      // Read until the server closes the connection
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          dispatchBlock(block);
        }
      }
      setStreamStatus('disconnected');
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[EdaPanel] SSE error:', err);
      }
      setStreamStatus('disconnected');
    }
  }, [user, onAuthError]);

  const disconnectStream = () => {
    abortRef.current?.abort();
    setStreamStatus('disconnected');
  };

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      setStreamStatus('disconnected');
      return undefined;
    }
    if (activeTab === 'stream') {
      connectStream();
    }
    return () => abortRef.current?.abort();
  }, [open, activeTab, connectStream]);

  // ── Jobs ──────────────────────────────────────────────────────────────────
  const fetchJobs = useCallback(async () => {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user?.token}`
    };
    try {
      const res = await fetch(API_URLS.jobs, { headers });
      if (res.status === 401) { onAuthError?.(); return; }
      const data = await res.json();
      if (data.success) {
        const prev = prevCompletedRef.current;
        const newlyCompleted = data.data.filter(
          (j) => j.status === 'completed' && !prev.has(j.id)
        );
        prevCompletedRef.current = new Set(
          data.data.filter((j) => j.status === 'completed').map((j) => j.id)
        );
        setJobs(data.data);
        setQueueStats(data.queue || null);
        if (newlyCompleted.length > 0) onJobsCompleted?.(newlyCompleted);
      }
    } catch (err) {
      console.error('[EdaPanel] Failed to fetch jobs:', err);
    }
  }, [user, onAuthError, onJobsCompleted]);

  const fetchStats = useCallback(async () => {
    const headers = { Authorization: `Bearer ${user?.token}` };
    try {
      const res = await fetch(`${API_URLS.events}/stats`, { headers });
      if (res.status === 401) { onAuthError?.(); return; }
      const data = await res.json();
      if (data.success) setStats(data.data);
    } catch (err) {
      console.error('[EdaPanel] Failed to fetch stats:', err);
    }
    try {
      const res = await fetch(`${API_URLS.events}/dlq`, { headers });
      const data = await res.json();
      if (data.success) setDlq(data.data);
    } catch { /* dlq is best-effort */ }
  }, [user, onAuthError]);

  useEffect(() => {
    if (!open) return undefined;
    if (activeTab === 'jobs') {
      fetchJobs();
      const timer = setInterval(fetchJobs, 2000);
      return () => clearInterval(timer);
    }
    if (activeTab === 'telemetry') {
      fetchStats();
      const timer = setInterval(fetchStats, 5000);
      return () => clearInterval(timer);
    }
    return undefined;
  }, [open, activeTab, fetchJobs, fetchStats]);

  const submitJob = async (type) => {
    setSubmittingType(type);
    try {
      const res = await fetch(API_URLS.jobs, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ type })
      });
      if (res.status === 401) { onAuthError?.(); return; }
      const data = await res.json();
      if (!data.success) {
        alert(data.message || 'Failed to submit job');
      }
      fetchJobs();
    } catch {
      alert('Failed to submit job');
    } finally {
      setSubmittingType(null);
    }
  };

  const downloadArtifact = async (job) => {
    setDownloadingId(job.id);
    try {
      const res = await fetch(`${API_URLS.jobs}/${job.id}/artifact`, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = job.artifact?.filename || `job-${job.id}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Artifact download failed: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  if (!open) return null;

  return (
    <div className="eda-drawer-backdrop" onClick={onClose}>
      <aside className="eda-drawer" onClick={(e) => e.stopPropagation()}>
        <header className="eda-header">
          <div className="eda-title-group">
            <Activity size={20} className="eda-title-icon" />
            <div>
              <h2>Event-Driven Architecture</h2>
              <p>Live SSE stream, background jobs &amp; telemetry</p>
            </div>
          </div>
          <button className="eda-close" onClick={onClose} title="Close panel">
            <X size={20} />
          </button>
        </header>

        <nav className="eda-tabs">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`eda-tab ${activeTab === id ? 'active' : ''}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={15} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {/* ── Live Stream Tab ──────────────────────────────────────────── */}
        {activeTab === 'stream' && (
          <section className="eda-body">
            <div className="stream-toolbar">
              <div className={`stream-status status-${streamStatus}`}>
                {streamStatus === 'connected' ? <PlugZap size={14} /> : <Plug size={14} />}
                <span>
                  {streamStatus === 'connected'
                    ? 'SSE connected'
                    : streamStatus === 'connecting'
                      ? 'Connecting…'
                      : 'Disconnected'}
                </span>
              </div>
              <span className="event-count">{events.length} events</span>
              <div className="stream-actions">
                <button className="eda-btn" onClick={() => setEvents([])} disabled={events.length === 0}>
                  <Trash2 size={13} /> Clear
                </button>
                {streamStatus === 'connected' ? (
                  <button className="eda-btn" onClick={disconnectStream}>Disconnect</button>
                ) : (
                  <button className="eda-btn primary" onClick={connectStream}>
                    <RefreshCw size={13} /> Reconnect
                  </button>
                )}
              </div>
            </div>

            <div className="event-stream-list">
              {events.length === 0 ? (
                <div className="eda-empty">
                  <Radio size={28} />
                  <p>
                    {streamStatus === 'connected'
                      ? 'Connected and waiting for events… perform any task action to see events appear.'
                      : 'Stream is not connected. Click Reconnect to start listening.'}
                  </p>
                </div>
              ) : (
                [...events].reverse().map((event) => (
                  <div key={`${event.id}-${event.timestamp}`} className={`event-row ${topicColor(event.topic)}`}>
                    <span className="event-id">#{event.id}</span>
                    <span className="event-topic">{event.topic}</span>
                    <span className="event-time">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="event-payload">
                      {JSON.stringify(event.payload)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* ── Async Jobs Tab ───────────────────────────────────────────── */}
        {activeTab === 'jobs' && (
          <section className="eda-body">
            <div className="jobs-actions">
              <button
                className="job-submit-btn export"
                onClick={() => submitJob('csv-export')}
                disabled={submittingType !== null}
              >
                <Download size={14} />
                {submittingType === 'csv-export' ? 'Accepting…' : 'Export Tasks CSV'}
              </button>
              <button
                className="job-submit-btn retry-demo"
                onClick={() => submitJob('simulate-retry')}
                disabled={submittingType !== null}
              >
                <RefreshCw size={14} /> Simulate Retry
              </button>
              <button
                className="job-submit-btn failure"
                onClick={() => submitJob('simulate-failure')}
                disabled={submittingType !== null}
              >
                <AlertTriangle size={14} /> Simulate Failure
              </button>
            </div>

            {queueStats && (
              <div className="queue-strip">
                <span><strong>{queueStats.total}</strong> total</span>
                <span><strong>{queueStats.queued}</strong> queued</span>
                <span><strong>{queueStats.running}</strong> running</span>
                <span><strong>{queueStats.completed}</strong> done</span>
                <span className="q-failed"><strong>{queueStats.failed}</strong> failed</span>
                <span className="q-dlq"><strong>{queueStats.deadLettered}</strong> DLQ</span>
              </div>
            )}

            <div className="jobs-list">
              {jobs.length === 0 ? (
                <div className="eda-empty">
                  <Cpu size={28} />
                  <p>No jobs yet. Jobs are accepted with HTTP 202 and run in background workers.</p>
                </div>
              ) : (
                jobs.map((job) => (
                  <div key={job.id} className="job-card">
                    <div className="job-card-head">
                      <span className="job-type">{job.type}</span>
                      <span className={statusBadge(job.status)}>{job.status.toUpperCase()}</span>
                    </div>
                    <div className="job-progress-track">
                      <div
                        className={`job-progress-fill ${job.status === 'failed' ? 'fill-failed' : ''}`}
                        style={{ width: `${job.progress || 0}%` }}
                      />
                    </div>
                    <div className="job-meta">
                      <span>{job.progressMessage || '—'}</span>
                      <span>attempt {job.attempts}/{job.maxAttempts}</span>
                      {job.durationMs != null && <span>{job.durationMs}ms</span>}
                    </div>
                    {job.error && <div className="job-error">{job.error}</div>}
                    {job.status === 'completed' && job.artifact && (
                      <button
                        className="job-download-btn"
                        onClick={() => downloadArtifact(job)}
                        disabled={downloadingId === job.id}
                      >
                        <Download size={13} />
                        {downloadingId === job.id ? 'Downloading…' : `Download ${job.artifact.filename}`}
                      </button>
                    )}
                    <div className="job-foot">
                      <span className="job-id">{job.id.slice(0, 8)}</span>
                      {job.requestedBy?.email && <span>by {job.requestedBy.email}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* ── Telemetry Tab ────────────────────────────────────────────── */}
        {activeTab === 'telemetry' && (
          <section className="eda-body">
            <div className="telemetry-toolbar">
              <span>Auto-refreshes every 5s</span>
              <button className="eda-btn" onClick={fetchStats}>
                <RefreshCw size={13} /> Refresh
              </button>
            </div>

            {!stats ? (
              <div className="eda-empty"><BarChart3 size={28} /><p>Loading telemetry…</p></div>
            ) : (
              <>
                <div className="telemetry-grid">
                  <div className="telemetry-card">
                    <span className="t-label">Events emitted</span>
                    <span className="t-value">{stats.totalEventsEmitted}</span>
                  </div>
                  <div className="telemetry-card">
                    <span className="t-label">Avg job duration</span>
                    <span className="t-value">{stats.avgJobDurationMs}<small>ms</small></span>
                  </div>
                  <div className="telemetry-card">
                    <span className="t-label">Notifications sent</span>
                    <span className="t-value">{stats.notificationsSent}</span>
                  </div>
                  <div className="telemetry-card">
                    <span className="t-label">DLQ count</span>
                    <span className="t-value t-danger">{stats.deadLetterCount}</span>
                  </div>
                </div>

                <h3 className="telemetry-section-title">Subscriber bindings</h3>
                <table className="listener-table">
                  <thead>
                    <tr><th>Event topic</th><th>Listeners</th><th>Emitted</th></tr>
                  </thead>
                  <tbody>
                    {Object.entries(stats.listeners).map(([topic, count]) => (
                      <tr key={topic}>
                        <td><code className={topicColor(topic)}>{topic}</code></td>
                        <td>{count}</td>
                        <td>{stats.eventsByTopic[topic] || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {dlq.length > 0 && (
                  <>
                    <h3 className="telemetry-section-title">Dead-letter queue</h3>
                    <div className="dlq-list">
                      {dlq.map((entry) => (
                        <div key={entry.jobId} className="dlq-row">
                          <span className="job-type">{entry.type}</span>
                          <span className="job-error">{entry.error}</span>
                          <span className="job-id">{entry.jobId.slice(0, 8)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div className="how-it-works">
                  <h3><Play size={14} /> How it works</h3>
                  <ul>
                    <li><strong>Non-blocking ingestion:</strong> HTTP handlers publish events and return immediately; subscribers react independently.</li>
                    <li><strong>Decoupled subscribers:</strong> the SSE stream, telemetry counters and notification workers never call each other — they only bind to topics on the event bus.</li>
                    <li><strong>Fault isolation:</strong> a failing job retries with exponential backoff and, after max attempts, lands in the DLQ without affecting other jobs or the API.</li>
                  </ul>
                </div>
              </>
            )}
          </section>
        )}
      </aside>
    </div>
  );
};

export default EdaPanel;
