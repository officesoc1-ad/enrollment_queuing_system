import QueueEntry from '@/models/QueueEntry';
import QueueConfig from '@/models/QueueConfig';
import Schedule from '@/models/Schedule';

const queueController = {
  async registerStudent({ schedule_id, course_id, year_level, enrollment_type, student_name, student_id }) {
    // Validate schedule exists
    const schedule = await Schedule.getById(schedule_id);
    if (!schedule) throw new Error('Schedule not found');

    // Create queue entry (auto-assigns queue number)
    const entry = await QueueEntry.create({
      schedule_id,
      course_id,
      year_level,
      enrollment_type,
      student_name,
      student_id
    });

    // Ensure queue config exists for this group
    await QueueConfig.getOrCreate(schedule_id, course_id, year_level, enrollment_type);

    return entry;
  },

  async callNext(configId, count = 1) {
    const config = await QueueConfig.getById(configId);
    if (!config) throw new Error('Queue config not found');

    // Fetch up to `count` waiting entries
    const waitingEntries = await QueueEntry.getNextNWaiting(
      config.schedule_id,
      config.course_id,
      config.year_level,
      config.enrollment_type,
      count
    );

    if (waitingEntries.length === 0) return { message: 'No more students waiting', config, called: 0 };

    // Set all fetched entries to 'serving' in parallel
    const updatedEntries = await Promise.all(
      waitingEntries.map(entry => QueueEntry.updateStatus(entry.id, 'serving'))
    );

    // Update current_serving to the highest queue number called
    const lastEntry = waitingEntries[waitingEntries.length - 1];
    await QueueConfig.updateCurrentServing(configId, lastEntry.queue_number);

    return { entries: updatedEntries, config, called: updatedEntries.length };
  },

  async skipCurrent(entryId) {
    const updated = await QueueEntry.updateStatus(entryId, 'skipped');
    return updated;
  },

  async completeCurrent(entryId) {
    const updated = await QueueEntry.updateStatus(entryId, 'completed');
    return updated;
  },

  async getStudentStatus(entryId) {
    const positionData = await QueueEntry.getPositionInQueue(entryId);
    if (!positionData) throw new Error('Queue entry not found');

    const { entry, position, aheadCount } = positionData;

    // Get the queue config for current serving info
    const config = await QueueConfig.getOrCreate(
      entry.schedule_id,
      entry.course_id,
      entry.year_level,
      entry.enrollment_type
    );

    return {
      entry,
      position,
      aheadCount,
      currentServing: config.current_serving
    };
  },

  async getAllQueues() {
    const configs = await QueueConfig.getAll();

    const queues = await Promise.all(
      configs.map(async (config) => {
        const counts = await QueueEntry.getCountByStatus(
          config.schedule_id,
          config.course_id,
          config.year_level,
          config.enrollment_type
        );
        return { ...config, counts };
      })
    );

    return queues;
  }
};

export default queueController;
