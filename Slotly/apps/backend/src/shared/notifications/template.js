

export function getNotificationTemplate(event, data = {}) {
  switch (event) {
    case 'BOOKING_CONFIRMED':
      return {
        title: 'Booking Confirmed',
        message: `Your booking at ${data.businessName} is confirmed for ${formatTime(data.time)}.`,
      };

    case 'BOOKING_CANCELED':
      return {
        title: 'Booking Canceled',
        message: `Your booking at ${data.businessName} has been canceled.`,
      };

    case 'PAYMENT_SUCCESS':
      return {
        title: 'Payment Received',
        message: `Your payment of KES ${data.amount} was successful. Booking ref: ${data.bookingId}.`,
      };

    case 'COUPON_ASSIGNED':
      return {
        title: 'New Coupon Just for You!',
        message: `Use code ${data.code} to get ${formatDiscount(data)} off your next booking.`,
      };

    case 'COUPON_USED':
      return {
        title: 'Coupon Redeemed',
        message: `Coupon ${data.code} has been redeemed by ${data.customerName}.`,
      };

    case 'REFERRAL_MILESTONE':
      return {
        title: 'Referral Reward Unlocked!',
        message: `You’ve referred ${data.count} friends. A reward is coming your way!`,
      };

    case 'STAFF_APPLICATION':
      return {
        title: 'New Staff Application',
        message: `${data.staffName} applied to join your business.`,
      };

    case 'STAFF_DECISION':
      return {
        title: `Application ${data.status}`,
        message: `Your staff application at ${data.businessName} was ${data.status.toLowerCase()}.`,
      };

    case 'STAFF_ASSIGNED':
      return {
        title: 'You’ve Been Assigned a Service',
        message: `You’ve been assigned to ${data.serviceName} at ${data.businessName}.`,
      };

    case 'TIME_OFF_DECISION':
      return {
        title: `Time Off ${data.status}`,
        message: `Your time off request from ${formatDate(data.startDate)} to ${formatDate(data.endDate)} was ${data.status.toLowerCase()}.`,
      };

    case 'BUSINESS_SUSPENDED':
      return {
        title: 'Business Suspended',
        message: `Your business ${data.businessName} is suspended until ${formatDate(data.until)}.`,
      };

    case 'BUSINESS_UNSUSPENDED':
      return {
        title: 'Business Reinstated',
        message: `Your business ${data.businessName} is now active again.`,
      };

    case 'REVIEW_FLAGGED':
      return {
        title: 'Flagged Review Alert',
        message: `A review for ${data.businessName} has been flagged for moderation.`,
      };

    case 'SUBSCRIPTION_REMINDER':
      return {
        title: 'Subscription Expiring Soon',
        message: `Your ${data.plan} subscription ends on ${formatDate(data.endDate)}. Renew to avoid disruption.`,
      };

    default:
      return {
        title: 'Notification',
        message: 'You have a new update.',
      };
  }
}



function formatTime(date) {
  return new Date(date).toLocaleString('en-KE', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDiscount(data) {
  return data.isPercentage ? `${data.discount}%` : `KES ${data.discount}`;
}
