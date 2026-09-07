import React, { useEffect, useMemo, useRef } from 'react';
import { 
  Activity, 
  Tv, 
  Volume2, 
  Clock 
} from 'lucide-react';
import { sortQueue, formatToken, formatPrivacyName } from '../services/queueService';

export const WaitingRoom = ({ queue, doctors }) => {
  const previousCalledTokenRef = useRef(null);

  // Active sorted queue list (First-Come-First-Served order)
  const activeQueue = useMemo(() => {
    return sortQueue(queue.filter(e => e.status !== 'completed' && e.status !== 'cancelled' && e.status !== 'no_show'), 'asc');
  }, [queue]);

  // Currently being called patient (status === 'called')
  const nowServing = useMemo(() => {
    return activeQueue.find(e => e.status === 'called');
  }, [activeQueue]);

  // Upcoming waiting list
  const upNext = useMemo(() => {
    return activeQueue.filter(e => e.status === 'waiting').slice(0, 5);
  }, [activeQueue]);

  // Get Room & Doctor Info for Now Serving
  const servingInfo = useMemo(() => {
    if (!nowServing) return null;
    const doc = doctors.find(d => d.id === nowServing.doctor_id);
    return {
      token: formatToken(nowServing.token_number),
      name: formatPrivacyName(nowServing.patient?.full_name),
      doctor: doc?.full_name || 'General Doctor',
      room: doc?.room_number || 'Room 1'
    };
  }, [nowServing, doctors]);

  // Text-to-Speech Announcement when a patient is called
  useEffect(() => {
    if (servingInfo && servingInfo.token !== previousCalledTokenRef.current) {
      previousCalledTokenRef.current = servingInfo.token;
      
      // Announce token voice chime
      const playAnnouncement = () => {
        if ('speechSynthesis' in window) {
          // Cancel active speech
          window.speechSynthesis.cancel();
          
          const text = `Token ${nowServing.token_number}, ${servingInfo.name}, please proceed to ${servingInfo.room}`;
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 0.9;
          utterance.pitch = 1.0;
          
          // Select a professional sounding English voice if available
          const voices = window.speechSynthesis.getVoices();
          const preferredVoice = voices.find(v => v.lang.includes('en') && v.name.includes('Google'));
          if (preferredVoice) utterance.voice = preferredVoice;

          window.speechSynthesis.speak(utterance);
        }
      };

      // Delay speech slightly to let display transition
      const timer = setTimeout(playAnnouncement, 500);
      return () => clearTimeout(timer);
    }
    
    // Clear serving token ref if nobody is being called
    if (!nowServing) {
      previousCalledTokenRef.current = null;
    }
  }, [servingInfo, nowServing]);

  // Digital clock state
  const [time, setTime] = React.useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="waiting-room-fullscreen">
      {/* Left Panel: NOW SERVING (TV Highlight) */}
      <div className="waiting-room-left">
        <div style={{ position: 'absolute', top: '24px', left: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={24} style={{ color: '#3b82f6' }} />
          <span style={{ fontSize: '1.25rem', fontWeight: '700', letterSpacing: '-0.02em' }}>MedClinic</span>
        </div>

        {servingInfo ? (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span className="serving-banner">Now Serving</span>
            <div className="serving-token">{servingInfo.token}</div>
            <div className="serving-patient">{servingInfo.name}</div>
            <div className="serving-room">Proceed to {servingInfo.room}</div>
            <div style={{ fontSize: '1rem', color: '#6b7280', marginTop: '16px' }}>
              Assigned Physician: {servingInfo.doctor}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <Tv size={64} style={{ color: '#374151' }} />
            <h2 style={{ color: '#9ca3af' }}>Waiting Room Board</h2>
            <p style={{ color: '#6b7280', maxWidth: '300px' }}>
              No patient is currently being called. Please keep your token ready.
            </p>
          </div>
        )}

        <div style={{ position: 'absolute', bottom: '24px', left: '24px', display: 'flex', alignItems: 'center', gap: '8px', color: '#9ca3af', fontSize: '0.95rem' }}>
          <Volume2 size={16} />
          <span>Automatic voice announcements enabled</span>
        </div>
      </div>

      {/* Right Panel: UP NEXT (Waitlist Queue) */}
      <div className="waiting-room-right">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <h2 className="up-next-title" style={{ margin: 0, border: 'none', padding: 0 }}>Up Next</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9ca3af', fontSize: '1.1rem', backgroundColor: '#111827', padding: '8px 16px', borderRadius: '8px' }}>
            <Clock size={16} />
            <span>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
        </div>

        {upNext.length === 0 ? (
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            color: '#4b5563', 
            fontSize: '1.25rem',
            border: '2px dashed #1f2937',
            borderRadius: '16px',
            margin: '20px 0'
          }}>
            Queue is clear.
          </div>
        ) : (
          <div className="up-next-list">
            {upNext.map((entry) => {
              const doc = doctors.find(d => d.id === entry.doctor_id);
              return (
                <div key={entry.id} className="up-next-row animate-fade-in">
                  <span className="up-next-token">{formatToken(entry.token_number)}</span>
                  <span className="up-next-name">{formatPrivacyName(entry.patient?.full_name)}</span>
                  <span className="up-next-doctor">
                    {doc?.room_number || 'Room 1'}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 'auto', textAlign: 'center', color: '#4b5563', fontSize: '0.85rem' }}>
          Please contact front desk if your token number is not displayed.
        </div>
      </div>
    </div>
  );
};

export default WaitingRoom;
