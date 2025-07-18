const Employee = require('../models/Employee');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Attendance = require('../models/Attendance');

// Helper function to handle async errors
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

// Helper function for API features
class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  filter() {
    const queryObj = { ...this.queryString };
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach(el => delete queryObj[el]);

    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);

    this.query = this.query.find(JSON.parse(queryStr));
    return this;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt');
    }
    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v');
    }
    return this;
  }

  paginate() {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 100;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);
    return this;
  }
}

// Create new employee
const createEmployee = catchAsync(async (req, res, next) => {
  const {
    userId,
    employeeId,
    position,
    department,
    hireDate,
    salary,
    commissionRate,
    workSchedule,
    specializations,
    certifications,
    skills,
    languages
  } = req.body;

  // Check if user exists and is not already an employee
  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const existingEmployee = await Employee.findOne({ user: userId });
  if (existingEmployee) {
    return res.status(400).json({
      success: false,
      message: 'User is already an employee'
    });
  }

  // Check if employee ID is unique
  const existingEmployeeId = await Employee.findOne({ employeeId });
  if (existingEmployeeId) {
    return res.status(400).json({
      success: false,
      message: 'Employee ID already exists'
    });
  }

  // Create employee
  const employee = await Employee.create({
    user: userId,
    employeeId,
    position,
    department,
    hireDate,
    salary,
    commissionRate,
    workSchedule,
    specializations,
    certifications,
    skills,
    languages
  });

  // Update user role to employee
  await User.findByIdAndUpdate(userId, { role: 'employee' });

  res.status(201).json({
    success: true,
    message: 'Employee created successfully',
    data: {
      employee
    }
  });
});

// Get all employees
const getAllEmployees = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(Employee.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const employees = await features.query;

  res.status(200).json({
    success: true,
    results: employees.length,
    data: {
      employees
    }
  });
});

// Get single employee
const getEmployee = catchAsync(async (req, res, next) => {
  const employee = await Employee.findById(req.params.id);

  if (!employee) {
    return res.status(404).json({
      success: false,
      message: 'No employee found with that ID'
    });
  }

  // Check if user can access this employee data
  if (req.user.role === 'employee') {
    const currentEmployee = await Employee.findOne({ user: req.user._id });
    if (currentEmployee._id.toString() !== employee._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only access your own employee data'
      });
    }
  }

  res.status(200).json({
    success: true,
    data: {
      employee
    }
  });
});

// Update employee
const updateEmployee = catchAsync(async (req, res, next) => {
  const employee = await Employee.findById(req.params.id);

  if (!employee) {
    return res.status(404).json({
      success: false,
      message: 'No employee found with that ID'
    });
  }

  // Check if user can update this employee
  if (req.user.role === 'employee') {
    const currentEmployee = await Employee.findOne({ user: req.user._id });
    if (currentEmployee._id.toString() !== employee._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own employee data'
      });
    }

    // Limit fields that employees can update
    const allowedFields = [
      'workSchedule', 'specializations', 'certifications', 'skills', 
      'languages', 'availability', 'emergencyContact', 'bankDetails'
    ];
    const filteredBody = {};
    Object.keys(req.body).forEach(el => {
      if (allowedFields.includes(el)) {
        filteredBody[el] = req.body[el];
      }
    });
    req.body = filteredBody;
  }

  const updatedEmployee = await Employee.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    message: 'Employee updated successfully',
    data: {
      employee: updatedEmployee
    }
  });
});

// Delete/Deactivate employee
const deleteEmployee = catchAsync(async (req, res, next) => {
  const employee = await Employee.findById(req.params.id);

  if (!employee) {
    return res.status(404).json({
      success: false,
      message: 'No employee found with that ID'
    });
  }

  // Check for active bookings
  const activeBookings = await Booking.find({
    'services.employee': employee._id,
    status: { $in: ['confirmed', 'pending', 'in-progress'] }
  });

  if (activeBookings.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Cannot deactivate employee with active bookings'
    });
  }

  // Deactivate employee
  employee.isActive = false;
  employee.terminationDate = new Date();
  employee.terminationReason = req.body.reason || 'Terminated by admin';
  await employee.save();

  // Update user role back to client
  await User.findByIdAndUpdate(employee.user, { role: 'client' });

  res.status(200).json({
    success: true,
    message: 'Employee deactivated successfully',
    data: null
  });
});

// Get employee schedule
const getEmployeeSchedule = catchAsync(async (req, res, next) => {
  const { startDate, endDate } = req.query;
  const employeeId = req.params.id;

  const employee = await Employee.findById(employeeId);
  if (!employee) {
    return res.status(404).json({
      success: false,
      message: 'Employee not found'
    });
  }

  // Check if user can access this employee's schedule
  if (req.user.role === 'employee') {
    const currentEmployee = await Employee.findOne({ user: req.user._id });
    if (currentEmployee._id.toString() !== employeeId) {
      return res.status(403).json({
        success: false,
        message: 'You can only access your own schedule'
      });
    }
  }

  // Get bookings for the date range
  const bookings = await Booking.find({
    'services.employee': employeeId,
    appointmentDate: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    },
    status: { $in: ['confirmed', 'pending', 'in-progress'] }
  }).populate('client', 'firstName lastName phone')
    .populate('services.service', 'name duration');

  // Get attendance records
  const attendance = await Attendance.find({
    employee: employeeId,
    date: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  });

  res.status(200).json({
    success: true,
    data: {
      workSchedule: employee.workSchedule,
      bookings,
      attendance,
      unavailableDates: employee.availability.unavailableDates
    }
  });
});

// Get employee performance
const getEmployeePerformance = catchAsync(async (req, res, next) => {
  const employeeId = req.params.id;

  const employee = await Employee.findById(employeeId);
  if (!employee) {
    return res.status(404).json({
      success: false,
      message: 'Employee not found'
    });
  }

  // Check if user can access this employee's performance
  if (req.user.role === 'employee') {
    const currentEmployee = await Employee.findOne({ user: req.user._id });
    if (currentEmployee._id.toString() !== employeeId) {
      return res.status(403).json({
        success: false,
        message: 'You can only access your own performance data'
      });
    }
  }

  // Get booking statistics
  const bookingStats = await Booking.aggregate([
    { $unwind: '$services' },
    { $match: { 'services.employee': mongoose.Types.ObjectId(employeeId) } },
    {
      $group: {
        _id: '$services.status',
        count: { $sum: 1 },
        revenue: { $sum: '$services.price' }
      }
    }
  ]);

  // Get monthly performance
  const monthlyPerformance = await Booking.aggregate([
    { $unwind: '$services' },
    { 
      $match: { 
        'services.employee': mongoose.Types.ObjectId(employeeId),
        createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
      } 
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        bookings: { $sum: 1 },
        revenue: { $sum: '$services.price' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  // Get attendance statistics
  const attendanceStats = await Attendance.aggregate([
    { 
      $match: { 
        employee: mongoose.Types.ObjectId(employeeId),
        date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      } 
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalHours: { $sum: '$actualHours' },
        totalOvertimeHours: { $sum: '$overtimeHours' }
      }
    }
  ]);

  res.status(200).json({
    success: true,
    data: {
      performance: employee.performance,
      bookingStats,
      monthlyPerformance,
      attendanceStats
    }
  });
});

// Update employee availability
const updateEmployeeAvailability = catchAsync(async (req, res, next) => {
  const employeeId = req.params.id;
  const { isAvailable, unavailableDates } = req.body;

  const employee = await Employee.findById(employeeId);
  if (!employee) {
    return res.status(404).json({
      success: false,
      message: 'Employee not found'
    });
  }

  // Check if user can update this employee's availability
  if (req.user.role === 'employee') {
    const currentEmployee = await Employee.findOne({ user: req.user._id });
    if (currentEmployee._id.toString() !== employeeId) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own availability'
      });
    }
  }

  employee.availability.isAvailable = isAvailable;
  if (unavailableDates) {
    employee.availability.unavailableDates = unavailableDates;
  }

  await employee.save();

  res.status(200).json({
    success: true,
    message: 'Availability updated successfully',
    data: {
      availability: employee.availability
    }
  });
});

// Get available employees for a service and time slot
const getAvailableEmployees = catchAsync(async (req, res, next) => {
  const { serviceId, startTime, endTime } = req.query;

  if (!serviceId || !startTime || !endTime) {
    return res.status(400).json({
      success: false,
      message: 'Service ID, start time, and end time are required'
    });
  }

  // Find employees who can perform this service
  const service = await Service.findById(serviceId);
  if (!service) {
    return res.status(404).json({
      success: false,
      message: 'Service not found'
    });
  }

  // Get employees who are available and can perform the service
  const availableEmployees = await Employee.find({
    _id: { $in: service.availableEmployees },
    isActive: true,
    'availability.isAvailable': true
  });

  // Filter out employees with conflicting bookings
  const conflictFreeEmployees = [];
  
  for (const employee of availableEmployees) {
    const conflictingBooking = await Booking.findOne({
      'services.employee': employee._id,
      'services.startTime': { $lt: new Date(endTime) },
      'services.endTime': { $gt: new Date(startTime) },
      status: { $in: ['confirmed', 'pending', 'in-progress'] }
    });

    if (!conflictingBooking) {
      conflictFreeEmployees.push(employee);
    }
  }

  res.status(200).json({
    success: true,
    results: conflictFreeEmployees.length,
    data: {
      employees: conflictFreeEmployees
    }
  });
});

// Search employees
const searchEmployees = catchAsync(async (req, res, next) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({
      success: false,
      message: 'Search query is required'
    });
  }

  const employees = await Employee.find({
    $or: [
      { employeeId: { $regex: q, $options: 'i' } },
      { position: { $regex: q, $options: 'i' } },
      { department: { $regex: q, $options: 'i' } },
      { specializations: { $in: [new RegExp(q, 'i')] } }
    ]
  }).populate('user', 'firstName lastName email').limit(20);

  res.status(200).json({
    success: true,
    results: employees.length,
    data: {
      employees
    }
  });
});

// Get employee's own schedule dashboard
const getMySchedule = catchAsync(async (req, res, next) => {
  // Find employee record for the logged-in user
  const employee = await Employee.findOne({ user: req.user._id });
  
  if (!employee) {
    return res.status(404).json({
      success: false,
      message: 'Employee record not found'
    });
  }

  // Get upcoming appointments assigned to this employee
  const upcomingBookings = await Booking.find({
    'services.employee': employee._id,
    appointmentDate: { $gte: new Date() },
    status: { $in: ['confirmed', 'pending'] }
  })
  .populate({
    path: 'services.service',
    select: 'name duration price'
  })
  .populate({
    path: 'client',
    select: 'firstName lastName' // Only basic info, no contact details
  })
  .sort({ appointmentDate: 1, 'services.startTime': 1 })
  .limit(50);

  // Format the response to hide sensitive client information
  const formattedBookings = upcomingBookings.map(booking => ({
    _id: booking._id,
    bookingNumber: booking.bookingNumber,
    appointmentDate: booking.appointmentDate,
    status: booking.status,
    services: booking.services.map(service => ({
      _id: service._id,
      service: {
        name: service.service.name,
        duration: service.service.duration,
        price: service.price
      },
      startTime: service.startTime,
      endTime: service.endTime,
      status: service.status
    })),
    client: {
      firstName: booking.client.firstName,
      lastName: booking.client.lastName
      // No email, phone, or other contact details
    },
    totalDuration: booking.totalDuration,
    totalAmount: booking.totalAmount
  }));

  res.status(200).json({
    success: true,
    results: formattedBookings.length,
    data: {
      employee: {
        _id: employee._id,
        employeeId: employee.employeeId,
        position: employee.position,
        department: employee.department
      },
      upcomingAppointments: formattedBookings
    }
  });
});

// Get employee's own attendance record
const getMyAttendance = catchAsync(async (req, res, next) => {
  const { startDate, endDate } = req.query;
  
  // Find employee record for the logged-in user
  const employee = await Employee.findOne({ user: req.user._id });
  
  if (!employee) {
    return res.status(404).json({
      success: false,
      message: 'Employee record not found'
    });
  }

  // Build date filter
  const dateFilter = {};
  if (startDate) {
    dateFilter.date = { $gte: new Date(startDate) };
  }
  if (endDate) {
    dateFilter.date = { ...dateFilter.date, $lte: new Date(endDate) };
  }

  const attendance = await Attendance.find({
    employee: employee._id,
    ...dateFilter
  })
  .sort({ date: -1 })
  .limit(30);

  res.status(200).json({
    success: true,
    results: attendance.length,
    data: {
      attendance
    }
  });
});

// Mark check-in
const checkIn = catchAsync(async (req, res, next) => {
  // Find employee record for the logged-in user
  const employee = await Employee.findOne({ user: req.user._id });
  
  if (!employee) {
    return res.status(404).json({
      success: false,
      message: 'Employee record not found'
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if already checked in today
  const existingAttendance = await Attendance.findOne({
    employee: employee._id,
    date: today
  });

  if (existingAttendance && existingAttendance.checkIn) {
    return res.status(400).json({
      success: false,
      message: 'Already checked in today'
    });
  }

  if (existingAttendance) {
    // Update existing record
    existingAttendance.checkIn = new Date();
    await existingAttendance.save();
  } else {
    // Create new attendance record
    await Attendance.create({
      employee: employee._id,
      date: today,
      checkIn: new Date()
    });
  }

  res.status(200).json({
    success: true,
    message: 'Check-in successful',
    data: {
      checkInTime: new Date()
    }
  });
});

// Mark check-out
const checkOut = catchAsync(async (req, res, next) => {
  // Find employee record for the logged-in user
  const employee = await Employee.findOne({ user: req.user._id });
  
  if (!employee) {
    return res.status(404).json({
      success: false,
      message: 'Employee record not found'
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find today's attendance record
  const attendance = await Attendance.findOne({
    employee: employee._id,
    date: today
  });

  if (!attendance || !attendance.checkIn) {
    return res.status(400).json({
      success: false,
      message: 'No check-in record found for today'
    });
  }

  if (attendance.checkOut) {
    return res.status(400).json({
      success: false,
      message: 'Already checked out today'
    });
  }

  // Calculate working hours
  const checkOutTime = new Date();
  const workingHours = (checkOutTime - attendance.checkIn) / (1000 * 60 * 60);

  attendance.checkOut = checkOutTime;
  attendance.workingHours = Math.round(workingHours * 100) / 100;
  await attendance.save();

  res.status(200).json({
    success: true,
    message: 'Check-out successful',
    data: {
      checkOutTime,
      workingHours: attendance.workingHours
    }
  });
});

// Get employee's own ratings and feedback
const getMyRatings = catchAsync(async (req, res, next) => {
  // Find employee record for the logged-in user
  const employee = await Employee.findOne({ user: req.user._id });
  
  if (!employee) {
    return res.status(404).json({
      success: false,
      message: 'Employee record not found'
    });
  }

  // Get bookings with feedback for this employee
  const bookingsWithFeedback = await Booking.find({
    'services.employee': employee._id,
    'feedback.rating': { $exists: true, $ne: null }
  })
  .populate({
    path: 'client',
    select: 'firstName lastName' // Only basic info
  })
  .select('feedback appointmentDate services.service')
  .populate('services.service', 'name')
  .sort({ 'feedback.submittedAt': -1 })
  .limit(20);

  // Calculate average rating
  const ratings = bookingsWithFeedback.map(booking => booking.feedback.rating);
  const averageRating = ratings.length > 0 
    ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 100) / 100
    : 0;

  // Format feedback to hide sensitive client information
  const formattedFeedback = bookingsWithFeedback.map(booking => ({
    _id: booking._id,
    rating: booking.feedback.rating,
    comment: booking.feedback.comment,
    submittedAt: booking.feedback.submittedAt,
    wouldRecommend: booking.feedback.wouldRecommend,
    service: booking.services[0]?.service?.name || 'Unknown Service',
    appointmentDate: booking.appointmentDate,
    client: {
      firstName: booking.client.firstName,
      lastName: booking.client.lastName
      // No email or other contact details
    }
  }));

  res.status(200).json({
    success: true,
    data: {
      employee: {
        _id: employee._id,
        employeeId: employee.employeeId,
        position: employee.position
      },
      ratings: {
        average: averageRating,
        total: ratings.length,
        breakdown: {
          5: ratings.filter(r => r === 5).length,
          4: ratings.filter(r => r === 4).length,
          3: ratings.filter(r => r === 3).length,
          2: ratings.filter(r => r === 2).length,
          1: ratings.filter(r => r === 1).length
        }
      },
      recentFeedback: formattedFeedback
    }
  });
});

// Get employee's own performance summary
const getMyPerformance = catchAsync(async (req, res, next) => {
  // Find employee record for the logged-in user
  const employee = await Employee.findOne({ user: req.user._id });
  
  if (!employee) {
    return res.status(404).json({
      success: false,
      message: 'Employee record not found'
    });
  }

  const { period = 'month' } = req.query;
  const now = new Date();
  let startDate;

  switch (period) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  // Get bookings in the specified period
  const bookings = await Booking.find({
    'services.employee': employee._id,
    appointmentDate: { $gte: startDate },
    status: { $in: ['completed', 'confirmed'] }
  });

  // Calculate performance metrics
  const totalBookings = bookings.length;
  const completedBookings = bookings.filter(b => b.status === 'completed').length;
  const totalRevenue = bookings.reduce((sum, booking) => sum + booking.finalAmount, 0);
  const averageRating = employee.performance.ratings.average;

  // Get attendance for the period
  const attendance = await Attendance.find({
    employee: employee._id,
    date: { $gte: startDate }
  });

  const totalWorkingHours = attendance.reduce((sum, record) => sum + (record.workingHours || 0), 0);
  const attendanceRate = attendance.length > 0 
    ? Math.round((attendance.filter(a => a.checkIn && a.checkOut).length / attendance.length) * 100)
    : 0;

  res.status(200).json({
    success: true,
    data: {
      period,
      metrics: {
        totalBookings,
        completedBookings,
        completionRate: totalBookings > 0 ? Math.round((completedBookings / totalBookings) * 100) : 0,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        averageRating,
        totalWorkingHours: Math.round(totalWorkingHours * 100) / 100,
        attendanceRate
      }
    }
  });
});

// Get employee statistics (admin only)
const getEmployeeStats = catchAsync(async (req, res, next) => {
  // Get total employees
  const totalEmployees = await Employee.countDocuments();
  const activeEmployees = await Employee.countDocuments({ isActive: true });
  const inactiveEmployees = totalEmployees - activeEmployees;

  // Get employees by department
  const departmentStats = await Employee.aggregate([
    {
      $group: {
        _id: '$department',
        count: { $sum: 1 },
        avgSalary: { $avg: '$salary' }
      }
    }
  ]);

  // Get employees by position
  const positionStats = await Employee.aggregate([
    {
      $group: {
        _id: '$position',
        count: { $sum: 1 }
      }
    }
  ]);

  // Get recent hires (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentHires = await Employee.countDocuments({
    hireDate: { $gte: thirtyDaysAgo }
  });

  // Get average ratings
  const avgRating = await Employee.aggregate([
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$performance.ratings.average' }
      }
    }
  ]);

  res.status(200).json({
    success: true,
    data: {
      overview: {
        totalEmployees,
        activeEmployees,
        inactiveEmployees,
        recentHires,
        averageRating: avgRating[0]?.averageRating || 0
      },
      byDepartment: departmentStats,
      byPosition: positionStats
    }
  });
});

module.exports = {
  createEmployee,
  getAllEmployees,
  getEmployee,
  updateEmployee,
  deleteEmployee,
  getEmployeeSchedule,
  getEmployeePerformance,
  updateEmployeeAvailability,
  getAvailableEmployees,
  searchEmployees,
  getEmployeeStats,
  getMySchedule,
  getMyAttendance,
  checkIn,
  checkOut,
  getMyRatings,
  getMyPerformance
};

