import Schedule from '@/models/Schedule';
import QueueConfig from '@/models/QueueConfig';

const scheduleController = {
  async createSchedule({ course_id, enrollment_type, year_level, schedule_date, start_time, end_time }) {
    const schedule = await Schedule.create({ course_id, enrollment_type, year_level, schedule_date, start_time, end_time });
    
    // Automatically initialize an empty queue configuration for this schedule
    // so that the admin can manage the queue (e.g. toggle active) before any students join
    await QueueConfig.getOrCreate(schedule.id, course_id, year_level, enrollment_type);
    
    return schedule;
  },

  async updateSchedule(id, updates) {
    return await Schedule.update(id, updates);
  },

  async deleteSchedule(id) {
    return await Schedule.delete(id);
  },

  async deleteAllSchedules() {
    return await Schedule.deleteAll();
  },

  async getAllSchedules() {
    return await Schedule.getAll();
  },

  async getActiveSchedules() {
    return await Schedule.getActive();
  },

  async getScheduleMatrix() {
    const schedules = await Schedule.getAll();

    // Group by date, then by enrollment_type, then by time slot
    const matrix = {};
    schedules.forEach(schedule => {
      const dateKey = schedule.schedule_date;
      if (!matrix[dateKey]) matrix[dateKey] = {};
      if (!matrix[dateKey][schedule.enrollment_type]) matrix[dateKey][schedule.enrollment_type] = [];
      matrix[dateKey][schedule.enrollment_type].push(schedule);
    });

    return matrix;
  }
};

export default scheduleController;
