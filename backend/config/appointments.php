<?php

/*
| Booking rules for the parishioner Book Appointment page. Times are in the
| parish's local time (app.parish_timezone). A slot is taken when a Pending or
| Approved appointment overlaps it at the same venue type; for a Chapel venue
| only appointments at the same chapel count.
*/

return [
    // Extendable: add a type here and to the frontend's list.
    'event_types' => ['Mass Intention', 'House Blessing', 'Wedding Pre-interview', 'General Counseling'],

    // Start times offered per venue type (24-hour "HH:MM").
    'slots' => [
        'Parish Church' => ['08:00', '09:30', '11:00', '14:00', '15:30'],
        'Chapel' => ['09:00', '13:00', '15:00', '17:00'],
        'Home' => ['09:00', '10:30', '13:00', '15:00', '16:30'],
    ],

    'duration_minutes' => (int) env('APPOINTMENT_DURATION_MINUTES', 60),

    // Bookable from this many days after today through booking_window_days after today.
    'min_notice_days' => (int) env('APPOINTMENT_MIN_NOTICE_DAYS', 1),
    'booking_window_days' => (int) env('APPOINTMENT_BOOKING_WINDOW_DAYS', 60),
];
