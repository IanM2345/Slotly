import * as Sentry from '@sentry/nextjs';
import '@/sentry.server.config';

export function getNotificationTemplate(event, data = {}) {
  try {
    switch (event) {
      case 'BOOKING_CONFIRMED':
        return {
          title: 'Booking Confirmed',
          message: `Your booking at ${data.businessName ?? 'our venue'} is confirmed for ${formatTime(data.time)}.`,
        };

      case 'BOOKING_CANCELED':
        return {
          title: 'Booking Canceled',
          message: `Your booking at ${data.businessName ?? 'our venue'} has been canceled.`,
        };

      case 'PAYMENT_SUCCESS':
        return {
          title: 'Payment Received',
          message: `Your payment of KES ${data.amount ?? '0'} was successful. Booking ref: ${data.bookingId ?? 'N/A'}.`,
        };

      case 'COUPON_ASSIGNED':
        return {
          title: 'New Coupon Just for You!',
          message: `Use code ${data.code ?? 'XXXXXX'} to get ${formatDiscount(data)} off your next booking.`,
        };

      case 'COUPON_USED':
        return {
          title: 'Coupon Redeemed',
          message: `Coupon ${data.code ?? 'N/A'} has been redeemed by ${data.customerName ?? 'a user'}.`,
        };

      case 'REFERRAL_MILESTONE':
        return {
          title: 'Referral Reward Unlocked!',
          message: `You’ve referred ${data.count ?? 'multiple'} friends. A reward is coming your way!`,
        };

      case 'STAFF_APPLICATION':
        return {
          title: 'New Staff Application',
          message: `${data.staffName ?? 'Someone'} applied to join your business.`,
        };

      case 'STAFF_DECISION':
        return {
          title: `Application ${data.status ?? 'Reviewed'}`,
          message: `Your staff application at ${data.businessName ?? 'the business'} was ${safeLower(data.status)}.`,
        };

      case 'STAFF_ASSIGNED':
        return {
          title: 'You’ve Been Assigned a Service',
          message: `You’ve been assigned to ${data.serviceName ?? 'a service'} at ${data.businessName ?? 'the business'}.`,
        };

      case 'TIME_OFF_DECISION':
        return {
          title: `Time Off ${data.status ?? 'Decision'}`,
          message: `Your time off request from ${formatDate(data.startDate)} to ${formatDate(data.endDate)} was ${safeLower(data.status)}.`,
        };

      case 'BUSINESS_SUSPENDED':
        return {
          title: 'Business Suspended',
          message: `Your business ${data.businessName ?? ''} is suspended until ${formatDate(data.until)}.`,
        };

      case 'BUSINESS_UNSUSPENDED':
        return {
          title: 'Business Reinstated',
          message: `Your business ${data.businessName ?? ''} is now active again.`,
        };

      case 'REVIEW_FLAGGED':
        return {
          title: 'Flagged Review Alert',
          message: `A review for ${data.businessName ?? 'your business'} has been flagged for moderation.`,
        };

      case 'SUBSCRIPTION_REMINDER':
        return {
          title: 'Subscription Expiring Soon',
          message: `Your ${data.plan ?? 'current'} subscription ends on ${formatDate(data.endDate)}. Renew to avoid disruption.`,
        };

      default:
        Sentry.captureMessage(`Unknown notification event: ${event}`, {
          level: 'info',
          tags: { module: 'notification-template' },
        });

        return {
          title: 'Notification',
          message: 'You have a new update.',
        };
    }
  } catch (error) {
    Sentry.captureException(error, {
      tags: { module: 'notification-template', event },
      extra: { data },
    });

    return {
      title: 'Notification Error',
      message: 'We were unable to generate your message.',
    };
  }
}


function formatTime(date) {
  try {
    return new Date(date).toLocaleString('en-KE', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return 'a scheduled time';
  }
}

function formatDate(date) {
  try {
    return new Date(date).toLocaleDateString('en-KE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return 'a future date';
  }
}

function formatDiscount(data) {
  if (!data || typeof data.discount === 'undefined') return 'a discount';
  return data.isPercentage ? `${data.discount}%` : `KES ${data.discount}`;
}

function safeLower(value) {
  return typeof value === 'string' ? value.toLowerCase() : 'processed';
}
