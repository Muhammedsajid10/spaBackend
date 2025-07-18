const Booking = require('../models/Booking');
const Service = require('../models/Service');
const Employee = require('../models/Employee');
const User = require('../models/User');
// const { apiUtils } = require('../utils/apiUtils');





// ========================================
// PUBLIC BOOKING CONTROLLERS (No Auth Required)
// ========================================

// Get available services for booking
const getAvailableServices = async (req, res) => {
  try {
    const services = await Service.find({ isActive: true })
      .select('name description price duration category isPopular')
      .sort({ isPopular: -1, name: 1 });

    res.json({
      success: true,
      results: services.length,
      data: { services }
    });
  } catch (error) {
    console.error('Error fetching available services:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available services'
    });
  }
};

// Get available professionals for a specific service and date
const getAvailableProfessionals = async (req, res) => {
  try {
    const { service, date } = req.query;

    console.log('getAvailableProfessionals called with:', req.query);

    if (!service || !date) {
      return res.status(400).json({
        success: false,
        message: 'Service ID and date are required'
      });
    }

    // First, get the service to check its category/type
    const serviceDoc = await Service.findById(service);
    if (!serviceDoc) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Find employees who can perform this type of service based on their specializations
    // For now, we'll get all active employees and filter by position/department
    const employees = await Employee.find({
      isActive: true
    })
    .populate('user', 'firstName lastName email')
    .select('user position employeeId specializations performance workSchedule department');

    console.log('Found employees:', employees.length);

    // Filter employees based on availability for the given date
    const availableEmployees = employees.filter(employee => {
      const dayOfWeek = new Date(date).getDay(); // 0 = Sunday, 1 = Monday, etc.
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[dayOfWeek];
      const schedule = employee.workSchedule[dayName];
      
      return schedule && schedule.isWorking;
    });

    console.log('Available employees:', availableEmployees.length);

    // Transform the data to only include necessary information for clients
    const professionals = availableEmployees.map(employee => ({
      _id: employee._id,
      user: {
        firstName: employee.user.firstName,
        lastName: employee.user.lastName
      },
      position: employee.position,
      employeeId: employee.employeeId,
      specializations: employee.specializations || [],
      performance: {
        ratings: employee.performance?.ratings || { average: 0, count: 0 }
      }
    }));
    
    res.json({
      success: true,
      results: professionals.length,
      data: { professionals }
    });
  } catch (error) {
    console.error('Error fetching available professionals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available professionals'
    });
  }
};

// Get available time slots for a professional
const getAvailableTimeSlots = async (req, res) => {
  try {
    const { employeeId, serviceId, date } = req.query;

    console.log('getAvailableTimeSlots called with:', req.query);

    if (!employeeId || !serviceId || !date) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID, service ID, and date are required'
      });
    }

    // Find the employee
    const employee = await Employee.findById(employeeId)
      .populate('user', 'firstName lastName');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Professional not found'
      });
    }

    console.log('Found employee:', employee.user.firstName, employee.user.lastName);

    // Get the service to know its duration
    const service = await Service.findById(serviceId);
    if (!service) {
    return res.status(404).json({
      success: false,
        message: 'Service not found'
      });
    }

    console.log('Found service:', service.name, 'Duration:', service.duration);

    // Get the day of week for the given date
    const dayOfWeek = new Date(date).getDay();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek];
    const schedule = employee.workSchedule[dayName];

    console.log('Day of week:', dayOfWeek, 'Day name:', dayName);
    console.log('Work schedule for this day:', schedule);

    if (!schedule || !schedule.isWorking) {
      console.log('Employee not working on this day');
      return res.json({
        success: true,
        results: 0,
        data: { timeSlots: [] }
      });
    }

    // Generate time slots based on work schedule
    const timeSlots = generateTimeSlots(schedule, service.duration, date);
    console.log('Generated time slots:', timeSlots.length);

    // Check for existing bookings and mark slots as unavailable
    const existingBookings = await Booking.find({
      employeeId: employeeId,
      date: date,
      status: { $in: ['confirmed', 'pending'] }
    });

    console.log('Existing bookings:', existingBookings.length);

    const availableSlots = timeSlots.map(slot => {
      const isBooked = existingBookings.some(booking => {
        const bookingStart = new Date(booking.startTime);
        const bookingEnd = new Date(booking.endTime);
        const slotStart = new Date(slot.startTime);
        const slotEnd = new Date(slot.endTime);
        
        return (slotStart < bookingEnd && slotEnd > bookingStart);
      });

      return {
        ...slot,
        available: !isBooked
      };
    }); 

    console.log('Available slots:', availableSlots.length);

    res.json({
      success: true,                              
      results: availableSlots.length,
      data: { timeSlots: availableSlots }
    });
  } catch (error) {
    console.error('Error fetching available time slots:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available time slots'
    });
  }
};

// Create booking confirmation (public)
const createBookingConfirmation = async (req, res) => {
  try {
    const { serviceId, employeeId, date, time, customerInfo } = req.body;

    // Validate required fields
    if (!serviceId || !employeeId || !date || !time || !customerInfo) {
      return res.status(400).json({
        success: false,
        message: 'Service ID, employee ID, date, time, and customer info are required'
      });
    }

    // Create a temporary booking confirmation
    const confirmation = {
      serviceId,
      employeeId,
      date,
      time,
      customerInfo,
      confirmationId: generateConfirmationId(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
    };

    // In a real app, you might save this to a temporary collection
    // For now, we'll just return the confirmation

    res.json({
      success: true,
      data: { confirmation }
    });
  } catch (error) {
    console.error('Error creating booking confirmation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create booking confirmation'
    });
  }
};

// ========================================
// AUTHENTICATED BOOKING CONTROLLERS
// ========================================

// Create booking
const createBooking = async (req, res) => {
  try {
    const { services, appointmentDate, notes, paymentMethod, client: clientData } = req.body;
    const adminId = req.user.id; // Admin creating the booking

    if (!services || !services.length) {
      return res.status(400).json({ message: 'At least one service is required' });
    }

    // Find or create the client user
    let clientUser;
    if (clientData && clientData.email) {
      clientUser = await User.findOne({ email: clientData.email });

      if (!clientUser) {
        // Create a new user for the client
        let firstName = '';
        let lastName = '';
        if (clientData.name) {
          const parts = clientData.name.split(' ');
          firstName = parts[0];
          lastName = parts.slice(1).join(' ');
        } else {
          firstName = clientData.firstName || '';
          lastName = clientData.lastName || '';
        }

        clientUser = new User({
          firstName,
          lastName,
          email: clientData.email,
          phone: clientData.phone,
          password: 'defaultPassword123', // A temporary default password
          role: 'client',
          isVerified: true, // Or false, depending on your flow
        });
        await clientUser.save();
      }
    } else {
      // If no client data, maybe default to the admin or throw error
      return res.status(400).json({ message: 'Client information is required' });
    }

    const totalAmount = services.reduce((acc, s) => acc + (s.price || 0), 0);
    const totalDuration = services.reduce((acc, s) => acc + (s.duration || 0), 0);

    const newBooking = new Booking({
      client: clientUser._id,
      services,
      appointmentDate,
      totalAmount: totalAmount,
      totalDuration: totalDuration,
      paymentMethod,
      status: 'confirmed',
      notes,
      bookedBy: adminId,
    });

    // Ensure finalAmount is set (pre-save will also calculate it, but set here for validation)
    if (!newBooking.finalAmount) {
      newBooking.finalAmount = newBooking.totalAmount - (newBooking.discountAmount || 0) + (newBooking.taxAmount || 0);
    }

    // Ensure bookingNumber is set (in case pre-save hook is not triggered)
    if (!newBooking.bookingNumber) {
      const date = new Date();
      const year = date.getFullYear().toString().slice(-2);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      // Find the last booking of the day
      const lastBooking = await Booking.findOne({
        bookingNumber: new RegExp(`^BK${year}${month}${day}`)
      }).sort({ bookingNumber: -1 });
      let sequence = 1;
      if (lastBooking) {
        const lastSequence = parseInt(lastBooking.bookingNumber.slice(-4));
        sequence = lastSequence + 1;
      }
      newBooking.bookingNumber = `BK${year}${month}${day}${sequence.toString().padStart(4, '0')}`;
    }

    await newBooking.save();

    const populatedBooking = await Booking.findById(newBooking._id)
      .populate('client', 'firstName lastName email phone')
      .populate({
        path: 'services.service',
        model: 'Service',
      })
      .populate({
        path: 'services.employee',
        model: 'Employee',
        populate: {
          path: 'user',
          model: 'User',
          select: 'firstName lastName',
        },
      });

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: { booking: populatedBooking },
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// Get user's bookings
const getUserBookings = async (req, res) => {
  try {
    const userId = req.user._id;
    const bookings = await Booking.find({ client: userId })
      .populate('services.service', 'name price duration')
      .populate('services.employee', 'user position')
      .sort({ appointmentDate: -1 });

    res.json({
      success: true,
      results: bookings.length,
      data: { bookings }
    });
  } catch (error) {
    console.error('Error fetching user bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings'
    });
  }
};

// Get specific booking
const getBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const booking = await Booking.findOne({ _id: id, client: userId })
      .populate('services.service', 'name price duration')
      .populate('services.employee', 'user position');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.json({
      success: true,
      data: { booking }
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking'
    });
  }
};

// Cancel booking
const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const booking = await Booking.findOneAndUpdate(
      { _id: id, client: userId },
      { status: 'cancelled' },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.json({
      success: true,
      data: { booking }
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel booking'
    });
  }
};

// Reschedule booking
const rescheduleBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { newDateTime } = req.body;
    const userId = req.user._id;

    const booking = await Booking.findOneAndUpdate(
      { _id: id, client: userId },
      { 
        date: new Date(newDateTime),
        startTime: new Date(newDateTime),
        endTime: new Date(new Date(newDateTime).getTime() + 60 * 60 * 1000) // Add 1 hour
      },
      { new: true }
    );

  if (!booking) {
    return res.status(404).json({
      success: false,
        message: 'Booking not found'
      });
    }

    res.json({
      success: true,
      data: { booking }
    });
  } catch (error) {
    console.error('Error rescheduling booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reschedule booking'
    });
  }
};

// Complete booking after authentication
const completeBooking = async (req, res) => {
  try {
    const { confirmationId } = req.body;
    const userId = req.user._id;

    // In a real app, you would validate the confirmation and create the actual booking
    // For now, we'll just return success

    res.json({
    success: true,
      message: 'Booking completed successfully'
    });
  } catch (error) {
    console.error('Error completing booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete booking'
    });
  }
};

// ========================================
// ADMIN BOOKING CONTROLLERS
// ========================================

// Get all bookings (admin only)
const getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('client', 'firstName lastName email')
      .populate('services.service', 'name price')
      .populate({
        path: 'services.employee',
        select: 'employeeId user',
        populate: {
          path: 'user',
          select: 'firstName lastName'
        }
      })
      .sort({ appointmentDate: -1 });

    res.json({
      success: true,
      results: bookings.length,
      data: { bookings }
    });
  } catch (error) {
    console.error('Error fetching all bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings'
    });
  }
};

// Update booking (admin only)
const updateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const booking = await Booking.findByIdAndUpdate(id, updateData, { new: true });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.json({
    success: true,
      data: { booking }
    });
  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update booking'
    });
  }
};

// ========================================
// HELPER FUNCTIONS
// ========================================

// Generate time slots based on work schedule
const generateTimeSlots = (schedule, serviceDuration, date) => {
  const slots = [];
  const startTime = new Date(`${date}T${schedule.startTime}`);
  const endTime = new Date(`${date}T${schedule.endTime}`);

  let currentTime = new Date(startTime);
  
  while (currentTime < endTime) {
    const slotEnd = new Date(currentTime.getTime() + serviceDuration * 60 * 1000);
    
    if (slotEnd <= endTime) {
      slots.push({
        startTime: currentTime.toISOString(),
        endTime: slotEnd.toISOString(),
        available: true
      });
    }

    currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000); // 30-minute intervals
  }
  
  return slots;
};

// Generate confirmation ID
const generateConfirmationId = () => {
  return 'CONF_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

module.exports = {
  // Public routes
  getAvailableServices,
  getAvailableProfessionals,
  getAvailableTimeSlots,
  createBookingConfirmation,
  
  // Authenticated routes
  createBooking,
  getUserBookings,
  getBooking,
  cancelBooking,
  rescheduleBooking,
  completeBooking,
  
  // Admin routes
  getAllBookings,
  updateBooking
};

