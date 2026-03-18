import Schedule from '@/models/Schedule';

const scheduleController = {
  async createSchedule({ enrollment_type, year_level, schedule_date, start_time, end_time }) {
    return await Schedule.create({ enrollment_type, year_level, schedule_date, start_time, end_time });
  },

  async updateSchedule(id, updates) {
    return await Schedule.update(id, updates);
  },

  async deleteSchedule(id) {
    return await Schedule.delete(id);
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
