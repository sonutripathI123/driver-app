from enum import Enum


class UserRole(str, Enum):
    """Role-Based Access Control (RBAC) System Roles."""
    ADMIN = "ADMIN"
    OPERATIONS_MANAGER = "OPERATIONS_MANAGER"
    DISPATCHER = "DISPATCHER"
    ACCOUNTANT = "ACCOUNTANT"
    DRIVER = "DRIVER"
    CUSTOMER = "CUSTOMER"


class BookingSource(str, Enum):
    """Origination channel for a booking."""
    WEBSITE = "WEBSITE"
    BOOKING_WIDGET = "BOOKING_WIDGET"
    INSTANT_QUOTE = "INSTANT_QUOTE"
    PHONE = "PHONE"
    EMAIL = "EMAIL"
    MANUAL = "MANUAL"
    APP = "APP"
    PARTNER = "PARTNER"


class BookingStatus(str, Enum):
    """Central Master Booking Lifecycle Statuses."""
    DRAFT = "DRAFT"
    ENQUIRY = "ENQUIRY"
    QUOTED = "QUOTED"
    VERIFICATION_REQUIRED = "VERIFICATION_REQUIRED"
    PAYMENT_PENDING = "PAYMENT_PENDING"
    CONFIRMED = "CONFIRMED"
    ALLOCATED = "ALLOCATED"
    DISPATCHED = "DISPATCHED"
    EN_ROUTE = "EN_ROUTE"
    ARRIVED = "ARRIVED"
    PICKED_UP = "PICKED_UP"
    COMPLETED = "COMPLETED"
    FINANCIALLY_CLOSED = "FINANCIALLY_CLOSED"
    CANCELLED = "CANCELLED"
    REFUND_PENDING = "REFUND_PENDING"
    REFUNDED = "REFUNDED"


class LegStatus(str, Enum):
    """Operational status for individual journey legs."""
    PENDING = "PENDING"
    ALLOCATED = "ALLOCATED"
    DISPATCHED = "DISPATCHED"
    EN_ROUTE = "EN_ROUTE"
    ARRIVED = "ARRIVED"
    PICKED_UP = "PICKED_UP"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class PaymentStatus(str, Enum):
    """Payment state of the central booking."""
    UNPAID = "UNPAID"
    PARTIAL_DEPOSIT = "PARTIAL_DEPOSIT"
    PAID_IN_FULL = "PAID_IN_FULL"
    OVERDUE = "OVERDUE"
    REFUND_PENDING = "REFUND_PENDING"
    REFUNDED = "REFUNDED"
    PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED"


class VerificationStatus(str, Enum):
    """Security verification status for short-notice/high-value bookings."""
    NOT_REQUIRED = "NOT_REQUIRED"
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    FAILED = "FAILED"


class DriverStatus(str, Enum):
    """Operational availability status of a driver."""
    AVAILABLE = "AVAILABLE"
    ON_TRIP = "ON_TRIP"
    OFF_DUTY = "OFF_DUTY"
    SUSPENDED = "SUSPENDED"


class VehicleCategory(str, Enum):
    """Fleet vehicle classification categories."""
    SEDAN_EXECUTIVE = "SEDAN_EXECUTIVE"
    SEDAN_PREMIUM = "SEDAN_PREMIUM"
    SUV_PREMIUM = "SUV_PREMIUM"
    PEOPLE_MOVER = "PEOPLE_MOVER"
    MINIBUS = "MINIBUS"


class AuditAction(str, Enum):
    """Types of tracked entity actions in audit logging."""
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    STATUS_CHANGE = "STATUS_CHANGE"
    ALLOCATION = "ALLOCATION"
    PAYMENT = "PAYMENT"
    CANCELLATION = "CANCELLATION"
    REFUND = "REFUND"


class InvoiceStatus(str, Enum):
    """Tax Invoice Statuses."""
    DRAFT = "DRAFT"
    ISSUED = "ISSUED"
    PAID = "PAID"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    OVERDUE = "OVERDUE"
    VOID = "VOID"
    CREDITED = "CREDITED"


class PayoutBatchStatus(str, Enum):
    """Driver RCTI Payout Batch Lifecycle Status."""
    DRAFT = "DRAFT"
    APPROVED = "APPROVED"
    DISBURSED = "DISBURSED"
    VOID = "VOID"

