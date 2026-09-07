/**
 * Reusable Queue Service and Smart Queue Algorithms
 */

// Status priority order for display and calling
const STATUS_PRIORITY = {
  'in_consultation': 1,
  'called': 2,
  'waiting': 3,
  'no_show': 4,
  'completed': 5,
  'cancelled': 6
};

/**
 * Smart Queue Sorting Algorithm
 * 
 * Rules:
 * 1. Active statuses (IN_CONSULTATION, CALLED, WAITING) go first.
 * 2. Within active states:
 *    - Walk-ins: effective sort time is their arrival_time.
 *    - Appointments: effective sort time is max(scheduled_time, arrival_time).
 *      This respects their scheduled slot, but if they arrive late, they slip
 *      behind patients who arrived/were scheduled prior to their arrival.
 * 3. Patients who are CALLED are prioritized at the top of the queue list for easy actioning.
 * 
 * @param {Array} queueEntries - The list of queue entries for today
 * @returns {Array} - The sorted queue list
 */
export const sortQueue = (queueEntries, order = 'asc') => {
  if (!queueEntries || !Array.isArray(queueEntries)) return [];

  return [...queueEntries].sort((a, b) => {
    // Sort by status order first
    const aPriority = STATUS_PRIORITY[a.status] || 99;
    const bPriority = STATUS_PRIORITY[b.status] || 99;

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    // If both have the same status, sort by effective priority time
    const getEffectiveTime = (entry) => {
      let time = 0;
      if (entry?.arrival_time) {
        time = new Date(entry.arrival_time).getTime();
      } else if (entry?.created_at) {
        time = new Date(entry.created_at).getTime();
      }

      if (isNaN(time) || time <= 0) {
        time = Date.now();
      }

      if (entry?.visit_type === 'appointment') {
        let scheduledDateStr = new Date().toISOString().split('T')[0];
        let scheduledTimeStr = '00:00';

        if (entry.appointment) {
          scheduledDateStr = entry.appointment.appointment_date || scheduledDateStr;
          scheduledTimeStr = entry.appointment.appointment_time || scheduledTimeStr;
        } else if (entry.appointment_time) {
          scheduledTimeStr = entry.appointment_time;
        }

        const scheduled = new Date(`${scheduledDateStr}T${scheduledTimeStr}`).getTime();
        if (!isNaN(scheduled) && scheduled > 0) {
          return Math.max(scheduled, time);
        }
      }

      return time;
    };

    const timeA = getEffectiveTime(a);
    const timeB = getEffectiveTime(b);

    const diff = order === 'desc' ? timeB - timeA : timeA - timeB;

    if (!isNaN(diff) && diff !== 0) return diff;

    // Fallback tie-breaker by token number
    const tokenA = Number(a.token_number) || 0;
    const tokenB = Number(b.token_number) || 0;
    return order === 'desc' ? tokenB - tokenA : tokenA - tokenB;
  });
};

/**
 * Calculates the estimated wait time for a patient in the queue.
 * 
 * Formula:
 * - Filter sorted queue for the same doctor.
 * - Count how many patients in 'waiting' state are ahead of this patient.
 * - Wait time = count * avgConsultationDuration.
 * 
 * @param {Array} sortedQueue - Already sorted queue entries
 * @param {string} entryId - The queue entry ID of the patient
 * @param {number} avgConsultationDuration - Average consultation length in minutes
 * @returns {string} - Human-readable estimated wait time
 */
export const getEstimatedWaitTime = (sortedQueue, entryId, avgConsultationDuration = 10) => {
  const targetEntry = sortedQueue.find(e => e.id === entryId);
  if (!targetEntry || targetEntry.status !== 'waiting') return '0 min';

  const doctorId = targetEntry.doctor_id;
  
  // Find doctor's queue entries in waiting state
  const docWaitingQueue = sortedQueue.filter(
    e => e.doctor_id === doctorId && e.status === 'waiting'
  );

  // Find index of our target entry in this doctor's waiting list
  const index = docWaitingQueue.findIndex(e => e.id === entryId);
  
  if (index === -1) return '0 min';

  const mins = index * avgConsultationDuration;
  return mins === 0 ? 'Next' : `~${mins} min`;
};

/**
 * Validates a status transition in the queue lifecycle.
 * 
 * Permitted transitions:
 * WAITING -> CALLED
 * WAITING -> NO_SHOW
 * WAITING -> CANCELLED
 * CALLED -> IN_CONSULTATION
 * CALLED -> NO_SHOW
 * CALLED -> WAITING (recall/re-queue fallback)
 * IN_CONSULTATION -> COMPLETED
 * 
 * @param {string} currentStatus 
 * @param {string} nextStatus 
 * @returns {boolean}
 */
export const isValidTransition = (currentStatus, nextStatus) => {
  const allowed = {
    'waiting': ['called', 'no_show', 'cancelled'],
    'called': ['in_consultation', 'no_show', 'waiting'],
    'in_consultation': ['completed'],
    'completed': [],
    'no_show': ['waiting', 'cancelled'],
    'cancelled': []
  };

  const targets = allowed[currentStatus.toLowerCase()] || [];
  return targets.includes(nextStatus.toLowerCase());
};

/**
 * Generates the daily token number.
 * 
 * @param {Array} todayEntries - All entries created today
 * @returns {number} - The next token number (e.g. 1, 2, 3...)
 */
export const getNextToken = (todayEntries) => {
  if (!todayEntries || todayEntries.length === 0) return 1;
  const tokens = todayEntries.map(e => Number(e.token_number) || 0);
  return Math.max(...tokens, 0) + 1;
};

/**
 * Formats token numbers to a standard clinic display format (e.g., T001, T023).
 * 
 * @param {number|string} token - The raw token number
 * @returns {string} - Formatted token string
 */
export const formatToken = (token) => {
  const num = Number(token);
  if (isNaN(num)) return token;
  return `T${String(num).padStart(3, '0')}`;
};

/**
 * Formats privacy-safe patient names (e.g. "Rahul Sen" -> "Rahul S.")
 * 
 * @param {string} fullName - Full patient name
 * @returns {string} - Privacy-safe abbreviated name
 */
export const formatPrivacyName = (fullName) => {
  if (!fullName) return '';
  const parts = fullName.trim().split(' ');
  if (parts.length <= 1) return fullName;
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1][0].toUpperCase();
  return `${firstName} ${lastInitial}.`;
};
